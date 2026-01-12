# app/service/holding_analytics_snapshot_service.py
import logging
import time
import traceback
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional

import numpy as np
import pandas as pd
from scipy import optimize

from app.calendars.trade_calendar import TradeCalendar
from app.database import db
from app.framework.async_task_manager import create_task
from app.models import (
    Holding, HoldingSnapshot, AnalyticsWindow, HoldingAnalyticsSnapshot
)

logger = logging.getLogger(__name__)
trade_calendar = TradeCalendar()
ZERO = Decimal('0')

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
                snapshots = cls._process_single_holding(ho_id, windows, mode='full')

                if snapshots:
                    # cls._save_snapshots(ho_id, snapshots, mode='full')
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
                create_task(
                    task_name=f"redo-has-all-ho_id={ho_id}",
                    module_path="app.services.holding_analytics_snapshot_service",
                    method_name="generate_all_analytics",
                    kwargs={"ids": f"[{ho_id},]"},
                    error_message=str(e)
                )

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
        errors = []

        for ho_id in target_ho_ids:
            try:
                # 增量计算：只计算 yesterday 这一天
                snapshots = cls._process_single_holding(ho_id, windows, mode='incremental', target_date=target_date)

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
                err_msg = f"Error generating yesterday analytics for ho_id={ho_id}: {e}"
                logger.error(err_msg)
                create_task(
                    task_name=f"regenerate holding analytics snapshots for ho_id={ho_id}",
                    module_path="app.services.holding_analytics_snapshot_service",
                    method_name="generate_yesterday_analytics",
                    kwargs={"ids": f"[{ho_id},]"},
                    error_message=err_msg
                )
                errors.append(err_msg)

        logger.info(f"Finished generate_yesterday_analytics. Generated: {total_count}")
        duration = time.time() - start_time
        return {"generated": total_count, "duration": duration, "errors": errors}

    # -------------------------------------------------------------------------
    # 核心处理逻辑
    # -------------------------------------------------------------------------
    @classmethod
    def _process_single_holding(cls, ho_id: int, windows: List[AnalyticsWindow],
                                mode: str = 'full', target_date: date = None) -> List[HoldingAnalyticsSnapshot]:
        """
        处理单个持仓的数据。
        :param mode: 'full' (全量历史) 或 'incremental' (仅计算 target_date)
        """
        # 1. 加载数据
        # 必须加载历史数据才能计算 Rolling/Expanding 指标
        df = cls._load_holding_data(ho_id, up_to_date=target_date if mode == 'incremental' else None)

        if df.empty:
            return []
        # 如果是增量模式，检查最后一天是否匹配
        if mode == 'incremental':
            last_date = df.index[-1].date()
            if last_date != target_date:
                # 数据尚未同步或日期不匹配
                return []
            # 只需要计算最后一行对应的日期
            calc_dates = [df.index[-1]]
        else:
            # 全量模式：计算每一天
            calc_dates = df.index
        results = []

        # 2. 遍历日期进行计算
        # 性能优化提示：对于极大规模数据，这里应该使用 Pandas 的 rolling().apply() 或向量化操作。
        # 但考虑到金融指标（如最大回撤日期）的复杂性，以及单只持仓数据量通常 < 5000 条，
        # 逐日切片计算的可读性和维护性优于复杂的向量化代码。

        for current_ts in calc_dates:
            # 截止到当前日期的切片 (包含当前日期)
            # 使用 loc 切片，效率尚可
            df_upto_now = df.loc[:current_ts]

            # 获取当前日期的 cycle_id (用于 CUR 窗口)
            current_cycle = df_upto_now.iloc[-1]['cycle']
            current_date_obj = current_ts.date()
            for window in windows:
                # 获取窗口数据切片
                df_window = cls._get_window_slice(df_upto_now, window, current_cycle)
                if df_window is None or df_window.empty:
                    continue
                # 计算指标
                metrics = cls._calculate_metrics(df_window, window.annualization_factor)
                # 构建对象
                snapshot = HoldingAnalyticsSnapshot(
                    ho_id=ho_id,
                    snapshot_date=current_date_obj,
                    window_key=window.window_key,
                    # Return Metrics
                    twrr_cumulative=metrics['twrr_cum'],
                    twrr_annualized=metrics['twrr_ann'],
                    irr_cumulative=metrics['irr_cum'],
                    irr_annualized=metrics['irr_ann'],

                    has_cumulative_pnl=metrics['cum_pnl'],
                    has_total_dividend=metrics['total_div'],
                    has_return_volatility=metrics['volatility'],
                    has_sharpe_ratio=metrics['sharpe'],
                    has_max_drawdown=metrics['mdd'],
                    has_max_drawdown_start_date=metrics['mdd_start'],
                    has_max_drawdown_end_date=metrics['mdd_end'],
                    has_max_drawdown_recovery_date=metrics['mdd_recovery_date'],
                    has_max_drawdown_days=metrics['mdd_days'],
                    has_max_runup=metrics['max_runup'],
                    has_win_rate=metrics['win_rate'],
                    has_calmar_ratio=metrics['calmar'],
                    has_sortino_ratio=metrics['sortino'],
                    has_downside_risk=metrics['downside_risk'],
                )
                results.append(snapshot)
        return results

    @classmethod
    def _load_holding_data(cls, ho_id: int, up_to_date: date = None) -> pd.DataFrame:
        """
        加载持仓的基础快照数据并转换为 DataFrame
        """
        query = db.session.query(
            HoldingSnapshot.snapshot_date,
            HoldingSnapshot.hos_daily_pnl_ratio,
            HoldingSnapshot.hos_daily_pnl,
            HoldingSnapshot.holding_shares,
            HoldingSnapshot.hos_daily_cash_dividend,
            HoldingSnapshot.tr_cycle,
            HoldingSnapshot.hos_net_external_cash_flow,
            HoldingSnapshot.hos_market_value,
        ).filter(
            HoldingSnapshot.ho_id == ho_id
        )
        if up_to_date:
            query = query.filter(HoldingSnapshot.snapshot_date <= up_to_date)
        raw_data = query.order_by(HoldingSnapshot.snapshot_date).all()
        if not raw_data:
            return pd.DataFrame()
        df = pd.DataFrame(raw_data, columns=['date', 'daily_pnl_ratio', 'daily_pnl', 'shares', 'daily_cash_dividend',
                                             'cycle',
                                             'net_external_cash_flow', 'mv'])

        # 类型转换: Decimal -> Float
        cols_to_float = ['daily_pnl_ratio', 'daily_pnl', 'shares', 'daily_cash_dividend', 'net_external_cash_flow',
                         'mv']
        for col in cols_to_float:
            df[col] = df[col].apply(lambda x: float(x) if x is not None else 0.0)

        # 确保 cycle 是 int
        df['cycle'] = df['cycle'].fillna(0).astype(int)

        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)

        return df

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
                return df[df['cycle'] == current_cycle_id]
            else:
                # 其他 expanding 逻辑，默认全部
                return df

        return None

    @classmethod
    def _calculate_metrics(cls, df: pd.DataFrame, annual_factor: int = 252) -> Dict:
        """
        核心计算引擎：输入一个 DataFrame（包含 daily_pnl_ratio, pnl），输出所有指标字典
        """
        # 提取 Series
        daily_pnl_ratio_list = df['daily_pnl_ratio']  # 日收益率 (0.01 代表 1%)
        pnls = df['daily_pnl']  # 日盈亏金额
        dividends = df['daily_cash_dividend']

        n = len(daily_pnl_ratio_list)
        if n == 0:
            return {}

        # 1. twrr_cum 公式: (1+r1)*(1+r2)... - 1
        twrr_cum = (1 + daily_pnl_ratio_list).prod() - 1

        # 3. 累计盈亏 & 分红
        cum_pnl = pnls.sum()
        total_div = dividends.sum()

        # 2. twrr_cum 年化收益率 (Annualized Return)
        # 公式: (1 + cum_ret) ^ (252/n) - 1
        # 注意：如果天数太少（<30天），年化通常没有意义或极度失真
        if n >= MIN_ANNUALIZATION_DAYS:
            twrr_ann = (1 + twrr_cum) ** (annual_factor / n) - 1
        else:
            twrr_ann = None  # 用None表示不适用

        # 3. IRR (XIRR)
        # 仅对长周期或 ALL 窗口计算，短周期 XIRR 意义不大且耗时
        # XIRR 本身就是年化指标
        irr_ann = None
        irr_cum = None
        if n >= MIN_ANNUALIZATION_DAYS:
            try:
                irr_ann = cls._calculate_xirr(df)
                if irr_ann is not None:
                    # 根据年化 IRR 反推这段时间的累计 IRR
                    # 累计 = (1 + 年化) ^ (自然日天数 / 365) - 1
                    days_diff = (df.index[-1] - df.index[0]).days
                    if days_diff > 0:
                        irr_cum = (1 + irr_ann) ** (days_diff / 365.0) - 1
                    else:
                        irr_cum = ZERO
            except Exception as e:
                # XIRR 计算可能不收敛
                logger.debug(f"XIRR calculation failed: {e}")
                pass

        # 4. 波动率 (Volatility)
        # 标准差 * sqrt(252)
        if n > 1:
            volatility = daily_pnl_ratio_list.std(ddof=1) * np.sqrt(annual_factor)
        else:
            volatility = ZERO

        # 5. 夏普比率 (Sharpe Ratio)
        # (Rp - Rf) / Vol
        if volatility > EPSILON:
            sharpe = (twrr_ann - RISK_FREE_RATE) / volatility if twrr_ann is not None else 0.0
        else:
            sharpe = ZERO

        # 6. 下行风险 & Sortino
        # 只取负收益计算标准差
        negtive_returns = daily_pnl_ratio_list[daily_pnl_ratio_list < 0]
        if len(negtive_returns) > 1:
            downside_std = negtive_returns.std(ddof=1) * np.sqrt(annual_factor)
        else:
            downside_std = ZERO

        if downside_std > EPSILON:
            sortino = (twrr_ann - RISK_FREE_RATE) / downside_std if twrr_ann is not None else 0.0
        else:
            sortino = ZERO

        # 7. 最大回撤 (Max Drawdown) TODO 跳过多个持仓周期之间的空仓期 还是说在各个周期内进行寻找
        # 构造净值曲线 (假设初始为1)
        nav_series = (1 + daily_pnl_ratio_list).cumprod()
        # 历史累计最大值
        running_max = nav_series.cummax()
        # 回撤序列 (始终 <= 0)
        drawdown_series = (nav_series - running_max) / running_max
        mdd = drawdown_series.min()  # e.g. -0.15

        # 计算回撤日期
        mdd_end_ts = drawdown_series.idxmin()  # 回撤最低点的日期  Timestamp
        mdd_end_date = mdd_end_ts.date()

        # 找到最低点之前的那个最高点日期
        # 在 mdd_end_idx 之前的数据中，找到等于 running_max[mdd_end_idx] 的最后一天
        subset_before_trough = running_max.loc[:mdd_end_ts]
        peak_val = subset_before_trough.iloc[-1]
        # 在这之前，最后一次出现该 peak_val 的日期即为开始日期
        mdd_start_ts = subset_before_trough[subset_before_trough == peak_val].index[-1]
        mdd_start_date = mdd_start_ts.date()

        # 回撤天数 (交易日) 通常指 Peak 到 Trough 之间的间隔
        try:
            mdd_days = trade_calendar.count_trade_days_between(
                mdd_start_date, mdd_end_date, inclusive=False
            )
        except Exception:
            # 降级处理：如果日历报错，使用自然日或列表长度
            mdd_days = (mdd_end_date - mdd_start_date).days

        # 最大回撤恢复日期
        # 直接复用 nav_series, mdd_end_date, peak_val
        recovery_date = cls._calc_recovery_date(nav_series, mdd_end_date, peak_val)
        # 最大上涨幅度
        # 直接复用 nav_series
        max_runup = cls._calc_max_runup(nav_series)

        # 8. 卡玛比率 (Calmar)
        # Ann_Ret / abs(MDD)
        if mdd < 0:
            calmar = twrr_ann / abs(mdd) if twrr_ann is not None else 0.0
        else:
            calmar = ZERO

        # 9. 胜率 (Win Rate)
        win_count = (daily_pnl_ratio_list > 0).sum()
        win_rate = win_count / n

        return {
            'twrr_cum': Decimal(f"{twrr_cum:.6f}"),
            'twrr_ann': Decimal(f"{twrr_ann:.6f}") if twrr_ann is not None else None,
            'irr_ann': Decimal(f"{irr_ann:.6f}"),
            'irr_cum': Decimal(f"{irr_cum:.6f}") if irr_cum is not None else None,
            'cum_pnl': Decimal(f"{cum_pnl:.4f}"),
            'total_div': Decimal(f"{total_div:.4f}"),
            'volatility': Decimal(f"{volatility:.6f}"),
            'sharpe': Decimal(f"{sharpe:.4f}"),
            'sortino': Decimal(f"{sortino:.4f}"),
            'downside_risk': Decimal(f"{downside_std:.6f}"),
            'mdd': Decimal(f"{mdd:.6f}"),
            'mdd_start': mdd_start_date,
            'mdd_end': mdd_end_date,
            'mdd_days': int(mdd_days),
            'calmar': Decimal(f"{calmar:.4f}"),
            'win_rate': Decimal(f"{win_rate:.4f}"),
            'mdd_recovery_date': recovery_date,
            'max_runup': max_runup,
        }

    @staticmethod
    def _calculate_xirr(df: pd.DataFrame) -> Optional[float]:
        """
        计算单只持仓的 XIRR
        现金流定义 :
        - 买入 (net_inflow > 0): 现金流出，记为负。
        - 卖出 (net_inflow < 0): 现金流入，记为正。
        - 现金分红 (dividend > 0): 现金流入，记为正。
        - 期末市值 (mv): 视为全部赎回，记为正。
        """
        # 1. 构造现金流 Flow = net_external_cash_flow + dividend
        df['flow'] = (df['net_external_cash_flow']) + df['daily_cash_dividend']

        # 过滤出有现金流的日子
        flows = df[df['flow'].abs() > EPSILON].copy()

        dates = list(flows.index)
        amounts = list(flows['flow'])

        # 添加期末市值 (视为全部赎回)
        last_date = df.index[-1]
        last_mv = df.iloc[-1]['mv']
        # 如果最后一天已经有现金流，累加；否则追加
        if dates and dates[-1] == last_date:
            amounts[-1] += last_mv
        else:
            dates.append(last_date)
            amounts.append(last_mv)

        if not dates:
            return None

        # 只有一笔正现金流（只有市值没有投入），无法计算
        if all(a >= 0 for a in amounts) or all(a <= 0 for a in amounts):
            return None

        # 2. 计算 XNPV 方程
        def xnpv(rate, dates, amounts):
            if rate <= -1.0:
                return float('inf')
            d0 = dates[0]
            # 核心公式：Sum( CashFlow_i / (1+r)^((d_i - d0)/365) )
            # 这里的 365 是金融学定义 XIRR 的标准，代表自然年
            return sum([a / ((1.0 + rate) ** ((d - d0).days / 365.0)) for d, a in zip(dates, amounts)])

        try:
            # 使用 Newton-Raphson 方法求解 f(r) = 0
            # 初始猜测值 0.1 (10%)
            return optimize.newton(lambda r: xnpv(r, dates, amounts), 0.1, tol=0.0001, maxiter=100)
        except:
            # 如果不收敛，尝试使用 brentq (区间法) 或者直接返回 None
            return None

    @staticmethod
    def _calc_recovery_date(nav_series: pd.Series, mdd_end_date: date, peak_val: float) -> Optional[date]:
        """
        计算最大回撤恢复日期
        逻辑：在最大回撤低点(mdd_end_date)之后，寻找第一个净值 >= 回撤前最高点(peak_val)的日期
        """
        if mdd_end_date is None or peak_val is None:
            return None

        # 1. 截取低点之后的数据
        # 注意：nav_series 的索引必须是 datetime 类型
        # mdd_end_date 是 date 类型，Pandas 切片通常兼容，但最好转一下
        after_trough = nav_series.loc[pd.Timestamp(mdd_end_date):]

        # 排除掉低点当天（如果低点当天就恢复了，那是V型反转，逻辑上也成立，但通常是之后）
        if len(after_trough) <= 1:
            return None

        after_trough = after_trough.iloc[1:]

        # 2. 寻找第一个大于等于 peak_val 的位置
        # idxmax() 在布尔序列中会返回第一个 True 的索引
        recovery_mask = after_trough >= peak_val

        if not recovery_mask.any():
            return None  # 至今尚未恢复

        recovery_ts = recovery_mask.idxmax()
        return recovery_ts.date()

    @staticmethod
    def _calc_max_runup(nav_series: pd.Series) -> Decimal:
        """
        计算最大上涨幅度 (Max Run-up)
        逻辑：与最大回撤相反。计算 (当前净值 - 历史最低净值) / 历史最低净值 的最大值
        """
        if nav_series.empty:
            return ZERO

        # 1. 计算历史累计最小值
        running_min = nav_series.cummin()

        # 2. 防止除以0 (虽然净值通常 > 0，但防守一下 将0替换为极小值或处理异常)
        running_min = running_min.replace(0, np.nan)
        # 3. 计算潜在上涨幅度序列 公式：(Price / Low) - 1
        runup_series = (nav_series / running_min) - 1
        if runup_series.isnull().all():
            return ZERO

        # 4. 取最大值
        max_runup = runup_series.max()

        return Decimal(f"{max_runup:.6f}")
