# app/service/holding_snapshot_service.py
import logging
import time
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Tuple, Optional

from app.calendars.trade_calendar import TradeCalendar
from app.constant.biz_enums import TradeTypeEnum
from app.framework.cache_manager import CacheManager
from app.framework.exceptions import BizException
from app.models import db, HoldingSnapshot, Holding, FundNavHistory, Trade
from app.tools.date_tool import date_to_str

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


class HoldingSnapshotService:

    @classmethod
    def generate_all_holding_snapshots(cls, ids: list[str] | None = None):
        """
        批量覆盖式生成所有快照。
        """
        logger.info("Starting to generate all holding snapshots...")
        start_time = time.time()

        total_generated = 0
        errors = []

        success_ho_ids = []
        failed_ho_ids = []

        if ids:
            holdings = Holding.query.filter(Holding.id.in_(ids)).all()
        else:
            holdings = Holding.query.all()

        if not holdings:
            return {"total_generated": 0, "errors": [], "duration": 0}

        for holding in holdings:
            to_add_snapshots = []

            snapshots = cls._generate_for_holding(holding)
            to_add_snapshots.append(snapshots)
            try:
                # 批量插入分析快照
                if to_add_snapshots:
                    # 删除旧记录
                    deleted = HoldingSnapshot.query.filter(
                        HoldingSnapshot.ho_id == holding.id
                    ).delete(synchronize_session=False)
                    # 插入新记录
                    db.session.bulk_save_objects(to_add_snapshots)
                    total_generated += len(to_add_snapshots)

                db.session.commit()
                logger.info(f"Generated {len(to_add_snapshots)} holding snapshots for {holding.ho_code}")
            except Exception as e:
                # TODO 增加缓存fallback机制 使用Flask-Caching 报错的holding重试 3次重试失败 则反馈到任务台(是否有必要新建表格)
                error_msg = f"Error processing holding {holding.ho_code}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)

        end_time = time.time()
        result = {
            "total_generated": total_generated,
            "errors": errors,
            "duration": round(end_time - start_time, 2)
        }
        return result

    @classmethod
    def _generate_for_holding(cls, holding: Holding) -> List[HoldingSnapshot]:
        """为单个持仓生成其生命周期内的所有快照（内部方法）"""
        logger.info(f"Processing holding: {holding.ho_code} ({holding.ho_name})")
        # 获取所有交易记录 时间升序
        trade_list = Trade.query.filter(Trade.ho_id == holding.id).order_by(Trade.tr_date).all()
        if not trade_list:
            return []

        # 根据tr_round分组
        trades_by_round = defaultdict(list)
        for trade in trade_list:
            trades_by_round[trade.tr_round].append(trade)

        snapshots = []

        # 根据每轮交易记录，生成快照数据
        for tr_round, round_trades in trades_by_round.items():
            first_date = round_trades[0].tr_date
            last_date = round_trades[-1].tr_date

            # 获取区间内所有净值
            nav_history_list = FundNavHistory.query.filter(
                FundNavHistory.ho_id == holding.id,
                FundNavHistory.nav_date >= first_date,
                FundNavHistory.nav_date <= last_date
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

            # 逐日计算快照
            current_date = first_date
            while current_date <= last_date:
                # 获取当日净值，如果不存在（如节假日），则跳过当天
                nav_today = nav_map.get(date_to_str(current_date))
                if not nav_today:
                    current_date += timedelta(days=1)
                    continue

                net_investment_today = ZERO

                # 处理[current_date]的所有交易
                trades_in_current_date = trades_by_date.get(date_to_str(current_date))
                if trades_in_current_date:
                    for trade in trades_in_current_date:
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
                                # TODO 这里应该引入缓存队列，失败了之后重试
                                # 如果在卖出前份额已为0（异常数据） 超卖
                                raise BizException(
                                    f"Sell trade on {current_date} for {holding.ho_code} but shares are zero.")

                            current_shares -= trade.tr_shares
                            # 卖出所得计为负向投资
                            net_investment_today -= trade.tr_amount
                # 根据数据，生成快照
                snapshot, previous_snapshot, cumulative_realized_pnl = cls._get_snapshot(
                    holding, current_date, nav_today, cumulative_realized_pnl, current_shares,
                    net_investment_today, current_total_cost, previous_snapshot)

                snapshots.append(snapshot)
                current_date += timedelta(days=1)

        return snapshots

    @classmethod
    def _get_snapshot(cls, holding, current_date, nav_today, cumulative_realized_pnl, current_shares,
                      net_investment_today, current_total_cost, previous_snapshot):
        snapshot = HoldingSnapshot()
        # 不管是否清仓，通用记录数据：
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = current_date
        snapshot.market_price = nav_today.nav_per_unit
        # 实现盈亏
        snapshot.hos_realized_pnl = cumulative_realized_pnl

        # 处理分红
        if nav_today.dividend_price:
            snapshot.dividend_amount = nav_today.dividend_price * current_shares
            net_investment_today += snapshot.dividend_amount

        if current_shares > ZERO:  # 未清仓
            # 基本持仓信息
            snapshot.holding_shares = current_shares
            snapshot.hos_total_cost = current_total_cost
            snapshot.cost_price = (current_total_cost / current_shares
                                   if current_shares > 0 else ZERO)
            # 市场价值信息
            snapshot.hos_market_value = current_shares * nav_today.nav_per_unit
            # 未实现盈亏
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - snapshot.hos_total_cost
        else:  # 清仓
            snapshot.holding_shares = ZERO
            snapshot.hos_total_cost = previous_snapshot.hos_total_cost
            snapshot.cost_price = previous_snapshot.cost_price
            snapshot.hos_market_value = previous_snapshot.holding_shares * nav_today.nav_per_unit
            snapshot.hos_unrealized_pnl = ZERO

        # 不管是否清仓，通用指标，但是必须后算
        # 反映剔除现金流后的纯市场损益 当日盈亏 = (期末持仓市值 - 期初持仓市值) - 当日净现金流入
        snapshot.hos_daily_pnl = snapshot.hos_market_value - previous_snapshot.hos_market_value - net_investment_today
        snapshot.hos_daily_pnl_ratio = (
            snapshot.hos_daily_pnl / previous_snapshot.hos_market_value
            if previous_snapshot.hos_market_value > 0 else ZERO
        )
        # 累计盈亏
        snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
        snapshot.hos_total_pnl_ratio = (
            snapshot.hos_total_pnl / snapshot.hos_total_cost
            if snapshot.hos_total_cost > 0 else ZERO
        )

        if current_shares > ZERO:  # 未清仓
            previous_snapshot = snapshot
        else:  # 清仓
            previous_snapshot = None
            cumulative_realized_pnl = ZERO

        return snapshot, previous_snapshot, cumulative_realized_pnl

    @classmethod
    def generate_yesterday_snapshots(cls):
        """
        每日增量任务：为所有持仓生成昨天的快照（如果有净值），利用前天的快照来提高效率
        TODO 重构
        """
        logger.info("Starting daily task: generate_yesterday_snapshots.")

        total_generated = 0
        errors = []

        result = {'generated': total_generated, 'errors': errors}

        # 检查昨天是否是交易日
        yesterday = date.today() - timedelta(days=1)
        trade_calendar = TradeCalendar()
        if not trade_calendar.is_trade_day(yesterday):
            logger.info("No target holdings found. Task finished.")
            return result
        # 获取上上个交易日
        day_before_yesterday = trade_calendar.prev_trade_day(yesterday)

        # 上个交易日有交易的(新买入的，上上个交易日没有快照)
        yesterday_traded_holding_ids = db.session.query(Trade.ho_id).filter(
            Trade.tr_date == yesterday
        ).distinct().all()
        yesterday_traded_holding_ids = [id_tuple[0] for id_tuple in yesterday_traded_holding_ids]

        # 上上个交易日有快照的所有持仓
        target_holding_ids_from_snapshots = db.session.query(HoldingSnapshot.ho_id).filter(
            HoldingSnapshot.snapshot_date == day_before_yesterday
        ).distinct().all()
        target_holding_ids_from_snapshots = [id_tuple[0] for id_tuple in target_holding_ids_from_snapshots]

        # 合并两个集合：上个交易日有交易的 + 上上个交易日有快照的所有持仓
        target_holding_ids = set(target_holding_ids_from_snapshots) | set(yesterday_traded_holding_ids)
        if not target_holding_ids:
            logger.info("No target holdings found. Task finished.")
            return result

        # 2. 数据预取，减少循环内DB查询
        # 预取昨天的净值
        yesterday_navs_list = FundNavHistory.query.filter(
            FundNavHistory.ho_id.in_(target_holding_ids),
            FundNavHistory.nav_date == yesterday
        ).all()
        nav_map = {nav.ho_id: nav for nav in yesterday_navs_list}

        # 预取前天的快照
        day_before_yesterday_snapshots_list = HoldingSnapshot.query.filter(
            HoldingSnapshot.ho_id.in_(target_holding_ids),
            HoldingSnapshot.snapshot_date == day_before_yesterday
        ).all()
        day_before_yesterday_snapshot_map = {snap.ho_id: snap for snap in day_before_yesterday_snapshots_list}

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

                # # 3.1 检查是否已存在快照，确保任务可重复执行
                # if HoldingSnapshot.query.filter_by(ho_id=holding.id, snapshot_date=yesterday).first():
                #     logger.info(f"Snapshot for {holding.ho_code} on {yesterday} already exists. Skipping.")
                #     continue
                # 昨天交易
                trades_yesterday = trades_by_holding.get(holding.id)

                # 3.2 昨天净值
                nav_yesterday = nav_map.get(holding.id)
                # if not nav_yesterday:
                #     logger.warning(f"No NAV found for {holding.ho_code} on {yesterday}. Skipping.")
                #     continue

                # 3.3 前天快照
                day_before_yesterday_snapshot = day_before_yesterday_snapshot_map.get(holding.id)

                if day_before_yesterday_snapshot and trades_yesterday:
                    # 老持仓 增量计算：基于前一天的快照
                    start_shares = day_before_yesterday_snapshot.holding_shares
                    start_cost = day_before_yesterday_snapshot.hos_total_cost
                    start_realized_pnl = day_before_yesterday_snapshot.hos_realized_pnl
                elif day_before_yesterday_snapshot and not trades_yesterday:
                # 新购买，昨天有交易记录，但是前天没有快照 TODO 完成业务逻辑
                # start_shares, start_cost = cls._calculate_position_up_to_date(holding.id, day_before_yesterday)
                # start_realized_pnl = cls._get_realized_pnl_up_to_date(holding.id, day_before_yesterday)
                # # 对于高级指标，也需要回溯
                # # start_peak_mv = cls._get_peak_mv_up_to_date(holding.id, day_before_yesterday)
                # first_trade = Trade.query.filter_by(ho_id=holding.id).order_by(Trade.tr_date).first()
                # start_holding_days = (day_before_yesterday - first_trade.tr_date).days + 1 if first_trade else 0
                else:
                    # TODO 问题数据 整个holding的数据要重新生成 应用generate all
                    logger.warning(f"Previous day's snapshot not found for {holding.ho_code}. "
                                   f"Falling back to full calculation up to {day_before_yesterday}.")
                    data = CacheManager.set(cache_key)

                # 3.4 应用昨天的交易 todo 和全量计算里的是否公用一个方法？
                current_shares, current_total_cost, current_realized_pnl, net_investment_yesterday = cls._apply_trades_for_day(
                    start_shares, start_cost, start_realized_pnl, trades_yesterday
                )

                # 3.5 生成快照 TODO 检查业务逻辑是否完整
                snapshot = HoldingSnapshot()
                snapshot.ho_id = holding.id
                snapshot.snapshot_date = yesterday

                # 计算各项指标
                snapshot.holding_shares = current_shares
                snapshot.hos_total_cost = current_total_cost
                snapshot.cost_price = (
                        current_total_cost / current_shares) if current_shares > 0 else ZERO

                snapshot.market_price = nav_yesterday.nav_per_unit
                snapshot.hos_market_value = current_shares * nav_yesterday.nav_per_unit

                snapshot.hos_unrealized_pnl = snapshot.hos_market_value - snapshot.hos_total_cost
                snapshot.hos_realized_pnl = current_realized_pnl
                snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
                snapshot.hos_total_pnl_ratio = (
                        snapshot.hos_total_pnl / snapshot.hos_total_cost) if snapshot.hos_total_cost > 0 else ZERO

                prev_market_value = day_before_yesterday_snapshot.hos_market_value if day_before_yesterday_snapshot else ZERO
                snapshot.hos_daily_pnl = snapshot.hos_market_value - prev_market_value - net_investment_yesterday
                snapshot.hos_daily_pnl_ratio = (snapshot.hos_daily_pnl / prev_market_value
                                                if prev_market_value > 0 else ZERO)

                snapshots_to_add.append(snapshot)
            # 4. 批量提交
            if snapshots_to_add:
                # 删除旧记录
                deleted = HoldingSnapshot.query.filter(
                    HoldingSnapshot.ho_idin_(target_holding_ids)
                ).delete(synchronize_session=False)

                db.session.add_all(snapshots_to_add)
                db.session.commit()
                logger.info(f"Successfully generated and committed {len(snapshots_to_add)} new snapshots.")
            else:
                logger.info("No new snapshots were generated.")

            return result
        except Exception as e:
            db.session.rollback()
            logger.error(f"An error occurred during snapshot generation: {e}", exc_info=True)
            errors.append(str(e))
            return result

    # @classmethod
    # def _apply_trades_for_day(cls, start_shares, start_cost, trades):
    #     """辅助方法：应用当日交易，返回期末份额、成本和当日净投入"""
    #     net_investment = ZERO
    #     for trade in trades:
    #         if trade.tr_type == TradeTypeEnum.BUY:
    #             start_shares += trade.tr_shares
    #             start_cost += trade.tr_amount
    #             net_investment += trade.tr_amount
    #         elif trade.tr_type == TradeTypeEnum.SELL:
    #             if start_shares > 0:
    #                 cost_of_sold = (start_cost / start_shares) * trade.tr_shares
    #                 start_cost -= cost_of_sold
    #             start_shares -= trade.tr_shares
    #             net_investment -= trade.tr_amount
    #     return start_shares, start_cost, net_investment

    @staticmethod
    def _apply_trades(
            start_shares: Decimal,
            start_cost: Decimal,
            start_realized_pnl: Decimal,
            trades: List[Trade]
    ) -> Tuple[Decimal, Decimal, Decimal, Decimal]:
        """
        应用一天的交易，返回期末状态。
        这是一个纯函数，易于测试。
        """
        current_shares = start_shares
        current_total_cost = start_cost
        cumulative_realized_pnl = start_realized_pnl
        net_investment_today = ZERO
        for trade in trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                current_shares += trade.tr_shares
                current_total_cost += trade.tr_amount
                net_investment_today += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if current_shares <= ZERO:
                    # 数据质量问题：超卖。立即失败，不应重试。
                    raise BizException(
                        f"Data integrity error: Attempted to sell {trade.tr_shares} shares for holding {trade.ho_id} "
                        f"on {trade.tr_date}, but only {current_shares} shares are available."
                    )
                cost_of_sold_shares = (current_total_cost / current_shares) * trade.tr_shares
                current_total_cost -= cost_of_sold_shares
                realized_pnl_from_this_sell = trade.tr_amount - cost_of_sold_shares
                cumulative_realized_pnl += realized_pnl_from_this_sell

                current_shares -= trade.tr_shares
                net_investment_today -= trade.tr_amount

        return current_shares, current_total_cost, cumulative_realized_pnl, net_investment_today

    @staticmethod
    def _create_snapshot_from_state(
            holding: Holding,
            snapshot_date: date,
            nav_today: FundNavHistory,
            current_shares: Decimal,
            current_total_cost: Decimal,
            cumulative_realized_pnl: Decimal,
            net_investment_today: Decimal,
            prev_snapshot: Optional[HoldingSnapshot]
    ) -> HoldingSnapshot:
        """
        根据当前状态和前一日快照，创建新的快照对象。
        """
        snapshot = HoldingSnapshot()
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = snapshot_date
        snapshot.market_price = nav_today.nav_per_unit
        snapshot.hos_realized_pnl = cumulative_realized_pnl
        dividend_amount = ZERO
        if nav_today.dividend_price:
            dividend_amount = nav_today.dividend_price * current_shares
        snapshot.dividend_amount = dividend_amount
        # 分红计入净投入，因为它增加了持仓的“价值”但没有现金流出
        net_investment_today += dividend_amount
        if current_shares > ZERO:
            snapshot.holding_shares = current_shares
            snapshot.hos_total_cost = current_total_cost
            snapshot.cost_price = current_total_cost / current_shares
            snapshot.hos_market_value = current_shares * nav_today.nav_per_unit
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - current_total_cost
        else:  # 清仓状态
            snapshot.holding_shares = ZERO
            # 清仓后，成本价和总成本保留清仓前的最后一个值，用于计算累计收益率等
            if prev_snapshot:
                snapshot.hos_total_cost = prev_snapshot.hos_total_cost
                snapshot.cost_price = prev_snapshot.cost_price
            else:  # 如果没有历史快照，只能归零
                snapshot.hos_total_cost = ZERO
                snapshot.cost_price = ZERO

            snapshot.hos_market_value = ZERO
            snapshot.hos_unrealized_pnl = ZERO
        # 计算需要前一日快照的指标
        prev_market_value = prev_snapshot.hos_market_value if prev_snapshot else ZERO
        snapshot.hos_daily_pnl = snapshot.hos_market_value - prev_market_value - net_investment_today
        snapshot.hos_daily_pnl_ratio = (
            snapshot.hos_daily_pnl / prev_market_value if prev_market_value > ZERO else ZERO
        )

        snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
        snapshot.hos_total_pnl_ratio = (
            snapshot.hos_total_pnl / snapshot.hos_total_cost if snapshot.hos_total_cost > ZERO else ZERO
        )

        return snapshot
