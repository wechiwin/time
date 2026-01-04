# app/service/holding_snapshot_service.py
import logging
import time
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import func

from app.constant.biz_enums import TradeTypeEnum
from app.framework.exceptions import BizException
from app.models import db, HoldingSnapshot, Holding, FundNavHistory, Trade
from app.tools.date_tool import date_to_str

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


class HoldingSnapshotService:

    @classmethod
    def generate_all_snapshots(cls):
        """
        批量覆盖式生成所有快照。
        """
        logger.info("Starting to generate all holding snapshots...")
        start_time = time.time()

        holdings = Holding.query.all()
        total_generated = 0
        errors = []

        try:
            for holding in holdings:
                logger.info(f"Processing holding: {holding.ho_code} ({holding.ho_name})")
                # 获取所有交易记录
                trade_list = Trade.query.filter(Trade.ho_id == holding.id).order_by(Trade.tr_date, Trade.id).all()
                if not trade_list:
                    continue
                # 根据tr_round分组
                grouped_by_round = defaultdict(list)
                for trade in trade_list:
                    grouped_by_round[trade.tr_round].append(trade)

                # 根据交易记录生成数据
                for tr_round, round_trades in grouped_by_round.items():
                    start_date = round_trades[0].tr_date
                    end_date = round_trades[-1].tr_date

                    # 获取区间内所有净值
                    nav_history_list = FundNavHistory.query.filter(
                        FundNavHistory.ho_id == holding.id,
                        FundNavHistory.nav_date >= start_date,
                        FundNavHistory.nav_date <= end_date
                    ).all()
                    nav_map = {date_to_str(nav.nav_date): nav for nav in nav_history_list}

                    trades_by_date = defaultdict(list)
                    for trade in round_trades:
                        trades_by_date[date_to_str(trade.tr_date)].append(trade)

                    # 初始化状态变量
                    current_shares = ZERO
                    current_total_cost = ZERO
                    cumulative_realized_pnl = ZERO
                    previous_snapshot = None
                    snapshots_to_add = []

                    # 用于计算高级指标的状态变量
                    first_trade_date_in_round = round_trades[0].tr_date
                    peak_market_value_in_round = ZERO

                    # 逐日计算快照
                    current_date = start_date
                    while current_date <= end_date:
                        net_investment_today = ZERO

                        # 6.1 处理当日所有交易，更新持仓状态
                        if date_to_str(current_date) in trades_by_date:
                            for trade in trades_by_date[date_to_str(current_date)]:
                                if trade.tr_type == TradeTypeEnum.BUY.value:
                                    current_shares += trade.tr_shares
                                    current_total_cost += trade.tr_amount
                                    net_investment_today += trade.tr_amount
                                elif trade.tr_type == TradeTypeEnum.SELL.value:
                                    # 使用移动加权平均法计算卖出部分的成本
                                    if current_shares > 0:
                                        cost_of_sold_shares = (current_total_cost / current_shares) * trade.tr_shares
                                        current_total_cost -= cost_of_sold_shares

                                        realized_pnl_from_this_sell = trade.tr_amount - cost_of_sold_shares
                                        cumulative_realized_pnl += realized_pnl_from_this_sell
                                    else:
                                        # 如果在卖出前份额已为0（异常数据），成本也归0
                                        # current_total_cost = ZERO
                                        raise BizException(
                                            f"Sell trade on {current_date} for {holding.ho_code} but shares are zero.")

                                    current_shares -= trade.tr_shares
                                    # 卖出所得计为负向投资
                                    net_investment_today -= trade.tr_amount

                        # 6.2 获取当日净值，如果不存在（如节假日），则跳过当天
                        nav_today = nav_map.get(date_to_str(current_date))
                        if not nav_today:
                            current_date += timedelta(days=1)
                            continue

                        # 6.3 如果当日持仓份额 > 0，则计算并生成快照
                        if current_shares > ZERO:
                            snapshot = HoldingSnapshot(
                                ho_id=holding.id,
                                snapshot_date=current_date
                            )

                            # 基本持仓信息
                            snapshot.hos_shares = current_shares
                            snapshot.hos_total_cost = current_total_cost
                            snapshot.hos_cost_price = (current_total_cost / current_shares
                                                       if current_shares > 0 else ZERO)

                            # 市场价值信息
                            snapshot.market_price = nav_today.nav_per_unit
                            snapshot.accum_market_price = nav_today.nav_accumulated_per_unit
                            snapshot.hos_market_value = current_shares * nav_today.nav_per_unit

                            # 未实现盈亏
                            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - snapshot.hos_total_cost
                            # 实现盈亏
                            snapshot.hos_realized_pnl = cumulative_realized_pnl

                            # 累计盈亏
                            snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
                            snapshot.hos_total_pnl_ratio = (
                                snapshot.hos_total_pnl / snapshot.hos_total_cost
                                if snapshot.hos_total_cost > 0 else ZERO
                            )
                            # 当日盈亏
                            previous_market_value = previous_snapshot.hos_market_value if previous_snapshot else ZERO
                            snapshot.hos_daily_pnl = snapshot.hos_market_value - previous_market_value - net_investment_today
                            snapshot.hos_daily_pnl_ratio = (
                                snapshot.hos_daily_pnl / previous_market_value
                                if previous_market_value > 0 else ZERO
                            )
                            # 高级指标
                            snapshot.hos_holding_days = (current_date - first_trade_date_in_round).days + 1

                            # 最大回撤
                            peak_market_value_in_round = max(peak_market_value_in_round, snapshot.hos_market_value)
                            snapshot.hos_peak_market_value = peak_market_value_in_round
                            if snapshot.hos_peak_market_value > 0:
                                snapshot.hos_max_drawdown = (
                                        (snapshot.hos_peak_market_value - snapshot.hos_market_value)
                                        / snapshot.hos_peak_market_value)
                            else:
                                snapshot.hos_max_drawdown = ZERO

                            snapshots_to_add.append(snapshot)
                            previous_snapshot = snapshot
                        else:
                            # 如果当天清仓，则插入数据，重置状态
                            snapshot = HoldingSnapshot(
                                ho_id=holding.id,
                                snapshot_date=current_date,
                                hos_shares=ZERO,
                                hos_total_cost=previous_snapshot.hos_total_cost,
                                hos_cost_price=previous_snapshot.hos_cost_price,
                                market_price=nav_today.nav_per_unit,
                                accum_market_price=nav_today.nav_accumulated_per_unit,
                                hos_market_value=previous_snapshot.hos_shares * nav_today.nav_per_unit,
                                hos_unrealized_pnl=ZERO,
                                hos_realized_pnl=cumulative_realized_pnl,
                                hos_total_pnl=cumulative_realized_pnl,
                            )

                            # 计算清仓日的当日盈亏（基于前一日持仓）
                            if previous_snapshot:
                                # 清仓日的当日盈亏 = (期末持仓市值 - 期初持仓市值) - 当日净现金流入
                                # 由于期末市值为0，净现金流入 = -net_investment_today（因为 net_inv = 买入 - 卖出）
                                # 所以: hos_daily_pnl = 0 - prev_mv - net_inv = -prev_mv - net_inv
                                # 此计算方式符合投资组合绩效标准，反映剔除现金流后的纯市场损益。
                                snapshot.hos_daily_pnl = -previous_snapshot.hos_market_value - net_investment_today
                                snapshot.hos_daily_pnl_ratio = (
                                        snapshot.hos_daily_pnl / previous_snapshot.hos_market_value) if previous_snapshot.hos_market_value > 0 else ZERO

                                snapshot.hos_total_pnl_ratio = (
                                    snapshot.hos_total_pnl / snapshot.hos_total_cost
                                    if snapshot.hos_total_cost > 0 else ZERO
                                )
                                # 清仓日的持仓天数为前一日持仓天数 + 1
                                snapshot.hos_holding_days = previous_snapshot.hos_holding_days + 1

                                # 最大回撤：清仓日的回撤应为0（因为已无持仓）
                                # 最大回撤
                                peak_market_value_in_round = max(peak_market_value_in_round, snapshot.hos_market_value)
                                snapshot.hos_peak_market_value = peak_market_value_in_round
                                if snapshot.hos_peak_market_value > 0:
                                    snapshot.hos_max_drawdown = (
                                            (snapshot.hos_peak_market_value - snapshot.hos_market_value)
                                            / snapshot.hos_peak_market_value)
                                else:
                                    snapshot.hos_max_drawdown = ZERO
                                # snapshot.hos_max_drawdown = ZERO
                            else:
                                # 如果没有前一日快照（异常情况），设置默认值
                                snapshot.hos_daily_pnl = ZERO
                                snapshot.hos_daily_pnl_ratio = ZERO
                                snapshot.hos_holding_days = 0
                                snapshot.hos_peak_market_value = ZERO
                                snapshot.hos_max_drawdown = ZERO

                            snapshots_to_add.append(snapshot)
                            previous_snapshot = None
                            peak_market_value_in_round = ZERO
                            cumulative_realized_pnl = ZERO
                        current_date += timedelta(days=1)
                    # 7. 将该轮次生成的所有快照批量添加到 session
                    if snapshots_to_add:
                        # 先删除之前的记录
                        deleted = HoldingSnapshot.query.filter(
                            HoldingSnapshot.ho_id == holding.id,
                            HoldingSnapshot.snapshot_date >= start_date,
                            HoldingSnapshot.snapshot_date <= end_date
                        ).delete(synchronize_session=False)
                        logger.info(f"deleted {deleted} records for {holding.ho_code} in generate_all_snapshots.")

                        db.session.add_all(snapshots_to_add)
                        total_generated += len(snapshots_to_add)
                        logger.info(
                            f"Generated {len(snapshots_to_add)} snapshots for round {tr_round} of holding {holding.ho_name}.")

            db.session.commit()
            end_time = time.time()

            logger.info(f"Successfully generated and committed a total of {total_generated} snapshots for all holdings in {end_time - start_time:.2f} seconds.")
        except Exception as e:
            db.session.rollback()
            logger.error(e, exc_info=True)
            errors.append("Failed to generate snapshots")

        # 9. 最终报告
        if not errors:
            logger.info(f"Successfully generated a total of {total_generated} snapshots for all holdings.")
        else:
            logger.warning(
                f"Finished generating snapshots with {len(errors)} errors. Total generated: {total_generated}.")
        return {"total_generated": total_generated, "errors": errors}

    @classmethod
    def generate_yesterday_snapshots(cls):
        """
        每日增量任务：为所有持仓生成昨天的快照（如果有净值），利用前天的快照来提高效率
        """
        logger.info("Starting daily task: generate_yesterday_snapshots.")

        yesterday = date.today() - timedelta(days=1)
        day_before_yesterday = yesterday - timedelta(days=1)

        # 1. 筛选目标：只处理当前仍在持仓中的标的
        yesterday_traded_holding_ids = db.session.query(Trade.ho_id).filter(
            Trade.tr_date == yesterday
        ).distinct().all()
        yesterday_traded_holding_ids = [id_tuple[0] for id_tuple in yesterday_traded_holding_ids]

        # 找出在day_before_yesterday有快照的所有持仓
        target_holding_ids_from_snapshots = db.session.query(HoldingSnapshot.ho_id).filter(
            HoldingSnapshot.snapshot_date == day_before_yesterday
        ).distinct().all()
        target_holding_ids_from_snapshots = [id_tuple[0] for id_tuple in target_holding_ids_from_snapshots]

        # 合并两个集合：昨天有交易的 + 当前仍在持仓的
        target_holding_ids = set(target_holding_ids_from_snapshots) | set(yesterday_traded_holding_ids)
        if not target_holding_ids:
            logger.info("No target holdings found. Task finished.")
            return {'generated': 0, 'errors': []}

        # 2. 数据预取，减少循环内DB查询
        # 预取昨天的净值
        yesterday_navs_list = FundNavHistory.query.filter(
            FundNavHistory.ho_id.in_(target_holding_ids),
            FundNavHistory.nav_date == yesterday
        ).all()
        nav_map = {nav.ho_id: nav for nav in yesterday_navs_list}

        # 预取前天的快照
        prev_snapshots_list = HoldingSnapshot.query.filter(
            HoldingSnapshot.ho_id.in_(target_holding_ids),
            HoldingSnapshot.snapshot_date == day_before_yesterday
        ).all()
        prev_snapshot_map = {snap.ho_id: snap for snap in prev_snapshots_list}

        # 预取昨天的交易
        yesterday_trades_list = Trade.query.filter(
            Trade.ho_id.in_(target_holding_ids),
            Trade.tr_date == yesterday
        ).order_by(Trade.id).all()
        trades_by_holding = defaultdict(list)
        for trade in yesterday_trades_list:
            trades_by_holding[trade.ho_id].append(trade)

        # 预取持仓信息
        holdings_map = {h.id: h for h in Holding.query.filter(Holding.id.in_(target_holding_ids)).all()}

        snapshots_to_add = []
        errors = []

        try:
            # 3. 循环处理每个持仓
            for ho_id in target_holding_ids:
                holding = holdings_map.get(ho_id)
                if not holding:
                    logger.warning(f"Holding with id {ho_id} not found. Skipping.")
                    continue

                # 3.1 检查是否已存在快照，确保任务可重复执行
                if HoldingSnapshot.query.filter_by(ho_id=holding.id, snapshot_date=yesterday).first():
                    logger.info(f"Snapshot for {holding.ho_code} on {yesterday} already exists. Skipping.")
                    continue

                # 3.2 检查昨天是否有净值，没有则无法生成快照
                nav_yesterday = nav_map.get(holding.id)
                if not nav_yesterday:
                    logger.warning(f"No NAV found for {holding.ho_code} on {yesterday}. Skipping.")
                    continue

                # 3.3 确定计算的起点（增量或全量）
                prev_snapshot = prev_snapshot_map.get(holding.id)

                if prev_snapshot:
                    # 增量计算：基于前一天的快照
                    start_shares = prev_snapshot.hos_shares
                    start_cost = prev_snapshot.hos_total_cost
                    start_realized_pnl = prev_snapshot.hos_realized_pnl
                    start_peak_mv = prev_snapshot.hos_peak_market_value
                    start_holding_days = prev_snapshot.hos_holding_days
                else:
                    # Fallback：如果前一天快照不存在，则从头计算
                    logger.warning(f"Previous day's snapshot not found for {holding.ho_code}. "
                                   f"Falling back to full calculation up to {day_before_yesterday}.")
                    start_shares, start_cost = cls._calculate_position_up_to_date(holding.id, day_before_yesterday)
                    start_realized_pnl = cls._get_realized_pnl_up_to_date(holding.id, day_before_yesterday)
                    # 对于高级指标，也需要回溯
                    start_peak_mv = cls._get_peak_mv_up_to_date(holding.id, day_before_yesterday)
                    first_trade = Trade.query.filter_by(ho_id=holding.id).order_by(Trade.tr_date).first()
                    start_holding_days = (day_before_yesterday - first_trade.tr_date).days + 1 if first_trade else 0

                # 3.4 应用昨天的交易
                current_shares, current_total_cost, current_realized_pnl, net_investment_yesterday = cls._apply_trades_for_day(
                    start_shares, start_cost, start_realized_pnl, trades_by_holding.get(holding.id, [])
                )

                # 3.5 如果昨天之后仍有持仓，或昨天刚清仓，则生成快照
                if current_shares > 0 or (current_shares <= 0 and start_shares > 0):
                    snapshot = HoldingSnapshot(ho_id=holding.id, snapshot_date=yesterday)

                    # 计算各项指标
                    snapshot.hos_shares = current_shares
                    snapshot.hos_total_cost = current_total_cost
                    snapshot.hos_cost_price = (
                            current_total_cost / current_shares) if current_shares > 0 else ZERO

                    snapshot.market_price = nav_yesterday.nav_per_unit
                    snapshot.accum_market_price = nav_yesterday.nav_accumulated_per_unit
                    snapshot.hos_market_value = current_shares * nav_yesterday.nav_per_unit

                    snapshot.hos_unrealized_pnl = snapshot.hos_market_value - snapshot.hos_total_cost
                    snapshot.hos_realized_pnl = current_realized_pnl
                    snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
                    snapshot.hos_total_pnl_ratio = (
                            snapshot.hos_total_pnl / snapshot.hos_total_cost) if snapshot.hos_total_cost > 0 else ZERO

                    prev_market_value = prev_snapshot.hos_market_value if prev_snapshot else ZERO
                    snapshot.hos_daily_pnl = snapshot.hos_market_value - prev_market_value - net_investment_yesterday
                    snapshot.hos_daily_pnl_ratio = (snapshot.hos_daily_pnl / prev_market_value
                                                    if prev_market_value > 0 else ZERO)

                    snapshot.hos_holding_days = start_holding_days + 1
                    # 最大回撤计算
                    snapshot.hos_peak_market_value = max(start_peak_mv, snapshot.hos_market_value)
                    if snapshot.hos_peak_market_value > 0:
                        snapshot.hos_max_drawdown = ((snapshot.hos_peak_market_value - snapshot.hos_market_value)
                                                     / snapshot.hos_peak_market_value)
                    else:
                        snapshot.hos_max_drawdown = ZERO

                    snapshots_to_add.append(snapshot)
            # 4. 批量提交
            if snapshots_to_add:
                db.session.add_all(snapshots_to_add)
                db.session.commit()
                logger.info(f"Successfully generated and committed {len(snapshots_to_add)} new snapshots.")
            else:
                logger.info("No new snapshots were generated.")

            return {'generated': len(snapshots_to_add), 'errors': errors}
        except Exception as e:
            db.session.rollback()
            logger.error(f"An error occurred during snapshot generation: {e}", exc_info=True)
            return {'generated': 0, 'errors': [str(e)]}

    @classmethod
    def _apply_trades_for_day(cls, start_shares, start_cost, start_realized_pnl, trades):
        """应用当日交易，返回期末份额、成本、累计已实现盈亏和当日净投入"""
        net_investment = ZERO
        cumulative_realized_pnl = start_realized_pnl

        for trade in trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                start_shares += trade.tr_shares
                start_cost += trade.tr_amount
                net_investment += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if start_shares > 0:
                    cost_of_sold = (start_cost / start_shares) * trade.tr_shares
                    start_cost -= cost_of_sold

                    realized_pnl_from_this_sell = trade.tr_amount - cost_of_sold
                    cumulative_realized_pnl += realized_pnl_from_this_sell
                start_shares -= trade.tr_shares
                net_investment -= trade.tr_amount
        return start_shares, start_cost, cumulative_realized_pnl, net_investment

    @classmethod
    def _get_realized_pnl_up_to_date(cls, ho_id, target_date):
        """辅助方法，计算截至某日的累计已实现盈亏"""
        sell_trades = Trade.query.filter(
            Trade.ho_id == ho_id,
            Trade.tr_date <= target_date,
            Trade.tr_type == TradeTypeEnum.SELL.value
        ).order_by(Trade.tr_date, Trade.id).all()

        # 需要模拟持仓状态来计算卖出成本
        total_shares = ZERO
        total_cost = ZERO
        cumulative_realized_pnl = ZERO

        all_trades = Trade.query.filter(
            Trade.ho_id == ho_id,
            Trade.tr_date <= target_date
        ).order_by(Trade.tr_date, Trade.id).all()

        for trade in all_trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                total_shares += trade.tr_shares
                total_cost += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if total_shares > 0:
                    cost_of_sold = (total_cost / total_shares) * trade.tr_shares
                    total_cost -= cost_of_sold
                    realized_pnl = trade.tr_amount - cost_of_sold
                    cumulative_realized_pnl += realized_pnl
                total_shares -= trade.tr_shares

        return cumulative_realized_pnl

    @classmethod
    def _calculate_position_up_to_date(cls, ho_id, target_date):
        """
        辅助方法：计算指定持仓在某个日期（含）之前的累计份额和成本。
        用于增量更新失败时的 Fallback。
        """
        trades = Trade.query.filter(
            Trade.ho_id == ho_id,
            Trade.tr_date <= target_date
        ).order_by(Trade.tr_date, Trade.id).all()
        total_shares = ZERO
        total_cost = ZERO
        for trade in trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                total_shares += trade.tr_shares
                total_cost += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if total_shares > 0:
                    cost_of_sold = (total_cost / total_shares) * trade.tr_shares
                    total_cost -= cost_of_sold
                total_shares -= trade.tr_shares

        return total_shares, total_cost

    @classmethod
    def _get_peak_mv_up_to_date(cls, ho_id, target_date):
        """辅助方法：获取截至某日的历史市值峰值，用于Fallback"""
        last_snapshot = HoldingSnapshot.query.filter(
            HoldingSnapshot.ho_id == ho_id,
            HoldingSnapshot.snapshot_date <= target_date
        ).order_by(HoldingSnapshot.snapshot_date.desc()).first()
        return last_snapshot.hos_peak_market_value if last_snapshot else ZERO

    @classmethod
    def backfill_advanced_metrics(cls, ho_id: Optional[int] = None):
        """
        回填或修复快照中的高级指标，使其与最新的计算逻辑保持一致。
        处理的指标包括:
        - hos_max_profit_ratio
        - hos_daily_nav_return
        - hos_price_return, hos_dividend_return
        - hos_position_ratio
        :param ho_id: 可选，指定单个持仓进行回填。如果为 None，则处理所有持仓。
        """
        logger.info(f"Starting backfill for advanced metrics. Target ho_id: {'All' if ho_id is None else ho_id}")

        try:
            # 注意：仓位占比是相对于整个投资组合，所以这里不应该受 ho_id 参数的限制
            total_mv_query = db.session.query(
                HoldingSnapshot.snapshot_date,
                func.sum(HoldingSnapshot.hos_market_value).label('total_mv')
            ).group_by(HoldingSnapshot.snapshot_date).all()

            daily_total_market_value = {
                row.snapshot_date: row.total_mv for row in total_mv_query if row.total_mv and row.total_mv > 0
            }
            logger.info(f"Successfully pre-calculated total market values for {len(daily_total_market_value)} dates.")
        except Exception as e:
            logger.error(f"Failed to pre-calculate daily total market value: {e}", exc_info=True)
            return {'updated': 0, 'errors': [f"Pre-calculation failed: {e}"]}

        # 2. 获取所有需要处理的快照记录
        query = HoldingSnapshot.query
        if ho_id:
            query = query.filter(HoldingSnapshot.ho_id == ho_id)

        # 按持仓和日期排序，这是按时间序列处理的前提
        all_snapshots = query.order_by(HoldingSnapshot.ho_id, HoldingSnapshot.snapshot_date).all()
        if not all_snapshots:
            logger.warning("No snapshots found for backfilling.")
            return {'updated': 0, 'errors': []}

        # 按 ho_id 分组
        snapshots_by_holding = defaultdict(list)
        for snap in all_snapshots:
            snapshots_by_holding[snap.ho_id].append(snap)

        updated_count = 0
        errors = []

        try:
            # 3. 逐个持仓进行指标回填
            for hid, snaps in snapshots_by_holding.items():
                logger.debug(f"Backfilling metrics for ho_id: {hid}")

                # 初始化每个持仓轮次的状态变量
                first_holding_date_in_round = None
                peak_market_value_in_round = ZERO
                max_profit_ratio_in_round = Decimal('-Infinity')
                previous_snapshot = None  # 用于计算日度指标

                for snap in snaps:
                    # 确保关键数值为 Decimal 类型，避免 None 导致计算错误
                    snap.hos_market_value = snap.hos_market_value or ZERO
                    snap.hos_total_cost = snap.hos_total_cost or ZERO
                    snap.hos_total_pnl = snap.hos_total_pnl or ZERO
                    snap.hos_daily_pnl = snap.hos_daily_pnl or ZERO
                    snap.market_price = snap.market_price or ZERO

                    # 如果当天有持仓
                    if snap.hos_shares and snap.hos_shares > 0:
                        if first_holding_date_in_round is None:
                            # 这是一个新持仓轮次的开始
                            first_holding_date_in_round = snap.snapshot_date
                    else:

                        # TODO 清仓日的 hos_peak_market_value 和 hos_max_drawdown 也应为 0
                        # snap.hos_peak_market_value = ZERO
                        # snap.hos_max_drawdown = ZERO
                        snap.hos_max_profit_ratio = ZERO
                        snap.hos_daily_nav_return = ZERO
                        if previous_snapshot and previous_snapshot.hos_shares and previous_snapshot.hos_shares > 0:
                            prev_nav = previous_snapshot.market_price or ZERO
                            price_change_pnl = (snap.market_price - prev_nav) * previous_snapshot.hos_shares
                            snap.hos_price_return = price_change_pnl
                            snap.hos_dividend_return = snap.hos_daily_pnl - price_change_pnl
                        else:
                            snap.hos_price_return = snap.hos_daily_pnl  # 首日的价格收益等于当日盈亏

                        # 当天已清仓，重置轮次状态
                        first_holding_date_in_round = None
                        peak_market_value_in_round = ZERO
                        max_profit_ratio_in_round = Decimal('-Infinity')

                        snap.hos_dividend_return = ZERO
                        snap.hos_position_ratio = ZERO

                        previous_snapshot = None  # 清仓后，下一轮的计算不应依赖于此快照
                        updated_count += 1
                        continue  # 处理下一个快照

                    # 3.2 市值峰值 (hos_peak_market_value) 和 最大回撤 (hos_max_drawdown)
                    # peak_market_value_in_round = max(peak_market_value_in_round, snap.hos_market_value)
                    # snap.hos_peak_market_value = peak_market_value_in_round

                    # if snap.hos_peak_market_value > 0:
                    #     snap.hos_max_drawdown = ((snap.hos_peak_market_value - snap.hos_market_value)
                    #                              / snap.hos_peak_market_value)
                    # else:
                    #     snap.hos_max_drawdown = ZERO

                    # 3.3 最大浮盈率 (hos_max_profit_ratio)
                    if snap.hos_total_cost > 0:
                        profit_ratio = snap.hos_total_pnl / snap.hos_total_cost
                        max_profit_ratio_in_round = max(max_profit_ratio_in_round, profit_ratio)
                        snap.hos_max_profit_ratio = max_profit_ratio_in_round
                    else:
                        # 如果成本为0或负数，浮盈率无意义
                        snap.hos_max_profit_ratio = ZERO

                    # 3.4 日净值回报率 (hos_daily_nav_return)
                    if previous_snapshot and previous_snapshot.market_price and previous_snapshot.market_price > 0:
                        snap.hos_daily_nav_return = (snap.market_price / previous_snapshot.market_price) - 1
                    else:
                        snap.hos_daily_nav_return = ZERO
                    # 3.5 价格收益 (hos_price_return) 和 分红收益 (hos_dividend_return)
                    if previous_snapshot and previous_snapshot.hos_shares and previous_snapshot.hos_shares > 0:
                        prev_nav = previous_snapshot.market_price or ZERO
                        price_change_pnl = (snap.market_price - prev_nav) * previous_snapshot.hos_shares
                        snap.hos_price_return = price_change_pnl
                        snap.hos_dividend_return = snap.hos_daily_pnl - price_change_pnl
                    else:
                        snap.hos_price_return = snap.hos_daily_pnl  # 首日的价格收益等于当日盈亏
                        snap.hos_dividend_return = ZERO
                    # 3.6 仓位占比 (hos_position_ratio)
                    total_mv_on_date = daily_total_market_value.get(snap.snapshot_date)
                    if total_mv_on_date and total_mv_on_date > 0:
                        snap.hos_position_ratio = snap.hos_market_value / total_mv_on_date
                    else:
                        snap.hos_position_ratio = ZERO

                    updated_count += 1
                    previous_snapshot = snap  # 更新前一日快照，为下一次循环做准备

            # 所有计算完成后，一次性提交
            db.session.commit()
            logger.info(f"Successfully backfilled and committed metrics for {updated_count} snapshot records.")

        except Exception as e:
            db.session.rollback()
            error_msg = f"An error occurred during metrics backfill: {e}"
            logger.error(error_msg, exc_info=True)
            errors.append(error_msg)
        logger.info({'updated': updated_count, 'errors': errors})
        return {'updated': updated_count, 'errors': errors}
