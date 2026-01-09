import logging
import time
import traceback
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional

import numpy as np
import pandas as pd

from app.calendars.trade_calendar import TradeCalendar
from app.database import db
from app.models import (
    Holding, HoldingSnapshot, AnalyticsWindow, HoldingAnalyticsSnapshot
)

logger = logging.getLogger(__name__)
trade_calendar = TradeCalendar()

# 配置化常量
RISK_FREE_RATE = 0.02  # TODO 目前硬编码为 0.02 (2%)。建议放入系统配置表或常量类中。
TRADING_DAYS_PER_YEAR = 252
MIN_ANNUALIZATION_DAYS = 30  # 最小年化天数
EPSILON = 1e-6  # 浮点精度阈值


class HoldingAnalyticsSnapshotService:
    # TODO 之后需要计算的字段or逻辑
    #  1.has_benchmark_return，has_alpha, has_beta，has_tracking_error，has_information_ratio
    #  这需要引入 BenchmarkHistory 数据。逻辑是：将持仓的 df 与基准的 df 按日期 join，然后计算协方差（Covariance）得出 Beta，
    #  再计算 Alpha。目前的实现暂未包含此部分，如果需要可以后续添加。
    #  2.has_portfolio_contribution 需要等到 portfolio snapshot 算完了才计算
    #  3.最大回撤恢复日期 (has_max_drawdown_recovery_date)：这是一个非线性的搜索过程，需要找到从最低点开始，净值何时重新回到最高点。
    #  4.最大上涨幅度 (has_max_runup)：与最大回撤逻辑相反，计算从低点到高点的最大涨幅。

    @classmethod
    def generate_all_analytics(cls, ho_ids: List[int] = None):
        """
        全量生成：为指定持仓（或所有持仓）生成历史所有日期的分析快照
        """
        logger.info("Starting generate_all_analytics...")
        start_time = time.time()

        # 1. 获取所有分析窗口定义
        windows = AnalyticsWindow.query.all()
        if not windows:
            logger.warning("No AnalyticsWindow defined.")
            return {"total_generated": 0, "duration": 0}

        # 2. 确定要处理的持仓
        query = db.session.query(Holding.id, Holding.ho_code)
        if ho_ids:
            query = query.filter(Holding.id.in_(ho_ids))
        holdings = query.all()

        total_count = 0
        errors = []

        for ho_id, ho_code in holdings:
            try:
                # 为单个持仓生成所有历史分析数据
                snapshots = cls._process_single_holding_full(ho_id, windows)

                if snapshots:
                    # 批量删除旧数据 (覆盖模式)
                    db.session.query(HoldingAnalyticsSnapshot).filter(
                        HoldingAnalyticsSnapshot.ho_id == ho_id
                    ).delete(synchronize_session=False)

                    # 批量插入新数据
                    # 注意：如果数据量极大，建议分批 bulk_save_objects
                    db.session.bulk_save_objects(snapshots)
                    db.session.commit()
                    total_count += len(snapshots)
                    logger.info(f"Generated {len(snapshots)} analytics records for {ho_code}")

            except Exception as e:
                db.session.rollback()
                logger.error(f"Error processing holding {ho_code}: {str(e)}")
                logger.error(traceback.format_exc())

        duration = time.time() - start_time
        logger.info(f"Finished generate_all_analytics. Total: {total_count}, Duration: {duration:.2f}s")
        return {"total_generated": total_count, "duration": duration, "errors": errors}

    @classmethod
    def generate_yesterday_analytics(cls):
        """
        增量生成：仅生成“昨天”（最近一个交易日）的分析快照
        """
        logger.info("Starting generate_yesterday_analytics...")
        start_time = time.time()

        # 1. 确定日期
        target_date = date.today() - timedelta(days=1)
        if not trade_calendar.is_trade_day(target_date):
            logger.info(f"{target_date} is not a trading day. Skipping.")
            return {"generated": 0}

        # 2. 获取窗口定义
        windows = AnalyticsWindow.query.all()

        # 3. 找出昨天有 HoldingSnapshot 的持仓 ID, 只有昨天生成了基础快照，才能生成分析快照
        target_ho_ids = db.session.query(HoldingSnapshot.ho_id).filter(
            HoldingSnapshot.snapshot_date == target_date
        ).distinct().all()
        target_ho_ids = [t[0] for t in target_ho_ids]
        if not target_ho_ids:
            logger.info("No holding snapshots found for yesterday.")
            return {"generated": 0}

        total_count = 0

        for ho_id in target_ho_ids:
            try:
                # 增量计算：只计算 yesterday 这一天
                snapshots = cls._process_single_holding_incremental(ho_id, target_date, windows)

                if snapshots:
                    # 删除可能存在的当天重复数据（防重入）
                    db.session.query(HoldingAnalyticsSnapshot).filter(
                        HoldingAnalyticsSnapshot.ho_id == ho_id,
                        HoldingAnalyticsSnapshot.snapshot_date == target_date
                    ).delete(synchronize_session=False)

                    db.session.bulk_save_objects(snapshots)
                    db.session.commit()
                    total_count += len(snapshots)
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error generating yesterday analytics for ho_id={ho_id}: {e}")

        logger.info(f"Finished generate_yesterday_analytics. Generated: {total_count}")
        duration = time.time() - start_time
        return {"generated": total_count, "duration": duration}

    # -------------------------------------------------------------------------
    # 核心处理逻辑
    # -------------------------------------------------------------------------

    @classmethod
    def _process_single_holding_full(cls, ho_id: int, windows: List[AnalyticsWindow]) -> List[HoldingAnalyticsSnapshot]:
        """
        处理单个持仓的全量历史数据
        """
        # 1. 加载该持仓所有历史基础快照
        # 我们需要: date, daily_pnl_ratio (收益率), daily_pnl (盈亏额), holding_shares (判断是否持仓)
        raw_data = db.session.query(
            HoldingSnapshot.snapshot_date,
            HoldingSnapshot.hos_daily_pnl_ratio,
            HoldingSnapshot.hos_daily_pnl,
            HoldingSnapshot.holding_shares,
            HoldingSnapshot.dividend_amount
        ).filter(
            HoldingSnapshot.ho_id == ho_id
        ).order_by(HoldingSnapshot.snapshot_date).all()

        if not raw_data:
            return []

        # 2. 转换为 Pandas DataFrame (这是高性能计算的关键)
        df = pd.DataFrame(raw_data, columns=['date', 'ret', 'pnl', 'shares', 'dividend'])
        # 转换类型: Decimal -> Float (Pandas计算需要Float)
        df['ret'] = df['ret'].apply(lambda x: float(x) if x is not None else 0.0)
        df['pnl'] = df['pnl'].apply(lambda x: float(x) if x is not None else 0.0)
        df['shares'] = df['shares'].apply(lambda x: float(x) if x is not None else 0.0)
        df['dividend'] = df['dividend'].apply(lambda x: float(x) if x is not None else 0.0)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        # 3. 预计算辅助列：是否持仓中
        # 只要 shares > 0 或者 当天虽然 shares=0 但有 pnl (清仓日)，都算有效交易日
        # 简单起见，我们认为只要有 Snapshot 记录就是有效的一天

        # 识别 "本轮持仓" (CUR) 的起点
        # 逻辑：如果前一天的 shares <= 0 且 今天 shares > 0，则今天是新一轮的开始
        df['prev_shares'] = df['shares'].shift(1).fillna(0)
        df['is_new_cycle'] = (df['prev_shares'] <= 0) & (df['shares'] > 0)
        # 给每一轮持仓打上 ID (cumsum)
        df['cycle_id'] = df['is_new_cycle'].cumsum()

        results = []

        # 4. 逐日循环计算 (虽然 Pandas 有 rolling/expanding，但我们需要针对不同 Window 混合处理)
        # 优化：对于几千条数据，Python 循环 + Pandas 切片计算是可以接受的
        dates = df.index
        for i, current_date in enumerate(dates):
            # 截取截止到当天的数据
            # 注意：iloc[0 : i+1] 包含第 i 行
            df_upto_now = df.iloc[:i + 1]
            current_cycle_id = df.iloc[i]['cycle_id']

            for window in windows:
                # 获取窗口对应的数据切片
                df_window = cls._get_window_slice(df_upto_now, window, current_cycle_id)

                if df_window is None or df_window.empty:
                    continue

                # 计算指标
                metrics = cls._calculate_metrics(df_window, window.annualization_factor)

                # 构建 ORM 对象
                snapshot = HoldingAnalyticsSnapshot(
                    ho_id=ho_id,
                    snapshot_date=current_date.date(),
                    window_key=window.window_key,
                    # 映射计算结果
                    has_cumulative_return=metrics['cum_ret'],
                    has_annualized_return=metrics['ann_ret'],
                    has_cumulative_pnl=metrics['cum_pnl'],
                    has_total_dividend=metrics['total_div'],
                    has_return_volatility=metrics['volatility'],
                    has_sharpe_ratio=metrics['sharpe'],
                    has_max_drawdown=metrics['mdd'],
                    has_max_drawdown_start_date=metrics['mdd_start'],
                    has_max_drawdown_end_date=metrics['mdd_end'],
                    has_max_drawdown_days=metrics['mdd_days'],
                    has_win_rate=metrics['win_rate'],
                    has_calmar_ratio=metrics['calmar'],
                    has_sortino_ratio=metrics['sortino'],
                    has_downside_risk=metrics['downside_risk'],
                    has_calc_version="v1.0"
                )
                results.append(snapshot)

        return results

    @classmethod
    def _process_single_holding_incremental(cls, ho_id: int, target_date: date, windows: List[AnalyticsWindow]):
        """
        增量处理：只计算 target_date 这一天的指标
        注意：虽然只计算一天，但需要加载足够的历史数据来计算 Rolling/Expanding 指标
        """
        # 1. 确定需要加载的历史数据范围
        # 为了安全起见，对于 Rolling 窗口，我们需要 max_days + buffer
        # 对于 Expanding (ALL/CUR)，我们需要全部历史
        # 简单策略：加载全部历史。对于单个持仓，几千条数据内存开销很小，且逻辑最简单安全。

        raw_data = db.session.query(
            HoldingSnapshot.snapshot_date,
            HoldingSnapshot.hos_daily_pnl_ratio,
            HoldingSnapshot.hos_daily_pnl,
            HoldingSnapshot.holding_shares,
            HoldingSnapshot.dividend_amount
        ).filter(
            HoldingSnapshot.ho_id == ho_id,
            HoldingSnapshot.snapshot_date <= target_date
        ).order_by(HoldingSnapshot.snapshot_date).all()

        if not raw_data:
            return []

        # 检查最后一条数据是否是 target_date
        if raw_data[-1].snapshot_date != target_date:
            # 可能是数据同步延迟，target_date 的 snapshot 还没生成
            return []

        # 2. 转 DataFrame
        df = pd.DataFrame(raw_data, columns=['date', 'ret', 'pnl', 'shares', 'dividend'])
        df['ret'] = df['ret'].apply(lambda x: float(x) if x is not None else 0.0)
        df['pnl'] = df['pnl'].apply(lambda x: float(x) if x is not None else 0.0)
        df['shares'] = df['shares'].apply(lambda x: float(x) if x is not None else 0.0)
        df['dividend'] = df['dividend'].apply(lambda x: float(x) if x is not None else 0.0)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        # 3. 辅助列 (Cycle ID)
        df['prev_shares'] = df['shares'].shift(1).fillna(0)
        df['is_new_cycle'] = (df['prev_shares'] <= 0) & (df['shares'] > 0)
        df['cycle_id'] = df['is_new_cycle'].cumsum()

        # 4. 只计算最后一天 (target_date)
        current_cycle_id = df.iloc[-1]['cycle_id']
        results = []

        for window in windows:
            df_window = cls._get_window_slice(df, window, current_cycle_id)
            if df_window is None or df_window.empty:
                continue

            metrics = cls._calculate_metrics(df_window, window.annualization_factor)

            snapshot = HoldingAnalyticsSnapshot(
                ho_id=ho_id,
                snapshot_date=target_date,
                window_key=window.window_key,
                has_cumulative_return=metrics['cum_ret'],
                has_annualized_return=metrics['ann_ret'],
                has_cumulative_pnl=metrics['cum_pnl'],
                has_total_dividend=metrics['total_div'],
                has_return_volatility=metrics['volatility'],
                has_sharpe_ratio=metrics['sharpe'],
                has_max_drawdown=metrics['mdd'],
                has_max_drawdown_start_date=metrics['mdd_start'],
                has_max_drawdown_end_date=metrics['mdd_end'],
                has_max_drawdown_days=metrics['mdd_days'],
                has_win_rate=metrics['win_rate'],
                has_calmar_ratio=metrics['calmar'],
                has_sortino_ratio=metrics['sortino'],
                has_downside_risk=metrics['downside_risk'],
                has_calc_version="v1.0"
            )
            results.append(snapshot)

        return results

    # -------------------------------------------------------------------------
    # 辅助方法
    # -------------------------------------------------------------------------

    @staticmethod
    def _get_window_slice(df: pd.DataFrame, window: AnalyticsWindow, current_cycle_id: int) -> Optional[pd.DataFrame]:
        """
        根据窗口定义，从完整历史 df 中切分出需要计算的数据段
        """
        if window.window_type == 'rolling':
            if not window.window_days:
                return None
            # 取最后 N 天
            return df.tail(window.window_days)

        elif window.window_type == 'expanding':
            if window.window_key == 'ALL':
                # 自建仓以来 (全部数据)
                return df
            elif window.window_key == 'CUR':
                # 本轮持仓：过滤出 cycle_id 等于当前 cycle_id 的行
                return df[df['cycle_id'] == current_cycle_id]
            else:
                # 其他 expanding 逻辑，默认全部
                return df

        return None

    @staticmethod
    def _calculate_metrics(df: pd.DataFrame, annual_factor: int = 252) -> Dict:
        """
        核心计算引擎：输入一个 DataFrame（包含 ret, pnl），输出所有指标字典
        """
        # 提取 Series
        returns = df['ret']  # 日收益率 (0.01 代表 1%)
        pnls = df['pnl']  # 日盈亏金额
        dividends = df['dividend']

        n = len(returns)
        if n == 0:
            return {}

        # 1. 累计收益率 (Cumulative Return)
        # 公式: (1+r1)*(1+r2)... - 1
        cum_return = (1 + returns).prod() - 1

        # 2. 年化收益率 (Annualized Return)
        # 公式: (1 + cum_ret) ^ (252/n) - 1
        # 注意：如果天数太少（<30天），年化通常没有意义或极度失真，这里做个保护或者照常计算
        if n > 5:
            ann_return = (1 + cum_return) ** (annual_factor / n) - 1
        else:
            ann_return = 0  # 时间太短不计算年化

        # 3. 累计盈亏 & 分红
        cum_pnl = pnls.sum()
        total_div = dividends.sum()

        # 4. 波动率 (Volatility)
        # 标准差 * sqrt(252)
        if n > 1:
            volatility = returns.std(ddof=1) * np.sqrt(annual_factor)
        else:
            volatility = 0

        # 5. 夏普比率 (Sharpe Ratio)
        # (Ann_Ret - Rf) / Vol
        if volatility > 0:
            sharpe = (ann_return - RISK_FREE_RATE) / volatility
        else:
            sharpe = 0

        # 6. 下行风险 & Sortino
        # 只取负收益计算标准差
        neg_returns = returns[returns < 0]
        if len(neg_returns) > 1:
            downside_std = neg_returns.std(ddof=1) * np.sqrt(annual_factor)
        else:
            downside_std = 0

        if downside_std > 0:
            sortino = (ann_return - RISK_FREE_RATE) / downside_std
        else:
            sortino = 0

        # 7. 最大回撤 (Max Drawdown)
        # 构造净值曲线 (假设初始为1)
        nav_series = (1 + returns).cumprod()
        # 历史累计最大值
        running_max = nav_series.cummax()
        # 回撤序列 (始终 <= 0)
        drawdown_series = (nav_series - running_max) / running_max

        mdd = drawdown_series.min()  # e.g. -0.15

        # 计算回撤日期
        mdd_end_idx = drawdown_series.idxmin()  # 回撤最低点的日期
        mdd_end_date = mdd_end_idx.date()

        # 找到最低点之前的那个最高点日期
        # 在 mdd_end_idx 之前的数据中，找到等于 running_max[mdd_end_idx] 的最后一天
        peak_val = running_max.loc[mdd_end_idx]
        # 截取到最低点之前
        series_before_trough = running_max.loc[:mdd_end_idx]
        # 找到等于峰值的日期
        mdd_start_idx = series_before_trough[series_before_trough == peak_val].index[-1]
        mdd_start_date = mdd_start_idx.date()

        # 回撤天数 (交易日)
        # Pandas index 两个日期之间的行数
        mdd_days = df.index.get_loc(mdd_end_idx) - df.index.get_loc(mdd_start_idx)

        # 8. 卡玛比率 (Calmar)
        # Ann_Ret / abs(MDD)
        if mdd < 0:
            calmar = ann_return / abs(mdd)
        else:
            calmar = 0

        # 9. 胜率 (Win Rate)
        win_count = (returns > 0).sum()
        win_rate = win_count / n

        return {
            'cum_ret': Decimal(str(cum_return)),
            'ann_ret': Decimal(str(ann_return)),
            'cum_pnl': Decimal(str(cum_pnl)),
            'total_div': Decimal(str(total_div)),
            'volatility': Decimal(str(volatility)),
            'sharpe': Decimal(str(sharpe)),
            'sortino': Decimal(str(sortino)),
            'downside_risk': Decimal(str(downside_std)),
            'mdd': Decimal(str(mdd)),
            'mdd_start': mdd_start_date,
            'mdd_end': mdd_end_date,
            'mdd_days': int(mdd_days),
            'calmar': Decimal(str(calmar)),
            'win_rate': Decimal(str(win_rate))
        }
