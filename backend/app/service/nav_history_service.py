import time
from datetime import datetime, timedelta

import requests
from app.framework.exceptions import BizException
from app.models import db, NavHistory, Holding
from app.schemas_marshall import NavHistorySchema
from sqlalchemy import func


class NavHistoryService:
    @classmethod
    def search_list(cls, ho_code: int, start_date, end_date):
        if not ho_code:
            return ''

        # 基础查询：左连接 Holding 表
        query = db.session.query(NavHistory, Holding.ho_short_name).outerjoin(
            Holding, NavHistory.ho_code == Holding.ho_code
        )
        filters = []

        if ho_code:
            filters.append(NavHistory.ho_code == ho_code)
        if start_date:
            filters.append(NavHistory.nav_date >= start_date)
        if end_date:
            filters.append(NavHistory.nav_date <= end_date)
        if filters:
            query = query.filter(*filters)

        results = query.order_by(NavHistory.nav_date).all() or []

        data = [{
            'nav_id': nv.nav_id,
            'ho_code': nv.ho_code,
            'ho_short_name': ho_short_name,
            'nav_date': nv.nav_date,
            'nav_per_unit': nv.nav_per_unit,
            'nav_accumulated_per_unit': nv.nav_accumulated_per_unit
        } for nv, ho_short_name in results]
        return data

    @classmethod
    def crawl_all_nav_history(cls, ):
        yesterday = datetime.now() - timedelta(days=1)
        yesterday_str = yesterday.strftime('%Y-%m-%d')

        # 查询所有基金的信息
        all_holdings = Holding.query.all()

        # 查询所有基金的最晚净值日期
        max_subquery = db.session.query(
            NavHistory.ho_code,
            func.max(NavHistory.nav_date).label('max_date')
        ).group_by(NavHistory.ho_code).subquery()
        # 然后关联查询获取完整记录
        max_nav_his_list = db.session.query(NavHistory).join(
            max_subquery,
            db.and_(
                NavHistory.ho_code == max_subquery.c.ho_code,
                NavHistory.nav_date == max_subquery.c.max_date
            )
        ).all()
        max_nav_by_code = {nav.ho_code: nav.nav_date for nav in max_nav_his_list}

        # 查询所有基金的最早净值日期
        min_subquery = db.session.query(
            NavHistory.ho_code,
            func.min(NavHistory.nav_date).label('min_date')
        ).group_by(NavHistory.ho_code).subquery()
        # 然后关联查询获取完整记录
        min_nav_his_list = db.session.query(NavHistory).join(
            min_subquery,
            db.and_(
                NavHistory.ho_code == min_subquery.c.ho_code,
                NavHistory.nav_date == min_subquery.c.min_date
            )
        ).all()
        min_nav_by_code = {nav.ho_code: nav.nav_date for nav in min_nav_his_list}

        total_inserted = 0
        errors = []

        for holding in all_holdings:
            ho_code = holding.ho_code
            ho_establish_date = holding.ho_establish_date

            max_nav_date = max_nav_by_code.get(ho_code)
            min_nav_date = min_nav_by_code.get(ho_code)

            #  如果没有最早或者最晚，说明数据库没有相关净值历史记录，直接查创立日期-昨天
            if not max_nav_date or not min_nav_date:
                data = cls.crawl_one_nav_history(ho_code, ho_establish_date, yesterday_str)
                if data:
                    try:
                        cls.save_nav_history_to_db(data, ho_code, ho_establish_date, yesterday_str)
                        total_inserted += len(data)
                        time.sleep(0.5)
                    except Exception as e:
                        db.session.rollback()
                        errors.append(f"{ho_code}: {e}")
                break
            # 最晚净值日期-昨天
            if max_nav_date < yesterday_str:
                data = cls.crawl_one_nav_history(ho_code, max_nav_date, yesterday_str)
                if data:
                    try:
                        cls.save_nav_history_to_db(data, ho_code, max_nav_date, yesterday_str)
                        total_inserted += len(data)
                        time.sleep(0.5)
                    except Exception as e:
                        db.session.rollback()
                        errors.append(f"{ho_code}: {e}")
            # 创立日期-最早净值日期
            if min_nav_date > ho_establish_date:
                data = cls.crawl_one_nav_history(ho_code, ho_establish_date, min_nav_date)
                if data:
                    try:
                        cls.save_nav_history_to_db(data, ho_code, ho_establish_date, min_nav_date)
                        total_inserted += len(data)
                        time.sleep(0.5)
                    except Exception as e:
                        db.session.rollback()
                        errors.append(f"{ho_code}: {e}")

        return {'inserted': total_inserted, 'errors': errors}

    @classmethod
    def crawl_one_nav_history(cls, ho_code, start_date=None, end_date=None):
        """
        爬取单只基金的历史净值
        :param ho_code: 基金代码，如 '000001'
        :param start_date: 开始日期，格式 'YYYY-MM-DD'
        :param end_date: 结束日期，格式 'YYYY-MM-DD'
        :return: 净值列表（字典）
        """

        url = "https://api.fund.eastmoney.com/f10/lsjz"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Referer": f"http://fundf10.eastmoney.com/jjjz_{ho_code}.html",
            "X-Requested-With": "XMLHttpRequest",
        }
        params = {
            "fundCode": ho_code,
            "pageIndex": 1,
            "pageSize": 20,  # 最大一页1000条
            "startDate": start_date or "",
            "endDate": end_date or "",
        }

        all_data = []
        page = 1

        while True:
            params['pageIndex'] = page
            try:
                resp = requests.get(url, headers=headers, params=params, timeout=10)
                # print("接口返回内容：", resp.json())
                if resp.status_code != 200:
                    print(f"请求失败: {resp.status_code}")
                    break

                # 接口返回的是 JSON，不是 JSONP（即使有 callback）
                data = resp.json()
                if not data['Data'] or not data['Data']['LSJZList']:
                    break

                items = data['Data']['LSJZList']
                for item in items:
                    all_data.append({
                        'ho_code': ho_code,
                        # 'nav_date': datetime.strptime(item['FSRQ'], '%Y-%m-%d').date(),
                        'nav_date': item['FSRQ'],
                        'nav_per_unit': float(item['DWJZ']),
                        'nav_accumulated_per_unit': float(item['LJJZ']) if item['LJJZ'] else None,
                    })

                # 判断是否还有下一页
                total_pages = data['TotalCount'] // params['pageSize'] + 1
                if page >= total_pages:
                    break

                page += 1
                time.sleep(0.5)  # 防爬，避免请求过快
            except Exception as e:
                print(f"爬取第 {page} 页出错: {e}")
                break

        return all_data

    @classmethod
    def save_nav_history_to_db(cls, data_list, ho_code, start_date, end_date):
        # 查询日期内的数据
        result = NavHistory.query.filter(
            NavHistory.ho_code == ho_code,
            NavHistory.nav_date >= start_date,
            NavHistory.nav_date <= end_date
        ).all()
        # key:date val:identity
        result_map = {item.nav_date: item for item in result}

        """
        将爬取的数据存入数据库，避免重复插入
        """
        for item in data_list:
            # 检查是否已存在该基金+日期的记录
            net_val_db = result_map.get(item['nav_date'])
            if net_val_db:
                # 检查数据是否有变化，避免不必要的更新
                if (net_val_db.nav_per_unit != item['nav_per_unit'] or
                        net_val_db.nav_accumulated_per_unit != item['nav_accumulated_per_unit']):
                    net_val_db.nav_per_unit = item['nav_per_unit']
                    net_val_db.nav_accumulated_per_unit = item['nav_accumulated_per_unit']
            else:
                nv = NavHistory(
                    ho_code=item['ho_code'],
                    nav_date=item['nav_date'],
                    nav_per_unit=item['nav_per_unit'],
                    nav_accumulated_per_unit=item['nav_accumulated_per_unit']
                )
                db.session.add(nv)

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise BizException(f"保存失败: {e}")
