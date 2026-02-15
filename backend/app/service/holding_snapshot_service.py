# app/service/holding_snapshot_service.py
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Tuple

from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.constant.biz_enums import TradeTypeEnum, DividendTypeEnum, HoldingStatusEnum
from app.framework.async_task_manager import create_task
from app.framework.exceptions import AsyncTaskException
from app.models import db, HoldingSnapshot, Holding, FundNavHistory, Trade, UserHolding
from app.utils.date_util import date_to_str

ZERO = Decimal('0')


@dataclass
class PositionState:
    shares: Decimal = ZERO
    hos_holding_cost: Decimal = ZERO
    total_buy_amount: Decimal = ZERO  # 累计买入金额 (本金投入)
    total_sell_amount: Decimal = ZERO  # 累计卖出金额 (含收益)
    total_cash_dividend: Decimal = ZERO  # 累计现金分红
    total_reinvest_amount: Decimal = ZERO
    realized_pnl: Decimal = ZERO  # 累计已实现盈亏

    @property
    def total_dividend(self) -> Decimal:
        """累计分红总额"""
        return self.total_cash_dividend + self.total_reinvest_amount

    def get_avg_cost(self) -> Decimal:
        """安全获取平均成本"""
        if self.shares <= ZERO:
            return ZERO
        return self.hos_holding_cost / self.shares


