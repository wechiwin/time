# app/service/holding_snapshot_service.py
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta, datetime
from decimal import Decimal
from typing import List, Tuple, Optional

from app.calendars.trade_calendar import TradeCalendar
from app.constant.biz_enums import TradeTypeEnum, FundDividendMethodEnum
from app.framework.async_task_manager import create_task
from app.framework.exceptions import BizException
from app.models import db, HoldingSnapshot, Holding, FundNavHistory, Trade
from app.tools.date_tool import date_to_str

logger = logging.getLogger(__name__)

ZERO = Decimal('0')


@dataclass
class PositionState:
    shares: Decimal = ZERO
    holding_cost: Decimal = ZERO
    total_cost: Decimal = ZERO
    realized_pnl: Decimal = ZERO
    total_sell_cash: Decimal = ZERO


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

        if ids:
            holdings = Holding.query.filter(Holding.id.in_(ids)).all()
        else:
            holdings = Holding.query.all()

        if not holdings:
            return {"total_generated": 0, "errors": [], "duration": 0}

        for holding in holdings:
            to_add_snapshots = cls._generate_for_holding(holding)
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
                error_msg = f"Error processing holding {holding.ho_code}: {str(e)}"
                create_task(
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name} at {datetime.now()}",
                    module_path="app.services.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": [holding.id]},
                    error_message=error_msg
                )
                logger.error(e, exc_info=True)
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

        # 根据tr_cycle分组
        trades_by_cycle = defaultdict(list)
        for trade in trade_list:
            trades_by_cycle[trade.tr_cycle].append(trade)

        snapshots = []

        # 根据每轮交易记录，生成快照数据
        for tr_cycle, round_trades in trades_by_cycle.items():
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

            # 每轮初始化状态变量
            prev_snapshot = None
            state = PositionState()

            # 逐日计算快照
            current_date = first_date
            while current_date <= last_date:
                # 获取当日净值，如果不存在（如节假日），则跳过当天
                nav_today = nav_map.get(date_to_str(current_date))
                if not nav_today:
                    current_date += timedelta(days=1)
                    continue

                trades_in_current_date = trades_by_date.get(date_to_str(current_date), [])
                # 处理当日的所有交易
                state, net_investment_today = cls._apply_trades(state, trades_in_current_date)
                # 处理当日分红
                cash_from_dividend = cls._apply_dividend(state, holding, nav_today)
                # 当日现金流入
                net_cash_flow = net_investment_today + cash_from_dividend

                # 根据数据，生成当日快照
                snapshot = cls._create_snapshot_from_state(state, holding, nav_today, net_cash_flow, prev_snapshot)

                snapshots.append(snapshot)
                prev_snapshot = snapshot if state.shares > ZERO else None
                current_date += timedelta(days=1)

        return snapshots

    @classmethod
    def generate_yesterday_snapshots(cls):
        """
        每日增量任务：为所有持仓生成昨天的快照（如果有净值），利用前天的快照来提高效率
        """
        logger.info("Starting daily task: generate_yesterday_snapshots.")

        total_generated = 0
        errors = []

        result = {'generated': total_generated, 'errors': errors}

        # 检查昨天是否是交易日 以昨天为标的
        current_date = date.today() - timedelta(days=1)
        trade_calendar = TradeCalendar()
        if not trade_calendar.is_trade_day(current_date):
            logger.info("No target holdings found. Task finished.")
            return result
        # 获取上上个交易日
        prev_date = trade_calendar.prev_trade_day(current_date)

        # 上个交易日有交易的(新买入的，上上个交易日没有快照)
        current_traded_ho_ids = db.session.query(Trade.ho_id).filter(
            Trade.tr_date == current_date
        ).distinct().all()
        current_traded_ho_ids = [id_tuple[0] for id_tuple in current_traded_ho_ids]

        # 上上个交易日有快照的所有持仓
        prev_ho_ids_from_snapshots = db.session.query(HoldingSnapshot.ho_id).filter(
            HoldingSnapshot.snapshot_date == prev_date
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
                        task_name=f"regenerate yesterday holding snapshots for {holding.ho_code} - {holding.ho_short_name} at {datetime.now()}",
                        module_path="app.services.holding_snapshot_service",
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
                        task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name} at {datetime.now()}",
                        module_path="app.services.holding_snapshot_service",
                        method_name="generate_all_holding_snapshots",
                        kwargs={"ids": f"[{holding.id},]"},
                        error_message=f"no day_before_yesterday_snapshot from holding_snapshot_service: generate_yesterday_snapshots"
                    )
                    error_msg = f"Error processing generate_yesterday_snapshots of {holding.ho_code}, regenerated all."
                    errors.append(error_msg)
                    continue

                # 老持仓 增量计算：基于前一天的快照
                state = PositionState(
                    shares=prev_snapshot.holding_shares,
                    holding_cost=prev_snapshot.holding_cost,
                    total_cost=prev_snapshot.hos_total_cost,
                    realized_pnl=prev_snapshot.hos_realized_pnl,
                    total_sell_cash=prev_snapshot.hos_total_sell_cash,
                )
                # 3.4 应用昨天的交易
                state, net_investment_today = cls._apply_trades(state, trades)
                # 处理当日分红
                cash_from_dividend = cls._apply_dividend(state, holding, nav)
                # 当日现金流入
                net_cash_flow = net_investment_today + cash_from_dividend

                # 3.5 生成快照
                snapshot = cls._create_snapshot_from_state(state, holding, nav, net_cash_flow, prev_snapshot)

                snapshots_to_add.append(snapshot)
            # 4. 批量提交
            if snapshots_to_add:
                # 删除旧记录
                deleted = HoldingSnapshot.query.filter(
                    HoldingSnapshot.ho_id.in_(target_holding_ids),
                    HoldingSnapshot.snapshot_date == current_date
                ).delete(synchronize_session=False)

                db.session.add_all(snapshots_to_add)
                db.session.commit()
                total_generated += len(snapshots_to_add)
                logger.info(f"Successfully generated and committed {len(snapshots_to_add)} new snapshots.")
            else:
                logger.info("No new snapshots were generated.")

            return result
        except Exception as e:
            db.session.rollback()
            error_msg = f"An error occurred during snapshot generation: {e}"
            create_task(
                task_name=f"regenerate yesterday holding snapshots at {datetime.now()}",
                module_path="app.services.holding_snapshot_service",
                method_name="generate_yesterday_snapshots",
                error_message=error_msg
            )
            errors.append(error_msg)
            logger.error(error_msg, exc_info=True)
            return result

    @staticmethod
    def _apply_trades(state: PositionState, trades: List[Trade]) -> Tuple[PositionState, Decimal]:
        """
        Applies trades to current position state and calculates net investment.

        Business Rules:
        - Buy trades increase shares and holding cost
        - Sell trades reduce shares proportionally and realize P&L
        - Negative shares are not allowed (throws BizException)

        Returns:
            Tuple of (updated_state, net_investment_today)
        """
        net_investment_today = ZERO

        for trade in trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                state.shares += trade.tr_shares
                state.holding_cost += trade.tr_amount
                net_investment_today += trade.tr_amount
                state.total_cost += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if state.shares <= ZERO:
                    # 数据质量问题：超卖
                    create_task(
                        task_name=f"regenerate all holding snapshots for {trade.ho_id} in _apply_trades at {datetime.now()}",
                        module_path="app.services.holding_snapshot_service",
                        method_name="generate_all_holding_snapshots",
                        kwargs={"ids": [trade.ho_id]},
                        error_message=(
                            f"Sell exceeds: Attempted to sell {trade.tr_shares} shares for holding {trade.ho_id} "
                            f"on {trade.tr_date}, but only {state.shares} shares are available."
                        )
                    )
                    raise BizException
                cost_of_sold_shares = (state.holding_cost / state.shares) * trade.tr_shares
                state.holding_cost -= cost_of_sold_shares
                realized_pnl_from_this_sell = trade.tr_amount - cost_of_sold_shares
                state.realized_pnl += realized_pnl_from_this_sell

                state.shares -= trade.tr_shares
                net_investment_today -= trade.tr_amount
                state.total_sell_cash += trade.tr_amount

        return state, net_investment_today

    @staticmethod
    def _apply_dividend(state: PositionState, holding: Holding, nav: FundNavHistory) -> Decimal:
        """
        返回：分红产生的现金流
        """
        if not nav.dividend_price or state.shares <= ZERO:
            return ZERO

        dividend_amount = nav.dividend_price * state.shares

        if holding.fund_detail.dividend_method == FundDividendMethodEnum.REINVEST.value:
            reinvest_shares = dividend_amount / nav.nav_per_unit
            state.shares += reinvest_shares
            state.holding_cost += dividend_amount
            state.total_cost += dividend_amount
            return ZERO
        else:
            return dividend_amount

    @staticmethod
    def _create_snapshot_from_state(state: PositionState,
                                    holding: Holding,
                                    nav_today: FundNavHistory,
                                    net_cash_flow: Decimal,
                                    prev_snapshot: HoldingSnapshot | None
                                    ) -> HoldingSnapshot:
        """
        根据当前状态和前一日快照，创建新的快照对象。
        """
        snapshot = HoldingSnapshot()
        # 不管是否清仓，通用记录数据：
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = nav_today.nav_date
        snapshot.market_price = nav_today.nav_per_unit

        snapshot.hos_realized_pnl = state.realized_pnl
        snapshot.hos_total_sell_cash = state.total_sell_cash
        snapshot.hos_net_cash_flow = net_cash_flow
        snapshot.hos_total_cost = state.total_cost

        if state.shares > ZERO:  # 未清仓
            snapshot.holding_shares = state.shares
            snapshot.holding_cost = state.holding_cost
            snapshot.cost_price = state.holding_cost / state.shares
            snapshot.hos_market_value = state.shares * nav_today.nav_per_unit
            # 未实现盈亏
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - state.holding_cost
            # 反映剔除现金流后的纯市场损益 当日盈亏 = (期末持仓市值 - 期初持仓市值) - 当日净现金流入
            prev_market_value = prev_snapshot.hos_market_value if prev_snapshot else ZERO
            snapshot.hos_daily_pnl = snapshot.hos_market_value - prev_market_value - net_cash_flow
            snapshot.hos_daily_pnl_ratio = (
                snapshot.hos_daily_pnl / prev_market_value if prev_market_value > ZERO else ZERO
            )
            # 累计盈亏
            snapshot.hos_total_pnl = state.realized_pnl + snapshot.hos_unrealized_pnl
            snapshot.hos_total_pnl_ratio = (
                snapshot.hos_total_pnl / state.total_cost if state.total_cost > ZERO else ZERO
            )
        else:  # 清仓
            if not prev_snapshot:
                # 清仓如果没有历史快照，说明历史数据有问题，重新生成这个持仓的所有快照
                create_task(
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name} at {datetime.now()}",
                    module_path="app.services.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": [holding.id]},
                    error_message=f"{holding.ho_code} - {holding.ho_short_name}: no prev_snapshot from holding_snapshot_service: _create_snapshot_from_state"
                )

            # 清仓后，成本价和总成本保留清仓前的最后一个值，用于计算累计收益率等
            snapshot.holding_shares = ZERO
            snapshot.holding_cost = ZERO
            snapshot.cost_price = ZERO
            snapshot.hos_market_value = ZERO
            snapshot.hos_unrealized_pnl = ZERO

            # 反映剔除现金流后的纯市场损益 当日盈亏 = (清仓前一天持仓*今天净值 - 清仓前一天持仓市值) - 当日净现金流入
            snapshot.hos_daily_pnl = (prev_snapshot.holding_shares * nav_today.nav_per_unit -
                                      prev_snapshot.hos_market_value - net_cash_flow)
            snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
            # 累计盈亏 清仓当天没有 holding cost，要用total cost计算
            snapshot.hos_total_pnl = state.realized_pnl
            snapshot.hos_total_pnl_ratio = state.realized_pnl / snapshot.hos_total_cost

        return snapshot
