import logging
from datetime import date, datetime
from typing import Optional, Dict

import akshare as ak
import numpy as np
import pandas as pd
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError

from app.database import db
from app.models import Benchmark, BenchmarkHistory

# 配置日志
logger = logging.getLogger(__name__)


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
            logger.error(f"Error ensuring benchmark exists: {str(e)}")
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
            logger.error(f"Failed to sync benchmark data: {str(e)}", exc_info=True)
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
            logger.error(f"Sina source also failed: {str(e)}")
        logger.error(f"All data sources failed for benchmark: {code}")
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
