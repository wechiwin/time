import logging

from flask import Blueprint, request, g

from app.framework.auth import auth_required
from app.framework.res import Res
from app.service.dashboard_service import DashboardService

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('/summary', methods=['POST'])
@auth_required
def get_dashboard_summary():
    """
    聚合 Dashboard 所需的所有数据
    参数:
      - days: 趋势图的天数 (默认 30)
      - window: 绩效分析的窗口 key (默认 R252 即一年)
    """
    try:
        user_id = g.user.id
        data = request.get_json(silent=True) or {}
        days = data.get('days')
        window_key = data.get('window')

        result = DashboardService.get_summary(user_id, window_key, days)

        return Res.success(result)

    except Exception as e:
        logger.exception("Dashboard summary error")
        return Res.fail(f"Failed to load dashboard: {str(e)}")


@dashboard_bp.route('/overview', methods=['GET'])
@auth_required
def get_account_overview():
    """获取账户整体状况"""
    try:
        user_id = g.user.id
        data = DashboardService.get_overview(user_id)
        return Res.success(data)
    except Exception as e:
        logger.exception("Error getting account overview")
        return Res.fail(f"Failed to load overview: {str(e)}")


@dashboard_bp.route('/get_holdings_allocation', methods=['POST'])
@auth_required
def get_holdings_allocation():
    """
    聚合 Dashboard 所需的所有数据
    参数:
      - days: 趋势图的天数 (默认 30)
      - window: 绩效分析的窗口 key (默认 R252 即一年)
    """

    # 4. 资产配置 (饼图数据)
    user_id = g.user.id
    data = request.get_json(silent=True) or {}
    days = data.get('days')
    window_key = data.get('window')
    allocation = DashboardService.get_holdings_allocation(user_id, window_key)

    return Res.success({
        'allocation': allocation,
    })
