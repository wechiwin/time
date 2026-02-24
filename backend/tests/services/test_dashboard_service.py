"""
Tests for DashboardService
"""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.constant.biz_enums import AnalyticsWindowEnum
from app.models import (
    InvestedAssetSnapshot, InvestedAssetAnalyticsSnapshot,
    HoldingAnalyticsSnapshot, AlertHistory
)
from app.service.dashboard_service import DashboardService


class TestDashboardServiceGetPerformance:
    """Tests for DashboardService.get_performance"""

    def test_get_performance_no_data(self, db, mock_user):
        """Test getting performance when no data exists"""
        result = DashboardService.get_performance(mock_user.id, 'R252')
        assert result == {}

    def test_get_performance_with_data(self, db, mock_user):
        """Test getting performance with analytics data"""
        # Create analytics snapshot
        analytics = InvestedAssetAnalyticsSnapshot(
            user_id=mock_user.id,
            snapshot_date=date.today(),
            window_key='R252',
            twrr_cumulative=Decimal('0.15'),
            irr_annualized=Decimal('0.12'),
            volatility=Decimal('0.18'),
            max_drawdown=Decimal('-0.10'),
            sharpe_ratio=Decimal('1.2'),
            win_rate=Decimal('0.55'),
            period_pnl=Decimal('5000'),
            period_pnl_ratio=Decimal('0.10'),
            benchmark_cumulative_return=Decimal('0.08'),
            excess_return=Decimal('0.07'),
            beta=Decimal('0.9'),
            alpha=Decimal('0.03')
        )
        db.session.add(analytics)
        db.session.commit()

        result = DashboardService.get_performance(mock_user.id, 'R252')

        assert result['window'] == 'R252'
        assert result['twrr_cumulative'] == 15.0  # 0.15 * 100
        assert result['irr_annualized'] == 12.0  # 0.12 * 100
        assert result['sharpe_ratio'] == 1.2

    def test_get_performance_with_different_window(self, db, mock_user):
        """Test getting performance with different window"""
        # Create analytics for different windows
        for window in ['R21', 'R63', 'R252']:
            analytics = InvestedAssetAnalyticsSnapshot(
                user_id=mock_user.id,
                snapshot_date=date.today(),
                window_key=window,
                twrr_cumulative=Decimal('0.05'),
                irr_annualized=Decimal('0.06')
            )
            db.session.add(analytics)
        db.session.commit()

        result = DashboardService.get_performance(mock_user.id, 'R63')
        assert result['window'] == 'R63'


class TestDashboardServiceGetPortfolioTrend:
    """Tests for DashboardService.get_portfolio_trend"""

    def test_get_trend_no_data(self, db, mock_user):
        """Test getting trend when no data exists"""
        result = DashboardService.get_portfolio_trend(mock_user.id, days=30)
        assert result == []

    def test_get_trend_with_data(self, db, mock_user):
        """Test getting trend with snapshot data"""
        # Create multiple snapshots
        base_date = date.today() - timedelta(days=10)
        for i in range(10):
            market_value = Decimal('10000') + Decimal(str(i * 100))
            holding_cost = Decimal('9500')
            snapshot = InvestedAssetSnapshot(
                user_id=mock_user.id,
                snapshot_date=base_date + timedelta(days=i),
                ias_market_value=market_value,
                ias_holding_cost=holding_cost,
                ias_unrealized_pnl=market_value - holding_cost,
                ias_total_realized_pnl=Decimal('0'),
                ias_total_cash_dividend=Decimal('0'),
                ias_total_dividend=Decimal('0'),
                ias_total_pnl=market_value - holding_cost,
                ias_total_pnl_ratio=Decimal('0.05') + Decimal(str(i * 0.01))
            )
            db.session.add(snapshot)
        db.session.commit()

        result = DashboardService.get_portfolio_trend(mock_user.id, days=30)

        assert len(result) == 10
        assert 'date' in result[0]
        assert 'value' in result[0]
        assert 'cost' in result[0]
        assert 'profit' in result[0]
        assert 'return_rate' in result[0]

    def test_get_trend_limited_days(self, db, mock_user):
        """Test that trend respects days parameter"""
        # Create 30 days of data
        base_date = date.today() - timedelta(days=40)
        for i in range(40):
            snapshot = InvestedAssetSnapshot(
                user_id=mock_user.id,
                snapshot_date=base_date + timedelta(days=i),
                ias_market_value=Decimal('10000'),
                ias_holding_cost=Decimal('9500'),
                ias_unrealized_pnl=Decimal('500'),
                ias_total_realized_pnl=Decimal('0'),
                ias_total_cash_dividend=Decimal('0'),
                ias_total_dividend=Decimal('0'),
                ias_total_pnl=Decimal('500'),
                ias_total_pnl_ratio=Decimal('0.05')
            )
            db.session.add(snapshot)
        db.session.commit()

        result = DashboardService.get_portfolio_trend(mock_user.id, days=20)

        # Should only return data within the last 20 days
        assert len(result) <= 20


