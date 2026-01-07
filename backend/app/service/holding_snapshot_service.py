# app/service/holding_snapshot_service.py
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
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
                    task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                    module_path="app.services.holding_snapshot_service",
                    method_name="generate_all_holding_snapshots",
                    kwargs={"ids": f"[{holding.id},]"},
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
    def generate_yesterday_snapshots(cls):
        """
        每日增量任务：为所有持仓生成昨天的快照（如果有净值），利用前天的快照来提高效率
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

                # 昨天交易
                trades_yesterday = trades_by_holding.get(holding.id, [])

                # 昨天净值
                nav_yesterday = nav_map.get(holding.id)
                if not nav_yesterday:
                    error_msg = f"No NAV found for {holding.ho_code} - {holding.ho_short_name} on {yesterday}. Skipping."
                    create_task(
                        task_name=f"regenerate yesterday holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                        module_path="app.services.holding_snapshot_service",
                        method_name="generate_yesterday_snapshots",
                        kwargs={"ids": f"[{holding.id},]"},
                        error_message=error_msg
                    )
                    errors.append(error_msg)
                    continue

                # 3.3 前天快照
                day_before_yesterday_snapshot = day_before_yesterday_snapshot_map.get(holding.id)
                if not day_before_yesterday_snapshot:
                    # 两种情况全部重新生成：1.新购买，昨天有交易记录，但是前天没有快照；2.问题数据
                    create_task(
                        task_name=f"regenerate all holding snapshots for {holding.ho_code} - {holding.ho_short_name}",
                        module_path="app.services.holding_snapshot_service",
                        method_name="generate_all_holding_snapshots",
                        kwargs={"ids": f"[{holding.id},]"},
                        error_message=f"no day_before_yesterday_snapshot from holding_snapshot_service: generate_yesterday_snapshots"
                    )
                    error_msg = f"Error processing generate_yesterday_snapshots of {holding.ho_code}, regenerated all."
                    errors.append(error_msg)
                    continue

                # 老持仓 增量计算：基于前一天的快照
                start_shares = day_before_yesterday_snapshot.holding_shares
                start_holding_cost = day_before_yesterday_snapshot.holding_cost
                start_total_cost = day_before_yesterday_snapshot.hos_total_cost
                start_realized_pnl = day_before_yesterday_snapshot.hos_realized_pnl
                start_sell_cash = day_before_yesterday_snapshot.hos_total_sell_cash

                # 3.4 应用昨天的交易
                (current_shares, current_holding_cost, current_total_cost, current_realized_pnl, total_sell_cash,
                 net_investment_yesterday) = cls._apply_trades(
                    start_shares, start_holding_cost, start_total_cost, start_realized_pnl, start_sell_cash,
                    trades_yesterday)

                # 3.5 生成快照
                snapshot = cls._create_snapshot_from_state(
                    holding, yesterday, nav_yesterday, current_realized_pnl, current_shares,
                    net_investment_yesterday, current_holding_cost, current_total_cost, total_sell_cash,
                    day_before_yesterday_snapshot)

                snapshots_to_add.append(snapshot)
            # 4. 批量提交
            if snapshots_to_add:
                # 删除旧记录
                deleted = HoldingSnapshot.query.filter(
                    HoldingSnapshot.ho_id.in_(target_holding_ids)
                ).delete(synchronize_session=False)

                db.session.add_all(snapshots_to_add)
                db.session.commit()
                logger.info(f"Successfully generated and committed {len(snapshots_to_add)} new snapshots.")
            else:
                logger.info("No new snapshots were generated.")

            return result
        except Exception as e:
            db.session.rollback()
            error_msg = f"An error occurred during snapshot generation: {e}"
            create_task(
                task_name=f"regenerate yesterday holding snapshots for all",
                module_path="app.services.holding_snapshot_service",
                method_name="generate_yesterday_snapshots",
                error_message=error_msg
            )
            errors.append(error_msg)
            logger.error(error_msg, exc_info=True)
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
            current_holding_cost = ZERO
            current_total_cost = ZERO
            total_sell_cash = ZERO
            cumulative_realized_pnl = ZERO
            previous_snapshot = None

            # 逐日计算快照
            current_date = first_date
            while current_date <= last_date:
                # 获取当日净值，如果不存在（如节假日），则跳过当天
                nav_today = nav_map.get(date_to_str(current_date))
                if not nav_today:
                    current_date += timedelta(days=1)
                    continue

                net_investment_today = ZERO

                # 处理当日的所有交易
                trades_in_current_date = trades_by_date.get(date_to_str(current_date))
                if trades_in_current_date:
                    (current_shares, current_holding_cost, current_total_cost, cumulative_realized_pnl, total_sell_cash,
                     net_investment_today) = cls._apply_trades(
                        current_shares, current_holding_cost, current_total_cost, cumulative_realized_pnl,
                        total_sell_cash, trades_in_current_date)

                # 根据数据，生成当日快照
                snapshot, previous_snapshot, cumulative_realized_pnl, current_total_cost \
                    = cls._create_snapshot_from_state(
                    holding, current_date, nav_today, cumulative_realized_pnl, current_shares, net_investment_today,
                    current_holding_cost, current_total_cost, total_sell_cash, previous_snapshot)

                snapshots.append(snapshot)
                current_date += timedelta(days=1)

        return snapshots

    @staticmethod
    def _apply_trades(
            start_shares: Decimal,
            start_holding_cost: Decimal,
            start_total_cost: Decimal,
            start_realized_pnl: Decimal,
            start_sell_cash: Decimal,
            trades: List[Trade]
    ) -> Tuple[Decimal, Decimal, Decimal, Decimal, Decimal, Decimal]:
        """
        应用一天的交易，返回期末状态。
        这是一个纯函数，易于测试。
        """
        current_shares = start_shares
        current_holding_cost = start_holding_cost
        current_total_cost = start_total_cost
        cumulative_realized_pnl = start_realized_pnl
        total_sell_cash = start_sell_cash
        net_investment_today = ZERO

        for trade in trades:
            if trade.tr_type == TradeTypeEnum.BUY.value:
                current_shares += trade.tr_shares
                current_holding_cost += trade.tr_amount
                net_investment_today += trade.tr_amount
                current_total_cost += trade.tr_amount
            elif trade.tr_type == TradeTypeEnum.SELL.value:
                if current_shares <= ZERO:
                    # 数据质量问题：超卖。立即失败，不应重试。
                    raise BizException(
                        f"Data integrity error: Attempted to sell {trade.tr_shares} shares for holding {trade.ho_id} "
                        f"on {trade.tr_date}, but only {current_shares} shares are available."
                    )
                cost_of_sold_shares = (current_holding_cost / current_shares) * trade.tr_shares
                current_holding_cost -= cost_of_sold_shares
                realized_pnl_from_this_sell = trade.tr_amount - cost_of_sold_shares
                cumulative_realized_pnl += realized_pnl_from_this_sell

                current_shares -= trade.tr_shares
                net_investment_today -= trade.tr_amount
                total_sell_cash += trade.tr_amount

        return (current_shares, current_holding_cost, current_total_cost, cumulative_realized_pnl, total_sell_cash,
                net_investment_today)

    @staticmethod
    def _create_snapshot_from_state(
            holding: Holding,
            current_date: date,
            nav_today: FundNavHistory,
            cumulative_realized_pnl: Decimal,
            current_shares: Decimal,
            net_investment_today: Decimal,
            current_holding_cost: Decimal,
            current_total_cost: Decimal,
            total_sell_cash: Decimal,
            prev_snapshot: Optional[HoldingSnapshot]
    ) -> tuple[HoldingSnapshot, HoldingSnapshot | None, Decimal, Decimal]:
        """
        根据当前状态和前一日快照，创建新的快照对象。
        """
        snapshot = HoldingSnapshot()
        # 不管是否清仓，通用记录数据：
        snapshot.ho_id = holding.id
        snapshot.snapshot_date = current_date
        snapshot.market_price = nav_today.nav_per_unit
        # 实现盈亏
        snapshot.hos_realized_pnl = cumulative_realized_pnl
        snapshot.hos_total_sell_cash = total_sell_cash

        # 处理分红
        if nav_today.dividend_price:
            dividend_amount = nav_today.dividend_price * current_shares
            snapshot.dividend_amount = dividend_amount
            dividend_method = holding.fund_detail.dividend_method
            if FundDividendMethodEnum.REINVEST.value == dividend_method:
                # 分红再投资：用分红金额买入更多份额
                reinvest_shares = dividend_amount / nav_today.nav_per_unit
                current_shares += reinvest_shares
                current_holding_cost += dividend_amount
                current_total_cost += dividend_amount
            else:
                # 现金分红：分红计入当日净流入（正现金流）
                net_investment_today += dividend_amount

        snapshot.hos_net_cash_flow = net_investment_today

        if current_shares > ZERO:  # 未清仓
            snapshot.holding_shares = current_shares
            snapshot.holding_cost = current_holding_cost
            snapshot.cost_price = current_holding_cost / current_shares
            snapshot.hos_market_value = current_shares * nav_today.nav_per_unit
            # 未实现盈亏
            snapshot.hos_unrealized_pnl = snapshot.hos_market_value - current_holding_cost
            snapshot.hos_total_cost = current_total_cost
            # 反映剔除现金流后的纯市场损益 当日盈亏 = (期末持仓市值 - 期初持仓市值) - 当日净现金流入
            prev_market_value = prev_snapshot.hos_market_value if prev_snapshot else ZERO
            snapshot.hos_daily_pnl = snapshot.hos_market_value - prev_market_value - net_investment_today
            snapshot.hos_daily_pnl_ratio = (
                snapshot.hos_daily_pnl / prev_market_value if prev_market_value > ZERO else ZERO
            )
            # 累计盈亏
            snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
            snapshot.hos_total_pnl_ratio = (
                snapshot.hos_total_pnl / snapshot.holding_cost if snapshot.holding_cost > ZERO else ZERO
            )

            previous_snapshot = snapshot
        else:  # 清仓
            if not prev_snapshot:
                # 清仓如果没有历史快照，说明数据有问题
                raise BizException(f"{holding.ho_code} - {holding.ho_short_name}: no prev_snapshot from holding_snapshot_service: _create_snapshot_from_state")
            # 清仓后，成本价和总成本保留清仓前的最后一个值，用于计算累计收益率等
            snapshot.holding_shares = ZERO
            snapshot.holding_cost = ZERO
            snapshot.cost_price = ZERO
            snapshot.hos_market_value = ZERO
            snapshot.hos_unrealized_pnl = ZERO
            snapshot.hos_total_cost = prev_snapshot.hos_total_cost

            # 反映剔除现金流后的纯市场损益 当日盈亏 = (清仓前一天持仓*今天净值 - 期初持仓市值) - 当日净现金流入
            snapshot.hos_daily_pnl = prev_snapshot.holding_shares * nav_today.nav_per_unit - prev_snapshot.hos_market_value - net_investment_today
            snapshot.hos_daily_pnl_ratio = snapshot.hos_daily_pnl / prev_snapshot.hos_market_value
            # 累计盈亏 清仓当天没有 holding cost，要用total cost计算
            snapshot.hos_total_pnl = snapshot.hos_realized_pnl + snapshot.hos_unrealized_pnl
            snapshot.hos_total_pnl_ratio = snapshot.hos_total_pnl / snapshot.hos_total_cost

            # 清仓后清零
            previous_snapshot = None
            cumulative_realized_pnl = ZERO
            total_sell_cash = ZERO

            # 返回三个参数作为下一轮计算的依据(全量需要使用)
        return snapshot, previous_snapshot, cumulative_realized_pnl, total_sell_cash
