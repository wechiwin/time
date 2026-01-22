import logging
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Optional, List

import numpy as np
import pandas as pd
from scipy import optimize

from app.calendars.trade_calendar import TradeCalendar
from app.database import db
from app.framework.async_task_manager import create_task
from app.models import (
    InvestedAssetSnapshot, AnalyticsWindow, InvestedAssetAnalyticsSnapshot, UserSetting
)

logger = logging.getLogger(__name__)
trade_calendar = TradeCalendar()

# 配置化常量
RISK_FREE_RATE = 0.02  # TODO 目前硬编码为 0.02 (2%)。建议放入系统配置表或常量类中。
TRADING_DAYS_PER_YEAR = 252
CALENDAR_DAYS_PER_YEAR = 365.25  # 使用 365.25 更精确
MIN_ANNUALIZATION_DAYS = 30  # 最小年化天数
EPSILON = 1e-6  # 浮点精度阈值
ZERO = Decimal('0')
XIRR_BRACKET = [-0.999, 50.0]  # XIRR 求解范围 (-99.9% to 5000%)


class InvestedAssetAnalyticsSnapshotService:

    # ==================================================================
    # 任务入口 (Task Entrypoints) - 已修改
    # ==================================================================

    @classmethod
    def scheduled_daily_generation(cls):
        """
        【增量任务总入口】由 APScheduler 调用，为所有活跃用户生成 T-1 快照。
        """
        target_date = date.today() - timedelta(days=1)
        if not trade_calendar.is_trade_day(target_date):
            logger.info(f"{target_date} is not a trading day. Skipping daily generation.")
            return

        active_users = UserSetting.query.filter_by(is_active=True).all()
        logger.info(f"Starting daily analytics generation for {len(active_users)} users for date {target_date}.")

        for user in active_users:
            try:
                cls.generate_by_day(user_id=user.id, target_date=target_date)
            except Exception as e:
                # 隔离用户错误，防止一个用户的失败影响其他用户
                error_msg = f"Failed to generate analytics for user {user.id} on {target_date}: {e}"
                logger.error(error_msg, exc_info=True)
                # 可以选择为失败的用户创建重试任务
                create_task(
                    task_name=f"retry_analytics_user_{user.id}_{target_date}",
                    module_path="app.service.invested_asset_analytics_snapshot_service",
                    class_name="InvestedAssetAnalyticsSnapshotService",
                    method_name="generate_by_day",
                    kwargs={"user_id": user.id, "target_date": target_date},
                    error_message=error_msg
                )

    @classmethod
    def generate_by_day(cls, user_id: int, target_date: Optional[date] = None):
        """
        为单个用户生成指定日期的分析快照。
        """
        if not target_date:
            target_date = date.today() - timedelta(days=1)

        if not trade_calendar.is_trade_day(target_date):
            logger.info(f"{target_date} is not a trading day. Skipping.")
            return None

        logger.info(f"Starting InvestedAssetAnalyticsSnapshot generation for user {user_id} on {target_date}...")

        total_generated = 0
        errors = []
        start_time = time.time()

        try:
            results = cls.generate_analytics(start_date=target_date, end_date=target_date, user_id=user_id)
            if not results:
                return {"total_generated": 0, "errors": [], "duration": time.time() - start_time}

            # 删除旧数据（防重入）
            InvestedAssetAnalyticsSnapshot.query.filter_by(
                user_id=user_id,
                snapshot_date=target_date
            ).delete(synchronize_session=False)

            db.session.add_all(results)
            db.session.commit()
            total_generated += len(results)
            logger.info(f"Successfully generated analytics for {target_date}")
            return {"total_generated": len(results), "errors": [], "duration": time.time() - start_time}

        except Exception as e:
            db.session.rollback()
            error_msg = f"Error generating InvestedAssetAnalyticsSnapshot  for {target_date}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            # 触发重试
            create_task(
                task_name=f"retry_invested_asset_analytics_{target_date}",
                module_path="app.service.invested_asset_analytics_snapshot_service",
                class_name="InvestedAssetAnalyticsSnapshotService",
                method_name="generate_by_day",
                kwargs={"target_date": target_date},
                error_message=error_msg
            )

        duration = time.time() - start_time
        return {"total_generated": total_generated, "errors": errors, "duration": duration}

    @classmethod
    def regenerate_for_user(cls, user_id: int):
        """
        【全量重刷入口】 清除所有历史数据，从最早的持仓记录开始重新生成。
        """
        logger.info("Starting Full Regeneration of InvestedAssetAnalyticsSnapshot for user {user_id}...")
        start_time = time.time()

        total_generated = 0
        errors = []

        # 查找最早的投资资产快照日期
        min_date_result = db.session.query(db.func.min(InvestedAssetSnapshot.snapshot_date)).scalar()
        if not min_date_result:
            msg = "No InvestedAssetSnapshot data found. Aborting regeneration."
            logger.warning(msg)
            errors.append(msg)
            return {"total_generated": total_generated, "errors": errors, "duration": 0}

        min_date = min_date_result
        today = date.today()
        current_date = min_date

        try:
            results = cls.generate_analytics(start_date=min_date, end_date=today, user_id=user_id)
            if not results:
                logger.warning(f"No InvestedAssetSnapshot generated for: {current_date}")
                return {"total_generated": total_generated, "errors": errors, "duration": 0}

            # 删除旧数据（防重入）
            logger.info(f"Deleting existing analytics data from {min_date} to {today}...")
            InvestedAssetAnalyticsSnapshot.query.filter(
                InvestedAssetAnalyticsSnapshot.user_id == user_id,
                InvestedAssetAnalyticsSnapshot.snapshot_date >= min_date,
                InvestedAssetAnalyticsSnapshot.snapshot_date <= today
            ).delete(synchronize_session=False)

            # 4. 保存入库
            db.session.add_all(results)
            db.session.commit()

            total_generated += len(results)
            logger.info(f"Successfully generated all invested asset analytics snapshots")

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
    def generate_analytics(cls,
                           start_date: date,
                           end_date: date,
                           user_id: int,
                           ) -> Optional[List[InvestedAssetAnalyticsSnapshot]]:
        """
        核心方法：按窗口和时间范围生成分析快照
        :param start_date: 开始日期
        :param end_date: 结束日期
        :return: 生成的快照列表
        """
        logger.info(f"Generating analytics from {start_date} to {end_date}...")

        # 获取所有窗口配置
        windows = AnalyticsWindow.query.all()
        if not windows:
            logger.warning("No analytics windows configured")
            return None

        # 2. 【性能优化】一次性加载截止到 end_date 的所有历史基础数据
        # 这样在循环中只需要做 DataFrame 切片，不需要查库
        full_history_df = cls._load_history_data(user_id, end_date)
        if full_history_df.empty:
            logger.warning(f"No historical data available up to {end_date}")
            return []

        all_snapshots = []
        current_date = start_date

        # 3. 遍历每一天
        while current_date < end_date:  # 注意：通常包含 end_date
            if not trade_calendar.is_trade_day(current_date):
                current_date += timedelta(days=1)
                continue

            # 检查当前日期是否有数据（通过 DataFrame 索引检查，比查库快）
            # full_history_df 的索引是 pd.Timestamp，需要转换比较
            ts_current = pd.Timestamp(current_date)
            if ts_current not in full_history_df.index:
                # logger.debug(f"No snapshot data for {current_date}, skipping.")
                current_date += timedelta(days=1)
                continue

            # 截取截止到当前日期的数据 (History up to current_date)
            # 使用 loc 切片，包含 current_date
            df_up_to_now = full_history_df.loc[:ts_current]

            for window in windows:
                # 根据窗口定义获取对应的数据切片 (e.g., 最近20天)
                df_window = cls._get_window_slice(df_up_to_now, window)

                # 如果窗口数据不足（例如 R252 但只有 10 天数据），根据业务需求决定是否计算
                # 这里简单判空
                if df_window is None or df_window.empty:
                    continue

                # 计算指标
                metrics = cls._calculate_metrics(df_window, window.annualization_factor)

                # 构建对象
                snap = InvestedAssetAnalyticsSnapshot(
                    user_id=user_id,
                    snapshot_date=current_date,
                    window_key=window.window_key,

                    # Return Metrics
                    twrr_cumulative=metrics['twrr_cum'],
                    twrr_annualized=metrics['twrr_ann'],
                    irr_cumulative=metrics['irr_cum'],
                    irr_annualized=metrics['irr_ann'],
                    period_pnl=metrics['period_pnl'],
                    period_pnl_ratio=metrics['period_pnl_ratio'],
                    # Risk Metrics
                    volatility=metrics['volatility'],
                    max_drawdown=metrics['mdd'],
                    max_drawdown_start_date=metrics['mdd_start'],
                    max_drawdown_end_date=metrics['mdd_end'],
                    max_drawdown_recovery_date=metrics['mdd_recovery'],
                    sharpe_ratio=metrics['sharpe'],
                    sortino_ratio=metrics['sortino'],
                    calmar_ratio=metrics['calmar'],

                    # Distribution
                    win_rate=metrics['win_rate'],
                    best_day_return=metrics['best_day'],
                    worst_day_return=metrics['worst_day'],
                )
                all_snapshots.append(snap)

            current_date += timedelta(days=1)

        return all_snapshots

    @classmethod
    def _load_history_data(cls, user_id: int, up_to_date: date) -> pd.DataFrame:
        """
        加载 InvestedAssetSnapshot 历史数据
        """
        query = db.session.query(
            InvestedAssetSnapshot.snapshot_date,
            InvestedAssetSnapshot.ias_daily_pnl_ratio,
            InvestedAssetSnapshot.ias_daily_pnl,
            InvestedAssetSnapshot.ias_net_external_cash_flow,
            InvestedAssetSnapshot.ias_market_value,
            InvestedAssetSnapshot.ias_daily_cash_dividend
        ).filter(InvestedAssetSnapshot.user_id == user_id,
                 InvestedAssetSnapshot.snapshot_date <= up_to_date
                 ).order_by(InvestedAssetSnapshot.snapshot_date)

        rows = query.all()
        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame(rows, columns=['date', 'ret', 'pnl', 'net_inflow', 'mv', 'dividend'])

        # 类型转换
        cols = ['ret', 'pnl', 'net_inflow', 'mv', 'dividend']
        for c in cols:
            df[c] = df[c].apply(lambda x: float(x) if x is not None else 0.0)

        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        return df

    @staticmethod
    def _get_window_slice(df: pd.DataFrame, window: AnalyticsWindow) -> Optional[pd.DataFrame]:
        """
        根据窗口定义切片 DataFrame
        """
        if window.window_type == 'rolling':
            if not window.window_days:
                return None
            return df.tail(window.window_days)
        elif window.window_type == 'expanding':
            if window.window_key == 'ALL':
                return df
            # 如果有 YTD (Year to Date) 等逻辑可在此扩展
            return df
        return None

    @classmethod
    def _calculate_metrics(cls, df: pd.DataFrame, annual_factor: int = 252) -> Dict:
        """
        计算核心指标
        """
        returns = df['ret']
        pnls = df['pnl']
        n = len(returns)

        # 1. TWRR (Time-Weighted Return)
        # 几何链接：(1+r1)*(1+r2)... - 1
        twrr_cum = (1 + returns).prod() - 1

        if n >= MIN_ANNUALIZATION_DAYS:
            twrr_ann = (1 + twrr_cum) ** (annual_factor / n) - 1
        else:
            twrr_ann = None

        # 2. Period PnL
        period_pnl = pnls.sum()

        # 逻辑：区间盈亏 / 区间期初本金
        # 期初本金 = 第一天的期末市值 - 第一天的盈亏 - 第一天的净流入 (即 T-1 日的市值)
        first_row = df.iloc[0]
        start_mv_t_minus_1 = first_row['mv'] - first_row['pnl'] - first_row['net_inflow']

        # 确定分母（本金）：
        # 如果 T-1 市值几乎为0（例如新开仓），则使用第一天的净流入作为本金
        base_capital = start_mv_t_minus_1
        if base_capital < 1.0:  # 使用 1.0 作为金额的最小阈值，避免浮点误差
            base_capital = base_capital + first_row['net_inflow']

        if base_capital > 1.0:
            period_pnl_ratio = period_pnl / base_capital
        else:
            period_pnl_ratio = 0.0

        # 3. IRR (Money-Weighted Return) - XIRR
        irr_ann_val = None
        irr_cum_val = None
        # 仅对 'ALL' 或长周期窗口计算，短周期计算 XIRR 容易不收敛且意义不大
        if n > MIN_ANNUALIZATION_DAYS:
            irr_ann_val = cls._calculate_xirr(df)
            # 如果算出了年化 IRR，尝试计算累计 IRR
            if irr_ann_val is not None:
                # 计算时间跨度（年）
                days = (df.index[-1] - df.index[0]).days
                if days > 0:
                    try:
                        # 累计 = (1 + 年化)^(天数/365) - 1
                        irr_cum_val = (1 + irr_ann_val) ** (days / 365.0) - 1
                    except:
                        irr_cum_val = None

        # 4. Risk Metrics
        if n > 1:
            volatility = returns.std(ddof=1) * np.sqrt(annual_factor)
        else:
            volatility = ZERO

        sharpe = 0
        if volatility > EPSILON and twrr_ann is not None:
            sharpe = (twrr_ann - RISK_FREE_RATE) / volatility if twrr_ann is not None else 0

        # Sortino
        neg_rets = returns[returns < 0]
        if len(neg_rets) > 1:
            downside_std = neg_rets.std(ddof=1) * np.sqrt(annual_factor)
        else:
            downside_std = ZERO

        sortino = 0
        if downside_std > EPSILON and twrr_ann is not None:
            sortino = (twrr_ann - RISK_FREE_RATE) / downside_std

        # 5. Max Drawdown
        nav_series = (1 + returns).cumprod()
        running_max = nav_series.cummax()
        drawdown = (nav_series - running_max) / running_max
        mdd = drawdown.min()

        # MDD Dates
        mdd_end_ts = drawdown.idxmin()
        subset = running_max.loc[:mdd_end_ts]
        if not subset.empty:
            peak_val = subset.iloc[-1]
            # 找到最后一个达到峰值的日期
            mdd_start_ts = subset[subset == peak_val].index[-1]
        else:
            mdd_start_ts = df.index[0]
            peak_val = nav_series.iloc[0]

        # Recovery
        mdd_recovery = None
        # 只有当确实有回撤时才计算日期
        if mdd < 0:
            # 找到谷底之前的那个峰值
            subset = running_max.loc[:mdd_end_ts]
            if not subset.empty:
                peak_val = subset.iloc[-1]
                # 找到最后一个达到峰值的日期
                peak_dates = subset[subset == peak_val].index
                if not peak_dates.empty:
                    mdd_start_ts = peak_dates[-1]

            # Recovery: 谷底之后，第一个 >= peak_val 的日期
            after_trough = nav_series.loc[mdd_end_ts:].iloc[1:]  # 排除谷底当天
            if not after_trough.empty:
                rec_mask = after_trough >= peak_val
                if rec_mask.any():
                    mdd_recovery = rec_mask.idxmax().date()

        # Calmar
        calmar = 0
        if mdd < 0 and twrr_ann:
            calmar = twrr_ann / abs(mdd)

        # 6. Distribution
        win_rate = (returns > 0).sum() / n if n > 0 else 0
        best_day = returns.max() if n > 0 else 0
        worst_day = returns.min() if n > 0 else 0

        return {
            'twrr_cum': Decimal(f"{twrr_cum:.6f}"),
            'twrr_ann': Decimal(f"{twrr_ann:.6f}") if twrr_ann is not None else None,
            'irr_cum': Decimal(f"{irr_cum_val:.6f}") if irr_cum_val is not None else None,
            'irr_ann': Decimal(f"{irr_ann_val:.6f}") if irr_ann_val is not None else None,
            'period_pnl': Decimal(f"{period_pnl:.4f}"),
            'period_pnl_ratio': Decimal(f"{period_pnl_ratio:.6f}"),
            'volatility': Decimal(f"{volatility:.6f}"),
            'mdd': Decimal(f"{mdd:.6f}"),
            'mdd_start': mdd_start_ts.date() if isinstance(mdd_start_ts, pd.Timestamp) else mdd_start_ts,
            'mdd_end': mdd_end_ts.date() if isinstance(mdd_end_ts, pd.Timestamp) else mdd_end_ts,
            'mdd_recovery': mdd_recovery,
            'sharpe': Decimal(f"{sharpe:.4f}"),
            'sortino': Decimal(f"{sortino:.4f}"),
            'calmar': Decimal(f"{calmar:.4f}"),
            'win_rate': Decimal(f"{win_rate:.4f}"),
            'best_day': Decimal(f"{best_day:.6f}"),
            'worst_day': Decimal(f"{worst_day:.6f}"),
        }

    @staticmethod
    def _calculate_xirr(df: pd.DataFrame) -> Optional[float]:
        """
        计算 XIRR (内部收益率)
        逻辑：
        1. 构造现金流 = 每日净投入(买卖) + 每日现金分红
        2. 最后一天的现金流 = 最后一天的市值 (视为全部赎回，正数流入)。
        """
        # 1. 构造现金流
        flows = df['net_inflow'] + df['dividend']
        # 期初投入为负，期末市值为正
        cash_flows = np.append(flows.values, df['mv'].iloc[-1])
        dates = np.append(flows.index.to_pydatetime(), df.index[-1].to_pydatetime())

        # 过滤掉零现金流，提高计算效率
        non_zero_mask = cash_flows != 0
        cash_flows = cash_flows[non_zero_mask]
        dates = dates[non_zero_mask]

        if len(cash_flows) < 2 or not (any(cash_flows > 0) and any(cash_flows < 0)):
            return None

        # 2. 定义向量化的 XNPV 函数
        def xnpv_np(rate, dates, amounts):
            if rate <= -1.0:
                # 返回一个巨大的正数，引导求解器离开无效区域
                return 1e12

            # (date - date0).days
            time_diffs = np.array([(d - dates[0]).days for d in dates]) / CALENDAR_DAYS_PER_YEAR

            # 避免在 rate 接近 -1 时出现溢出
            # np.power 对于负基数和非整数指数会返回 nan，这里我们已经通过 rate <= -1 保护
            discount_factors = np.power(1.0 + rate, time_diffs)

            # 检查是否有无效的贴现因子（例如 inf）
            if not np.all(np.isfinite(discount_factors)) or np.any(discount_factors == 0):
                return 1e12

            return np.sum(amounts / discount_factors)

        # 3. 使用稳健的求解器 brentq
        try:
            # brentq 需要一个函数值异号的区间 [a, b]
            # 我们可以通过测试区间的端点来确认
            f_a = xnpv_np(XIRR_BRACKET[0], dates, cash_flows)
            f_b = xnpv_np(XIRR_BRACKET[1], dates, cash_flows)

            if np.sign(f_a) == np.sign(f_b):
                # 如果同号，说明解可能不在这个大区间内，或者有多个解，这在IRR中很少见但可能
                logger.warning(f"XIRR solver could not find a valid bracket for cash flows on {dates[-1]}. f(a)={f_a}, f(b)={f_b}")
                # 尝试使用 newton 作为备选
                return optimize.newton(lambda r: xnpv_np(r, dates, cash_flows), 0.1, tol=1e-5, maxiter=100)

            root, info = optimize.brentq(lambda r: xnpv_np(r, dates, cash_flows), XIRR_BRACKET[0], XIRR_BRACKET[1])

            return root

        except (RuntimeError, ValueError) as e:
            # RuntimeError: 求解失败
            # ValueError: f(a)和f(b)必须异号
            logger.warning(f"XIRR calculation failed for period ending {df.index[-1].date()}: {e}")
            return None