class HoldingSnapshotService:

    @classmethod
    def generate_all_holding_snapshots(cls, ids: list[str] | None = None, user_id: int = None):
        """
        批量覆盖式生成所有快照。
        """
        logger.info("Starting to generate all holding snapshots...")
        start_time = time.time()

        total_generated = 0
        errors = []

        if ids:
            user_holdings = UserHolding.query.filter(
                UserHolding.user_id == user_id,
                UserHolding.ho_id.in_(ids)
            ).all()
        else:
            user_holdings = UserHolding.query.filter(UserHolding.user_id == user_id).all()

        if not user_holdings:
            return {"total_generated": 0, "errors": [], "duration": 0}

        for user_holding in user_holdings:
            holding = user_holding.holding
            to_add_snapshots = cls._generate_for_holding(holding, user_holding.ho_status)
            try:
                # 批量插入分析快照
                if to_add_snapshots:
                    # 删除旧记录 - 必须同时过滤 user_id，避免误删其他用户数据
                    deleted = HoldingSnapshot.query.filter(
                        HoldingSnapshot.ho_id == holding.id,
                        HoldingSnapshot.user_id == user_id
                    ).delete(synchronize_session=False)
                    # 插入新记录
                    db.session.bulk_save_objects(to_add_snapshots)
                    total_generated += len(to_add_snapshots)

                db.session.commit()
                logger.info(f"Generated {len(to_add_snapshots)} holding snapshots for {holding.ho_code}")
            except AsyncTaskException as e:
                logger.exception()
                errors.append(e.async_task_log.error_message)
            except Exception as e:
                error_msg = f"Error processing holding {holding.ho_code}: {str(e)}"
                create_task(
                    user_id=user_id,
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                    module_path="app.service.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": [holding.id]},
                    error_message=error_msg
                )
                logger.exception()
                errors.append(error_msg)

        end_time = time.time()
        result = {
            "total_generated": total_generated,
            "errors": errors,
            "duration": round(end_time - start_time, 2)
        }
        logger.info(result)
        return result

    @classmethod
    def _generate_for_holding(cls, holding: Holding, ho_status: str) -> List[HoldingSnapshot]:
        """为单个持仓生成其生命周期内的所有快照（内部方法）"""
        logger.info(f"Processing holding: {holding.ho_code} ({holding.ho_name})")
        snapshots = []

        # 检查holding状态
        if ho_status == HoldingStatusEnum.NOT_HELD:
            return snapshots

        # 获取所有交易记录 时间升序
        trade_list = Trade.query.filter(Trade.ho_id == holding.id).order_by(Trade.tr_date).all()
        if not trade_list:
            return snapshots

        # 根据tr_cycle分组
        trades_by_cycle = defaultdict(list)
        for trade in trade_list:
            trades_by_cycle[trade.tr_cycle].append(trade)

        max_tr_cycle = max(trades_by_cycle.keys())

        # 根据每周期交易记录，生成快照数据
        for tr_cycle, round_trades in trades_by_cycle.items():
            # 周期内第一次交易日期
            first_date = round_trades[0].tr_date
            # 周期内最后一次交易日期
            if tr_cycle == max_tr_cycle and ho_status == HoldingStatusEnum.HOLDING:
                # 如果是最后一轮持仓周期 且 目前仍在持仓中
                last_date = trade_calendar.prev_trade_day(date.today())
            else:
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

            # 每轮初始化状态变量
            prev_snapshot = None
            state = PositionState()

            # 逐日计算快照
            current_date = first_date
            while current_date <= last_date:
                # 获取当日净值，如果不存在（如节假日），则跳过当天
                nav_today = nav_map.get(date_to_str(current_date))
                if not nav_today:
                    current_date = trade_calendar.next_trade_day(current_date)
                    # current_date += timedelta(days=1)
                    continue

                trades_in_current_date = trades_by_date.get(date_to_str(current_date), [])

                state, net_external_cash_flow, hos_daily_buy_amount, hos_daily_sell_amount, hos_daily_cash_dividend, hos_daily_reinvest_dividend = cls._apply_trades(
                    state, trades_in_current_date)

                snapshot = cls._create_snapshot_from_state(
                    state, holding, nav_today, net_external_cash_flow, hos_daily_cash_dividend, hos_daily_reinvest_dividend,
                    prev_snapshot, hos_daily_buy_amount, hos_daily_sell_amount
                )

                snapshot.tr_cycle = tr_cycle
                snapshots.append(snapshot)
                prev_snapshot = snapshot if state.shares > ZERO else None
                current_date = trade_calendar.next_trade_day(current_date)

        return snapshots

    @classmethod
    def generate_yesterday_snapshots(cls, user_id: int):
        """
        每日增量任务：为所有持仓生成昨天的快照（如果有净值），利用前天的快照来提高效率
        """
        logger.info("Starting daily task: generate_yesterday_snapshots.")

        total_generated = 0
        errors = []

        result = {'generated': total_generated, 'errors': errors}

        # 检查昨天是否是交易日 以昨天为标的
        current_date = date.today() - timedelta(days=1)
        if not trade_calendar.is_trade_day(current_date):
            logger.info("No target holdings found. Task finished.")
            return result

        # 获取上上个交易日
        prev_date = trade_calendar.prev_trade_day(current_date)

        # 上个交易日有交易的(新买入的，上上个交易日没有快照)
        current_traded_ho_ids = db.session.query(Trade.ho_id).filter(
            Trade.tr_date == current_date, Trade.user_id == user_id
        ).distinct().all()
        current_traded_ho_ids = [id_tuple[0] for id_tuple in current_traded_ho_ids]

        # 上上个交易日有快照的所有持仓
        prev_ho_ids_from_snapshots = db.session.query(HoldingSnapshot.ho_id).filter(
            HoldingSnapshot.snapshot_date == prev_date, HoldingSnapshot.user_id == user_id
        ).distinct().all()
        prev_ho_ids_from_snapshots = [id_tuple[0] for id_tuple in prev_ho_ids_from_snapshots]

        # 合并两个集合：上个交易日有交易的 + 上上个交易日有快照的所有持仓
        target_holding_ids = set(prev_ho_ids_from_snapshots) | set(current_traded_ho_ids)
        if not target_holding_ids:
            logger.info("No target holdings found. Task finished.")
            return result

        # 2. 数据预取，减少循环内DB查询
        # 预取昨天的净值
        current_nav_list = FundNavHistory.query.filter(
            FundNavHistory.ho_id.in_(target_holding_ids),
            FundNavHistory.nav_date == current_date
        ).all()
        nav_map = {nav.ho_id: nav for nav in current_nav_list}

        # 预取前天的快照
        prev_snapshots = HoldingSnapshot.query.filter(
            HoldingSnapshot.ho_id.in_(target_holding_ids),
            HoldingSnapshot.snapshot_date == prev_date
        ).all()
        prev_snapshot_map_by_ho_id = {snap.ho_id: snap for snap in prev_snapshots}

        # 预取昨天的交易
        current_trades = Trade.query.filter(
            Trade.ho_id.in_(target_holding_ids),
            Trade.tr_date == current_date
        ).order_by(Trade.id).all()
        trades_by_ho_id = defaultdict(list)
        for trade in current_trades:
            trades_by_ho_id[trade.ho_id].append(trade)

        # 预取持仓信息
        holdings_map_by_id = {h.id: h for h in Holding.query.filter(Holding.id.in_(target_holding_ids)).all()}

        snapshots_to_add = []
        errors = []

        try:
            # 3. 循环处理每个持仓
            for ho_id in target_holding_ids:
                holding = holdings_map_by_id.get(ho_id)
                if not holding:
                    logger.warning(f"Holding with id {ho_id} not found. Skipping.")
                    continue

                # 昨天交易
                trades = trades_by_ho_id.get(holding.id, [])

                # 昨天净值
                nav = nav_map.get(holding.id)
                if not nav:
                    error_msg = f"No NAV found for {holding.ho_code} - {holding.ho_short_name} on {current_date}. Skipping."
                    create_task(
                        user_id=user_id,
                        task_name=f"regenerate yesterday holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                        module_path="app.service.holding_snapshot_service",
                        method_name="generate_yesterday_snapshots",
                        kwargs={"ids": f"[{holding.id},]"},
                        error_message=error_msg
                    )
                    errors.append(error_msg)
                    continue

                # 3.3 前天快照
                prev_snapshot = prev_snapshot_map_by_ho_id.get(holding.id)
                if not prev_snapshot:
                    # 两种情况全部重新生成：1.新购买，昨天有交易记录，但是前天没有快照；2.问题数据
                    create_task(
                        user_id=user_id,
                        task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                        module_path="app.service.holding_snapshot_service",
                        method_name="generate_all_holding_snapshots",
                        kwargs={"ids": f"[{holding.id},]"},
                        error_message=f"{current_date} no day_before_yesterday_snapshot from holding_snapshot_service: generate_yesterday_snapshots"
                    )
                    error_msg = f"Error processing generate_yesterday_snapshots of {holding.ho_code}, regenerated all."
                    errors.append(error_msg)
                    continue

                # 老持仓 增量计算：基于前一天的快照
                state = PositionState(
                    shares=prev_snapshot.holding_shares,
                    hos_holding_cost=prev_snapshot.hos_holding_cost,
                    total_buy_amount=prev_snapshot.hos_total_cost,
                    realized_pnl=prev_snapshot.hos_realized_pnl,
                    total_sell_amount=prev_snapshot.hos_total_sell_cash,
                )
                # 处理当日分红
                # cash_dividend, hos_daily_reinvest_dividend = cls._apply_dividend(state, holding, nav)
                # 3.4 应用昨天的交易
                state, net_external_cash_flow, hos_daily_buy_amount, hos_daily_sell_amount, hos_daily_cash_dividend, hos_daily_reinvest_dividend = cls._apply_trades(state, trades)

                # 3.5 生成快照
                snapshot = cls._create_snapshot_from_state(state=state,
                                                           holding=holding,
                                                           nav_today=nav,
                                                           net_external_cash_flow=net_external_cash_flow,
                                                           hos_daily_cash_dividend=hos_daily_cash_dividend,
                                                           hos_daily_reinvest_dividend=hos_daily_reinvest_dividend,
                                                           prev_snapshot=prev_snapshot,
                                                           hos_daily_buy_amount=hos_daily_buy_amount,
                                                           hos_daily_sell_amount=hos_daily_sell_amount
                                                           )

                snapshot.tr_cycle = trades[-1].tr_cycle if trades else prev_snapshot.tr_cycle
                snapshots_to_add.append(snapshot)
            # 4. 批量提交
            if snapshots_to_add:
                # 删除旧记录 - 必须同时过滤 user_id，避免误删其他用户数据
                deleted = HoldingSnapshot.query.filter(
                    HoldingSnapshot.ho_id.in_(target_holding_ids),
                    HoldingSnapshot.snapshot_date == current_date,
                    HoldingSnapshot.user_id == user_id
                ).delete(synchronize_session=False)

                db.session.add_all(snapshots_to_add)
                db.session.commit()
                total_generated += len(snapshots_to_add)
                logger.info(f"Successfully generated and committed {len(snapshots_to_add)} new snapshots.")
            else:
                logger.info("No new snapshots were generated.")

            return result
        except AsyncTaskException as e:
            logger.exception()
            errors.append(e.async_task_log.error_message)
        except Exception as e:
            db.session.rollback()
            error_msg = f"{current_date} An error occurred during snapshot generation: {e}"
            create_task(
                user_id=user_id,
                task_name=f"regenerate yesterday holding snapshots",
                module_path="app.service.holding_snapshot_service",
                method_name="generate_yesterday_snapshots",
                error_message=error_msg
            )
            errors.append(error_msg)
            logger.exception(error_msg)
            return result

    @staticmethod
    def _apply_trades(state: PositionState,
                      trades: List[Trade],
                      user_id: int,
                      ) -> Tuple[PositionState, Decimal, Decimal, Decimal, Decimal, Decimal]:
        """
        处理当日的所有交易，包括分红。
        返回: (state, net_external_cash_flow, daily_buy, daily_sell, daily_cash_div, daily_reinvest_shares)
        """
        net_external_cash_flow = ZERO
        hos_daily_buy_amount = ZERO
        hos_daily_sell_amount = ZERO
        hos_daily_reinvest_dividend = ZERO
        hos_daily_cash_dividend = ZERO

        trades = sorted(trades, key=lambda x: x.tr_date)
        for trade in trades:
            # 买入
            if trade.tr_type == TradeTypeEnum.BUY.value:
                state.shares += trade.tr_shares
                state.hos_holding_cost += trade.cash_amount
                state.total_buy_amount += trade.cash_amount

                net_external_cash_flow -= trade.cash_amount
                hos_daily_buy_amount += trade.cash_amount

            # 卖出
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if state.shares <= ZERO:
                    # 数据质量问题：超卖
                    async_task_log = create_task(
                        user_id=user_id,
                        task_name=f"regenerate all holding snapshots for {trade.ho_id} in _apply_trades",
                        module_path="app.service.holding_snapshot_service",
                        method_name="generate_all_holding_snapshots",
                        kwargs={"ids": [trade.ho_id]},
                        error_message=(
                            f"Sell exceeds: Attempted to sell {trade.tr_shares} shares for holding {trade.ho_id} "
                            f"on {trade.tr_date}, but only {state.shares} shares are available."
                        )
                    )
                    raise AsyncTaskException(async_task_log)

                # 计算卖出部分的成本
                # 加权平均成本法: 卖出成本 = (当前持仓成本 / 当前持仓份额) * 卖出份额
                cost_of_sold_shares = (state.hos_holding_cost / state.shares) * trade.tr_shares
                state.shares -= trade.tr_shares
                state.hos_holding_cost -= cost_of_sold_shares
                state.total_sell_amount += trade.cash_amount
                hos_daily_sell_amount += trade.cash_amount

                realized_pnl_from_this_sell = trade.cash_amount - cost_of_sold_shares
                state.realized_pnl += realized_pnl_from_this_sell

                net_external_cash_flow += trade.cash_amount

            elif trade.tr_type == TradeTypeEnum.DIVIDEND:
                if trade.dividend_type == DividendTypeEnum.CASH:
                    # 现金分红：是外部现金流入，增加累计现金分红
                    state.total_cash_dividend += trade.tr_amount
                    # 注意：现金分红是收益，但不计入买卖的外部现金流，它在 PnL 公式中单独体现
                    hos_daily_cash_dividend += trade.tr_amount

                elif trade.dividend_type == DividendTypeEnum.REINVEST:
                    # 分红再投资：增加份额，增加累计再投资额
                    state.shares += trade.tr_shares
                    state.total_reinvest_amount += trade.tr_amount
                    # 分红再投资不影响持仓成本(cost basis)，但会拉低平均成本。
                    # 它也不是外部现金流，因为钱没有真正流出或流入投资组合。
                    hos_daily_reinvest_dividend += trade.tr_amount

        return state, net_external_cash_flow, hos_daily_buy_amount, hos_daily_sell_amount, hos_daily_cash_dividend, hos_daily_reinvest_dividend

    @staticmethod
    def _create_snapshot_from_state(state: PositionState,
                                    holding: Holding,
                                    nav_today: FundNavHistory,
                                    net_external_cash_flow: Decimal,
                                    hos_daily_cash_dividend: Decimal,
                                    hos_daily_reinvest_dividend: Decimal,
                                    prev_snapshot: HoldingSnapshot | None,
                                    hos_daily_buy_amount: Decimal,
                                    hos_daily_sell_amount: Decimal,
                                    user_id: str
                                    ) -> HoldingSnapshot:
        """
        根据当前状态和前一日快照，创建新的快照对象。
        """
        snapshot = HoldingSnapshot()
        # 不管是否清仓，通用记录数据：
        snapshot.user_id = user_id
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = nav_today.nav_date
        snapshot.market_price = nav_today.nav_per_unit

        snapshot.hos_total_buy_amount = state.total_buy_amount
        snapshot.hos_daily_buy_amount = hos_daily_buy_amount
        snapshot.hos_total_sell_amount = state.total_sell_amount
        snapshot.hos_daily_sell_amount = hos_daily_sell_amount

        snapshot.hos_daily_cash_dividend = hos_daily_cash_dividend
        snapshot.hos_daily_reinvest_dividend = hos_daily_reinvest_dividend
        snapshot.hos_total_cash_dividend = state.total_cash_dividend
        snapshot.hos_total_dividend = state.total_dividend

        snapshot.hos_realized_pnl = state.realized_pnl
        snapshot.hos_net_external_cash_flow = net_external_cash_flow

        if state.shares > ZERO:  # 未清仓
            snapshot.holding_shares = state.shares
            snapshot.hos_holding_cost = state.hos_holding_cost
            snapshot.avg_cost = state.hos_holding_cost / state.shares
            snapshot.hos_market_value = state.shares * nav_today.nav_per_unit
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - state.hos_holding_cost
            # 累计盈亏
            snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl + state.total_dividend

            if prev_snapshot and prev_snapshot.hos_market_value > ZERO:  # 非t0购入
                snapshot.hos_daily_pnl = (
                        snapshot.hos_market_value - prev_snapshot.hos_market_value
                        + net_external_cash_flow + hos_daily_cash_dividend
                )
                snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
                snapshot.hos_total_pnl_ratio = snapshot.hos_total_pnl / state.total_buy_amount

            else:  # t0购入 当天：当日盈亏 = 累计盈亏
                snapshot.hos_daily_pnl = snapshot.hos_total_pnl
                if state.total_buy_amount > ZERO:
                    snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / state.total_buy_amount
                    snapshot.hos_total_pnl_ratio = snapshot.hos_daily_pnl_ratio  # T0天，累计率=当日率
                else:
                    snapshot.hos_daily_pnl_ratio = ZERO
                    snapshot.hos_total_pnl_ratio = ZERO

        else:  # 清仓
            if not prev_snapshot:
                # 清仓时，如果没有 prev_snapshot，说明历史数据有问题，重新生成这个持仓的所有快照
                async_task_log = create_task(
                    user_id=user_id,
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                    module_path="app.service.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": [holding.id]},
                    error_message=f"{holding.ho_code} - {nav_today.nav_date} - {holding.ho_short_name}: no prev_snapshot from holding_snapshot_service: _create_snapshot_from_state"
                )
                raise AsyncTaskException(async_task_log)

            snapshot.holding_shares = ZERO
            snapshot.hos_market_value = ZERO
            snapshot.hos_holding_cost = ZERO
            snapshot.avg_cost = ZERO
            snapshot.hos_unrealized_pnl = ZERO

            snapshot.hos_daily_pnl = (
                    snapshot.hos_market_value - prev_snapshot.hos_market_value
                    + net_external_cash_flow + hos_daily_cash_dividend
            )
            snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
            # 清仓当天 hos_unrealized_pnl 为0
            snapshot.hos_total_pnl = state.realized_pnl + state.total_dividend
            snapshot.hos_total_pnl_ratio = state.realized_pnl / snapshot.hos_total_buy_amount

            snapshot.is_cleared = True

        return snapshot
