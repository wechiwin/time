# app/service/holding_analytics_snapshot_service.py
import time
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional

import numpy as np
import pandas as pd
from flask import g
from loguru import logger
from scipy import optimize
from sqlalchemy import or_

from app.calendars.trade_calendar import trade_calendar
from app.extension import db
from app.framework.async_task_manager import create_task
from app.models import (
    Holding, HoldingSnapshot, AnalyticsWindow, HoldingAnalyticsSnapshot, InvestedAssetSnapshot, UserSetting, UserHolding
)

ZERO = Decimal('0')

# 配置化常量
TRADING_DAYS_PER_YEAR = 252
MIN_ANNUALIZATION_DAYS = 30
EPSILON = 1e-6
DEFAULT_RISK_FREE_RATE = 0.02


class HoldingAnalyticsSnapshotService:

    @classmethod
    def generate_analytics(
            cls,
            user_id: int,
            start_date: date,
            end_date: date,
            ho_ids: Optional[List[int]] = None
    ) -> Optional[List[HoldingAnalyticsSnapshot]]:
        """
        统一的分析快照生成入口。

        :param user_id: 用户ID
        :param start_date: 目标开始日期 (包含)
        :param end_date: 目标结束日期 (包含)
        :param ho_ids: 指定的持仓ID列表，为空则处理该用户所有持仓
        :return: 生成的快照列表
        """
        logger.info(f"Starting analytics generation: {start_date} to {end_date} for user {user_id}")
        start_time = time.time()

        # 1. 获取分析窗口配置 (全局共享)
        windows = AnalyticsWindow.query.all()
        if not windows:
            logger.warning("No AnalyticsWindow defined. Aborting.")
            return []

        # 2. 获取用户的 risk_free_rate
        user = UserSetting.query.get(user_id)
        risk_free_rate = float(user.risk_free_rate) if user and user.risk_free_rate else DEFAULT_RISK_FREE_RATE

        # 3. 获取目标持仓 (通过 UserHolding 关联表)
        query = Holding.query.join(UserHolding, UserHolding.ho_id == Holding.id).filter(UserHolding.user_id == user_id)
        if ho_ids:
            query = query.filter(Holding.id.in_(ho_ids))
        holdings = query.all()

        if not holdings:
            return []

        all_snapshots = []

        # 4. 逐个持仓处理
        for holding in holdings:
            try:
                # 生成该持仓在指定时间段的快照对象
                snapshots = cls._process_single_holding(
                    holding=holding,
                    user_id=user_id,
                    windows=windows,
                    target_start=start_date,
                    target_end=end_date,
                    risk_free_rate=risk_free_rate
                )
                all_snapshots.extend(snapshots)

            except Exception as e:
                err_msg = f"Error processing holding {holding.ho_code}: {str(e)}"
                logger.exception(err_msg)

                # 记录异步任务以便后续重试
                create_task(
                    user_id=user_id,
                    task_name=f"Fix Analytics: {holding.ho_code}",
                    module_path="app.service.holding_analytics_snapshot_service",
                    method_name="generate_analytics",
                    kwargs={
                        "user_id": user_id,
                        "start_date": str(start_date),
                        "end_date": str(end_date),
                        "ho_ids": [holding.id]
                    },
                    error_message=err_msg
                )

        logger.info(f"Generated {len(all_snapshots)} analytics snapshots in {round(time.time() - start_time, 2)}s")
        return all_snapshots

    # ---------------------------------------------------------
    # Internal Logic Methods
    # ---------------------------------------------------------

    @classmethod
    def _process_single_holding(
            cls,
            holding: Holding,
            user_id: int,
            windows: List[AnalyticsWindow],
            target_start: date,
            target_end: date,
            risk_free_rate: float = DEFAULT_RISK_FREE_RATE
    ) -> List[HoldingAnalyticsSnapshot]:
        """
        处理单个持仓：加载数据 -> 遍历日期 -> 计算指标 -> 生成对象
        """
        # 1. 加载该持仓的基础快照数据 (DataFrame)
        # 需要加载 target_end 之前的所有数据，因为计算窗口需要历史数据
        df = cls._load_holding_data(ho_id=holding.id, up_to_date=target_end)
        if df.empty:
            return []

        # 2. 筛选出需要生成快照的目标日期范围
        mask = (df.index.date >= target_start) & (df.index.date <= target_end)
        target_dates = df.loc[mask].index

        if target_dates.empty:
            return []

        results = []

        # 3. 遍历目标日期
        for current_ts in target_dates:
            current_date_obj = current_ts.date()

            # 截止到当前日期的数据切片
            df_upto_now = df.loc[:current_ts]
            current_cycle = df_upto_now.iloc[-1]['cycle']

            # 4. 遍历窗口配置
            for window in windows:
                # 获取计算所需的窗口数据
                df_window = cls._get_window_slice(df_upto_now, window, current_cycle)

                # 数据不足则跳过
                if df_window is None or df_window.empty:
                    continue

                # 计算指标
                metrics = cls._calculate_metrics(df_window, window.annualization_factor, risk_free_rate)

                # 组装对象
                snapshot = HoldingAnalyticsSnapshot()
                snapshot.user_id = user_id
                snapshot.ho_id = holding.id
                snapshot.snapshot_date = current_date_obj
                snapshot.window_key = window.window_key

                # 映射指标
                snapshot.twrr_cumulative = metrics.get('twrr_cum')
                snapshot.twrr_annualized = metrics.get('twrr_ann')
                snapshot.irr_cumulative = metrics.get('irr_cum')
                snapshot.irr_annualized = metrics.get('irr_ann')
                snapshot.has_cumulative_pnl = metrics.get('cum_pnl')
                snapshot.has_cash_dividend = metrics.get('total_cash_div')
                snapshot.has_reinvest_dividend = metrics.get('total_reinvest_div')
                snapshot.has_total_dividend = (snapshot.has_cash_dividend or ZERO) + (snapshot.has_reinvest_dividend or ZERO)
                snapshot.has_return_volatility = metrics.get('volatility')
                snapshot.has_sharpe_ratio = metrics.get('sharpe')
                snapshot.has_max_drawdown = metrics.get('mdd')
                snapshot.has_max_drawdown_start_date = metrics.get('mdd_start')
                snapshot.has_max_drawdown_end_date = metrics.get('mdd_end')
                snapshot.has_max_drawdown_recovery_date = metrics.get('mdd_recovery_date')
                snapshot.has_max_drawdown_days = metrics.get('mdd_days')
                snapshot.has_max_runup = metrics.get('max_runup')
                snapshot.has_win_rate = metrics.get('win_rate')
                snapshot.has_calmar_ratio = metrics.get('calmar')
                snapshot.has_sortino_ratio = metrics.get('sortino')
                snapshot.has_downside_risk = metrics.get('downside_risk')

                results.append(snapshot)

        return results

    @classmethod
    def _load_holding_data(cls, ho_id: int, up_to_date: date) -> pd.DataFrame:
        """
        加载持仓基础快照并转为 DataFrame 以便计算
        """
        query = db.session.query(
            HoldingSnapshot.snapshot_date,
            HoldingSnapshot.hos_daily_pnl_ratio,
            HoldingSnapshot.hos_daily_pnl,
            HoldingSnapshot.holding_shares,
            HoldingSnapshot.hos_daily_cash_dividend,
            HoldingSnapshot.hos_daily_reinvest_dividend,
            HoldingSnapshot.tr_cycle,
            HoldingSnapshot.hos_net_external_cash_flow,
            HoldingSnapshot.hos_market_value,
        ).filter(
            HoldingSnapshot.ho_id == ho_id,
            HoldingSnapshot.snapshot_date <= up_to_date
        ).order_by(HoldingSnapshot.snapshot_date)

        raw_data = query.all()
        if not raw_data:
            return pd.DataFrame()

        # 转换为 DataFrame
        columns = [
            'date', 'daily_pnl_ratio', 'daily_pnl', 'shares',
            'daily_cash_dividend', 'daily_reinvest_dividend',
            'cycle', 'net_external_cash_flow', 'mv'
        ]
        df = pd.DataFrame([dict(zip(columns, row)) for row in raw_data])

        # 类型转换
        cols_to_float = [
            'daily_pnl_ratio', 'daily_pnl', 'shares',
            'daily_cash_dividend', 'daily_reinvest_dividend',
            'net_external_cash_flow', 'mv'
        ]
        for col in cols_to_float:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

        df['cycle'] = df['cycle'].fillna(0).astype(int)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        return df

    @staticmethod
    def _get_window_slice(df: pd.DataFrame, window: AnalyticsWindow, current_cycle_id: int) -> Optional[pd.DataFrame]:
        """
        根据窗口定义切片数据
        """
        if window.window_type == 'rolling':
            if not window.window_days:
                return None
            return df.tail(window.window_days)

        elif window.window_type == 'expanding':
            if window.window_key == 'ALL':
                return df
            elif window.window_key == 'CUR':
                return df[df['cycle'] == current_cycle_id]
            else:
                return df

        return None

    @classmethod
    def _calculate_metrics(cls, df: pd.DataFrame, annual_factor: int = 252, risk_free_rate: float = DEFAULT_RISK_FREE_RATE) -> Dict:
        """
        核心指标计算
        """
        daily_pnl_ratio_list = df['daily_pnl_ratio']
        pnls = df['daily_pnl']
        daily_cash_dividend = df['daily_cash_dividend']
        daily_reinvest_dividend = df['daily_reinvest_dividend']

        n = len(daily_pnl_ratio_list)
        if n == 0:
            return {}

        # 1. TWRR Cumulative
        twrr_cum = (1 + daily_pnl_ratio_list).prod() - 1

        # 2. Annualized TWRR
        twrr_ann = None
        if n >= MIN_ANNUALIZATION_DAYS:
            twrr_ann = (1 + twrr_cum) ** (annual_factor / n) - 1

        # 3. PnL & Dividends
        cum_pnl = pnls.sum()
        total_cash_div = daily_cash_dividend.sum()
        total_reinvest_div = daily_reinvest_dividend.sum()

        # 4. IRR (XIRR)
        irr_ann = None
        irr_cum = None
        if n >= MIN_ANNUALIZATION_DAYS:
            try:
                irr_ann = cls._calculate_xirr(df)
                if irr_ann is not None:
                    days_diff = (df.index[-1] - df.index[0]).days
                    if days_diff > 0:
                        irr_cum = Decimal(f"{((1 + irr_ann) ** (days_diff / 365.0) - 1):.6f}")
                    else:
                        irr_cum = ZERO
            except Exception:
                pass

        # 5. Volatility
        volatility = ZERO
        if n > 1:
            volatility = Decimal(f"{daily_pnl_ratio_list.std(ddof=1) * np.sqrt(annual_factor):.6f}")

        # 6. Sharpe
        sharpe = ZERO
        if volatility > EPSILON and twrr_ann is not None:
            sharpe = Decimal(f"{(float(twrr_ann) - risk_free_rate) / float(volatility):.4f}")

        # 7. Downside Risk & Sortino
        neg_returns = daily_pnl_ratio_list[daily_pnl_ratio_list < 0]
        downside_std = ZERO
        if len(neg_returns) > 1:
            downside_std = Decimal(f"{neg_returns.std(ddof=1) * np.sqrt(annual_factor):.6f}")

        sortino = ZERO
        if downside_std > EPSILON and twrr_ann is not None:
            sortino = Decimal(f"{(float(twrr_ann) - risk_free_rate) / float(downside_std):.4f}")

        # 8. MDD & Dates
        nav_series = (1 + daily_pnl_ratio_list).cumprod()
        running_max = nav_series.cummax()
        drawdown_series = (nav_series - running_max) / running_max
        mdd = drawdown_series.min()

        mdd_end_ts = drawdown_series.idxmin()
        mdd_end_date = mdd_end_ts.date()

        # MDD Start
        subset_before_trough = running_max.loc[:mdd_end_ts]
        if not subset_before_trough.empty:
            peak_val = subset_before_trough.iloc[-1]
            peak_candidates = subset_before_trough[subset_before_trough == peak_val]
            mdd_start_ts = peak_candidates.index[-1]
            mdd_start_date = mdd_start_ts.date()
        else:
            mdd_start_date = df.index[0].date()
            peak_val = nav_series.iloc[0]

        # MDD Days
        try:
            mdd_days = trade_calendar.count_trade_days_between(mdd_start_date, mdd_end_date, inclusive=False)
        except Exception:
            mdd_days = (mdd_end_date - mdd_start_date).days

        # Recovery Date
        recovery_date = cls._calc_recovery_date(nav_series, mdd_end_date, peak_val)

        # Max Runup
        max_runup = cls._calc_max_runup(nav_series)

        # 9. Calmar
        calmar = ZERO
        if mdd < 0 and twrr_ann is not None:
            calmar = Decimal(f"{float(twrr_ann) / abs(float(mdd)):.4f}")

        # 10. Win Rate
        win_rate = Decimal((daily_pnl_ratio_list > 0).sum() / n)

        return {
            'twrr_cum': Decimal(f"{twrr_cum:.6f}"),
            'twrr_ann': Decimal(f"{twrr_ann:.6f}") if twrr_ann is not None else None,
            'irr_ann': Decimal(f"{irr_ann:.6f}") if irr_ann is not None else None,
            'irr_cum': irr_cum,
            'cum_pnl': Decimal(f"{cum_pnl:.4f}"),
            'total_cash_div': Decimal(f"{total_cash_div:.4f}"),
            'total_reinvest_div': Decimal(f"{total_reinvest_div:.4f}"),
            'volatility': volatility,
            'sharpe': sharpe,
            'sortino': sortino,
            'downside_risk': downside_std,
            'mdd': Decimal(f"{mdd:.6f}"),
            'mdd_start': mdd_start_date,
            'mdd_end': mdd_end_date,
            'mdd_days': int(mdd_days),
            'calmar': calmar,
            'win_rate': win_rate,
            'mdd_recovery_date': recovery_date,
            'max_runup': max_runup,
        }

    # ---------------------------------------------------------
    # Utility Methods (XIRR, Recovery, Runup)
    # ---------------------------------------------------------

    @staticmethod
    def _calculate_xirr(df: pd.DataFrame) -> Optional[float]:
        """
        计算 XIRR (Newton/Bisection fallback)
        """
        df = df.copy()
        df['flow'] = df['net_external_cash_flow'] + df['daily_cash_dividend']

        # 过滤微小现金流
        flows = df[df['flow'].abs() > EPSILON].copy()
        dates = list(flows.index)
        amounts = list(flows['flow'])

        # 加入期末市值
        last_date = df.index[-1]
        last_mv = df.iloc[-1]['mv']

        if dates and dates[-1] == last_date:
            amounts[-1] += last_mv
        else:
            dates.append(last_date)
            amounts.append(last_mv)

        if len(dates) < 2:
            return None

        # 检查现金流方向
        pos = sum(1 for a in amounts if a > 0)
        neg = sum(1 for a in amounts if a < 0)
        if pos == 0 or neg == 0:
            return None

        if (dates[-1] - dates[0]).days < MIN_ANNUALIZATION_DAYS:
            return None

        def xnpv(rate, dates, amounts):
            if rate <= -1.0:
                return float('inf')
            d0 = dates[0]
            return sum(a / ((1.0 + rate) ** ((d - d0).days / 365.0)) for d, a in zip(dates, amounts))

        # Initial Guess
        total_in = sum(a for a in amounts if a < 0)
        total_out = sum(a for a in amounts if a > 0)
        guess = 0.1
        if total_in != 0:
            years = (dates[-1] - dates[0]).days / 365.0
            if years > 0:
                guess = ((total_out + total_in) / abs(total_in)) / years
                guess = max(-0.99, min(10.0, guess))

        try:
            result = optimize.newton(lambda r: xnpv(r, dates, amounts), guess, tol=1e-6, maxiter=200, disp=False)
            if not np.isfinite(result):
                raise RuntimeError("Non-finite")
            return result
        except (RuntimeError, ValueError):
            # Fallback: Bisection
            try:
                a, b = -0.99, 10.0
                fa, fb = xnpv(a, dates, amounts), xnpv(b, dates, amounts)
                if fa * fb > 0:
                    return None
                root, _ = optimize.bisect(lambda r: xnpv(r, dates, amounts), a, b, xtol=1e-6, maxiter=500, disp=False)
                return root
            except Exception:
                return None

    @staticmethod
    def _calc_recovery_date(nav_series: pd.Series, mdd_end_date: date, peak_val: float) -> Optional[date]:
        if mdd_end_date is None:
            return None
        try:
            after_trough = nav_series.loc[pd.Timestamp(mdd_end_date) + timedelta(days=1):]
            if after_trough.empty:
                return None

            recovery_mask = after_trough >= peak_val
            if not recovery_mask.any():
                return None

            return recovery_mask.idxmax().date()
        except Exception:
            return None

    @staticmethod
    def _calc_max_runup(nav_series: pd.Series) -> Decimal:
        if nav_series.empty:
            return ZERO
        running_min = nav_series.cummin().replace(0, np.nan)
        runup_series = (nav_series / running_min) - 1
        if runup_series.isnull().all():
            return ZERO
        return Decimal(f"{runup_series.max():.6f}")

    # ---------------------------------------------------------
    # Portfolio Level Aggregation
    # ---------------------------------------------------------

    @classmethod
    def update_position_ratios_and_contributions(cls, user_id: int, start_date: date = None, end_date: date = None):
        """
        更新仓位占比和组合贡献，需要先计算ias。

        :param user_id: 用户ID (必填)
        :param start_date: 开始日期 (可选，如果不传则自动查找 has_position_ratio IS NULL 的记录)
        :param end_date: 结束日期 (可选)
        """
        logger.info(f"Updating position ratios/contributions for user {user_id}")
        start_time = time.time()

        # 获取需要更新字段的列表
        query = HoldingAnalyticsSnapshot.query.filter(
            HoldingAnalyticsSnapshot.user_id == user_id
        )

        if start_date and end_date:
            # 如果传入了日期范围，按范围处理
            query = query.filter(
                HoldingAnalyticsSnapshot.snapshot_date >= start_date,
                HoldingAnalyticsSnapshot.snapshot_date <= end_date
            )
        else:
            # 如果未传入日期，自动查找 has_position_ratio IS NULL 的记录
            query = query.filter(
                or_(
                    HoldingAnalyticsSnapshot.has_position_ratio.is_(None),
                    HoldingAnalyticsSnapshot.has_portfolio_contribution.is_(None)
                )
            )

        to_update_has_list = query.order_by(HoldingAnalyticsSnapshot.snapshot_date).all()
        if not to_update_has_list:
            logger.info("Nothing to update in position ratios/contributions.")
            return {"updated": 0}

        # 1. 构建需要更新的 HoldingAnalyticsSnapshot 日期映射
        has_to_update_map = defaultdict(list)
        for has in to_update_has_list:
            has_to_update_map[has.snapshot_date].append(has)

        # 2. 获取日期范围并批量查询
        min_date = min(has_to_update_map.keys())
        max_date = max(has_to_update_map.keys())

        # 3. 获取所有需要的持仓快照
        holding_snapshots = HoldingSnapshot.query.filter(
            HoldingSnapshot.snapshot_date.between(min_date, max_date),
            HoldingSnapshot.user_id == user_id
        ).all()

        holding_data_map = defaultdict(dict)
        for snap in holding_snapshots:
            holding_data_map[snap.snapshot_date][snap.ho_id] = snap

        # 获取所有需要的投资组合快照 (往前倒一天)
        ias_list = InvestedAssetSnapshot.query.filter(
            InvestedAssetSnapshot.snapshot_date.between(trade_calendar.prev_trade_day(min_date), max_date),
            InvestedAssetSnapshot.user_id == user_id
        ).all()

        ias_date_map = {ias.snapshot_date: ias for ias in ias_list}

        updated_count = 0
        records_to_commit = []
        # 遍历并计算更新
        for target_date, has_records in has_to_update_map.items():
            # 获取当日和前一日的组合快照
            ias_today = ias_date_map.get(target_date)
            ias_prev = ias_date_map.get(trade_calendar.prev_trade_day(target_date))

            # 获取当日的持仓快照
            holding_snaps_for_date = holding_data_map.get(target_date, {})

            for has in has_records:
                holding_data = holding_snaps_for_date.get(has.ho_id)
                if not holding_data:
                    logger.debug(f"Skipping HAS id={has.id}: No HoldingSnapshot data found.")
                    continue

                # 计算 has_portfolio_contribution
                prev_mv = ias_prev.ias_market_value if ias_prev else ZERO
                if prev_mv and prev_mv != ZERO:
                    has.has_portfolio_contribution = holding_data.hos_daily_pnl / prev_mv
                else:
                    has.has_portfolio_contribution = ZERO

                # 计算 has_position_ratio
                if ias_today and ias_today.ias_market_value and ias_today.ias_market_value != ZERO:
                    has.has_position_ratio = holding_data.hos_market_value / ias_today.ias_market_value
                else:
                    has.has_position_ratio = ZERO

                records_to_commit.append(has)
                updated_count += 1

        if records_to_commit:
            try:
                db.session.bulk_save_objects(records_to_commit)
                db.session.commit()
                logger.info(f"Successfully updated {updated_count} HoldingAnalyticsSnapshot records.")
            except Exception as e:
                db.session.rollback()
                logger.exception(f"Error committing updates for HoldingAnalyticsSnapshot: {e}")
                raise

        duration = round(time.time() - start_time, 2)
        logger.info(f"Finished update_position_ratios_and_contributions in {duration}s. Updated {updated_count} records.")
        return {"updated": updated_count, "duration": duration}
