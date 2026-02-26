import time
from datetime import datetime, timedelta
from decimal import Decimal

import requests
from flask_babel import gettext as _
from loguru import logger
from sqlalchemy import func, desc
from sqlalchemy.orm import selectinload

from app.framework.exceptions import BizException
from app.models import db, FundNavHistory, Holding, UserHolding
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
    def crawl_nav_history_by_date_range(cls, start_date, end_date):
        """
        根据开始和结束时间爬取所有基金的净值数据
        :param start_date: 开始日期
        :param end_date: 结束日期
        :return: dict with 'success_count', 'fail_count', 'errors'
        """
        # 查询所有基金的信息
        all_holdings = Holding.query.all()
        if not all_holdings:
            return {'success_count': 0, 'fail_count': 0, 'errors': []}

        success_count = 0
        fail_count = 0
        errors = []

        for holding in all_holdings:
            ho_code = holding.ho_code

            try:
                inserted = cls.crawl_one_nav_and_insert(holding, start_date, end_date)
                logger.info(f"Crawled {ho_code}: inserted {inserted} records")
                success_count += 1
                time.sleep(0.5)
            except Exception as e:
                fail_count += 1
                error_msg = f"Failed to crawl {ho_code} in range [{start_date}, {end_date}]: {e}"
                logger.exception(error_msg)
                errors.append({'ho_code': ho_code, 'error': str(e)})

        return {
            'success_count': success_count,
            'fail_count': fail_count,
            'errors': errors
        }

    @classmethod
    def crawl_all_nav_history(cls, user_id=None):
        """
        爬取基金的全部历史净值数据（全量重新爬取）
        - 从成立日爬到昨天
        - 删除旧数据，插入新数据
        :param user_id: 可选，指定用户ID时只爬取该用户持有的基金
        """
        yesterday = datetime.now().date() - timedelta(days=1)

        # 查询基金信息（去重，避免重复爬取）
        if user_id:
            # 只爬取用户持有的基金
            all_holdings = Holding.query.join(
                UserHolding, Holding.id == UserHolding.ho_id
            ).filter(
                UserHolding.user_id == user_id
            ).distinct(Holding.ho_code).all()
        else:
            # 爬取所有基金（定时任务场景）
            all_holdings = Holding.query.distinct(Holding.ho_code).all()
        if not all_holdings:
            return {'success_count': 0, 'fail_count': 0, 'errors': []}

        success_count = 0
        fail_count = 0
        errors = []

        for holding in all_holdings:
            ho_code = holding.ho_code
            ho_establish_date = holding.establishment_date

            if not ho_establish_date:
                msg = f"Skipping {ho_code}: establish date is not set."
                logger.warning(msg)
                continue

            try:
                inserted = cls.crawl_one_nav_and_insert(holding, ho_establish_date, yesterday)
                logger.info(f"Crawled {ho_code}: inserted {inserted} records in range [{ho_establish_date}, {yesterday}]")
                success_count += 1
                time.sleep(0.5)
            except Exception as e:
                fail_count += 1
                error_msg = f"Failed to crawl {ho_code} in range [{ho_establish_date}, {yesterday}]: {e}"
                logger.exception(error_msg)
                errors.append({'ho_code': ho_code, 'range': f'{ho_establish_date} ~ {yesterday}', 'error': str(e)})

        return {
            'success_count': success_count,
            'fail_count': fail_count,
            'errors': errors
        }

    @classmethod
    def crawl_yesterday_nav_history(cls):
        """
        爬取所有基金昨天的净值数据
        用于每日增量更新
        """
        yesterday = datetime.now().date() - timedelta(days=1)
        logger.info(f"Starting to crawl yesterday's nav history for all holdings: {yesterday}")

        return cls.crawl_nav_history_by_date_range(yesterday, yesterday)

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
                logger.exception(e)
                raise BizException(_("CRAWL_PAGE_ERROR") % {"ho_code": holding.ho_code, "page": page})

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
            logger.exception(e)
            raise BizException(_("DATA_SAVE_FAILED") % {"ho_code": holding.ho_code})

    @staticmethod
    def get_latest_by_ho_code(ho_code):
        """获取最新净值"""
        nav = FundNavHistory.query.filter_by(
            ho_code=ho_code
        ).order_by(desc(FundNavHistory.nav_date)).first()
        return nav if nav else None
