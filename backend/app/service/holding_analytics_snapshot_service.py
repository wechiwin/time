# app/service/holding_analytics_snapshot_service.py
import logging
import math
import time
from collections import defaultdict
from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import List, Dict, Optional

from sqlalchemy import func

from app.calendars.trade_calendar import TradeCalendar
from app.framework.async_task_manager import create_task
from app.models import (
    db,
    HoldingSnapshot,
    HoldingAnalyticsSnapshot, Holding, Trade
)

logger = logging.getLogger(__name__)
calendar = TradeCalendar()

ZERO = Decimal('0')


class HoldingAnalyticsSnapshotService:

    @classmethod
    def generate_all_snapshots(cls):
        logger.info("Start generate_all_snapshots (analytics)")
        start_time = time.time()

        all_holdings = Holding.query.all()
        if not all_holdings:
            logger.info("No holdings found")
            return True

        for holding in all_holdings:
            to_add_analytics = []
            errors = []
            analytics = cls._generate_analytics(holding)
            to_add_analytics.extend(analytics)
            try:
                # 批量插入分析快照
                if to_add_analytics:
                    deleted = HoldingAnalyticsSnapshot.query.filter_by(
                        HoldingAnalyticsSnapshot.ho_id == holding.id
                    ).delete(synchronize_session=False)

                    db.session.bulk_save_objects(to_add_analytics)
                    logger.info(f"Generated {len(to_add_analytics)} analytics snapshots")

                db.session.commit()
                logger.info(f"Generated {len(to_add_analytics)} analytics snapshots for {holding.ho_code}")
            except Exception as e:
                error_msg = f"Error generating holding analytics snapshots {holding.ho_code}: {str(e)}"
                create_task(
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name} at {datetime.now()}",
                    module_path="app.services.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": [holding.id]},
                    error_message=error_msg
                )
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)

        end_time = time.time()

        logger.info(f"HoldingAnalyticsSnapshotService generate_all_snapshots completed in {round(end_time - start_time, 2)}")

        return True

    @classmethod
    def generate_yesterday_snapshots(cls) -> Dict:
        """
        增量生成昨天的分析快照

        算法思路：
        1. 确定需要处理的持仓（昨天有交易或昨天有基础快照）
        2. 获取昨天和前天的基础快照数据
        3. 为每个持仓计算昨天的分析指标
        4. 批量插入或更新分析快照

        性能优化点：
        - 预加载所需数据减少数据库查询次数
        - 使用bulk操作提高插入效率
        """
        logger.info("Starting daily task: generate_yesterday_analytics_snapshots")
        updated_count = 0
        errors = []
        result = {
            "generated": updated_count,
            "errors": errors
        }
        # 判断昨天是不是交易日，并以之为标的日期
        current_date = date.today() - timedelta(days=1)
        if not calendar.is_trade_day(current_date):
            logger.info(f"{current_date} is not trade day")
            return result

        prev_date = calendar.prev_trade_day(current_date)
        try:
            # 确定目标持仓：当天有交易的 + 前一天有基础快照的
            trade_ho_ids = set(
                row[0] for row in db.session.query(Trade.ho_id)
                .filter(Trade.tr_date == current_date)
                .distinct()
            )
            prev_snapshot_ho_ids = set(
                row[0] for row in db.session.query(HoldingSnapshot.ho_id)
                .filter(HoldingSnapshot.snapshot_date == current_date)
                .distinct()
            )
            target_ho_ids = trade_ho_ids | prev_snapshot_ho_ids
            if not target_ho_ids:
                logger.info("No target holdings found for analytics snapshot generation")
                return result

            # 预加载数据
            # 1. 昨天的基础快照
            prev_snapshots = {
                s.ho_id: s for s in db.session.query(HoldingSnapshot)
                .filter(
                    HoldingSnapshot.ho_id.in_(target_ho_ids),
                    HoldingSnapshot.snapshot_date == current_date
                ).all()
            }
            # 2. 前天的分析快照（用于连续性计算）
            previous_analytics_snapshots = {
                s.ho_id: s for s in db.session.query(HoldingAnalyticsSnapshot)
                .filter(
                    HoldingAnalyticsSnapshot.ho_id.in_(target_ho_ids),
                    HoldingAnalyticsSnapshot.snapshot_date == prev_date
                ).all()
            }
            # 3. 近30天的基础快照（用于波动率计算）
            recent_holding_snapshots = defaultdict(list)
            for s in db.session.query(HoldingSnapshot).filter(
                    HoldingSnapshot.ho_id.in_(target_ho_ids),
                    HoldingSnapshot.snapshot_date.between(
                        calendar.get_nearby_trade_days(current_date, -30),
                        # current_date - timedelta(days=30),
                        current_date
                    )
            ).order_by(HoldingSnapshot.ho_id, HoldingSnapshot.snapshot_date) \
                    .all():
                recent_holding_snapshots[s.ho_id].append(s)

            new_snapshots = []

            # 处理每个目标持仓
            for ho_id in target_ho_ids:
                try:
                    base_snapshot = prev_snapshots.get(ho_id)
                    if not base_snapshot:
                        continue  # 没有基础快照则无法生成分析快照
                    # 检查是否已存在，避免重复生成
                    existing = db.session.query(HoldingAnalyticsSnapshot).filter_by(
                        ho_id=ho_id,
                        snapshot_date=current_date
                    ).first()
                    if existing:
                        # 如果已存在，可以选择更新或者跳过
                        # 这里选择跳过以保证幂等性
                        continue
                    # 获取前一个分析快照用于连续计算
                    prev_analytics = previous_analytics_snapshots.get(ho_id)

                    # 获取近期快照用于波动率计算
                    recent_snapshots = recent_holding_snapshots.get(ho_id, [])

                    # 生成单个分析快照
                    analytics_snapshot = cls._calculate_single_day_analytics(
                        base_snapshot=base_snapshot,
                        prev_analytics=prev_analytics,
                        recent_snapshots=recent_snapshots,
                        calc_date=current_date
                    )

                    if analytics_snapshot:
                        new_snapshots.append(analytics_snapshot)
                except Exception as e:
                    error_msg = f"Error processing holding {ho_id} for {current_date}: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    errors.append(error_msg)
            # 批量插入新快照
            if new_snapshots:
                deleted = HoldingAnalyticsSnapshot.query.filter_by(
                    HoldingAnalyticsSnapshot.ho_id.in_(target_ho_ids),
                    HoldingAnalyticsSnapshot.snapshot_date == current_date
                ).delete(synchronize_session=False)

                db.session.bulk_save_objects(new_snapshots)
                updated_count = len(new_snapshots)
            db.session.commit()

            logger.info(f"Successfully generated {updated_count} analytics snapshots for {current_date}")
            return result
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to generate yesterday analytics snapshots: {str(e)}", exc_info=True)
            return {"generated": 0, "errors": [str(e)]}

    @classmethod
    def _generate_analytics(cls, holding):
        """
        为单个持仓生成完整的分析快照序列

        核心算法：
        1. 路径依赖指标：需要基于历史数据逐步计算
        2. 波动率计算：使用最近30天的日收益率标准差
        3. 回撤计算：跟踪历史峰值并计算相对回撤
        4. 贡献度计算：基于组合总市值计算个股贡献

        时间复杂度：O(n)，其中n为快照数量
        空间复杂度：O(m)，其中m为最近30天快照数
        """
        holding_snapshots = db.session.query(HoldingSnapshot).filter(
            HoldingSnapshot.ho_id == holding.id
        ).order_by(
            HoldingSnapshot.snapshot_date
        ).all()
        if not holding_snapshots:
            return []

        analytics_snapshots = []

        # 初始化状态变量
        peak_market_value = ZERO  # 历史峰值市值
        max_drawdown = ZERO  # 最大回撤
        max_drawdown_days = 0  # 最大回撤持续天数
        drawdown_start_date = None  # 回撤开始日期
        current_drawdown_days = 0  # 当前回撤天数

        max_profit_ratio = ZERO  # 最大盈利比例
        max_profit_value = ZERO  # 最大盈利金额

        prev_analytics_snapshot = None

        # 预计算组合每日总市值用于仓位贡献计算 TODO 此方法是否需要重构 单独写一个方法来计算所有 analytics
        portfolio_daily_mv = cls._get_portfolio_daily_market_value(
            [s.snapshot_date for s in holding_snapshots]
        )
        # 按日期排序处理
        for i, snapshot in enumerate(holding_snapshots):
            ana_snapshot = HoldingAnalyticsSnapshot()
            ana_snapshot.ho_id = snapshot.ho_id
            ana_snapshot.snapshot_date = snapshot.snapshot_date

            # 设置计算版本和备注
            ana_snapshot.calc_version = "v1.0"
            ana_snapshot.has_calc_comment = "Full calculation"

            # 峰值市值和回撤相关指标
            if snapshot.hos_market_value > peak_market_value:
                peak_market_value = snapshot.hos_market_value
                # 新高峰出现，重置回撤计数
                current_drawdown_days = 0
                drawdown_start_date = None
            else:
                # 更新回撤相关统计
                if peak_market_value > ZERO:
                    current_drawdown = (peak_market_value - snapshot.hos_market_value) / peak_market_value
                    if current_drawdown > max_drawdown:
                        max_drawdown = current_drawdown
                        max_drawdown_days = current_drawdown_days
                    elif drawdown_start_date:
                        current_drawdown_days = (snapshot.snapshot_date - drawdown_start_date).days

                    # 如果开始进入回撤阶段
                    if current_drawdown > ZERO and drawdown_start_date is None:
                        drawdown_start_date = snapshot.snapshot_date

                # 更新当前回撤天数
                if drawdown_start_date:
                    current_drawdown_days = (snapshot.snapshot_date - drawdown_start_date).days

            ana_snapshot.has_peak_market_value = peak_market_value
            ana_snapshot.has_trough_market_value = snapshot.hos_market_value  # 可根据需要调整逻辑
            ana_snapshot.has_max_drawdown = max_drawdown
            ana_snapshot.has_max_drawdown_days = max_drawdown_days

            # 最大盈利指标
            if snapshot.hos_total_cost > ZERO:
                current_profit_ratio = snapshot.hos_total_pnl / snapshot.hos_total_cost
                if current_profit_ratio > max_profit_ratio:
                    max_profit_ratio = current_profit_ratio
                    max_profit_value = snapshot.hos_total_pnl
            ana_snapshot.has_max_profit_ratio = max_profit_ratio
            ana_snapshot.has_max_profit_value = max_profit_value

            # ========== 收益率和波动率 ==========
            # 日收益率（基于市场价值变化）
            daily_return = ZERO
            if i > 0 and holding_snapshots[i - 1].hos_market_value > ZERO:
                prev_mv = holding_snapshots[i - 1].hos_market_value
                curr_mv = snapshot.hos_market_value
                # 考虑现金流影响的收益率计算
                net_cf = snapshot.hos_net_cash_flow or ZERO
                adjusted_prev_mv = prev_mv + net_cf
                if adjusted_prev_mv > ZERO:
                    daily_return = (curr_mv - adjusted_prev_mv) / adjusted_prev_mv

            ana_snapshot.has_daily_return = daily_return
            # 波动率（近30天日收益率标准差）
            # 构建近30天窗口
            window_start = max(0, i - 29)
            window_returns = [
                cls._calculate_adjusted_daily_return(holding_snapshots[j - 1], holding_snapshots[j])
                for j in range(window_start + 1, i + 1)
                if j > 0
            ]

            if len(window_returns) >= 2:
                volatility = cls._calculate_volatility(window_returns)
            else:
                volatility = ZERO

            ana_snapshot.has_return_volatility = volatility

            # ========== 仓位和贡献 ==========
            # 仓位比例
            total_portfolio_mv = portfolio_daily_mv.get(snapshot.snapshot_date, ZERO)
            if total_portfolio_mv > ZERO and snapshot.hos_market_value is not None:
                position_ratio = snapshot.hos_market_value / total_portfolio_mv
            else:
                position_ratio = ZERO

            ana_snapshot.has_position_ratio = position_ratio
            # 组合贡献（简化模型：仓位比例 × 日收益率）
            portfolio_contribution = position_ratio * daily_return if position_ratio and daily_return else ZERO
            ana_snapshot.has_portfolio_contribution = portfolio_contribution

            # ========== 分红收益 ==========
            # 累计分红收益
            if prev_analytics_snapshot and  prev_analytics_snapshot.has_total_dividend:
                ana_snapshot.has_total_dividend = prev_analytics_snapshot.has_total_dividend + snapshot.dividend_amount
            else:
                ana_snapshot.has_total_dividend = ZERO
            # cumulative_dividend = ZERO
            # for j in range(i + 1):  # 包含当天
            #     div_amt = holding_snapshots[j].dividend_amount or ZERO
            #     cumulative_dividend += div_amt
            # ana_snapshot.has_total_dividend = cumulative_dividend

            analytics_snapshots.append(ana_snapshot)

            if snapshot.holding_shares > 0:
                prev_analytics_snapshot = ana_snapshot
            else:
                prev_analytics_snapshot = None

        return analytics_snapshots

    @classmethod
    def _calculate_single_day_analytics(
            cls,
            base_snapshot: HoldingSnapshot,
            prev_analytics: Optional[HoldingAnalyticsSnapshot],
            recent_snapshots: List[HoldingSnapshot],
            calc_date: date
    ) -> Optional[HoldingAnalyticsSnapshot]:
        """
        计算单日分析快照（增量方式）

        利用前一天的分析快照状态来推导今天的指标，
        大幅提升增量计算效率。
        """
        analytics = HoldingAnalyticsSnapshot()
        analytics.ho_id = base_snapshot.ho_id
        analytics.snapshot_date = calc_date
        analytics.calc_version = "v1.0"
        analytics.has_calc_comment = "Incremental calculation"
        # ========== 路径依赖指标（基于前一天状态）==========
        if prev_analytics:
            # 继承前一天的状态
            peak_market_value = prev_analytics.has_peak_market_value or ZERO
            max_drawdown = prev_analytics.has_max_drawdown or ZERO
            max_drawdown_days = prev_analytics.has_max_drawdown_days or 0
            max_profit_ratio = prev_analytics.has_max_profit_ratio or ZERO
            max_profit_value = prev_analytics.has_max_profit_value or ZERO
        else:
            # 没有前一天数据，需要从头计算
            peak_market_value = ZERO
            max_drawdown = ZERO
            max_drawdown_days = 0
            max_profit_ratio = ZERO
            max_profit_value = ZERO
        # 更新峰值市值
        if base_snapshot.hos_market_value > peak_market_value:
            peak_market_value = base_snapshot.hos_market_value
        analytics.has_peak_market_value = peak_market_value
        analytics.has_trough_market_value = base_snapshot.hos_market_value
        # 更新回撤指标
        if peak_market_value > ZERO:
            current_drawdown = (peak_market_value - base_snapshot.hos_market_value) / peak_market_value
            if current_drawdown > max_drawdown:
                max_drawdown = current_drawdown
                # 注意：增量模式下难以精确计算最大回撤天数
                max_drawdown_days = 0  # 简化处理
            else:
                max_drawdown_days = max_drawdown_days + 1 if max_drawdown > ZERO else 0
        analytics.has_max_drawdown = max_drawdown
        analytics.has_max_drawdown_days = max_drawdown_days
        # 更新最大盈利指标
        if base_snapshot.hos_total_cost > ZERO:
            current_profit_ratio = base_snapshot.hos_total_pnl / base_snapshot.hos_total_cost
            if current_profit_ratio > max_profit_ratio:
                max_profit_ratio = current_profit_ratio
                max_profit_value = base_snapshot.hos_total_pnl
        analytics.has_max_profit_ratio = max_profit_ratio
        analytics.has_max_profit_value = max_profit_value
        # ========== 收益率和波动率 ==========
        daily_return = ZERO
        if prev_analytics and hasattr(prev_analytics, 'has_daily_return'):
            # 可以复用之前计算的结果或重新计算
            pass

        # 重新计算当日收益率
        if recent_snapshots and len(recent_snapshots) >= 2:
            prev_snap = recent_snapshots[-2] if len(recent_snapshots) >= 2 else None
            curr_snap = recent_snapshots[-1]

            if prev_snap and curr_snap and prev_snap.hos_market_value > ZERO:
                daily_return = cls._calculate_adjusted_daily_return(prev_snap, curr_snap)

        analytics.has_daily_return = daily_return
        # 波动率计算
        if len(recent_snapshots) >= 2:
            returns = []
            for i in range(1, min(30, len(recent_snapshots))):
                ret = cls._calculate_adjusted_daily_return(
                    recent_snapshots[i - 1],
                    recent_snapshots[i]
                )
                returns.append(ret)

            if len(returns) >= 2:
                volatility = cls._calculate_volatility(returns)
            else:
                volatility = ZERO
        else:
            volatility = ZERO

        analytics.has_return_volatility = volatility
        # ========== 仓位和贡献 ==========
        # 获取组合总市值
        portfolio_mv = cls._get_portfolio_market_value_for_date(calc_date)
        if portfolio_mv > ZERO and base_snapshot.hos_market_value:
            position_ratio = base_snapshot.hos_market_value / portfolio_mv
        else:
            position_ratio = ZERO

        analytics.has_position_ratio = position_ratio
        analytics.has_portfolio_contribution = position_ratio * daily_return if position_ratio and daily_return else ZERO
        # ========== 分红收益 ==========
        cumulative_dividend = base_snapshot.dividend_amount or ZERO
        if prev_analytics and prev_analytics.has_total_dividend:
            cumulative_dividend += prev_analytics.has_total_dividend

        analytics.has_total_dividend = cumulative_dividend
        return analytics

    @staticmethod
    def _calculate_adjusted_daily_return(prev_snapshot: HoldingSnapshot, curr_snapshot: HoldingSnapshot) -> Decimal:
        """
        计算考虑现金流调整的日收益率

        公式：(今日市值 - (昨日市值 + 净现金流)) / (昨日市值 + 净现金流)
        """
        if not prev_snapshot.hos_market_value or prev_snapshot.hos_market_value <= ZERO:
            return ZERO

        prev_mv = prev_snapshot.hos_market_value
        curr_mv = curr_snapshot.hos_market_value or ZERO
        net_cf = curr_snapshot.hos_net_cash_flow or ZERO

        denominator = prev_mv + net_cf
        if denominator <= ZERO:
            return ZERO

        return (curr_mv - denominator) / denominator

    @staticmethod
    def _calculate_volatility(returns: List[Decimal]) -> Decimal:
        """
        计算收益率序列的标准差（年化波动率）

        参数:
            returns: 日收益率列表

        返回:
            年化波动率（假设252个交易日/年）
        """
        if len(returns) < 2:
            return ZERO

        n = Decimal(len(returns))
        # 计算平均值
        mean = sum(returns) / n
        # 计算方差
        variance = sum((r - mean) ** 2 for r in returns) / (n - 1)
        # 标准差（日波动率）
        daily_vol = variance.sqrt()
        # 年化波动率（假设252个交易日）
        TRADING_DAYS_PER_YEAR = Decimal('252')
        annualized_volatility = daily_vol * TRADING_DAYS_PER_YEAR.sqrt()

        return Decimal(str(round(annualized_volatility, 6)))

    @staticmethod
    def _get_portfolio_daily_market_value(dates: List[date]) -> Dict[date, Decimal]:
        """
        获取组合在指定日期的总市值

        用于计算个股仓位比例
        """
        if not dates:
            return {}

        # 查询指定日期范围内每日的组合总市值
        query_result = db.session.query(
            HoldingSnapshot.snapshot_date,
            func.sum(HoldingSnapshot.hos_market_value).label('total_mv')
        ).filter(
            HoldingSnapshot.snapshot_date.in_(dates)
        ).group_by(HoldingSnapshot.snapshot_date).all()

        return {row.snapshot_date: row.total_mv or ZERO for row in query_result}

    @staticmethod
    def _get_portfolio_market_value_for_date(target_date: date) -> Decimal:
        """
        获取组合在特定日期的总市值
        """
        result = db.session.query(func.sum(HoldingSnapshot.hos_market_value)).filter(
            HoldingSnapshot.snapshot_date == target_date
        ).scalar()

        return result or ZERO
