# calendars.py
import os
import logging
from datetime import date, datetime
from typing import Optional, Union, Set
from threading import Lock

import pandas as pd

from app.tools.date_tool import date_to_str, str_to_date

logger = logging.getLogger(__name__)


class TradeCalendar:
    """
    线程安全的 A 股交易日历单例
    优化点：
    1. 线程安全的懒加载
    2. 减少内存占用（只维护一份数据）
    3. 支持多种日期输入类型
    4. 更高效的日期计算
    """
    _instance = None
    _lock = Lock()  # 用于同步实例化和加载

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                # 初始化属性，但先不加载数据
                cls._instance._trade_dates = None
                cls._instance._dt_index = None
                cls._instance._initialized = False
        return cls._instance

    def _load(self):
        """读取 CSV 到内存，线程安全"""
        with self._lock:
            if self._initialized:
                return

            csv_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'calendars',
                'a_share_calendar.csv'
            )
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f'Calendar file not found: {csv_path}')

            df = pd.read_csv(csv_path, dtype=str)
            trade_dates_str = set(df['trade_date'])  # {'2024-06-05', ...}

            # 只维护一份数据：排序的 DatetimeIndex
            self._dt_index = pd.to_datetime(sorted(trade_dates_str)).sort_values()
            self._initialized = True

            logger.info("Trade calendar loaded from %s, total %d days",
                        csv_path, len(self._dt_index))

    def _ensure_loaded(self):
        """确保日历数据已加载（懒加载）"""
        if not self._initialized:
            self._load()

    # ---------- 公共 API 优化 ----------
    def is_trade_day(self, date_input: Union[str, date, datetime]) -> bool:
        """
        判断日期是否为交易日
        :param date_input: 支持字符串('2024-06-05')、date、datetime 对象
        """
        self._ensure_loaded()

        try:
            if isinstance(date_input, str):
                target_date = str_to_date(date_input)
            elif isinstance(date_input, datetime):
                target_date = date_input.date()
            else:
                target_date = date_input

            # 使用二分查找在已排序的日期列表中快速判断
            target_pd = pd.Timestamp(target_date)
            # 检查目标日期是否在交易日历中
            idx = self._dt_index.searchsorted(target_pd)
            return idx < len(self._dt_index) and self._dt_index[idx] == target_pd

        except (ValueError, TypeError):
            logger.warning(f"Invalid date input: {date_input}")
            return False

    def reload(self):
        """热重载日历数据，线程安全"""
        with self._lock:
            self._initialized = False
            self._dt_index = None
            self._load()
        logger.warning("Trade calendar reloaded")

    def prev_trade_day(self, date_input: Union[str, date, datetime]) -> Optional[date]:
        """
        返回前一个交易日（返回 date 对象，更通用）
        如果 date_input 本身是最早一天，则返回 None。
        """
        self._ensure_loaded()

        try:
            if isinstance(date_input, str):
                target_dt = str_to_date(date_input)
            elif isinstance(date_input, datetime):
                target_dt = date_input.date()
            else:
                target_dt = date_input

            target_pd = pd.Timestamp(target_dt)

            # 使用 asof 方法找到小于目标日期的最后一个交易日
            prev = self._dt_index.asof(target_pd - pd.Timedelta(days=1))

            if pd.isna(prev):
                return None
            return prev.date()

        except (ValueError, TypeError):
            logger.warning(f"Invalid date input: {date_input}")
            return None

    def next_trade_day(self, date_input: Union[str, date, datetime]) -> Optional[date]:
        """
        新增：返回下一个交易日
        """
        self._ensure_loaded()

        try:
            if isinstance(date_input, str):
                target_dt = str_to_date(date_input)
            elif isinstance(date_input, datetime):
                target_dt = date_input.date()
            else:
                target_dt = date_input

            target_pd = pd.Timestamp(target_dt)

            # 找到大于目标日期的第一个交易日
            idx = self._dt_index.searchsorted(target_pd, side='right')
            if idx < len(self._dt_index):
                return self._dt_index[idx].date()
            return None

        except (ValueError, TypeError):
            logger.warning(f"Invalid date input: {date_input}")
            return None

    def get_trade_days_in_range(self, start_date: Union[str, date],
                                end_date: Union[str, date]) -> Set[date]:
        """
        新增：获取指定范围内的所有交易日
        """
        self._ensure_loaded()

        start_dt = str_to_date(start_date) if isinstance(start_date, str) else start_date
        end_dt = str_to_date(end_date) if isinstance(end_date, str) else end_date

        start_pd = pd.Timestamp(start_dt)
        end_pd = pd.Timestamp(end_dt)

        # 使用 pandas 的切片操作高效获取范围内的日期
        mask = (self._dt_index >= start_pd) & (self._dt_index <= end_pd)
        trade_days_in_range = self._dt_index[mask]

        return {dt.date() for dt in trade_days_in_range}

    # 保持向后兼容的辅助方法
    def prev_trade_day_str(self, date_str: str) -> Optional[str]:
        """兼容旧版本的字符串返回"""
        result = self.prev_trade_day(date_str)
        return date_to_str(result) if result else None

    def next_trade_day_str(self, date_str: str) -> Optional[str]:
        """兼容旧版本的字符串返回"""
        result = self.next_trade_day(date_str)
        return date_to_str(result) if result else None
