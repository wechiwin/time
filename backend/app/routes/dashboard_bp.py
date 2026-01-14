# dashboard_bp.py
import logging
from flask import Blueprint, jsonify, request
from app.framework.res import Res
from app.service.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')
dashboard_service = DashboardService()


@dashboard_bp.route('/summary', methods=['GET'])
def get_dashboard_summary():
    """获取Dashboard完整汇总数据"""
    try:
        # 持仓汇总
        holdings_summary = dashboard_service.get_holdings_summary()

        # 交易统计
        trade_stats = dashboard_service.get_trade_statistics()

        # 近期预警
        recent_alerts = dashboard_service.get_recent_alerts(limit=10)

        # 波动性分析
        volatility_data = dashboard_service.calculate_portfolio_volatility(days=30)

        # 资产配置
        allocation_data = []
        for holding in holdings_summary['holdings']:
            allocation_data.append({
                'name': holding['name'],
                'code': holding['code'],
                'value': holding['current_value'],
                'percentage': holding['weight']
            })

        return Res.success({
            'holdings_summary': {
                'total_value': holdings_summary['total_value'],
                'total_cost': holdings_summary['total_cost'],
                'total_profit': holdings_summary['total_profit'],
                'total_profit_rate': holdings_summary['total_profit_rate'],
                'cumulative_profit': holdings_summary['cumulative_profit'],
                'cumulative_profit_rate': holdings_summary['cumulative_profit_rate'],
                'today_profit': holdings_summary['today_profit'],
                'today_profit_rate': holdings_summary['today_profit_rate'],
                'holdings_count': len(holdings_summary['holdings'])
            },
            'trade_statistics': trade_stats,
            'recent_alerts': recent_alerts,
            'portfolio_volatility': volatility_data,
            'asset_allocation': allocation_data
        })

    except Exception as e:
        logger.error(f"Error getting dashboard summary: {str(e)}")
        return Res.fail('Failed to get dashboard data')


@dashboard_bp.route('/holdings', methods=['GET'])
def get_holdings_detail():
    """获取持仓详细信息"""
    try:
        summary = dashboard_service.get_holdings_summary()
        return Res.success({
            'holdings': summary['holdings'],
            'summary': {
                'total_value': summary['total_value'],
                'total_cost': summary['total_cost'],
                'total_profit': summary['total_profit'],
                'total_profit_rate': summary['total_profit_rate']
            }
        })
    except Exception as e:
        logger.error(f"Error getting holdings detail: {str(e)}")
        return Res.fail('Failed to get holdings detail')


@dashboard_bp.route('/allocation', methods=['GET'])
def get_asset_allocation():
    """获取资产配置数据"""
    try:
        summary = dashboard_service.get_holdings_summary()

        allocation = []
        for holding in summary['holdings']:
            allocation.append({
                'name': holding['name'],
                'code': holding['code'],
                'value': holding['current_value'],
                'percentage': holding['weight']
            })

        return Res.success({
            'allocation': allocation,
            'total_value': summary['total_value']
        })
    except Exception as e:
        logger.error(f"Error getting asset allocation: {str(e)}")
        return Res.fail('Failed to get asset allocation')


@dashboard_bp.route('/trade-stats', methods=['GET'])
def get_trade_statistics():
    """获取交易统计数据"""
    try:
        stats = dashboard_service.get_trade_statistics()
        return Res.success(stats)
    except Exception as e:
        logger.error(f"Error getting trade statistics: {str(e)}")
        return Res.fail('Failed to get trade statistics')


@dashboard_bp.route('/alerts', methods=['GET'])
def get_recent_alerts():
    """获取近期预警"""
    try:
        limit = request.args.get('limit', 10, type=int)
        alerts = dashboard_service.get_recent_alerts(limit=limit)
        return Res.success(alerts)
    except Exception as e:
        logger.error(f"Error getting recent alerts: {str(e)}")
        return Res.fail('Failed to get recent alerts')


@dashboard_bp.route('/volatility', methods=['GET'])
def get_portfolio_volatility():
    """获取组合波动性"""
    try:
        days = request.args.get('days', 30, type=int)
        volatility = dashboard_service.calculate_portfolio_volatility(days=days)
        return Res.success(volatility)
    except Exception as e:
        logger.error(f"Error calculating portfolio volatility: {str(e)}")
        return Res.fail('Failed to calculate portfolio volatility')
