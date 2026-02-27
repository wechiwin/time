# app/service/holding_snapshot_service.py
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from loguru import logger

from app.calendars.trade_calendar import TradeCalendar
from app.constant.biz_enums import TradeTypeEnum, DividendTypeEnum, HoldingStatusEnum
from app.framework.async_task_manager import create_task
from app.framework.exceptions import AsyncTaskException
from app.models import db, HoldingSnapshot, Holding, FundNavHistory, Trade, UserHolding
from app.utils.date_util import date_to_str


trade_calendar = TradeCalendar()
ZERO = Decimal('0')


@dataclass
class PositionState:
    shares: Decimal = ZERO
    hos_holding_cost: Decimal = ZERO
    total_buy_amount: Decimal = ZERO
    total_sell_amount: Decimal = ZERO
    total_cash_dividend: Decimal = ZERO
    total_reinvest_amount: Decimal = ZERO
    realized_pnl: Decimal = ZERO

    @property
    def total_dividend(self) -> Decimal:
        return self.total_cash_dividend + self.total_reinvest_amount

    @classmethod
    def from_snapshot(cls, snap: HoldingSnapshot) -> 'PositionState':
        """从快照恢复状态"""
        return cls(
            shares=snap.holding_shares,
            hos_holding_cost=snap.hos_holding_cost,
            total_buy_amount=snap.hos_total_buy_amount,
            total_sell_amount=snap.hos_total_sell_amount,
            total_cash_dividend=snap.hos_total_cash_dividend,
            total_reinvest_amount=snap.hos_total_reinvest_dividend,
            realized_pnl=snap.hos_realized_pnl
        )


