# dashboard_service.py
import logging
import statistics
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

import numpy as np
from sqlalchemy import desc

from app.models import Holding, Trade, FundNavHistory, AlertHistory
from app.service.nav_history_service import FundNavHistoryService
from app.service.trade_service import TradeService

logger = logging.getLogger(__name__)


class DashboardService:
    """Dashboard数据计算服务"""

    @classmethod
    def get_holdings_summary(cls) -> Dict:
        """
        获取持仓汇总信息
        返回: {
            'total_value': 持仓总额,
            'total_cost': 总成本,
            'total_profit': 持仓收益,
            'total_profit_rate': 持有收益率,
            'cumulative_profit': 累计收益,
            'cumulative_profit_rate': 累计收益率,
            'today_profit': 今日收益,
            'today_profit_rate': 今日收益率,
            'holdings': [{
                'code': 基金代码,
                'name': 基金名称,
                'type': 基金类型,
                'current_nav': 当前净值,
                'shares': 持有份额,
                'current_value': 当前市值,
                'cost': 总成本,
                'profit': 盈亏金额,
                'profit_rate': 盈亏百分比,
                'weight': 资产占比
            }]
        }
        """
        holdings = Holding.query.filter_by(ho_status=1).all()

        result = {
            'total_value': 0,
            'total_cost': 0,
            'total_profit': 0,
            'today_profit': 0,
            'holdings': []
        }

        for holding in holdings:
            # 计算持仓份额,持仓成本
            uncleared_trade_list = TradeService.list_uncleared(holding.ho_code)
            if not uncleared_trade_list:
                continue
            shares, cost = TradeService.calculate_position(uncleared_trade_list)

            # 获取最新净值 TODO 目前用的是昨日净值 没有用今日预估净值
            latest_nav_history = FundNavHistoryService.get_latest_by_ho_code(holding.ho_code)
            if latest_nav_history is None:
                continue
            latest_nav = latest_nav_history.market_price

            # 获取昨日净值（用于计算今日收益）
            # yesterday_nav = self._get_yesterday_nav(holding.ho_code)
            yesterday_nav_history = latest_nav_history
            yesterday_nav = yesterday_nav_history.market_price

            # 计算各项指标
            current_value = shares * latest_nav
            profit = current_value - cost
            profit_rate = (profit / cost * 100) if cost > 0 else 0

            # 计算今日收益
            today_profit = 0
            if yesterday_nav:
                today_profit = shares * (latest_nav - yesterday_nav)

            holding_info = {
                'code': holding.ho_code,
                'name': holding.ho_name or holding.ho_short_name,
                'type': holding.ho_type,
                'current_nav': round(latest_nav, 4),
                'shares': round(shares, 2),
                'current_value': round(current_value, 2),
                'cost': round(cost, 2),
                'profit': round(profit, 2),
                'profit_rate': round(profit_rate, 2),
                'today_profit': round(today_profit, 2),
                'today_profit_rate': round((today_profit / cost * 100) if cost > 0 else 0, 2)
            }

            result['holdings'].append(holding_info)
            result['total_value'] += current_value
            result['total_cost'] += cost
            result['total_profit'] += profit
            result['today_profit'] += today_profit

        # 计算收益率
        if result['total_cost'] > 0:
            result['total_profit_rate'] = round(
                (result['total_profit'] / result['total_cost'] * 100), 2
            )
            result['today_profit_rate'] = round(
                (result['today_profit'] / result['total_cost'] * 100), 2
            )
        else:
            result['total_profit_rate'] = 0
            result['today_profit_rate'] = 0

        # 计算累计收益（需要所有历史交易）
        result['cumulative_profit'] = TradeService.calculate_cumulative_profit()
        result['cumulative_profit_rate'] = round(
            (result['cumulative_profit'] / result['total_cost'] * 100)
            if result['total_cost'] > 0 else 0, 2
        )

        # 计算资产权重
        for holding in result['holdings']:
            holding['weight'] = round(
                (holding['current_value'] / result['total_value'] * 100)
                if result['total_value'] > 0 else 0, 2
            )

        return result

    def _calculate_cumulative_profit(self) -> float:
        """计算累计收益（所有已清仓交易的收益）"""
        # 获取所有已清仓的交易
        cleared_trades = Trade.query.filter_by(is_cleared=1).all()

        total_profit = 0
        for trade in cleared_trades:
            if trade.tr_type == 0:  # 卖出
                # 查找对应的买入成本（简化处理）
                buy_trades = Trade.query.filter_by(
                    ho_code=trade.ho_code,
                    tr_type=1,
                    is_cleared=1
                ).all()

                if buy_trades:
                    avg_buy_price = sum(t.tr_amount for t in buy_trades) / sum(t.tr_shares for t in buy_trades)
                    profit = trade.tr_amount - (trade.tr_shares * avg_buy_price)
                    total_profit += profit

        return round(total_profit, 2)

    def get_trade_statistics(self) -> Dict:
        """
        获取交易统计概览
        返回: {
            'total_trades': 总交易次数,
            'winning_trades': 盈利交易次数,
            'losing_trades': 亏损交易次数,
            'win_rate': 胜率,
            'avg_holding_period': 平均持仓周期(天),
            'avg_profit': 平均盈利金额,
            'avg_loss': 平均亏损金额,
            'profit_loss_ratio': 盈亏比
        }
        """
        # 获取所有已清仓的交易（已完成交易）
        trades = Trade.query.filter_by(is_cleared=1).all()

        if not trades:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'avg_holding_period': 0,
                'avg_profit': 0,
                'avg_loss': 0,
                'profit_loss_ratio': 0
            }

        # 按基金代码分组，计算每只基金的交易
        fund_trades = defaultdict(list)
        for trade in trades:
            fund_trades[trade.ho_code].append(trade)

        winning_trades = 0
        losing_trades = 0
        profits = []
        losses = []
        holding_periods = []

        for ho_code, trade_list in fund_trades.items():
            # 分离买入和卖出交易
            buy_trades = [t for t in trade_list if t.tr_type == 1]
            sell_trades = [t for t in trade_list if t.tr_type == 0]

            # 计算每笔卖出交易的盈亏
            for sell in sell_trades:
                # 找到对应的买入（简化：使用平均买入价）
                if buy_trades:
                    total_buy_shares = sum(b.tr_shares for b in buy_trades)
                    total_buy_amount = sum(b.tr_amount for b in buy_trades)

                    if total_buy_shares > 0:
                        avg_buy_price = total_buy_amount / total_buy_shares
                        profit = sell.tr_amount - (sell.tr_shares * avg_buy_price)

                        if profit > 0:
                            winning_trades += 1
                            profits.append(profit)
                        else:
                            losing_trades += 1
                            losses.append(abs(profit))

                        # 计算持仓周期（简化）
                        buy_dates = [datetime.strptime(b.tr_date, '%Y-%m-%d') for b in buy_trades]
                        sell_date = datetime.strptime(sell.tr_date, '%Y-%m-%d')
                        avg_buy_date = min(buy_dates) if buy_dates else sell_date
                        holding_days = (sell_date - avg_buy_date).days
                        holding_periods.append(max(holding_days, 1))

        total_trades = winning_trades + losing_trades

        return {
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'win_rate': round((winning_trades / total_trades * 100) if total_trades > 0 else 0, 2),
            'avg_holding_period': round(statistics.mean(holding_periods) if holding_periods else 0, 1),
            'avg_profit': round(statistics.mean(profits) if profits else 0, 2),
            'avg_loss': round(statistics.mean(losses) if losses else 0, 2),
            'profit_loss_ratio': round(
                (statistics.mean(profits) / statistics.mean(losses))
                if profits and losses and statistics.mean(losses) > 0 else 0, 2
            )
        }

    def get_recent_alerts(self, limit: int = 10) -> List[Dict]:
        """
        获取近期预警与通知
        返回: [{
            'id': 预警ID,
            'code': 基金代码,
            'name': 基金名称,
            'type': 预警类型,
            'type_text': 类型文本,
            'current_nav': 当前净值,
            'target_nav': 目标净值,
            'trigger_date': 触发日期,
            'status': 状态,
            'status_text': 状态文本,
            'remark': 备注
        }]
        """
        alerts = AlertHistory.query.order_by(
            desc(AlertHistory.created_at)
        ).limit(limit).all()

        result = []
        type_mapping = {1: '买入', 2: '加仓', 0: '卖出'}
        status_mapping = {0: '待发送', 1: '已发送', 2: '发送失败'}

        for alert in alerts:
            # 获取基金名称
            holding = Holding.query.filter_by(ho_code=alert.ho_code).first()

            result.append({
                'id': alert.id,
                'code': alert.ho_code,
                'name': holding.ho_name if holding else alert.ho_code,
                'type': alert.action,
                'type_text': type_mapping.get(alert.action, '未知'),
                'current_nav': round(alert.trigger_navpu, 4),
                'target_nav': round(alert.target_navpu, 4),
                'trigger_date': alert.trigger_nav_date,
                'status': alert.send_status,
                'status_text': status_mapping.get(alert.send_status, '未知'),
                'remark': alert.remark,
                'sent_time': alert.sent_time.strftime('%Y-%m-%d %H:%M:%S') if alert.sent_time else None
            })

        return result

    def calculate_portfolio_volatility(self, days: int = 30) -> Dict:
        """
        计算投资组合波动性
        返回: {
            'volatility': 波动率(标准差),
            'beta': Beta值(相对于市场),
            'sharpe_ratio': 夏普比率,
            'max_drawdown': 最大回撤
        }
        """
        # 获取所有持仓基金
        holdings = Holding.query.filter_by(ho_status=1).all()

        if not holdings:
            return {
                'volatility': 0,
                'beta': 0,
                'sharpe_ratio': 0,
                'max_drawdown': 0
            }

        # 获取最近N天的每日组合价值
        portfolio_values = []
        dates = []

        # 获取最近N天的日期
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime('%Y-%m-%d')

            # 计算该日组合总价值
            daily_value = 0
            valid_date = False

            for holding in holdings:
                # 获取该基金在该日的净值
                nav = FundNavHistory.query.filter_by(
                    ho_code=holding.ho_code,
                    nav_date=date_str
                ).first()

                if nav:
                    # 计算持仓份额
                    uncleared_trade_list = TradeService.list_uncleared(holding.ho_code)
                    if not uncleared_trade_list:
                        continue
                    position_data = TradeService.calculate_position(uncleared_trade_list)
                    if position_data:
                        shares, _ = position_data
                        daily_value += shares * nav.market_price
                        valid_date = True

            if valid_date:
                portfolio_values.append(daily_value)
                dates.append(date_str)

            current_date += timedelta(days=1)

        if len(portfolio_values) < 2:
            return {
                'volatility': 0,
                'beta': 0,
                'sharpe_ratio': 0,
                'max_drawdown': 0
            }

        # 计算日收益率
        returns = []
        for i in range(1, len(portfolio_values)):
            if portfolio_values[i - 1] > 0:
                daily_return = (portfolio_values[i] - portfolio_values[i - 1]) / portfolio_values[i - 1]
                returns.append(daily_return)

        if not returns:
            return {
                'volatility': 0,
                'beta': 0,
                'sharpe_ratio': 0,
                'max_drawdown': 0
            }

        # 计算波动率（年化标准差）
        volatility = np.std(returns) * np.sqrt(252)  # 年化

        # 计算最大回撤
        max_drawdown = self._calculate_max_drawdown(portfolio_values)

        # 计算夏普比率（简化，假设无风险利率为3%）
        avg_return = np.mean(returns) * 252  # 年化平均收益
        risk_free_rate = 0.03
        sharpe_ratio = (avg_return - risk_free_rate) / volatility if volatility > 0 else 0

        # Beta值计算（需要市场基准数据，这里简化处理）
        # 实际项目中需要获取市场指数数据
        beta = self._calculate_beta(returns)

        return {
            'volatility': round(volatility * 100, 2),  # 转换为百分比
            'beta': round(beta, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
            'max_drawdown': round(max_drawdown * 100, 2)  # 转换为百分比
        }

    def _calculate_max_drawdown(self, values: List[float]) -> float:
        """计算最大回撤"""
        if not values:
            return 0

        peak = values[0]
        max_dd = 0

        for value in values:
            if value > peak:
                peak = value
            dd = (peak - value) / peak
            if dd > max_dd:
                max_dd = dd

        return max_dd

    def _calculate_beta(self, portfolio_returns: List[float]) -> float:
        """
        计算Beta值（简化版）
        实际项目中需要市场指数收益率数据
        这里使用模拟数据或返回默认值
        """
        # 模拟市场收益率（实际应从数据库获取）
        market_returns = [r * 0.8 + np.random.normal(0, 0.01) for r in portfolio_returns]

        if len(portfolio_returns) < 2 or len(market_returns) < 2:
            return 1.0

        # 计算Beta = Cov(portfolio, market) / Var(market)
        cov_matrix = np.cov(portfolio_returns, market_returns)
        if cov_matrix[1, 1] == 0:
            return 1.0

        beta = cov_matrix[0, 1] / cov_matrix[1, 1]
        return beta
