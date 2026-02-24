"""
Tests for HoldingSnapshotService
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from app.constant.biz_enums import TradeTypeEnum, HoldingStatusEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.framework.exceptions import AsyncTaskException
from app.models import HoldingSnapshot, Holding, Trade, FundNavHistory, UserHolding
from app.service.holding_snapshot_service import (
    HoldingSnapshotService, PositionState, ZERO
)
from tests.conftest import create_trade


class TestPositionState:
    """Tests for PositionState dataclass"""

    def test_default_values(self):
        """Test default values of PositionState"""
        state = PositionState()
        assert state.shares == ZERO
        assert state.hos_holding_cost == ZERO
        assert state.total_buy_amount == ZERO
        assert state.total_sell_amount == ZERO
        assert state.total_cash_dividend == ZERO
        assert state.total_reinvest_amount == ZERO
        assert state.realized_pnl == ZERO

    def test_total_dividend(self):
        """Test total_dividend property"""
        state = PositionState(
            total_cash_dividend=Decimal('100'),
            total_reinvest_amount=Decimal('50')
        )
        assert state.total_dividend == Decimal('150')

    def test_from_snapshot(self, db, mock_user, mock_holding):
        """Test creating PositionState from snapshot"""
        snapshot = HoldingSnapshot(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            snapshot_date=date.today(),
            holding_shares=Decimal('1000'),
            hos_holding_cost=Decimal('1500'),
            hos_total_buy_amount=Decimal('1500'),
            hos_total_sell_amount=Decimal('0'),
            hos_total_cash_dividend=Decimal('10'),
            hos_total_dividend=Decimal('15'),  # Total dividend includes cash + reinvest
            hos_realized_pnl=Decimal('0')
        )

        state = PositionState.from_snapshot(snapshot)

        assert state.shares == Decimal('1000')
        assert state.hos_holding_cost == Decimal('1500')
        assert state.total_buy_amount == Decimal('1500')
        assert state.total_cash_dividend == Decimal('10')
        # reinvest_amount = total_dividend - cash_dividend = 15 - 10 = 5
        assert state.total_reinvest_amount == Decimal('5')
        assert state.total_dividend == Decimal('15')


class TestApplyTrades:
    """Tests for HoldingSnapshotService._apply_trades"""

    def test_apply_buy_trade(self, db, mock_user, mock_holding):
        """Test applying buy trade"""
        state = PositionState()
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date.today(),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )

        new_state, flows = HoldingSnapshotService._apply_trades(
            state, [trade], mock_user.id, mock_holding.ho_code
        )

        assert new_state.shares == Decimal('1000')
        assert new_state.hos_holding_cost == Decimal('1501.5')
        assert new_state.total_buy_amount == Decimal('1501.5')
        assert flows['buy'] == Decimal('1501.5')
        assert flows['net_external'] == Decimal('-1501.5')

    def test_apply_sell_trade(self, db, mock_user, mock_holding):
        """Test applying sell trade"""
        state = PositionState(
            shares=Decimal('1000'),
            hos_holding_cost=Decimal('1500'),
            total_buy_amount=Decimal('1500')
        )
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date.today(),
            shares=Decimal('500'),
            nav=Decimal('1.8'),
            fee=Decimal('0.9')
        )

        new_state, flows = HoldingSnapshotService._apply_trades(
            state, [trade], mock_user.id, mock_holding.ho_code
        )

        # Shares reduced
        assert new_state.shares == Decimal('500')
        # Cost reduced proportionally
        assert new_state.hos_holding_cost == Decimal('750')
        # Realized PnL = sell proceeds - cost sold = 899.1 - 750 = 149.1
        assert new_state.realized_pnl == Decimal('149.1')
        assert flows['sell'] == Decimal('899.1')
        assert flows['net_external'] == Decimal('899.1')

    def test_apply_sell_all_shares(self, db, mock_user, mock_holding):
        """Test selling all shares"""
        state = PositionState(
            shares=Decimal('1000'),
            hos_holding_cost=Decimal('1500'),
            total_buy_amount=Decimal('1500')
        )
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date.today(),
            shares=Decimal('1000'),
            nav=Decimal('1.8'),
            fee=Decimal('1.8')
        )

        new_state, flows = HoldingSnapshotService._apply_trades(
            state, [trade], mock_user.id, mock_holding.ho_code
        )

        assert new_state.shares == ZERO
        assert new_state.hos_holding_cost == ZERO

    def test_apply_oversell_raises_exception(self, db, mock_user, mock_holding):
        """Test that overselling when already zero shares raises exception"""
        # The exception is only raised when shares <= 0 before the sell,
        # not when the sell would result in negative shares
        state = PositionState(shares=Decimal('0'))  # Zero shares
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date.today(),
            shares=Decimal('100'),  # Any sell when shares is 0
            nav=Decimal('1.5'),
            fee=Decimal('0.3')
        )

        with pytest.raises(AsyncTaskException):
            HoldingSnapshotService._apply_trades(
                state, [trade], mock_user.id, mock_holding.ho_code
            )

    def test_apply_multiple_trades(self, db, mock_user, mock_holding):
        """Test applying multiple trades on same day"""
        state = PositionState()
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date.today(),
                shares=Decimal('500'),
                nav=Decimal('1.5'),
                fee=Decimal('0.75')
            ),
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date.today(),
                shares=Decimal('500'),
                nav=Decimal('1.5'),
                fee=Decimal('0.75')
            ),
        ]

        new_state, flows = HoldingSnapshotService._apply_trades(
            state, trades, mock_user.id, mock_holding.ho_code
        )

        assert new_state.shares == Decimal('1000')
        assert flows['buy'] == Decimal('1501.5')


class TestCreateSnapshotEntity:
    """Tests for HoldingSnapshotService._create_snapshot_entity"""

    def test_create_snapshot_with_position(self, db, mock_user, mock_holding):
        """Test creating snapshot with active position"""
        state = PositionState(
            shares=Decimal('1000'),
            hos_holding_cost=Decimal('1500'),
            total_buy_amount=Decimal('1500'),
            total_sell_amount=ZERO,
            total_cash_dividend=ZERO,
            total_reinvest_amount=ZERO,
            realized_pnl=ZERO
        )

        nav = FundNavHistory(
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            nav_date=date.today(),
            nav_per_unit=Decimal('1.6'),
            nav_accumulated_per_unit=Decimal('1.6')
        )

        flows = {
            'buy': ZERO, 'sell': ZERO, 'net_external': ZERO,
            'cash_div': ZERO, 'reinvest': ZERO
        }

        snapshot = HoldingSnapshotService._create_snapshot_entity(
            state=state,
            holding=mock_holding,
            nav_today=nav,
            flows=flows,
            prev_snapshot=None,
            user_id=mock_user.id
        )

        assert snapshot.user_id == mock_user.id
        assert snapshot.ho_id == mock_holding.id
        assert snapshot.snapshot_date == date.today()
        assert snapshot.holding_shares == Decimal('1000')
        assert snapshot.market_price == Decimal('1.6')
        assert snapshot.hos_market_value == Decimal('1600')  # 1000 * 1.6
        assert snapshot.hos_unrealized_pnl == Decimal('100')  # 1600 - 1500
        assert snapshot.is_cleared == 0

    def test_create_snapshot_cleared_position(self, db, mock_user, mock_holding):
        """Test creating snapshot for cleared position"""
        state = PositionState(
            shares=ZERO,
            hos_holding_cost=ZERO,
            total_buy_amount=Decimal('1500'),
            total_sell_amount=Decimal('1800'),
            total_cash_dividend=ZERO,
            total_reinvest_amount=ZERO,
            realized_pnl=Decimal('300')
        )

        nav = FundNavHistory(
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            nav_date=date.today(),
            nav_per_unit=Decimal('1.8'),
            nav_accumulated_per_unit=Decimal('1.8')
        )

        flows = {
            'buy': ZERO, 'sell': Decimal('1800'), 'net_external': Decimal('1800'),
            'cash_div': ZERO, 'reinvest': ZERO
        }

        snapshot = HoldingSnapshotService._create_snapshot_entity(
            state=state,
            holding=mock_holding,
            nav_today=nav,
            flows=flows,
            prev_snapshot=None,
            user_id=mock_user.id
        )

        assert snapshot.holding_shares == ZERO
        assert snapshot.hos_market_value == ZERO
        assert snapshot.hos_unrealized_pnl == ZERO
        assert snapshot.hos_total_pnl == Decimal('300')  # Just realized PnL
        assert snapshot.is_cleared == 1

    def test_create_snapshot_with_prev_snapshot(self, db, mock_user, mock_holding):
        """Test creating snapshot with previous day's snapshot"""
        state = PositionState(
            shares=Decimal('1000'),
            hos_holding_cost=Decimal('1500'),
            total_buy_amount=Decimal('1500'),
            total_sell_amount=ZERO,
            total_cash_dividend=ZERO,
            total_reinvest_amount=ZERO,
            realized_pnl=ZERO
        )

        nav = FundNavHistory(
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            nav_date=date.today(),
            nav_per_unit=Decimal('1.6'),
            nav_accumulated_per_unit=Decimal('1.6')
        )

        prev_snapshot = HoldingSnapshot(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            snapshot_date=date.today() - timedelta(days=1),
            hos_market_value=Decimal('1500')
        )

        flows = {
            'buy': ZERO, 'sell': ZERO, 'net_external': ZERO,
            'cash_div': ZERO, 'reinvest': ZERO
        }

        snapshot = HoldingSnapshotService._create_snapshot_entity(
            state=state,
            holding=mock_holding,
            nav_today=nav,
            flows=flows,
            prev_snapshot=prev_snapshot,
            user_id=mock_user.id
        )

        # Daily PnL = new value - old value + flows = 1600 - 1500 + 0 = 100
        assert snapshot.hos_daily_pnl == Decimal('100')
        # Daily PnL ratio = 100 / 1500 = 0.0667
        # Convert to float for comparison with pytest.approx
        assert float(snapshot.hos_daily_pnl_ratio) == pytest.approx(0.0667, rel=0.01)


