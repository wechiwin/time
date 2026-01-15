import logging

from flask import Blueprint, request

from app.framework.res import Res
from app.service.dashboard_service import DashboardService

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('/summary', methods=['POST'])
def get_dashboard_summary():
    """
    聚合 Dashboard 所需的所有数据
    参数:
      - days: 趋势图的天数 (默认 30)
      - window: 绩效分析的窗口 key (默认 R252 即一年)
    """
    try:
        data = request.get_json()
        days = data.get('days')
        window_key = data.get('window')

        # 2. 绩效指标 (TWRR, IRR, Sharpe)
        performance = DashboardService.get_performance(window_key, days)

        # 3. 趋势图数据
        trend = DashboardService.get_portfolio_trend(days)

        # 4. 资产配置 (饼图数据)
        allocation = DashboardService.get_holdings_allocation()

        # 5. 近期预警
        alerts = DashboardService.get_recent_alerts(limit=5)

        return Res.success({
            'performance': performance,
            'trend': trend,
            'allocation': allocation,
            'alerts': alerts
        })

    except Exception as e:
        logger.exception("Dashboard summary error")
        return Res.fail(f"Failed to load dashboard: {str(e)}")


@dashboard_bp.route('/overview', methods=['GET'])
def get_account_overview():
    """获取账户整体状况"""
    try:
        data = DashboardService.get_overview()
        return Res.success(data)
    except Exception as e:
        logger.exception("Error getting account overview")
        return Res.fail(f"Failed to load overview: {str(e)}")
