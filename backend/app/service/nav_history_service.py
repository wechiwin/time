import time
from datetime import datetime, timedelta
from decimal import Decimal

import requests
from loguru import logger
from sqlalchemy import func, desc
from sqlalchemy.orm import selectinload

from app.framework.exceptions import BizException
from app.models import db, FundNavHistory, Holding
from app.utils.date_util import str_to_date


class FundNavHistoryService:
    @classmethod
    def search_list(cls, ho_id: int, start_date, end_date):
        if not ho_id:
            return ''

        # 基础查询：左连接 Holding 表
        query = FundNavHistory.query.options(selectinload(FundNavHistory.holding))

        filters = []

        if ho_id:
            filters.append(FundNavHistory.ho_id == ho_id)
        if start_date:
            filters.append(FundNavHistory.nav_date >= start_date)
        if end_date:
            filters.append(FundNavHistory.nav_date <= end_date)
        if filters:
            query = query.filter(*filters)

        results = query.order_by(FundNavHistory.nav_date).all() or []

        return results

    @classmethod
    def crawl_all_nav_history(cls, ):
        """
        爬取所有基金的市场数据
        """
        yesterday = datetime.now().date() - timedelta(days=1)

        # 查询所有基金的信息
        all_holdings = Holding.query.all()
        if not all_holdings:
            return {'inserted': 0, 'errors': []}

        # 一次查询获取所有持仓的最大和最小日期
        date_stats_query = db.session.query(
            FundNavHistory.ho_id,
            func.min(FundNavHistory.nav_date).label('min_date'),
            func.max(FundNavHistory.nav_date).label('max_date')
        ).group_by(FundNavHistory.ho_id).all()

        date_stats = {row.ho_id: {'min': row.min_date, 'max': row.max_date} for row in date_stats_query}

        total_inserted = 0

        for holding in all_holdings:
            ho_id = holding.id
            ho_code = holding.ho_code
            ho_establish_date = holding.establishment_date

            if not ho_establish_date:
                msg = f"Skipping {ho_code}: establish date is not set."
                logger.warning(msg)
                continue

            stats = date_stats.get(ho_id)

            ranges_to_crawl = []

            if not stats:
                # 情况1: 数据库无任何记录，从成立日爬到昨天
                ranges_to_crawl.append((ho_establish_date, yesterday))
            else:
                # 情况2: 补充最新数据 (从已有最大日期的后一天 -> 昨天)
                if stats['max'] < yesterday:
                    start_date = stats['max'] + timedelta(days=1)
                    ranges_to_crawl.append((start_date, yesterday))

                # 情况3: 补充早期缺失数据 (从成立日 -> 已有最小日期的前一天)
                if stats['min'] > ho_establish_date:
                    end_date = stats['min'] - timedelta(days=1)
                    ranges_to_crawl.append((ho_establish_date, end_date))
            # 遍历所有需要爬取的范围，执行爬取和保存
            for start_date, end_date in ranges_to_crawl:
                try:
                    # inserted_count = cls._crawl_and_save_single_range(
                    #     holding, start_date, end_date
                    # )
                    data = cls.crawl_one_nav_and_insert(holding, start_date, end_date)
                    # logger.info(data)
                    # cls.save_market_data_to_db(data, holding, start_date, end_date)
                    time.sleep(0.5)
                except Exception as e:
                    msg = f"Failed to crawl/save for {ho_code} in range [{start_date}, {end_date}]: {e}"
                    # 使用 logger 记录完整错误堆栈，便于排查
                    logger.exception(msg, exc_info=True)
        return True

    @classmethod
    def crawl_one_nav_and_insert(cls,
                                 holding: Holding,
                                 start_date=None,
                                 end_date=None):
        """
        爬取单只基金的历史净值
        :param ho_code: 基金代码，如 '000001'
        :param start_date: 开始日期，格式 'YYYY-MM-DD'
        :param end_date: 结束日期，格式 'YYYY-MM-DD'
        :return: 净值列表（字典）
        """
        logger.info("crawl_one_nav_and_insert")
        ho_code = holding.ho_code

        url = "https://api.fund.eastmoney.com/f10/lsjz"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Referer": f"http://fundf10.eastmoney.com/jjjz_{ho_code}.html",
            "X-Requested-With": "XMLHttpRequest",
        }
        params = {
            "fundCode": ho_code,
            "pageIndex": 1,
            "pageSize": 20,  # 超过了不返回数据
            "startDate": start_date or "",
            "endDate": end_date or "",
        }

        all_data: list[FundNavHistory] = []
        page = 1

        while True:
            params['pageIndex'] = page
            try:
                resp = requests.get(url, headers=headers, params=params, timeout=10)
                # print("接口返回内容：", resp.json())
                if resp.status_code != 200:
                    logger.info(f"请求失败: {resp.status_code}")
                    break

                # 接口返回的是 JSON，不是 JSONP（即使有 callback）
                data = resp.json()
                if not data['Data'] or not data['Data']['LSJZList']:
                    break

                items = data['Data']['LSJZList']
                for item in items:
                    record = FundNavHistory(
                        ho_id=holding.id,
                        ho_code=ho_code,
                        nav_date=str_to_date(item['FSRQ']) if item['FSRQ'] else None,
                        nav_per_unit=Decimal(item['DWJZ']),
                        nav_accumulated_per_unit=Decimal(item['LJJZ']) if item['LJJZ'] else None,
                        nav_return=float(item['JZZZL']) if item['JZZZL'] else None,
                        dividend_price=Decimal(item.get('FHFCZ')) if item['FHFCZ'] else None,
                    )
                    all_data.append(record)

                # 判断是否还有下一页
                total_pages = data['TotalCount'] // params['pageSize'] + 1
                if page >= total_pages:
                    break

                page += 1
                time.sleep(0.5)  # 防爬，避免请求过快
            except Exception as e:
                logger.exception(e, exc_info=True)
                raise BizException(f"{holding.ho_code}爬取第 {page} 页出错")

        # 储存数据
        try:
            # 删除日期内的数据，避免重复插入
            deleted = FundNavHistory.query.filter(
                FundNavHistory.ho_id == holding.id,
                FundNavHistory.nav_date >= start_date,
                FundNavHistory.nav_date <= end_date
            ).delete(synchronize_session=False)
            logger.info(f"deleted {deleted} records for {holding.ho_code} in save_market_data_to_db.")

            db.session.bulk_save_objects(all_data)
            db.session.commit()
            logger.info(f"Successfully inserted {len(all_data)} records for {holding.ho_code}.")
            return len(all_data)
        except Exception as e:
            db.session.rollback()
            logger.exception(e, exc_info=True)
            raise BizException(f"{holding.ho_code}数据保存失败")

    @staticmethod
    def get_latest_by_ho_code(ho_code):
        """获取最新净值"""
        nav = FundNavHistory.query.filter_by(
            ho_code=ho_code
        ).order_by(desc(FundNavHistory.nav_date)).first()
        return nav if nav else None