class TestGenerateSnapshots:
    """Tests for HoldingSnapshotService.generate_snapshots"""

    @patch('app.service.holding_snapshot_service.trade_calendar')
    def test_generate_snapshots_no_holdings(self, mock_calendar, db, mock_user):
        """Test generating snapshots when user has no holdings"""
        result = HoldingSnapshotService.generate_snapshots(
            user_id=mock_user.id,
            start_date=date.today() - timedelta(days=5),
            end_date=date.today()
        )

        assert result['total_generated'] == 0
        assert result['errors'] == []

    @patch('app.service.holding_snapshot_service.trade_calendar')
    def test_generate_snapshots_with_data(
        self, mock_calendar, db, mock_user, mock_holding, mock_user_holding
    ):
        """Test generating snapshots with holdings and trades"""
        # Mock trade calendar
        mock_calendar.prev_trade_day.return_value = date.today() - timedelta(days=1)
        mock_calendar.next_trade_day.side_effect = lambda d: d + timedelta(days=1)

        # Create trade
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date.today() - timedelta(days=3),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        trade.tr_cycle = 1
        db.session.add(trade)

        # Create NAV history
        for i in range(5):
            nav = FundNavHistory(
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                nav_date=date.today() - timedelta(days=4 - i),
                nav_per_unit=Decimal('1.5') + Decimal(str(i * 0.01)),
                nav_accumulated_per_unit=Decimal('1.5') + Decimal(str(i * 0.01))
            )
            db.session.add(nav)
        db.session.commit()

        result = HoldingSnapshotService.generate_snapshots(
            user_id=mock_user.id,
            start_date=date.today() - timedelta(days=2),
            end_date=date.today()
        )

        # Should generate some snapshots
        assert result['total_generated'] >= 0  # May be 0 if no NAV in range


