"""
Tests for TradeService
"""
import json
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from app.constant.biz_enums import TradeTypeEnum, HoldingStatusEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.framework.exceptions import BizException
from app.models import Trade, Holding, UserHolding
from app.service.trade_service import TradeService
from tests.conftest import create_trade


class TestTradeServiceListTrade:
    """Tests for TradeService.list_trade"""

    def test_list_trade_empty(self, db, mock_user):
        """Test listing trades when no trades exist"""
        result = TradeService.list_trade(ho_code=None)
        assert result == []

    def test_list_trade_with_trades(self, db, mock_user, mock_holding, mock_trade):
        """Test listing trades with existing trades"""
        result = TradeService.list_trade(ho_code=None)
        assert len(result) == 1
        assert result[0]['ho_code'] == '000001'
        assert result[0]['tr_type'] == TradeTypeEnum.BUY.value

    def test_list_trade_filter_by_ho_code(self, db, mock_user, mock_holding, mock_trade):
        """Test filtering trades by ho_code"""
        result = TradeService.list_trade(ho_code='000001')
        assert len(result) == 1

        result = TradeService.list_trade(ho_code='999999')
        assert len(result) == 0


class TestTradeServiceCalculatePosition:
    """Tests for TradeService.calculate_position"""

    def test_calculate_position_buy_only(self, db, mock_user, mock_holding):
        """Test position calculation with buy trades only"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 1),
                shares=Decimal('1000'),
                nav=Decimal('1.5'),
                fee=Decimal('1.5')
            ),
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 15),
                shares=Decimal('500'),
                nav=Decimal('1.6'),
                fee=Decimal('0.8')
            ),
        ]

        total_shares, total_cost = TradeService.calculate_position(trades)

        assert total_shares == 1500.0
        # Total cost = (1500 + 1.5) + (800 + 0.8) = 1501.5 + 800.8 = 2302.3
        assert total_cost == pytest.approx(2302.3, rel=0.01)

    def test_calculate_position_with_sell(self, db, mock_user, mock_holding):
        """Test position calculation with buy and sell trades"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 1),
                shares=Decimal('1000'),
                nav=Decimal('1.5'),
                fee=Decimal('1.5')
            ),
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.SELL.value,
                tr_date=date(2024, 2, 1),
                shares=Decimal('400'),
                nav=Decimal('1.8'),
                fee=Decimal('0.72')
            ),
        ]

        total_shares, total_cost = TradeService.calculate_position(trades)

        # Shares = 1000 - 400 = 600
        assert total_shares == 600.0
        # Cost = 1501.5 - (400 * 1.5015) = 1501.5 - 600.6 = 900.9
        assert total_cost == pytest.approx(900.9, rel=0.01)

    def test_calculate_position_sell_all(self, db, mock_user, mock_holding):
        """Test position calculation when selling all shares"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 1),
                shares=Decimal('1000'),
                nav=Decimal('1.5'),
                fee=Decimal('1.5')
            ),
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.SELL.value,
                tr_date=date(2024, 2, 1),
                shares=Decimal('1000'),
                nav=Decimal('1.8'),
                fee=Decimal('1.8')
            ),
        ]

        total_shares, total_cost = TradeService.calculate_position(trades)

        assert total_shares == 0.0
        assert total_cost == pytest.approx(0.0, abs=0.01)

    def test_calculate_position_empty_list(self, db):
        """Test position calculation with empty trade list"""
        total_shares, total_cost = TradeService.calculate_position([])
        assert total_shares == 0.0
        assert total_cost == 0.0


class TestTradeServiceListUncleared:
    """Tests for TradeService.list_uncleared"""

    def test_list_uncleared_no_trades(self, db, mock_holding):
        """Test listing uncleared trades when no trades exist"""
        trades, cycle = TradeService.list_uncleared(mock_holding, HoldingStatusEnum.CLOSED.value)
        assert trades == []
        assert cycle == 1

    def test_list_uncleared_with_trades(self, db, mock_user, mock_holding, mock_user_holding):
        """Test listing uncleared trades with existing trades"""
        # Create some trades
        for i in range(3):
            trade = create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 1) + timedelta(days=i),
                shares=Decimal('100'),
                nav=Decimal('1.5'),
                fee=Decimal('0.15')
            )
            trade.tr_cycle = 1
            db.session.add(trade)
        db.session.commit()

        trades, cycle = TradeService.list_uncleared(mock_holding, HoldingStatusEnum.HOLDING.value)

        assert len(trades) == 3
        assert cycle == 1

    def test_list_uncleared_closed_position(self, db, mock_user, mock_holding, mock_user_holding, mock_trades_buy_sell):
        """Test listing uncleared trades for closed position"""
        # After buy + sell cycle
        trades, cycle = TradeService.list_uncleared(mock_holding, HoldingStatusEnum.CLOSED.value)

        # Should return empty and next cycle
        assert trades == []
        assert cycle == 2


class TestTradeServiceCreateTransaction:
    """Tests for TradeService.create_transaction"""

    @patch('app.service.trade_service.trade_calendar.is_trade_day')
    def test_create_transaction_success(self, mock_is_trade_day, db, mock_user, mock_holding, mock_user_holding):
        """Test successful transaction creation"""
        mock_is_trade_day.return_value = True

        new_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )

        result = TradeService.create_transaction(new_trade)

        assert result is True

        # Verify trade was saved
        saved_trade = Trade.query.filter_by(ho_code='000001').first()
        assert saved_trade is not None
        assert saved_trade.tr_shares == Decimal('1000.00')

    @patch('app.service.trade_service.trade_calendar.is_trade_day')
    def test_create_transaction_non_trade_day(self, mock_is_trade_day, db, mock_user, mock_holding, mock_user_holding):
        """Test transaction creation on non-trade day"""
        mock_is_trade_day.return_value = False

        new_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),  # A Monday might not be a trade day
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )

        with pytest.raises(BizException):
            TradeService.create_transaction(new_trade)

    def test_create_transaction_missing_ho_id(self, db, mock_user):
        """Test transaction creation without ho_id"""
        new_trade = Trade(
            user_id=mock_user.id,
            ho_code='NONEXISTENT',
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),
            tr_shares=Decimal('1000'),
            tr_nav_per_unit=Decimal('1.5'),
            tr_amount=Decimal('1500'),
            tr_fee=Decimal('1.5'),
            cash_amount=Decimal('1501.5')
        )

        with pytest.raises(BizException):
            TradeService.create_transaction(new_trade)


class TestTradeServiceRecalculateHoldingTrades:
    """Tests for TradeService.recalculate_holding_trades"""

    def test_recalculate_single_buy(self, db, mock_user, mock_holding, mock_user_holding):
        """Test recalculation with single buy trade"""
        # Create a buy trade
        trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        db.session.add(trade)
        db.session.commit()

        TradeService.recalculate_holding_trades(mock_holding.id, mock_user.id)

        # Verify trade cycle is 1
        saved_trade = Trade.query.filter_by(ho_id=mock_holding.id).first()
        assert saved_trade.tr_cycle == 1
        assert saved_trade.is_cleared == GlobalYesOrNo.NO

    def test_recalculate_buy_sell_cycle(self, db, mock_user, mock_holding, mock_user_holding):
        """Test recalculation with buy then sell (clearing position)"""
        # Buy trade
        buy_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        db.session.add(buy_trade)
        db.session.commit()

        # Sell trade (sell all)
        sell_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date(2024, 2, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.8'),
            fee=Decimal('1.8')
        )
        db.session.add(sell_trade)
        db.session.commit()

        TradeService.recalculate_holding_trades(mock_holding.id, mock_user.id)

        # Verify sell trade is marked as cleared
        trades = Trade.query.filter_by(ho_id=mock_holding.id).order_by(Trade.tr_date).all()
        assert trades[0].tr_cycle == 1
        assert trades[1].tr_cycle == 1
        assert trades[1].is_cleared == GlobalYesOrNo.YES

    def test_recalculate_multiple_cycles(self, db, mock_user, mock_holding, mock_user_holding):
        """Test recalculation with multiple buy-sell cycles"""
        # First cycle: Buy then Sell
        buy1 = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 10),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        sell1 = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date(2024, 1, 20),
            shares=Decimal('1000'),
            nav=Decimal('1.6'),
            fee=Decimal('1.6')
        )

        # Second cycle: Buy again
        buy2 = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 2, 1),
            shares=Decimal('500'),
            nav=Decimal('1.7'),
            fee=Decimal('0.85')
        )

        db.session.add_all([buy1, sell1, buy2])
        db.session.commit()

        TradeService.recalculate_holding_trades(mock_holding.id, mock_user.id)

        trades = Trade.query.filter_by(ho_id=mock_holding.id).order_by(Trade.tr_date).all()
        assert trades[0].tr_cycle == 1  # buy1
        assert trades[1].tr_cycle == 1  # sell1 (cleared)
        assert trades[1].is_cleared == GlobalYesOrNo.YES
        assert trades[2].tr_cycle == 2  # buy2 (new cycle)

    def test_recalculate_oversold_raises_exception(self, db, mock_user, mock_holding, mock_user_holding):
        """Test that overselling raises exception"""
        # Try to sell without buying first
        sell_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.SELL.value,
            tr_date=date(2024, 1, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.8'),
            fee=Decimal('1.8')
        )
        db.session.add(sell_trade)
        db.session.commit()

        with pytest.raises(BizException):
            TradeService.recalculate_holding_trades(mock_holding.id, mock_user.id)

    def test_recalculate_updates_user_holding_status(self, db, mock_user, mock_holding, mock_user_holding):
        """Test that recalculation updates UserHolding status"""
        # Buy trade
        buy_trade = create_trade(
            user_id=mock_user.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            tr_type=TradeTypeEnum.BUY.value,
            tr_date=date(2024, 1, 15),
            shares=Decimal('1000'),
            nav=Decimal('1.5'),
            fee=Decimal('1.5')
        )
        db.session.add(buy_trade)
        db.session.commit()

        TradeService.recalculate_holding_trades(mock_holding.id, mock_user.id)

        # Verify UserHolding status is HOLDING
        uh = UserHolding.query.filter_by(user_id=mock_user.id, ho_id=mock_holding.id).first()
        assert uh.ho_status == HoldingStatusEnum.HOLDING.value


class TestTradeServiceImportTrade:
    """Tests for TradeService.import_trade"""

    def test_import_single_trade(self, db, mock_user, mock_holding, mock_user_holding):
        """Test importing a single trade"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 15),
                shares=Decimal('1000'),
                nav=Decimal('1.5'),
                fee=Decimal('1.5')
            )
        ]

        result = TradeService.import_trade(trades, mock_user.id)

        assert result is True
        saved = Trade.query.filter_by(ho_code='000001').first()
        assert saved is not None

    def test_import_multiple_trades_same_holding(self, db, mock_user, mock_holding, mock_user_holding):
        """Test importing multiple trades for the same holding"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 10),
                shares=Decimal('500'),
                nav=Decimal('1.5'),
                fee=Decimal('0.75')
            ),
            create_trade(
                user_id=mock_user.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 20),
                shares=Decimal('500'),
                nav=Decimal('1.6'),
                fee=Decimal('0.8')
            ),
        ]

        result = TradeService.import_trade(trades, mock_user.id)

        assert result is True
        saved_trades = Trade.query.filter_by(ho_code='000001').all()
        assert len(saved_trades) == 2

    def test_import_empty_list(self, db, mock_user):
        """Test importing empty trade list"""
        result = TradeService.import_trade([], mock_user.id)
        assert result is True

    def test_import_missing_holding(self, db, mock_user, mock_holding):
        """Test importing trades for non-existent holding"""
        trades = [
            create_trade(
                user_id=mock_user.id,
                ho_id=99999,  # Non-existent
                ho_code='999999',
                tr_type=TradeTypeEnum.BUY.value,
                tr_date=date(2024, 1, 15),
                shares=Decimal('1000'),
                nav=Decimal('1.5'),
                fee=Decimal('1.5')
            )
        ]

        with pytest.raises(BizException):
            TradeService.import_trade(trades, mock_user.id)


class TestTradeServiceUpdateTradeRecord:
    """Tests for TradeService.update_trade_record"""

    def test_update_trade_success(self, db, mock_user, mock_holding, mock_user_holding, mock_trade):
        """Test successful trade update"""
        update_data = {
            'tr_shares': Decimal('2000'),
            'tr_amount': Decimal('3000'),
            'cash_amount': Decimal('3001.5')
        }

        result = TradeService.update_trade_record(mock_trade.id, update_data)

        assert result is True

        # Verify update
        updated = Trade.query.get(mock_trade.id)
        assert updated.tr_shares == Decimal('2000')

    def test_update_nonexistent_trade(self, db):
        """Test updating non-existent trade"""
        with pytest.raises(BizException):
            TradeService.update_trade_record(99999, {'tr_shares': Decimal('100')})


class TestTradeServiceCleanAndParseJson:
    """Tests for TradeService._clean_and_parse_json"""

    def test_clean_json_with_markdown(self):
        """Test cleaning JSON with markdown code blocks"""
        text = '```json\n{"key": "value"}\n```'
        result = TradeService._clean_and_parse_json(text)
        assert result == {"key": "value"}

    def test_clean_json_without_markdown(self):
        """Test parsing clean JSON"""
        text = '{"key": "value"}'
        result = TradeService._clean_and_parse_json(text)
        assert result == {"key": "value"}

    def test_clean_json_invalid(self):
        """Test handling invalid JSON"""
        text = 'not valid json'
        result = TradeService._clean_and_parse_json(text)
        assert result == {}
