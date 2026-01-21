import logging
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, Date

from app.calendars.trade_calendar import TradeCalendar
from app.database import db
from app.framework.async_task_manager import create_task
from app.models import HoldingSnapshot, InvestedAssetSnapshot

logger = logging.getLogger(__name__)
trade_calendar = TradeCalendar()

ZERO = Decimal('0')


class InvestedAssetSnapshotService:
    """
    投资资产整体快照服务
    负责将当天的所有 HoldingSnapshot 聚合成一条 InvestedAssetSnapshot
    """

    @classmethod
    def generate_by_day(cls, target_date: Date = None):
        """
        【增量任务入口】
        通常由定时任务调用，生成 T-1 日的快照
        """
        if not target_date:
            target_date = date.today() - timedelta(days=1)

        if not trade_calendar.is_trade_day(target_date):
            logger.info(f"{target_date} is not a trading day. Skipping.")
            return None

        logger.info(f"Starting InvestedAssetSnapshot generation for {target_date}...")

        try:
            # 1. 获取前一交易日数据 (单日模式下必须查库)
            prev_date = trade_calendar.prev_trade_day(target_date)
            prev_snapshot = InvestedAssetSnapshot.query.filter_by(snapshot_date=prev_date).first()

            # 2. 计算
            snapshot = cls._calculate_snapshot(target_date, prev_snapshot)
            if not snapshot:
                return None

            # 删除旧数据（防重入）
            InvestedAssetSnapshot.query.filter_by(snapshot_date=target_date).delete()
            # 4. 保存入库
            db.session.add(snapshot)
            db.session.commit()

            return snapshot
        except Exception as e:
            db.session.rollback()
            error_msg = f"Error generating InvestedAssetSnapshot for {target_date}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            # 触发重试
            create_task(
                task_name=f"retry_invested_asset_snapshot_{target_date}",
                module_path="app.service.invested_asset_snapshot_service",
                class_name="InvestedAssetSnapshotService",
                method_name="generate_by_day",
                kwargs={"target_date": target_date},
                error_message=error_msg
            )
            return None

    @classmethod
    def regenerate_all(cls):
        """
        【全量重刷入口】
        清除所有历史数据，从最早的持仓记录开始重新生成。
        """
        logger.info("Starting Full Regeneration of InvestedAssetSnapshot...")
        start_time = time.time()

        total_generated = 0
        errors = []

        # 1. 找出最早的持仓日期
        min_date = db.session.query(func.min(HoldingSnapshot.snapshot_date)).scalar()
        if not min_date:
            msg = "No HoldingSnapshot data found. Aborting regeneration."
            logger.warning(msg)
            errors.append(msg)
            return {"total_generated": total_generated, "errors": errors, "duration": 0}

        # 3. 准备循环
        today = date.today()
        current_date = min_date

        # 内存缓存：保存上一交易日的快照对象
        # 初始为 None，第一天计算时会自动处理为 0 基准
        cached_prev_snapshot: Optional[InvestedAssetSnapshot] = None

        try:
            while current_date < today:
                if not trade_calendar.is_trade_day(current_date):
                    logger.info(f"{current_date} is not a trading day. Skipping.")
                    current_date += timedelta(days=1)
                    continue

                # 直接传入内存中的 cached_prev_snapshot，无需查库
                snapshot = cls._calculate_snapshot(current_date, cached_prev_snapshot)
                if not snapshot:
                    logger.warning(f"No InvestedAssetSnapshot generated for: {current_date}")
                    current_date += timedelta(days=1)
                    continue

                # 删除旧数据（防重入）
                InvestedAssetSnapshot.query.filter_by(snapshot_date=snapshot.snapshot_date).delete()

                # 保存入库
                db.session.add(snapshot)
                db.session.commit()

                # 更新缓存，供下一轮循环使用
                cached_prev_snapshot = snapshot
                total_generated += 1

                current_date += timedelta(days=1)
        except Exception as e:
            db.session.rollback()
            error_msg = f"Error generating InvestedAssetSnapshot for {current_date}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            errors.append(error_msg)
            # 触发重试
            create_task(
                task_name=f"retry_invested_asset_snapshot_{current_date}",
                module_path="app.service.invested_asset_snapshot_service",
                class_name="InvestedAssetSnapshotService",
                method_name="regenerate_all",
                kwargs={},
                error_message=error_msg
            )

        duration = time.time() - start_time
        logger.info(f"Full regeneration completed.")
        return {"total_generated": total_generated, "errors": errors, "duration": duration}

    @classmethod
    def _calculate_snapshot(cls,
                            target_date: date,
                            prev_snapshot: Optional[InvestedAssetSnapshot]
                            ) -> Optional[InvestedAssetSnapshot]:
        """
        【内部方法】纯计算逻辑
        :param target_date: 目标日期
        :param prev_snapshot: 上一交易日的快照对象 (可以是 DB 查询的，也可以是内存传递的)
        :return: 尚未持久化的 InvestedAssetSnapshot 对象
        """
        # 聚合当日所有持仓数据 使用 SQL 聚合比 Python 循环快得多
        agg_data = db.session.query(
            func.sum(HoldingSnapshot.hos_market_value).label('hos_total_mv'),
            func.sum(HoldingSnapshot.hos_holding_cost).label('hos_total_holding_cost'),
            func.sum(HoldingSnapshot.hos_unrealized_pnl).label('hos_total_unrealized_pnl'),
            func.sum(HoldingSnapshot.hos_net_external_cash_flow).label('hos_total_net_external_cash_flow'),
            func.sum(HoldingSnapshot.hos_daily_cash_dividend).label('hos_daily_total_cash_dividend'),
            func.sum(HoldingSnapshot.hos_daily_reinvest_dividend).label('hos_daily_reinvest_dividend'),
            func.sum(HoldingSnapshot.hos_daily_buy_amount).label('hos_daily_buy_amount'),
            func.sum(HoldingSnapshot.hos_daily_sell_amount).label('hos_daily_sell_amount'),
        ).filter(
            HoldingSnapshot.snapshot_date == target_date
        ).first()

        if not agg_data or agg_data.hos_total_mv is None:
            logger.warning(f"No HoldingSnapshot data found for {target_date}. Check if holding snapshots are generated.")
            return None

        # 初始化昨日数据 (处理第一天建仓的情况)
        prev_mv = prev_snapshot.ias_market_value if prev_snapshot else ZERO
        prev_total_pnl = prev_snapshot.ias_total_pnl if prev_snapshot else ZERO
        prev_total_div = prev_snapshot.ias_total_dividend if prev_snapshot else ZERO
        prev_total_reinvest_div = prev_snapshot.ias_total_reinvest_dividend if prev_snapshot else ZERO
        prev_total_cash_div = prev_snapshot.ias_total_cash_dividend if prev_snapshot else ZERO
        prev_total_buy = prev_snapshot.ias_total_buy_amount if prev_snapshot else ZERO
        prev_total_sell = prev_snapshot.ias_total_sell_amount if prev_snapshot else ZERO

        # 提取聚合数据 (处理 None 为 0)
        curr_mv = agg_data.hos_total_mv or ZERO
        curr_holding_cost = agg_data.hos_total_holding_cost or ZERO
        curr_unrealized = agg_data.hos_total_unrealized_pnl or ZERO
        daily_net_flow = agg_data.hos_total_net_external_cash_flow or ZERO
        daily_cash_div = agg_data.hos_daily_total_cash_dividend or ZERO
        daily_reinvest_div = agg_data.hos_daily_reinvest_dividend or ZERO

        # 累计买卖 (直接累加)
        daily_buy = agg_data.hos_daily_buy_amount or ZERO
        daily_sell = agg_data.hos_daily_sell_amount or ZERO

        # 3. 构建对象
        snapshot = InvestedAssetSnapshot()
        snapshot.snapshot_date = target_date
        # -------- A. Point-in-Time (时点状态) --------
        snapshot.ias_market_value = curr_mv
        snapshot.ias_holding_cost = curr_holding_cost
        snapshot.ias_unrealized_pnl = curr_unrealized
        # -------- B. Daily Flow (当日流量) --------
        snapshot.ias_net_external_cash_flow = daily_net_flow
        snapshot.ias_daily_cash_dividend = daily_cash_div
        snapshot.ias_daily_reinvest_dividend = daily_reinvest_div

        # 当日盈亏 = 当日市值 - 昨日市值 + 当日外部现金流(买负卖正) + 当日现金分红
        snapshot.ias_daily_pnl = (
                snapshot.ias_market_value
                - prev_mv
                + snapshot.ias_net_external_cash_flow
                + snapshot.ias_daily_cash_dividend
        )

        # 计算当日收益率 (Daily PnL Ratio) 如果当日有大额买入，分母不能仅为 prev_mv。
        # 采用简化逻辑：分母 = 期初市值 + 当日买入金额(绝对值)。
        denominator = prev_mv
        if snapshot.ias_net_external_cash_flow < ZERO:
            denominator += abs(snapshot.ias_net_external_cash_flow)
        if denominator > ZERO:
            snapshot.ias_daily_pnl_ratio = snapshot.ias_daily_pnl / denominator
        else:
            snapshot.ias_daily_pnl_ratio = ZERO

        # -------- C. Cumulative (历史累计 - 递归计算) --------
        # 1. 累计总收益 (Total PnL) = 昨日累计 + 当日盈亏 + 当日分红
        snapshot.ias_total_pnl = prev_total_pnl + snapshot.ias_daily_pnl
        # 2. 累计现金分红
        snapshot.ias_total_cash_dividend = prev_total_cash_div + daily_cash_div
        snapshot.ias_total_reinvest_dividend = prev_total_reinvest_div + daily_reinvest_div
        # 累计总分红，包含现金分红和分红再投资
        snapshot.ias_total_dividend = prev_total_div + daily_cash_div + daily_reinvest_div

        # 3. 倒推累计已实现盈亏 (Total Realized PnL)
        # 会计恒等式：总收益 = 已实现 + 未实现 + 总分红
        # => 已实现 = 总收益 - 未实现 - 总分红
        # 这种算法最稳健，因为它保证了账面永远是平的，不受清仓影响。
        snapshot.ias_total_realized_pnl = (
                snapshot.ias_total_pnl
                - snapshot.ias_unrealized_pnl
                - snapshot.ias_total_dividend
        )

        # 4. 累计买入/卖出
        snapshot.ias_total_buy_amount = prev_total_buy + daily_buy + daily_reinvest_div
        snapshot.ias_total_sell_amount = prev_total_sell + daily_sell

        # 5. 累计收益率 (Total Return) 使用 (累计买入 - 累计卖出) 作为净投入估算，如果小于等于0，则使用当前持仓成本。
        net_invested = snapshot.ias_total_buy_amount - snapshot.ias_total_sell_amount
        if net_invested <= ZERO:
            # 如果净投入为负（卖出超过买入），使用当前持仓成本作为分母 如果当天的持仓成本为0 说明清仓 用上一天的
            cost_base = snapshot.ias_holding_cost if snapshot.ias_holding_cost != ZERO else prev_snapshot.ias_holding_cost
        else:
            cost_base = net_invested

        if cost_base > ZERO:
            snapshot.ias_total_pnl_ratio = snapshot.ias_total_pnl / cost_base
        else:
            # 极端情况：空仓且赚钱了，或者数据异常
            snapshot.ias_total_pnl_ratio = ZERO

        return snapshot
