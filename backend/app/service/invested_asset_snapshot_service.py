# app/service/invested_asset_snapshot_service.py
import time
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

import pandas as pd
from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.extension import db
from app.framework.async_task_manager import create_task
from app.models import HoldingSnapshot, InvestedAssetSnapshot

ZERO = Decimal('0')


@dataclass
class _AggregateState:
    """用于在内存中传递昨日状态的内部类"""
    mv: Decimal = ZERO
    total_pnl: Decimal = ZERO
    total_dividend: Decimal = ZERO
    total_reinvest_div: Decimal = ZERO
    total_cash_div: Decimal = ZERO
    total_buy: Decimal = ZERO
    total_sell: Decimal = ZERO
    holding_cost: Decimal = ZERO


class InvestedAssetSnapshotService:
    """
    投资资产整体快照服务
    负责将当天的所有 HoldingSnapshot 聚合成一条 InvestedAssetSnapshot
    """

    @classmethod
    def generate_snapshots(cls, user_id: int, start_date: date, end_date: date):
        """
        统一入口：生成指定时间段的投资组合快照。

        :param user_id: 用户ID
        :param start_date: 目标开始日期 (包含)
        :param end_date: 目标结束日期 (包含)
        """
        logger.info(f"Starting InvestedAssetSnapshot generation: {start_date} to {end_date} for user {user_id}")
        start_time = time.time()

        # 1. 预加载基础数据
        # 获取区间内所有的 HoldingSnapshot
        snapshots = HoldingSnapshot.query.filter(
            HoldingSnapshot.user_id == user_id,
            HoldingSnapshot.snapshot_date >= start_date,
            HoldingSnapshot.snapshot_date <= end_date
        ).order_by(HoldingSnapshot.snapshot_date).all()

        if not snapshots:
            logger.info("No holding snapshots found in range.")
            return {"total_generated": 0, "errors": []}

        # 2. 转换为 DataFrame 进行高效聚合
        data = [{
            'date': s.snapshot_date,
            'mv': float(s.hos_market_value or 0),
            'cost': float(s.hos_holding_cost or 0),
            'unrealized_pnl': float(s.hos_unrealized_pnl or 0),
            'net_flow': float(s.hos_net_external_cash_flow or 0),
            'cash_div': float(s.hos_daily_cash_dividend or 0),
            'reinvest_div': float(s.hos_daily_reinvest_dividend or 0),
            'buy': float(s.hos_daily_buy_amount or 0),
            'sell': float(s.hos_daily_sell_amount or 0),
        } for s in snapshots]

        df = pd.DataFrame(data)
        # 按日期聚合求和
        daily_agg = df.groupby('date').sum().reset_index()
        # 转换回 Decimal 以保证精度
        daily_agg_dict = {
            row['date']: {
                'mv': Decimal(str(row['mv'])),
                'cost': Decimal(str(row['cost'])),
                'unrealized_pnl': Decimal(str(row['unrealized_pnl'])),
                'net_flow': Decimal(str(row['net_flow'])),
                'cash_div': Decimal(str(row['cash_div'])),
                'reinvest_div': Decimal(str(row['reinvest_div'])),
                'buy': Decimal(str(row['buy'])),
                'sell': Decimal(str(row['sell'])),
            }
            for _, row in daily_agg.iterrows()
        }

        # 3. 获取初始状态 (start_date - 1 天)
        prev_date = trade_calendar.prev_trade_day(start_date)
        prev_snap = InvestedAssetSnapshot.query.filter_by(
            user_id=user_id, snapshot_date=prev_date
        ).first()

        if prev_snap:
            state = _AggregateState(
                mv=prev_snap.ias_market_value,
                total_pnl=prev_snap.ias_total_pnl,
                total_dividend=prev_snap.ias_total_dividend,
                total_reinvest_div=prev_snap.ias_total_reinvest_dividend,
                total_cash_div=prev_snap.ias_total_cash_dividend,
                total_buy=prev_snap.ias_total_buy_amount,
                total_sell=prev_snap.ias_total_sell_amount,
                holding_cost=prev_snap.ias_holding_cost
            )
        else:
            state = _AggregateState()

        # 4. 逐日计算
        results = []
        current_date = start_date
        while current_date <= end_date:
            if not trade_calendar.is_trade_day(current_date):
                current_date += timedelta(days=1)
                continue

            # 获取当日聚合数据
            day_data = daily_agg_dict.get(current_date)
            if not day_data:
                # 如果当天没有持仓快照，跳过当天
                logger.warning(f"No HoldingSnapshot found for user {user_id} on {current_date}, skipping InvestedAssetSnapshot")
                current_date += timedelta(days=1)
                continue

            new_snap, state = cls._calculate_daily_snapshot(user_id, current_date, state, day_data)
            results.append(new_snap)
            current_date += timedelta(days=1)

        # 5. 批量入库
        total_generated = 0
        errors = []
        if results:
            try:
                # 删除旧数据
                db.session.query(InvestedAssetSnapshot).filter(
                    InvestedAssetSnapshot.user_id == user_id,
                    InvestedAssetSnapshot.snapshot_date >= start_date,
                    InvestedAssetSnapshot.snapshot_date <= end_date
                ).delete(synchronize_session=False)

                db.session.bulk_save_objects(results)
                db.session.commit()
                total_generated = len(results)
                logger.info(f"Generated {total_generated} InvestedAssetSnapshots.")
            except Exception as e:
                db.session.rollback()
                logger.exception(f"Error saving InvestedAssetSnapshots: {e}")
                errors.append(str(e))
                create_task(
                    user_id, "Fix InvestedAsset Snapshots",
                    "app.service.invested_asset_snapshot_service", "generate_snapshots",
                    {"user_id": user_id, "start_date": str(start_date), "end_date": str(end_date)}, str(e)
                )

        return {"total_generated": total_generated, "errors": errors, "duration": time.time() - start_time}

    @staticmethod
    def _calculate_daily_snapshot(
            user_id: int,
            target_date: date,
            prev_state: _AggregateState,
            day_data: dict
    ) -> (InvestedAssetSnapshot, _AggregateState):
        """
        纯计算逻辑：根据昨日状态和今日数据生成今日快照
        """
        snap = InvestedAssetSnapshot()
        snap.user_id = user_id
        snap.snapshot_date = target_date

        # 1. 当日基础数据
        snap.ias_market_value = day_data['mv']
        snap.ias_holding_cost = day_data['cost']
        snap.ias_unrealized_pnl = day_data['unrealized_pnl']
        snap.ias_net_external_cash_flow = day_data['net_flow']
        snap.ias_daily_cash_dividend = day_data['cash_div']
        snap.ias_daily_reinvest_dividend = day_data['reinvest_div']

        daily_buy = day_data['buy']
        daily_sell = day_data['sell']

        # 2. 当日盈亏
        # 公式: MV_T - MV_T-1 + NetFlow_T + Div_T
        snap.ias_daily_pnl = (
                snap.ias_market_value - prev_state.mv +
                snap.ias_net_external_cash_flow +
                snap.ias_daily_cash_dividend
        )

        # 3. 当日收益率
        # 分母 = 昨日市值 + 今日净流入(如果是负数，相当于加仓，增加分母)
        denominator = prev_state.mv
        if snap.ias_net_external_cash_flow < ZERO:
            denominator += abs(snap.ias_net_external_cash_flow)

        if denominator > ZERO:
            snap.ias_daily_pnl_ratio = snap.ias_daily_pnl / denominator
        else:
            snap.ias_daily_pnl_ratio = ZERO

        # 4. 累计数据 (State 更新)
        snap.ias_total_pnl = prev_state.total_pnl + snap.ias_daily_pnl
        snap.ias_total_cash_dividend = prev_state.total_cash_div + snap.ias_daily_cash_dividend
        snap.ias_total_reinvest_dividend = prev_state.total_reinvest_div + snap.ias_daily_reinvest_dividend
        snap.ias_total_dividend = snap.ias_total_cash_dividend + snap.ias_total_reinvest_dividend

        snap.ias_total_buy_amount = prev_state.total_buy + daily_buy + snap.ias_daily_reinvest_dividend
        snap.ias_total_sell_amount = prev_state.total_sell + daily_sell

        # 5. 累计已实现盈亏 (倒挤)
        # 恒等式: Total PnL = Realized + Unrealized + Dividend
        snap.ias_total_realized_pnl = (
                snap.ias_total_pnl - snap.ias_unrealized_pnl - snap.ias_total_dividend
        )

        # 6. 累计收益率
        # 分母：净投入 = 累计买入 - 累计卖出
        net_invested = snap.ias_total_buy_amount - snap.ias_total_sell_amount
        cost_base = net_invested
        if cost_base <= ZERO:
            # 如果净投入为负（已回本），使用当前持仓成本
            cost_base = snap.ias_holding_cost if snap.ias_holding_cost > ZERO else prev_state.holding_cost

        if cost_base > ZERO:
            snap.ias_total_pnl_ratio = snap.ias_total_pnl / cost_base
        else:
            snap.ias_total_pnl_ratio = ZERO

        # 更新 State 供明日使用
        new_state = _AggregateState(
            mv=snap.ias_market_value,
            total_pnl=snap.ias_total_pnl,
            total_dividend=snap.ias_total_dividend,
            total_reinvest_div=snap.ias_total_reinvest_dividend,
            total_cash_div=snap.ias_total_cash_dividend,
            total_buy=snap.ias_total_buy_amount,
            total_sell=snap.ias_total_sell_amount,
            holding_cost=snap.ias_holding_cost
        )

        return snap, new_state
