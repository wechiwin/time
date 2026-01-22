import logging
from datetime import datetime, timedelta
from typing import Dict, List

from sqlalchemy import desc, func

from app.constant.biz_enums import AnalyticsWindowEnum
from app.database import db
from app.mapper.dashboard_mapper import DashboardMapper
from app.models import (
    InvestedAssetSnapshot, InvestedAssetAnalyticsSnapshot,
    AlertHistory, HoldingAnalyticsSnapshot
)
from app.utils.date_util import date_to_str

logger = logging.getLogger(__name__)


class DashboardService:
    """
    基于快照(Snapshot)模型的 Dashboard 服务
    """

    @classmethod
    def get_performance(cls, user_id: int, window_key: str = 'R252', days: int = 365) -> Dict:
        """
        获取组合绩效分析指标 (基于 InvestedAssetAnalyticsSnapshot)
        :param window_key: 窗口键值，如 'R21'(1月), 'R63'(3月), 'R252'(1年), 'ALL'
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        # 获取最新日期的分析快照
        latest_date_query = db.session.query(func.max(InvestedAssetAnalyticsSnapshot.snapshot_date))
        latest_date = latest_date_query.scalar()

        if not latest_date:
            return {}

        analytics = InvestedAssetAnalyticsSnapshot.query.filter(
            InvestedAssetAnalyticsSnapshot.user_id == user_id,
            InvestedAssetAnalyticsSnapshot.snapshot_date.between(start_date, end_date),
            InvestedAssetAnalyticsSnapshot.window_key == window_key
        ).order_by(InvestedAssetAnalyticsSnapshot.snapshot_date.desc()).first()

        return {
            'window': analytics.window_key,
            'twrr_cumulative': float(analytics.twrr_cumulative or 0) * 100,
            'irr_annualized': float(analytics.irr_annualized or 0) * 100,
            'volatility': float(analytics.volatility or 0) * 100,
            'max_drawdown': float(analytics.max_drawdown or 0) * 100,
            'sharpe_ratio': float(analytics.sharpe_ratio or 0),
            'win_rate': float(analytics.win_rate or 0) * 100,
            'period_pnl': float(analytics.period_pnl or 0),
            'period_pnl_ratio': float(analytics.period_pnl_ratio or 0) * 100,
            'benchmark_cumulative_return': float(analytics.benchmark_cumulative_return or 0) * 100,
            'excess_return': float(analytics.excess_return or 0) * 100,
            'beta': float(analytics.beta or 0),
            'alpha': float(analytics.alpha or 0) * 100,
        }

    @classmethod
    def get_portfolio_trend(cls, user_id: int, days: int = 30) -> List[Dict]:
        """
        获取资产走势图数据 (基于 InvestedAssetSnapshot 历史)
        """
        start_date = datetime.now().date() - timedelta(days=days)

        snapshots = InvestedAssetSnapshot.query.filter(
            InvestedAssetSnapshot.user_id == user_id,
            InvestedAssetSnapshot.snapshot_date >= start_date
        ).order_by(InvestedAssetSnapshot.snapshot_date.asc()).all()

        data = []
        for snap in snapshots:
            data.append({
                'date': snap.snapshot_date.strftime('%Y-%m-%d'),
                'value': float(snap.ias_market_value),
                'cost': float(snap.ias_holding_cost),
                'profit': float(snap.ias_total_pnl),
                # 累计收益率用于画曲线
                'return_rate': float(snap.ias_total_pnl_ratio or 0) * 100
            })
        return data

    @classmethod
    def get_holdings_allocation(cls, user_id: int, window_key) -> List[Dict]:
        """
        获取最新持仓分布
        """
        # 1. 找到用户的最新的快照日期
        latest_date = db.session.query(
            func.max(HoldingAnalyticsSnapshot.snapshot_date)
        ).filter(
            HoldingAnalyticsSnapshot.user_id == user_id
        ).scalar()
        if not latest_date:
            return []

        holding_ana_snaps = DashboardMapper.get_holdings_allocation(date_to_str(latest_date), window_key)
        logger.info(str(holding_ana_snaps))
        return holding_ana_snaps

    @classmethod
    def get_recent_alerts(cls, user_id: int, limit: int = 5) -> List[Dict]:
        """
        获取近期预警
        """
        alerts = AlertHistory.query.filter(
            AlertHistory.user_id == user_id  # 用户隔离
        ).order_by(
            desc(AlertHistory.created_at)
        ).limit(limit).all()
        result = []

        for alert in alerts:
            # 1. 处理操作类型 (BUY/SELL)
            # 数据库模型中 action 定义为 db.Enum(AlertRuleActionEnum)，所以取出来直接是 Enum 对象
            action_type = alert.action.name if hasattr(alert.action, 'name') else str(alert.action)
            # alert.action.view 返回的是 lazy_gettext 对象，需要转为 str 才能被 JSON 序列化
            action_text = str(alert.action.view) if hasattr(alert.action, 'view') else str(alert.action)
            # 2. 处理发送状态 (PENDING/SENT/FAILED)
            status_code = alert.send_status.name if hasattr(alert.send_status, 'name') else str(alert.send_status)
            status_text = str(alert.send_status.view) if hasattr(alert.send_status, 'view') else str(alert.send_status)
            result.append({
                'id': alert.id,
                'code': alert.ho_code,
                'name': alert.ar_name,
                'type': action_type,  # 例如: 'BUY'
                'type_text': action_text,  # 例如: '买入' (根据语言环境变化)
                'current_nav': float(alert.trigger_price or 0),
                'target_nav': float(alert.target_price or 0),
                'date': alert.trigger_nav_date.strftime('%Y-%m-%d') if alert.trigger_nav_date else '',
                'status': status_code,  # 例如: 'SENT'
                'status_text': status_text  # 例如: '已发送'
            })

        return result

    @classmethod
    def get_overview(cls, user_id: int, ) -> Dict:
        """
        获取账户整体状况（不随时间筛选变化的数据）
        包含：当前总资产、总成本、成立以来累计盈亏、成立以来TWRR、成立以来IRR
        """
        # 获取最新的一条资产快照
        latest_snapshot = InvestedAssetSnapshot.query.filter(
            InvestedAssetSnapshot.user_id == user_id
        ).order_by(
            desc(InvestedAssetSnapshot.snapshot_date)
        ).first()

        if not latest_snapshot:
            return {
                'total_mv': 0,
                'holding_cost': 0,
                'total_pnl': 0,
                'total_pnl_ratio': 0,
                'twrr_cum': 0,
                'irr_ann': 0,
                'max_drawdown': 0,
            }

        # 2. 获取 'ALL' 窗口的分析数据 (用于成立以来的 TWRR 和 IRR)
        # 注意：必须匹配最新快照的日期，确保数据同步
        analytics_all = InvestedAssetAnalyticsSnapshot.query.filter_by(
            user_id=user_id,
            snapshot_date=latest_snapshot.snapshot_date,
            window_key=AnalyticsWindowEnum.ALL.value
        ).first()

        return {
            'total_mv': float(latest_snapshot.ias_market_value),
            'holding_cost': float(latest_snapshot.ias_holding_cost),
            'total_pnl': float(latest_snapshot.ias_total_pnl),
            'total_pnl_ratio': float(latest_snapshot.ias_total_pnl_ratio or 0) * 100,

            # 如果没有分析数据，默认为0
            'twrr_cum': float(analytics_all.twrr_cumulative or 0) * 100 if analytics_all else 0,
            'irr_ann': float(analytics_all.irr_annualized or 0) * 100 if analytics_all else 0,
            'max_drawdown': float(analytics_all.max_drawdown or 0) * 100 if analytics_all else 0,
        }