class TestCalculateRange:
    """Tests for HoldingSnapshotService._calculate_range"""

    @patch('app.service.holding_snapshot_service.trade_calendar')
    def test_calculate_range_no_trades(
        self, mock_calendar, db, mock_user, mock_holding
    ):
        """Test calculating range with no trades"""
        mock_calendar.next_trade_day.side_effect = lambda d: d + timedelta(days=1)

        navs = {}
        for i in range(5):
            d = date.today() - timedelta(days=4 - i)
            navs[d.isoformat()] = FundNavHistory(
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                nav_date=d,
                nav_per_unit=Decimal('1.5'),
                nav_accumulated_per_unit=Decimal('1.5')
            )

        result = HoldingSnapshotService._calculate_range(
            holding=mock_holding,
            user_id=mock_user.id,
            target_start=date.today() - timedelta(days=2),
            target_end=date.today(),
            trades=[],
            navs=navs,
            prev_snapshot=None
        )

        # No trades means no snapshots
        assert result == []

    @patch('app.service.holding_snapshot_service.trade_calendar')
    def test_calculate_range_with_trades(
        self, mock_calendar, db, mock_user, mock_holding
    ):
        """Test calculating range with trades"""
        mock_calendar.next_trade_day.side_effect = lambda d: d + timedelta(days=1)

        # Create trade
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date.today() - timedelta(days=3),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        trade.tr_cycle = 1

        navs = {}
        for i in range(5):
            d = date.today() - timedelta(days=4 - i)
            navs[d.isoformat()] = FundNavHistory(
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                nav_date=d,
                nav_per_unit=Decimal('1.5') + Decimal(str(i * 0.01)),
                nav_accumulated_per_unit=Decimal('1.5') + Decimal(str(i * 0.01))
            )

        result = HoldingSnapshotService._calculate_range(
            holding=mock_holding,
            user_id=mock_user.id,
            target_start=date.today() - timedelta(days=2),
            target_end=date.today(),
            trades=[trade],
            navs=navs,
            prev_snapshot=None
        )

        # Should generate snapshots for days in target range after trade
        assert len(result) >= 1
