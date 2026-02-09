from datetime import date, datetime
from typing import Optional, Dict, Tuple, List

import akshare as ak
import numpy as np
import pandas as pd
from loguru import logger
from sqlalchemy import select, func, and_
from sqlalchemy.exc import SQLAlchemyError

from app.extension import db
from app.models import Benchmark, BenchmarkHistory, InvestedAssetAnalyticsSnapshot, InvestedAssetSnapshot


class BenchmarkService:
    """
    基准指数服务层
    负责基准的元数据管理、历史行情获取、收益率计算和持久化
    """

    DEFAULT_BENCHMARK_CODE = '000300.SH'
    DEFAULT_BENCHMARK_NAME = '沪深300'

    @staticmethod
    def ensure_benchmark_exists(code: str = None, name: str = None) -> Benchmark:
        """
        初始化/获取基准元数据。如果不存在则创建。
        """
        target_code = code or BenchmarkService.DEFAULT_BENCHMARK_CODE
        target_name = name or BenchmarkService.DEFAULT_BENCHMARK_NAME

        try:
            stmt = select(Benchmark).where(Benchmark.bm_code == target_code)
            benchmark = db.session.execute(stmt).scalar_one_or_none()

            if not benchmark:
                logger.info(f"Benchmark {target_code} not found, creating...")
                benchmark = Benchmark(bm_code=target_code, bm_name=target_name)
                db.session.add(benchmark)
                db.session.commit()

            return benchmark
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.exception(f"Error ensuring benchmark exists: {str(e)}")
            raise

    @staticmethod
    def get_latest_date(bm_id: int) -> Optional[date]:
        """
        获取数据库中该基准的最新记录日期
        """
        stmt = select(func.max(BenchmarkHistory.bmh_date)).where(BenchmarkHistory.bm_id == bm_id)
        return db.session.execute(stmt).scalar()

    @classmethod
    def sync_benchmark_data(cls, bm_code: str = None):
        """
        核心方法：同步基准历史数据（增量更新）
        """
        bm_code = bm_code or cls.DEFAULT_BENCHMARK_CODE
        benchmark = cls.ensure_benchmark_exists(bm_code)

        # 1. 确定拉取的时间范围
        latest_date = cls.get_latest_date(benchmark.id)

        logger.info(f"Starting sync for benchmark: {bm_code}, last update: {latest_date}")

        try:
            # 2. 调用外部数据源
            df = cls._fetch_data_from_source(bm_code)

            if df is None or df.empty:
                logger.warning(f"No data fetched for {bm_code}")
                return

            # 3. 数据清洗与计算
            df['date'] = pd.to_datetime(df['date']).dt.date
            df.sort_values('date', inplace=True)

            # 计算日收益率
            # 替换 close 为 0 的情况避免 inf
            df['close'] = df['close'].replace(0, np.nan)
            df.dropna(subset=['close'], inplace=True)
            # 再进行 pct_change 并处理 NaN/inf
            df['daily_return'] = df['close'].pct_change()
            df['daily_return'] = df['daily_return'].replace([np.inf, -np.inf], np.nan).fillna(0)

            # 4. 过滤掉数据库已存在的日期 (增量逻辑)
            if latest_date:
                df = df[df['date'] > latest_date]

            if df.empty:
                logger.info("No new data to update.")
                return

            # 5. 批量写入数据库
            new_records = []
            for _, row in df.iterrows():
                # 此时 row['daily_return'] 已经是安全的 float (0.0 或 正常数值)
                d_return = float(row['daily_return'])  # 强转 float 确保兼容性

                history = BenchmarkHistory(
                    bm_id=benchmark.id,
                    bmh_date=row['date'],
                    bmh_close_price=row['close'],
                    bmh_return=d_return,
                    benchmark_return_daily=d_return
                )
                new_records.append(history)

            if new_records:
                db.session.bulk_save_objects(new_records)
                db.session.commit()
                logger.info(f"Successfully added {len(new_records)} records for {bm_code}")

        except Exception as e:
            db.session.rollback()
            logger.exception(f"Failed to sync benchmark data: {str(e)}", exc_info=True)
            raise

    @staticmethod
    def _fetch_data_from_source(code: str) -> pd.DataFrame:
        """
        从 AkShare 获取数据（增强版：支持多源重试）
        """
        # 1. 格式化代码
        # 移除后缀 .SH / .SZ
        clean_code = code.replace('.SH', '').replace('.SZ', '')
        # 构造带前缀的代码 (用于新浪源)
        if code.endswith('.SH') or code.startswith('000'):
            sina_code = f"sh{clean_code}"
        else:
            sina_code = f"sz{clean_code}"
        df = pd.DataFrame()
        # --- 策略 A: 尝试东方财富源 (ak.index_zh_a_hist) ---
        # 优点：数据全，包含开高低收
        # 要求：symbol="000300" (纯数字)
        try:
            logger.info(f"Fetching benchmark data from EastMoney (symbol={clean_code})...")
            df = ak.index_zh_a_hist(
                symbol=clean_code,
                period="daily",
                start_date="20000101",
                end_date=datetime.now().strftime("%Y%m%d")
            )
            if not df.empty:
                # 标准化列名
                df = df[['日期', '收盘']].copy()
                df.rename(columns={'日期': 'date', '收盘': 'close'}, inplace=True)
                return df
        except Exception as e:
            logger.warning(f"EastMoney source failed: {str(e)}. Trying fallback...")
        # --- 策略 B: 尝试新浪源 (ak.stock_zh_index_daily) ---
        # 优点：老牌接口，稳定
        # 要求：symbol="sh000300" (带前缀)
        try:
            logger.info(f"Fetching benchmark data from Sina (symbol={sina_code})...")
            df = ak.stock_zh_index_daily(symbol=sina_code)

            if not df.empty:
                # 标准化列名
                df = df[['date', 'close']].copy()
                # 新浪接口返回的 date 可能是 datetime 类型，确保统一
                df['date'] = pd.to_datetime(df['date']).dt.date
                # 确保 close 是 float
                df['close'] = pd.to_numeric(df['close'])
                return df
        except Exception as e:
            logger.exception(f"Sina source also failed: {str(e)}")
        logger.exception(f"All data sources failed for benchmark: {code}")
        return pd.DataFrame()

    @staticmethod
    def get_benchmark_returns_map(start_date: date, end_date: date, bm_code: str = None) -> Dict[date, float]:
        """
        获取指定时间段的基准收益率字典。
        用于 HoldingAnalyticsSnapshot 计算 Alpha/Beta。

        Returns:
            { date(2023-01-01): 0.012, date(2023-01-02): -0.005, ... }
        """
        target_code = bm_code or BenchmarkService.DEFAULT_BENCHMARK_CODE

        stmt = (
            select(BenchmarkHistory.bmh_date, BenchmarkHistory.benchmark_return_daily)
            .join(Benchmark, Benchmark.id == BenchmarkHistory.bm_id)
            .where(
                Benchmark.bm_code == target_code,
                BenchmarkHistory.bmh_date >= start_date,
                BenchmarkHistory.bmh_date <= end_date
            )
        )

        results = db.session.execute(stmt).all()

        # 转换为字典，方便快速查找
        def safe_float(val):
            try:
                return float(val) if val is not None else 0.0
            except ValueError:
                return 0.0

        return {row[0]: safe_float(row[1]) for row in results}

    @staticmethod
    def get_benchmark_cumulative_return(start_date: date, end_date: date, bm_code: str = None) -> float:
        """
        计算区间内的基准累计收益率
        逻辑：(1+r1)*(1+r2)*... - 1
        """
        returns_map = BenchmarkService.get_benchmark_returns_map(start_date, end_date, bm_code)
        if not returns_map:
            return 0.0

        cumulative = 1.0
        for r in returns_map.values():
            cumulative *= (1 + r)

        return cumulative - 1

    @classmethod
    def calculate_and_update_benchmark_metrics(
            cls,
            snapshot_date: date,
            window_key: str,
            bm_code: str = None
    ) -> Dict[str, float]:
        """
        计算并更新 InvestedAssetAnalyticsSnapshot 的基准相关指标

        Args:
            snapshot_date: 快照日期
            window_key: 窗口键（如 'R21', 'R252', 'ALL' 等）
            bm_code: 基准代码，默认为 DEFAULT_BENCHMARK_CODE

        Returns:
            包含计算结果的字典
        """
        try:
            # 1. 获取窗口的开始日期
            start_date = cls._get_window_start_date(snapshot_date, window_key)
            if not start_date:
                logger.warning(f"Cannot determine start date for window {window_key} on {snapshot_date}")
                return {}

            # 2. 获取基准收益率数据
            benchmark_returns = cls.get_benchmark_returns_map(start_date, snapshot_date, bm_code)
            if not benchmark_returns:
                logger.warning(f"No benchmark returns found for period {start_date} to {snapshot_date}")
                return {}

            # 3. 获取投资组合收益率数据
            portfolio_returns = cls._get_portfolio_returns(start_date, snapshot_date)
            if not portfolio_returns:
                logger.warning(f"No portfolio returns found for period {start_date} to {snapshot_date}")
                return {}

            # 4. 对齐日期（确保两个序列有相同的日期）
            aligned_benchmark, aligned_portfolio = cls._align_returns_series(
                benchmark_returns, portfolio_returns
            )

            if len(aligned_benchmark) < 2:  # 至少需要2个数据点计算Beta/Alpha
                logger.warning(f"Insufficient data points for regression: {len(aligned_benchmark)}")
                return {}

            # 5. 计算各项指标
            metrics = cls._calculate_benchmark_metrics(
                aligned_benchmark, aligned_portfolio, start_date, snapshot_date
            )

            # 6. 更新数据库
            cls._update_snapshot_metrics(snapshot_date, window_key, metrics)

            return metrics

        except Exception as e:
            logger.exception(f"Error calculating benchmark metrics: {str(e)}", exc_info=True)
            raise

    @staticmethod
    def _get_window_start_date(snapshot_date: date, window_key: str) -> Optional[date]:
        """
        根据窗口键计算开始日期

        注意：这里需要根据你的业务逻辑实现具体的窗口计算
        假设你已经有了 AnalyticsWindow 表来定义窗口
        """
        try:
            # 方法1：从 AnalyticsWindow 表查询
            from app.models import AnalyticsWindow

            stmt = select(AnalyticsWindow).where(AnalyticsWindow.window_key == window_key)
            window = db.session.execute(stmt).scalar_one_or_none()

            if not window:
                logger.warning(f"Window {window_key} not found in AnalyticsWindow")
                return None

            if window.window_type == 'expanding':
                # 扩展窗口：从有数据的第一天开始
                if window_key == 'ALL':
                    # 获取最早的投资快照日期
                    stmt = select(func.min(InvestedAssetSnapshot.snapshot_date))
                    earliest_date = db.session.execute(stmt).scalar()
                    return earliest_date
                elif window_key == 'CUR':
                    # 当前周期：需要根据持仓周期计算
                    # 这里需要根据你的业务逻辑实现
                    return snapshot_date  # 临时返回，需要根据实际业务调整
            elif window.window_type == 'rolling':
                # 滚动窗口：根据天数计算
                if window.window_days:
                    # 计算交易日，这里简化处理，实际应该考虑交易日历
                    from datetime import timedelta
                    return snapshot_date - timedelta(days=window.window_days)

            return None

        except Exception as e:
            logger.exception(f"Error getting window start date: {str(e)}")
            return None

    @staticmethod
    def _get_portfolio_returns(start_date: date, end_date: date) -> Dict[date, float]:
        """
        获取投资组合的日收益率

        Returns:
            {date: daily_return, ...}
        """
        try:
            stmt = (
                select(
                    InvestedAssetSnapshot.snapshot_date,
                    InvestedAssetSnapshot.ias_daily_pnl_ratio
                )
                .where(
                    and_(
                        InvestedAssetSnapshot.snapshot_date >= start_date,
                        InvestedAssetSnapshot.snapshot_date <= end_date
                    )
                )
                .order_by(InvestedAssetSnapshot.snapshot_date)
            )

            results = db.session.execute(stmt).all()

            returns_map = {}
            for row in results:
                date_val = row.snapshot_date
                return_val = row.ias_daily_pnl_ratio

                # 确保返回值是浮点数
                if return_val is not None:
                    try:
                        returns_map[date_val] = float(return_val)
                    except (ValueError, TypeError):
                        returns_map[date_val] = 0.0
                else:
                    returns_map[date_val] = 0.0

            return returns_map

        except Exception as e:
            logger.exception(f"Error getting portfolio returns: {str(e)}")
            return {}

    @staticmethod
    def _align_returns_series(
            benchmark_returns: Dict[date, float],
            portfolio_returns: Dict[date, float]
    ) -> Tuple[List[float], List[float]]:
        """
        对齐基准和投资组合的收益率序列

        返回两个列表，确保日期一一对应
        """
        aligned_benchmark = []
        aligned_portfolio = []

        # 获取共同的日期
        common_dates = set(benchmark_returns.keys()) & set(portfolio_returns.keys())
        if not common_dates:
            return [], []

        # 按日期排序
        sorted_dates = sorted(common_dates)

        for d in sorted_dates:
            aligned_benchmark.append(benchmark_returns[d])
            aligned_portfolio.append(portfolio_returns[d])

        return aligned_benchmark, aligned_portfolio

    @staticmethod
    def _calculate_benchmark_metrics(
            benchmark_returns: List[float],
            portfolio_returns: List[float],
            start_date: date,
            end_date: date
    ) -> Dict[str, float]:
        """
        计算基准相关指标

        计算公式：
        1. 基准累计收益率 = Π(1 + r_benchmark) - 1
        2. 投资组合累计收益率 = Π(1 + r_portfolio) - 1
        3. 超额收益 = 投资组合累计收益率 - 基准累计收益率
        4. Beta = Cov(r_portfolio, r_benchmark) / Var(r_benchmark)
        5. Alpha = 投资组合累计收益率 - (无风险利率 + Beta * 基准累计收益率)
           （简化版：Alpha = 投资组合累计收益率 - Beta * 基准累计收益率）
        """
        try:
            # 转换为 numpy 数组便于计算
            bm_array = np.array(benchmark_returns)
            port_array = np.array(portfolio_returns)

            # 1. 计算累计收益率
            bm_cumulative = np.prod(1 + bm_array) - 1
            port_cumulative = np.prod(1 + port_array) - 1

            # 2. 计算超额收益
            excess_return = port_cumulative - bm_cumulative

            # 3. 计算 Beta（使用线性回归）
            # 确保有足够的数据点
            if len(bm_array) > 1 and np.var(bm_array) > 0:
                # 使用协方差/方差公式计算 Beta
                covariance = np.cov(port_array, bm_array)[0, 1]
                variance = np.var(bm_array)
                beta = covariance / variance

                # 4. 计算 Alpha（简化版，假设无风险利率为0）
                alpha = port_cumulative - (beta * bm_cumulative)
            else:
                beta = 1.0  # 默认值
                alpha = 0.0

            # 处理异常值
            beta = float(np.clip(beta, -5, 5))  # 限制 Beta 在合理范围
            alpha = float(alpha)

            return {
                'benchmark_cumulative_return': float(bm_cumulative),
                'excess_return': float(excess_return),
                'beta': beta,
                'alpha': alpha,
                'portfolio_cumulative_return': float(port_cumulative)
            }

        except Exception as e:
            logger.exception(f"Error calculating metrics: {str(e)}")
            return {
                'benchmark_cumulative_return': 0.0,
                'excess_return': 0.0,
                'beta': 1.0,
                'alpha': 0.0,
                'portfolio_cumulative_return': 0.0
            }

    @staticmethod
    def _update_snapshot_metrics(
            snapshot_date: date,
            window_key: str,
            metrics: Dict[str, float]
    ) -> bool:
        """
        更新 InvestedAssetAnalyticsSnapshot 表中的基准指标
        """
        try:
            # 查找对应的快照记录
            stmt = select(InvestedAssetAnalyticsSnapshot).where(
                and_(
                    InvestedAssetAnalyticsSnapshot.snapshot_date == snapshot_date,
                    InvestedAssetAnalyticsSnapshot.window_key == window_key
                )
            )

            snapshot = db.session.execute(stmt).scalar_one_or_none()

            if not snapshot:
                logger.warning(f"No snapshot found for date {snapshot_date}, window {window_key}")
                return False

            # 更新字段
            snapshot.benchmark_cumulative_return = metrics.get('benchmark_cumulative_return', 0.0)
            snapshot.excess_return = metrics.get('excess_return', 0.0)
            snapshot.beta = metrics.get('beta', 1.0)
            snapshot.alpha = metrics.get('alpha', 0.0)

            db.session.commit()
            logger.info(f"Updated benchmark metrics for {snapshot_date}, {window_key}")
            return True

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.exception(f"Error updating snapshot metrics: {str(e)}")
            return False

    @classmethod
    def batch_update_benchmark_metrics(
            cls,
            start_date: date = None,
            end_date: date = None,
            window_keys: List[str] = None,
            bm_code: str = None
    ) -> Dict[str, int]:
        """
        批量更新基准指标

        Args:
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            window_keys: 要更新的窗口键列表（可选）
            bm_code: 基准代码（可选）

        Returns:
            更新统计信息
        """
        try:
            # 1. 确定要更新的日期范围
            if not start_date or not end_date:
                # 获取所有需要更新的快照日期
                stmt = select(
                    InvestedAssetAnalyticsSnapshot.snapshot_date,
                    InvestedAssetAnalyticsSnapshot.window_key
                ).distinct()

                if start_date:
                    stmt = stmt.where(InvestedAssetAnalyticsSnapshot.snapshot_date >= start_date)
                if end_date:
                    stmt = stmt.where(InvestedAssetAnalyticsSnapshot.snapshot_date <= end_date)
                if window_keys:
                    stmt = stmt.where(InvestedAssetAnalyticsSnapshot.window_key.in_(window_keys))

                results = db.session.execute(stmt).all()
            else:
                # 获取指定日期范围内的所有组合
                stmt = select(
                    InvestedAssetAnalyticsSnapshot.snapshot_date,
                    InvestedAssetAnalyticsSnapshot.window_key
                ).distinct().where(
                    and_(
                        InvestedAssetAnalyticsSnapshot.snapshot_date >= start_date,
                        InvestedAssetAnalyticsSnapshot.snapshot_date <= end_date
                    )
                )

                if window_keys:
                    stmt = stmt.where(InvestedAssetAnalyticsSnapshot.window_key.in_(window_keys))

                results = db.session.execute(stmt).all()

            # 2. 批量计算和更新
            success_count = 0
            error_count = 0

            for snapshot_date, window_key in results:
                try:
                    cls.calculate_and_update_benchmark_metrics(
                        snapshot_date, window_key, bm_code
                    )
                    success_count += 1

                    # 每处理100条记录提交一次，避免事务过大
                    if success_count % 100 == 0:
                        logger.info(f"Processed {success_count} records...")

                except Exception as e:
                    error_count += 1
                    logger.exception(f"Error processing {snapshot_date}, {window_key}: {str(e)}")

            logger.info(f"Batch update completed: {success_count}成功, {error_count}失败")

            return {
                'total': success_count + error_count,
                'success': success_count,
                'error': error_count
            }

        except Exception as e:
            logger.exception(f"Error in batch update: {str(e)}", exc_info=True)
            raise