class HoldingSnapshotService:

    @classmethod
    def generate_snapshots(
            cls,
            user_id: int,
            start_date: date,
            end_date: date,
            ids: Optional[List[str]] = None
    ) -> dict:
        """
        统一快照生成入口。

        :param user_id: 用户ID
        :param start_date: 目标开始日期 (包含)
        :param end_date: 目标结束日期 (包含)
        :param ids: 指定的持仓ID列表，为空则处理所有
        """
        logger.info(f"Starting snapshot generation: {start_date} to {end_date} for user {user_id}")
        start_time = time.time()

        # 1. 获取目标持仓 (通过 UserHolding 关联表)
        query = Holding.query.join(UserHolding, UserHolding.ho_id == Holding.id).filter(UserHolding.user_id == user_id)
        if ids:
            query = query.filter(Holding.id.in_(ids))
        holdings = query.all()

        if not holdings:
            return {"total_generated": 0, "errors": [], "duration": 0}

        # 2. 预加载全局数据 (优化：减少DB往返)
        ho_ids = [h.id for h in holdings]

        # 2.1 获取所有相关交易 (必须过滤 user_id，避免多用户数据混淆)
        all_trades = Trade.query.filter(
            Trade.ho_id.in_(ho_ids),
            Trade.user_id == user_id
        ).order_by(Trade.tr_date).all()
        trades_by_ho = defaultdict(list)
        for t in all_trades:
            trades_by_ho[t.ho_id].append(t)

        # 2.2 获取区间内的所有净值
        # 注意：需要从每个持仓的最早交易日期开始加载净值，而不是只从start_date
        # 因为回溯计算需要历史净值
        all_navs = FundNavHistory.query.filter(
            FundNavHistory.ho_id.in_(ho_ids),
            FundNavHistory.nav_date <= end_date
        ).all()
        nav_map = defaultdict(dict)
        for nav in all_navs:
            nav_map[nav.ho_id][date_to_str(nav.nav_date)] = nav

        # 2.3 获取 start_date - 1 天的快照 (用于状态热启动)
        prev_day = trade_calendar.prev_trade_day(start_date)
        existing_snaps = HoldingSnapshot.query.filter(
            HoldingSnapshot.ho_id.in_(ho_ids),
            HoldingSnapshot.snapshot_date == prev_day
        ).all()
        prev_snap_map = {s.ho_id: s for s in existing_snaps}

        # 3. 核心计算循环
        snapshots_to_save = []
        errors = []

        for holding in holdings:
            try:
                # 如果持仓状态是 NOT_HELD 且没有交易记录，跳过
                holding_status = getattr(holding, 'ho_status', None)
                if holding_status == HoldingStatusEnum.NOT_HELD and not trades_by_ho[holding.id]:
                    continue

                new_snaps = cls._calculate_range(
                    holding=holding,
                    user_id=user_id,
                    target_start=start_date,
                    target_end=end_date,
                    trades=trades_by_ho[holding.id],
                    navs=nav_map[holding.id],
                    prev_snapshot=prev_snap_map.get(holding.id)
                )
                snapshots_to_save.extend(new_snaps)

            except AsyncTaskException as e:
                logger.exception()
                errors.append(e.async_task_log.error_message)
            except Exception as e:
                err_msg = f"Error processing holding {holding.ho_code}: {str(e)}"
                logger.exception(err_msg)
                errors.append(err_msg)
                # 记录异步任务以便重试
                create_task(
                    user_id=user_id,
                    task_name=f"Fix Snapshot: {holding.ho_code}",
                    module_path="app.service.holding_snapshot_service",
                    method_name="generate_snapshots",
                    kwargs={"ids": [holding.id], "start_date": str(start_date), "end_date": str(end_date)},
                    error_message=err_msg
                )

        # 4. 数据库持久化
        total_generated = 0
        if snapshots_to_save:
            try:
                # 删除目标区间内的旧数据 (幂等性)
                db.session.query(HoldingSnapshot).filter(
                    HoldingSnapshot.ho_id.in_(ho_ids),
                    HoldingSnapshot.snapshot_date >= start_date,
                    HoldingSnapshot.snapshot_date <= end_date
                ).delete(synchronize_session=False)

                db.session.bulk_save_objects(snapshots_to_save)
                db.session.commit()
                total_generated = len(snapshots_to_save)
                logger.info(f"Successfully saved {total_generated} snapshots.")
            except Exception as e:
                db.session.rollback()
                logger.exception(f"Database commit failed: {e}")
                errors.append(f"DB Commit Error: {str(e)}")

        duration = round(time.time() - start_time, 2)
        return {"total_generated": total_generated, "errors": errors, "duration": duration}

    @classmethod
    def _calculate_range(
            cls,
            holding: Holding,
            user_id: int,
            target_start: date,
            target_end: date,
            trades: List[Trade],
            navs: dict,
            prev_snapshot: Optional[HoldingSnapshot]
    ) -> List[HoldingSnapshot]:
        """
        核心计算逻辑：生成指定时间段的快照。
        自动处理状态初始化（从prev_snapshot或从零开始）。
        """
        # 1. 确定计算的起始点
        if prev_snapshot:
            current_state = PositionState.from_snapshot(prev_snapshot)
            calc_cursor = target_start
        else:
            current_state = PositionState()
            if not trades:
                return []
            # 回溯到第一笔交易
            calc_cursor = trades[0].tr_date

        # 2. 准备交易索引
        trades_by_date = defaultdict(list)
        for t in trades:
            trades_by_date[date_to_str(t.tr_date)].append(t)

        results = []

        # 3. 逐日遍历
        safety_counter = 0
        max_days = (target_end - calc_cursor).days + 1 + 30

        while calc_cursor <= target_end:
            safety_counter += 1
            if safety_counter > max_days + 100:
                logger.warning(f"Loop safety limit reached for {holding.ho_code}")
                break

            date_str = date_to_str(calc_cursor)

            nav_today = navs.get(date_str)
            trades_today = trades_by_date.get(date_str, [])

            # 优化：如果在回溯期，且当天没交易，直接跳过
            if calc_cursor < target_start and not trades_today:
                calc_cursor = trade_calendar.next_trade_day(calc_cursor)
                continue

            # 如果在目标期，必须有净值才能生成快照
            if calc_cursor >= target_start and not nav_today:
                if trades_today:
                    logger.warning(f"Missing NAV for {holding.ho_code} on {date_str} with trades. Skipping snapshot.")
                calc_cursor = trade_calendar.next_trade_day(calc_cursor)
                continue

            # 应用交易 (更新 State)
            current_state, flows = cls._apply_trades(
                current_state, trades_today, user_id, holding.ho_code
            )

            # 生成快照 (仅在目标区间内)
            if calc_cursor >= target_start:
                cycle = trades_today[-1].tr_cycle if trades_today else (results[-1].tr_cycle if results else None)

                snap = cls._create_snapshot_entity(
                    state=current_state,
                    holding=holding,
                    nav_today=nav_today,
                    flows=flows,
                    prev_snapshot=results[-1] if results else prev_snapshot,
                    user_id=user_id
                )
                snap.tr_cycle = cycle
                results.append(snap)

            calc_cursor = trade_calendar.next_trade_day(calc_cursor)

        return results

    @staticmethod
    def _apply_trades(
            state: PositionState,
            trades: List[Trade],
            user_id: int,
            ho_code: str = None
    ) -> Tuple[PositionState, dict]:
        """
        纯函数：应用交易到状态。
        返回: (state, flows)
        """
        flows = {
            "net_external": ZERO, "buy": ZERO, "sell": ZERO,
            "cash_div": ZERO, "reinvest": ZERO
        }

        for trade in sorted(trades, key=lambda x: x.tr_date):
            if trade.tr_type == TradeTypeEnum.BUY.value:
                state.shares += trade.tr_shares
                state.hos_holding_cost += trade.cash_amount
                state.total_buy_amount += trade.cash_amount
                flows["net_external"] -= trade.cash_amount
                flows["buy"] += trade.cash_amount

            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if state.shares <= ZERO:
                    # 数据质量问题：超卖
                    async_task_log = create_task(
                        user_id=user_id,
                        task_name=f"regenerate all holding snapshots for {ho_code or trade.ho_id} in _apply_trades",
                        module_path="app.service.holding_snapshot_service",
                        method_name="generate_snapshots",
                        kwargs={"ids": [trade.ho_id]},
                        error_message=(
                            f"Sell exceeds: Attempted to sell {trade.tr_shares} shares for holding {trade.ho_id} "
                            f"on {trade.tr_date}, but only {state.shares} shares are available."
                        )
                    )
                    raise AsyncTaskException(async_task_log)

                avg_cost = state.hos_holding_cost / state.shares
                cost_sold = avg_cost * trade.tr_shares

                state.shares -= trade.tr_shares
                state.hos_holding_cost -= cost_sold
                state.realized_pnl += (trade.cash_amount - cost_sold)
                state.total_sell_amount += trade.cash_amount

                flows["net_external"] += trade.cash_amount
                flows["sell"] += trade.cash_amount

            elif trade.tr_type == TradeTypeEnum.DIVIDEND.value:
                if trade.dividend_type == DividendTypeEnum.CASH:
                    state.total_cash_dividend += trade.tr_amount
                    flows["cash_div"] += trade.tr_amount
                elif trade.dividend_type == DividendTypeEnum.REINVEST:
                    state.shares += trade.tr_shares
                    state.total_reinvest_amount += trade.tr_amount
                    flows["reinvest"] += trade.tr_amount

        return state, flows

    @staticmethod
    def _create_snapshot_entity(
            state: PositionState,
            holding: Holding,
            nav_today: FundNavHistory,
            flows: dict,
            prev_snapshot: Optional[HoldingSnapshot],
            user_id: int
    ) -> HoldingSnapshot:
        """纯函数：组装快照对象"""
        snapshot = HoldingSnapshot()
        snapshot.user_id = user_id
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = nav_today.nav_date
        snapshot.market_price = nav_today.nav_per_unit

        snapshot.hos_total_buy_amount = state.total_buy_amount
        snapshot.hos_daily_buy_amount = flows["buy"]
        snapshot.hos_total_sell_amount = state.total_sell_amount
        snapshot.hos_daily_sell_amount = flows["sell"]

        snapshot.hos_daily_cash_dividend = flows["cash_div"]
        snapshot.hos_daily_reinvest_dividend = flows["reinvest"]
        snapshot.hos_total_cash_dividend = state.total_cash_dividend
        snapshot.hos_total_reinvest_dividend = state.total_reinvest_amount
        snapshot.hos_total_dividend = state.total_dividend

        snapshot.hos_realized_pnl = state.realized_pnl
        snapshot.hos_net_external_cash_flow = flows["net_external"]

        if state.shares > ZERO:
            snapshot.holding_shares = state.shares
            snapshot.hos_holding_cost = state.hos_holding_cost
            snapshot.avg_cost = state.hos_holding_cost / state.shares
            snapshot.hos_market_value = state.shares * nav_today.nav_per_unit
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - state.hos_holding_cost
            snapshot.hos_total_pnl = snapshot.hos_unrealized_pnl + state.realized_pnl + state.total_dividend

            if prev_snapshot and prev_snapshot.hos_market_value > ZERO:
                snapshot.hos_daily_pnl = (snapshot.hos_market_value - prev_snapshot.hos_market_value) + flows["net_external"] + flows["cash_div"]
                snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
                snapshot.hos_total_pnl_ratio = snapshot.hos_total_pnl / state.total_buy_amount
            else:
                snapshot.hos_daily_pnl = snapshot.hos_total_pnl
                snapshot.hos_daily_pnl_ratio = (snapshot.hos_daily_pnl / state.total_buy_amount) if state.total_buy_amount > ZERO else ZERO
                snapshot.hos_total_pnl_ratio = snapshot.hos_daily_pnl_ratio
            snapshot.is_cleared = 0
        else:
            # 清仓
            snapshot.holding_shares = ZERO
            snapshot.hos_market_value = ZERO
            snapshot.hos_holding_cost = ZERO
            snapshot.avg_cost = ZERO
            snapshot.hos_unrealized_pnl = ZERO
            snapshot.hos_total_pnl = state.realized_pnl + state.total_dividend

            if prev_snapshot and prev_snapshot.hos_market_value > ZERO:
                snapshot.hos_daily_pnl = (ZERO - prev_snapshot.hos_market_value) + flows["net_external"] + flows["cash_div"]
                snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
            else:
                snapshot.hos_daily_pnl = ZERO
                snapshot.hos_daily_pnl_ratio = ZERO

            snapshot.hos_total_pnl_ratio = state.realized_pnl / snapshot.hos_total_buy_amount if snapshot.hos_total_buy_amount > ZERO else ZERO
            snapshot.is_cleared = 1

        return snapshot
