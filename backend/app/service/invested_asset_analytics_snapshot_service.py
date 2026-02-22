# app/service/invested_asset_analytics_snapshot_service.py
from loguru import logger
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Optional, List

import numpy as np
import pandas as pd
from scipy import optimize

from app.calendars.trade_calendar import trade_calendar
from app.extension import db
from app.framework.async_task_manager import create_task
from app.models import InvestedAssetSnapshot, AnalyticsWindow, InvestedAssetAnalyticsSnapshot, UserSetting


# 常量配置
TRADING_DAYS_PER_YEAR = 252
CALENDAR_DAYS_PER_YEAR = 365.25
MIN_ANNUALIZATION_DAYS = 30
EPSILON = 1e-6
ZERO = Decimal('0')
DEFAULT_RISK_FREE_RATE = 0.02


class InvestedAssetAnalyticsSnapshotService:

    @classmethod
    def generate_analytics(cls, user_id: int, start_date: date, end_date: date):
        """
        统一入口：生成指定时间段的投资组合分析快照。

        :param user_id: 用户ID
        :param start_date: 目标开始日期 (包含)
        :param end_date: 目标结束日期 (包含)
        """
        logger.info(f"Starting InvestedAssetAnalytics generation: {start_date} to {end_date} for user {user_id}")
        start_time = time.time()

        # 1. 加载窗口配置
        windows = AnalyticsWindow.query.all()
        if not windows:
            logger.warning("No AnalyticsWindow defined.")
            return {"total_generated": 0, "errors": []}

        # 2. 获取用户的 risk_free_rate
        user = UserSetting.query.get(user_id)
        risk_free_rate = float(user.risk_free_rate) if user and user.risk_free_rate else DEFAULT_RISK_FREE_RATE

        # 3. 加载历史数据 (需要比 start_date 更早的数据用于计算滚动窗口)
        raw_df = cls._load_data(user_id, end_date)
        if raw_df.empty:
            return {"total_generated": 0, "errors": []}

        # 4. 核心计算逻辑
        try:
            # 使用向量化计算生成所有结果
            result_snaps = cls._calculate_range(raw_df, windows, start_date, end_date, user_id, risk_free_rate)
        except Exception as e:
            logger.exception(f"Error during analytics calculation: {e}")
            return {"total_generated": 0, "errors": [str(e)]}

        # 4. 数据库持久化
        total_generated = 0
        if result_snaps:
            try:
                # 删除旧数据
                db.session.query(InvestedAssetAnalyticsSnapshot).filter(
                    InvestedAssetAnalyticsSnapshot.user_id == user_id,
                    InvestedAssetAnalyticsSnapshot.snapshot_date >= start_date,
                    InvestedAssetAnalyticsSnapshot.snapshot_date <= end_date
                ).delete(synchronize_session=False)

                db.session.bulk_save_objects(result_snaps)
                db.session.commit()
                total_generated = len(result_snaps)
                logger.info(f"Generated {total_generated} analytics snapshots.")
            except Exception as e:
                db.session.rollback()
                logger.exception(f"DB Error: {e}")

        return {"total_generated": total_generated, "duration": time.time() - start_time}

    @classmethod
    def _load_data(cls, user_id: int, up_to_date: date) -> pd.DataFrame:
        """加载基础快照数据"""
        data = InvestedAssetSnapshot.query.filter(
            InvestedAssetSnapshot.user_id == user_id,
            InvestedAssetSnapshot.snapshot_date <= up_to_date
        ).order_by(InvestedAssetSnapshot.snapshot_date).all()

        if not data:
            return pd.DataFrame()

        rows = [{
            'date': d.snapshot_date,
            'ret': float(d.ias_daily_pnl_ratio or 0),
            'pnl': float(d.ias_daily_pnl or 0),
            'mv': float(d.ias_market_value or 0),
            'net_flow': float(d.ias_net_external_cash_flow or 0),
            'dividend': float(d.ias_daily_cash_dividend or 0)
        } for d in data]

        df = pd.DataFrame(rows)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        return df

    @classmethod
    def _calculate_range(cls, df: pd.DataFrame, windows: List[AnalyticsWindow],
                         start_date: date, end_date: date, user_id: int,
                         risk_free_rate: float = DEFAULT_RISK_FREE_RATE) -> List[InvestedAssetAnalyticsSnapshot]:
        """
        核心计算逻辑：遍历日期和窗口，生成快照对象。
        """
        results = []

        # 过滤出目标日期索引
        target_dates = df.loc[start_date:end_date].index

        for t_date in target_dates:
            # 截止到当天的历史数据
            df_hist = df.loc[:t_date]

            for window in windows:
                # 获取窗口切片
                df_w = cls._get_window(df_hist, window)
                if df_w.empty or len(df_w) < 1:
                    continue

                # 计算指标
                metrics = cls._compute_metrics(df_w, risk_free_rate)

                # 组装对象
                snap = InvestedAssetAnalyticsSnapshot()
                snap.user_id = user_id
                snap.snapshot_date = t_date.date()
                snap.window_key = window.window_key

                snap.twrr_cumulative = metrics.get('twrr_cum')
                snap.twrr_annualized = metrics.get('twrr_ann')
                snap.irr_cumulative = metrics.get('irr_cum')
                snap.irr_annualized = metrics.get('irr_ann')
                snap.period_pnl = metrics.get('period_pnl')
                snap.period_pnl_ratio = metrics.get('period_pnl_ratio')

                snap.volatility = metrics.get('volatility')
                snap.max_drawdown = metrics.get('mdd')
                snap.max_drawdown_start_date = metrics.get('mdd_start')
                snap.max_drawdown_end_date = metrics.get('mdd_end')
                snap.max_drawdown_recovery_date = metrics.get('mdd_recovery')
                snap.sharpe_ratio = metrics.get('sharpe')
                snap.sortino_ratio = metrics.get('sortino')
                snap.calmar_ratio = metrics.get('calmar')

                snap.win_rate = metrics.get('win_rate')
                snap.best_day_return = metrics.get('best_day')
                snap.worst_day_return = metrics.get('worst_day')

                results.append(snap)

        return results

    @staticmethod
    def _get_window(df: pd.DataFrame, window: AnalyticsWindow) -> pd.DataFrame:
        if window.window_type == 'rolling':
            return df.tail(window.window_days) if window.window_days else pd.DataFrame()
        elif window.window_type == 'expanding':
            return df
        return pd.DataFrame()

    @classmethod
    def _compute_metrics(cls, df: pd.DataFrame, risk_free_rate: float = DEFAULT_RISK_FREE_RATE) -> Dict:
        """计算所有指标"""
        n = len(df)
        rets = df['ret']
        pnls = df['pnl']

        # 1. TWRR Cumulative & Ann
        twrr_cum = (1 + rets).prod() - 1
        twrr_ann = None
        if n >= MIN_ANNUALIZATION_DAYS:
            twrr_ann = (1 + twrr_cum) ** (TRADING_DAYS_PER_YEAR / n) - 1

        # 2. Period PnL & Ratio
        period_pnl = pnls.sum()
        # 本金 = T-1 日市值 (首行 MV - 首行 PnL - 首行 Flow)
        first_row = df.iloc[0]
        start_capital = first_row['mv'] - first_row['pnl'] - first_row['net_flow']
        if start_capital < 1.0:
            start_capital += first_row['net_flow']

        period_pnl_ratio = period_pnl / start_capital if start_capital > 1.0 else ZERO

        # 3. IRR (XIRR)
        irr_ann = None
        irr_cum = None
        if n >= MIN_ANNUALIZATION_DAYS:
            irr_ann = cls._calc_xirr(df)
            if irr_ann is not None:
                days = (df.index[-1] - df.index[0]).days
                if days > 0:
                    irr_cum = (1 + irr_ann) ** (days / CALENDAR_DAYS_PER_YEAR) - 1

        # 4. Risk Metrics
        volatility = rets.std(ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR) if n > 1 else ZERO
        sharpe = (twrr_ann - risk_free_rate) / volatility if (volatility > EPSILON and twrr_ann) else ZERO

        neg_rets = rets[rets < 0]
        downside_std = neg_rets.std(ddof=1) * np.sqrt(TRADING_DAYS_PER_YEAR) if len(neg_rets) > 1 else ZERO
        sortino = (twrr_ann - risk_free_rate) / downside_std if (downside_std > EPSILON and twrr_ann) else ZERO

        # 5. MDD
        nav = (1 + rets).cumprod()
        running_max = nav.cummax()
        dd = (nav - running_max) / running_max
        mdd = dd.min()

        mdd_end_ts = dd.idxmin()
        mdd_end = mdd_end_ts.date()

        # MDD Start
        peak_val = running_max.loc[mdd_end_ts]
        subset = running_max.loc[:mdd_end_ts]
        mdd_start_ts = subset[subset == peak_val].index[-1]
        mdd_start = mdd_start_ts.date()

        # Recovery
        mdd_recovery = None
        if mdd < 0:
            after_trough = nav.loc[mdd_end_ts:].iloc[1:]
            if not after_trough.empty:
                rec_mask = after_trough >= peak_val
                if rec_mask.any():
                    mdd_recovery = rec_mask.idxmax().date()

        calmar = twrr_ann / abs(mdd) if (mdd < 0 and twrr_ann) else ZERO

        # 6. Distribution
        win_rate = (rets > 0).sum() / n
        best_day = rets.max()
        worst_day = rets.min()

        return {
            'twrr_cum': Decimal(f"{twrr_cum:.6f}"),
            'twrr_ann': Decimal(f"{twrr_ann:.6f}") if twrr_ann is not None else None,
            'irr_ann': Decimal(f"{irr_ann:.6f}") if irr_ann is not None else None,
            'irr_cum': Decimal(f"{irr_cum:.6f}") if irr_cum is not None else None,
            'period_pnl': Decimal(f"{period_pnl:.4f}"),
            'period_pnl_ratio': Decimal(f"{period_pnl_ratio:.6f}"),
            'volatility': Decimal(f"{volatility:.6f}"),
            'mdd': Decimal(f"{mdd:.6f}"),
            'mdd_start': mdd_start,
            'mdd_end': mdd_end,
            'mdd_recovery': mdd_recovery,
            'sharpe': Decimal(f"{sharpe:.4f}"),
            'sortino': Decimal(f"{sortino:.4f}"),
            'calmar': Decimal(f"{calmar:.4f}"),
            'win_rate': Decimal(f"{win_rate:.4f}"),
            'best_day': Decimal(f"{best_day:.6f}"),
            'worst_day': Decimal(f"{worst_day:.6f}"),
        }

    @staticmethod
    def _calc_xirr(df: pd.DataFrame) -> Optional[float]:
        """优化后的 XIRR 计算"""
        # 构造现金流：NetFlow + Dividend
        flows = df['net_flow'] + df['dividend']
        # 加上期末市值 (作为赎回)
        last_date = df.index[-1]
        last_mv = df.iloc[-1]['mv']

        # 构建数组
        dates = list(flows.index)
        amounts = list(flows.values)

        if dates[-1] == last_date:
            amounts[-1] += last_mv
        else:
            dates.append(last_date)
            amounts.append(last_mv)

        # 过滤 0
        mask = np.array(amounts) != 0
        amounts = np.array(amounts)[mask]
        dates = np.array(dates)[mask]

        if len(amounts) < 2 or not (np.any(amounts > 0) and np.any(amounts < 0)):
            return None

        def xnpv(rate):
            d0 = dates[0]
            time_diffs = np.array([(d - d0).days for d in dates]) / CALENDAR_DAYS_PER_YEAR
            return np.sum(amounts / np.power(1.0 + rate, time_diffs))

        try:
            f_low = xnpv(-0.99)
            f_high = xnpv(10.0)

            if np.sign(f_low) == np.sign(f_high):
                return None

            root = optimize.brentq(xnpv, -0.99, 10.0)
            return root
        except Exception:
            return None
