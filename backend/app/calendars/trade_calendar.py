# calendars.py
import logging
import os
from datetime import date, datetime
from threading import Lock
from typing import Optional, Union, List

import pandas as pd

from app.utils.date_util import str_to_date

logger = logging.getLogger(__name__)


class TradeCalendar:
    """
    线程安全的 A 股交易日历单例。
    提供高效、准确的交易日查询功能。
    - 使用 Pandas DatetimeIndex 以获得高性能。
    - 采用线程安全的懒加载单例模式，节省内存和初始化时间。
    - API 设计清晰，行为可预测。
    """

    _instance = None
    _lock = Lock()  # 用于同步实例化和加载

    def __new__(cls):
        # 双重检查锁定，提高获取实例的性能
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._dt_index = None
                    cls._instance._initialized = False
        return cls._instance

    def _load(self):
        """
        从 CSV 文件加载交易日历数据。
        此方法设计为线程安全的，且只执行一次。
        """
        # 在锁内再次检查，防止多线程并发加载
        with self._lock:
            if self._initialized:
                return

            try:
                csv_path = os.path.join(
                    os.path.dirname(os.path.abspath(__file__)),
                    # 'calendars',
                    'a_share_calendar.csv'
                )
                if not os.path.exists(csv_path):
                    raise FileNotFoundError(f"Calendar file not found: {csv_path}")

                df = pd.read_csv(csv_path, dtype=str)
                trade_dates_str = set(df['trade_date'])  # {'2024-06-05', ...}

                # 只维护一份数据：排序的 DatetimeIndex
                self._dt_index = pd.to_datetime(sorted(trade_dates_str)).sort_values()
                self._initialized = True

                logger.info("Trade calendar loaded from %s, total %d days",
                            csv_path, len(self._dt_index))

            except Exception as e:
                logger.exception(f"Failed to load trade calendar, {str(e)}.", exc_info=True)
                # 加载失败，重置状态，以便下次可以重试
                self._initialized = False
                self._dt_index = None
                raise e

    def _ensure_loaded(self):
        """确保日历数据已加载（懒加载）"""
        if not self._initialized:
            self._load()

    def reload(self):
        """热重载日历数据，线程安全"""
        with self._lock:
            self._initialized = False
            self._dt_index = None
            self._load()
        logger.warning("Trade calendar reloaded")

    @staticmethod
    def _normalize_date(date_input: Union[str, date, datetime]) -> date:
        """将多种日期输入统一转换为 date 对象。"""
        if isinstance(date_input, str):
            return str_to_date(date_input)
        elif isinstance(date_input, datetime):
            return date_input.date()
        elif isinstance(date_input, date):
            return date_input
        else:
            raise ValueError(f"Unsupported date type: {type(date_input)}")

    def is_trade_day(self, date_input: Union[str, date, datetime]) -> bool:
        """
        判断日期是否为交易日
        :param date_input: 支持字符串('2024-06-05')、date、datetime 对象
        :return: 如果是交易日则返回 True，否则返回 False。
        """
        self._ensure_loaded()

        try:
            target_date = self._normalize_date(date_input)

            # 使用二分查找在已排序的日期列表中快速判断
            target_pd = pd.Timestamp(target_date)
            # 检查目标日期是否在交易日历中
            return target_pd in self._dt_index

        except (ValueError, TypeError):
            logger.warning(f"Invalid date input: {date_input}")
            return False

    def get_nearby_trade_days(
            self,
            date_input: Union[str, date, datetime],
            n: int,
            inclusive: bool = False
    ) -> List[date]:
        """
        获取给定日期附近的 n 个交易日。
        :param date_input: 基准日期。
        :param n: 获取的交易日数量。
                  1. n > 0: 获取未来的 n 个交易日。
                  2. n < 0: 获取过去的 |n| 个交易日。
                  3. n = 0: 如果当天是交易日且 inclusive=True，返回当天，否则返回空列表。
        :param inclusive: 是否包含 date_input 本身（如果它是交易日）。
                            True: 如果 date_input 是交易日，它将被作为结果之一。
                            False: 结果将严格在 date_input 之前或之后。
        :return: 一个按时间顺序排列的 date 对象列表。
        """
        self._ensure_loaded()
        if n == 0:
            if inclusive and self.is_trade_day(date_input):
                return [self._normalize_date(date_input)]
            return []
        try:
            target_ts = pd.Timestamp(self._normalize_date(date_input))
        except (ValueError, TypeError):
            logger.warning(f"Invalid date input for get_nearby_trade_days: {date_input}")
            return []
        # 使用 searchsorted 定位，效率很高
        # 'left': 返回第一个不小于 target_ts 的元素的索引
        # 'right': 返回第一个严格大于 target_ts 的元素的索引
        if n > 0:  # --- 获取未来交易日 ---
            # 定位到 date_input 当天或之后的第一个交易日
            start_idx = self._dt_index.searchsorted(target_ts, side='left')

            # 如果 date_input 本身是交易日且我们不希望包含它，则从下一个交易日开始
            if not inclusive:
                # 检查定位到的索引是否就是 target_ts 本身
                if start_idx < len(self._dt_index) and self._dt_index[start_idx] == target_ts:
                    start_idx += 1

            end_idx = start_idx + n
            result_slice = self._dt_index[start_idx:end_idx]
        else:  # --- 获取过去交易日 ---
            count = abs(n)
            # 定位到 date_input 当天或之后的第一个交易日
            end_idx = self._dt_index.searchsorted(target_ts, side='left')
            # 如果 date_input 本身是交易日且我们希望包含它，则切片的终点需要+1
            if inclusive:
                if end_idx < len(self._dt_index) and self._dt_index[end_idx] == target_ts:
                    end_idx += 1

            start_idx = max(0, end_idx - count)
            result_slice = self._dt_index[start_idx:end_idx]
        # 将 Pandas Timestamps 转换为 Python date 对象
        return [ts.date() for ts in result_slice]

    def prev_trade_day(self, date_input: Union[str, date, datetime]) -> Optional[date]:
        """
        返回前一个交易日（返回 date 对象，更通用）
        如果 date_input 本身是最早一天，则返回 None。
        """
        self._ensure_loaded()

        try:
            target_dt = self._normalize_date(date_input)

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
            target_dt = self._normalize_date(date_input)

            target_pd = pd.Timestamp(target_dt)

            # 找到大于目标日期的第一个交易日
            idx = self._dt_index.searchsorted(target_pd, side='right')
            if idx < len(self._dt_index):
                return self._dt_index[idx].date()
            return None

        except (ValueError, TypeError):
            logger.warning(f"Invalid date input: {date_input}")
            return None

    def count_trade_days_between(
            self,
            start_date: Union[str, date, datetime],
            end_date: Union[str, date, datetime],
            inclusive: bool = True,
    ) -> int:
        """
        计算两个日期之间的交易日天数。

        :param start_date: 起始日期（支持字符串、date、datetime）
        :param end_date: 结束日期（支持字符串、date、datetime）
        :param inclusive: 是否包含起始和结束当天（若它们本身是交易日）
        :return: 两个日期之间的交易日天数（int，>=0）
        :raises ValueError: 当输入非法或 start_date > end_date 时
        """
        self._ensure_loaded()

        try:
            start = self._normalize_date(start_date)
            end = self._normalize_date(end_date)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid date input: {e}") from e

        if start > end:
            raise ValueError("start_date must not be later than end_date")

        start_ts = pd.Timestamp(start)
        end_ts = pd.Timestamp(end)

        # 使用二分查找快速定位索引
        left_idx = self._dt_index.searchsorted(start_ts, side="left")
        right_idx = self._dt_index.searchsorted(end_ts, side="right")

        # 如果不包含边界，调整索引
        if not inclusive:
            # 排除 start 当天
            if left_idx < len(self._dt_index) and self._dt_index[left_idx] == start_ts:
                left_idx += 1
            # 排除 end 当天
            if right_idx > 0 and self._dt_index[right_idx - 1] == end_ts:
                right_idx -= 1

        return max(0, right_idx - left_idx)


if __name__ == '__main__':
    calendar = TradeCalendar()
    date = calendar.get_nearby_trade_days('2025-01-02', 0, True)
    print(date)