class TestDashboardServiceGetOverview:
    """Tests for DashboardService.get_overview"""

    def test_get_overview_no_data(self, db, mock_user):
        """Test getting overview when no data exists"""
        result = DashboardService.get_overview(mock_user.id)

        assert result['total_mv'] == 0
        assert result['holding_cost'] == 0
        assert result['total_pnl'] == 0

    def test_get_overview_with_data(self, db, mock_user):
        """Test getting overview with snapshot data"""
        # Create snapshot
        snapshot = InvestedAssetSnapshot(
            user_id=mock_user.id,
            snapshot_date=date.today(),
            ias_market_value=Decimal('50000'),
            ias_holding_cost=Decimal('45000'),
            ias_unrealized_pnl=Decimal('5000'),
            ias_total_pnl=Decimal('8000'),
            ias_total_pnl_ratio=Decimal('0.1778'),
            ias_total_realized_pnl=Decimal('3000'),
            ias_total_cash_dividend=Decimal('0'),
            ias_total_dividend=Decimal('0'),
            ias_total_buy_amount=Decimal('50000'),
            ias_total_sell_amount=Decimal('5000')
        )
        db.session.add(snapshot)

        # Create analytics for ALL window
        analytics = InvestedAssetAnalyticsSnapshot(
            user_id=mock_user.id,
            snapshot_date=date.today(),
            window_key=AnalyticsWindowEnum.ALL.value,
            twrr_cumulative=Decimal('0.20'),
            irr_annualized=Decimal('0.15'),
            max_drawdown=Decimal('-0.08')
        )
        db.session.add(analytics)
        db.session.commit()

        result = DashboardService.get_overview(mock_user.id)

        assert result['total_mv'] == 50000.0
        assert result['holding_cost'] == 45000.0
        assert result['total_pnl'] == 8000.0
        assert result['twrr_cum'] == 20.0  # 0.20 * 100
        assert result['irr_ann'] == 15.0

    def test_get_overview_returns_latest_data(self, db, mock_user):
        """Test that overview returns the latest snapshot"""
        # Create multiple snapshots
        for i in range(3):
            snapshot = InvestedAssetSnapshot(
                user_id=mock_user.id,
                snapshot_date=date.today() - timedelta(days=3 - i),
                ias_market_value=Decimal('10000') + Decimal(str(i * 1000)),
                ias_holding_cost=Decimal('9000'),
                ias_unrealized_pnl=Decimal('1000') + Decimal(str(i * 1000)),
                ias_total_pnl=Decimal('1000') + Decimal(str(i * 1000)),
                ias_total_pnl_ratio=Decimal('0.1'),
                ias_total_realized_pnl=Decimal('0'),
                ias_total_cash_dividend=Decimal('0'),
                ias_total_dividend=Decimal('0'),
                ias_total_buy_amount=Decimal('10000'),
                ias_total_sell_amount=Decimal('0')
            )
            db.session.add(snapshot)
        db.session.commit()

        result = DashboardService.get_overview(mock_user.id)

        # Should return the latest (highest market value)
        assert result['total_mv'] == 12000.0


class TestDashboardServiceGetRecentAlertSignals:
    """Tests for DashboardService.get_recent_alert_signals"""

    def test_get_alerts_no_data(self, db, mock_user):
        """Test getting alerts when no data exists"""
        result = DashboardService.get_recent_alert_signals(mock_user.id, limit=5)
        assert result == []

    def test_get_alerts_with_data(self, db, mock_user, mock_holding, mock_alert_rule):
        """Test getting alerts with data"""
        # Create alert histories
        for i in range(3):
            history = AlertHistory(
                user_id=mock_user.id,
                ar_id=mock_alert_rule.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                ar_name=f'Alert {i}',
                action='BUY',
                trigger_price=Decimal('1.4'),
                trigger_nav_date=date.today() - timedelta(days=i),
                target_price=Decimal('1.4'),
                send_status='sent'
            )
            db.session.add(history)
        db.session.commit()

        result = DashboardService.get_recent_alert_signals(mock_user.id, limit=5)

        assert len(result) == 3

    def test_get_alerts_respects_limit(self, db, mock_user, mock_holding, mock_alert_rule):
        """Test that alerts limit is respected"""
        # Create 10 alert histories
        for i in range(10):
            history = AlertHistory(
                user_id=mock_user.id,
                ar_id=mock_alert_rule.id,
                ho_id=mock_holding.id,
                ho_code=mock_holding.ho_code,
                ar_name=f'Alert {i}',
                action='BUY',
                trigger_price=Decimal('1.4'),
                trigger_nav_date=date.today() - timedelta(days=i),
                target_price=Decimal('1.4'),
                send_status='sent'
            )
            db.session.add(history)
        db.session.commit()

        result = DashboardService.get_recent_alert_signals(mock_user.id, limit=3)

        assert len(result) == 3

    def test_get_alerts_user_isolation(self, db, mock_user, mock_holding, mock_alert_rule):
        """Test that alerts are user-isolated"""
        # Create another user
        from app.models import UserSetting
        other_user = UserSetting(
            username='otheruser',
            pwd_hash=UserSetting.hash_password('password'),
            email_address='other@example.com',
            is_locked=0
        )
        db.session.add(other_user)
        db.session.commit()

        # Create alert for other user
        history = AlertHistory(
            user_id=other_user.id,
            ar_id=mock_alert_rule.id,
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            ar_name='Other User Alert',
            action='BUY',
            trigger_price=Decimal('1.4'),
            trigger_nav_date=date.today(),
            target_price=Decimal('1.4'),
            send_status='sent'
        )
        db.session.add(history)
        db.session.commit()

        # Query for original mock_user
        result = DashboardService.get_recent_alert_signals(mock_user.id, limit=5)

        assert len(result) == 0  # Should not see other user's alerts
