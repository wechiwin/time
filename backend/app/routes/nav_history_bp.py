import time
from datetime import datetime, timedelta

import requests
from app.framework.exceptions import BizException
from app.models import db, NavHistory, Holding
from app.schemas_marshall import NavHistorySchema, marshal_pagination
from app.service.nav_history_service import NavHistoryService
from flask import Blueprint, request, current_app
from sqlalchemy import func

nav_history_bp = Blueprint('nav_history', __name__, url_prefix='/api/nav_history')


@nav_history_bp.route('', methods=['GET'])
def get_nav_history():
    ho_code = request.args.get('ho_code')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    # 基础查询：左连接 Holding 表
    query = db.session.query(NavHistory, Holding.ho_short_name).outerjoin(
        Holding, NavHistory.ho_code == Holding.ho_code
    )

    if ho_code:
        query = query.filter_by(ho_code=ho_code)

    # 分页查询
    pagination = query.order_by(NavHistory.nav_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # results = query.order_by(NetValue.date).all() or []
    results = pagination.items or []

    data = [{
        'nav_id': nv.nav_id,
        'ho_code': nv.ho_code,
        'ho_short_name': ho_short_name,
        'nav_date': nv.nav_date,
        'nav_per_unit': nv.nav_per_unit,
        'nav_accumulated_per_unit': nv.nav_accumulated_per_unit
    } for nv, ho_short_name in results]

    return {
        'items': data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }

@nav_history_bp.route('search_list', methods=['GET'])
def search_list():
    ho_code = request.args.get('ho_code')
    data = NavHistoryService.search_list(ho_code)
    return data


@nav_history_bp.route('', methods=['POST'])
def create_net_value():
    data = request.get_json()
    required_fields = ['ho_code', 'nav_date', 'nav_per_unit']
    if not all(field in data for field in required_fields):
        raise BizException(message="缺少必要字段")
    new_nv = NavHistorySchema().load(data)
    db.session.add(new_nv)
    db.session.commit()
    return ''


@nav_history_bp.route('/<int:nav_id>', methods=['GET'])
def get_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    return NavHistorySchema().dump(nv)


@nav_history_bp.route('/<int:nav_id>', methods=['PUT'])
def update_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    data = request.get_json()
    updated_data = NavHistorySchema().load(data, instance=nv, partial=True)

    db.session.add(updated_data)
    db.session.commit()
    return ''


@nav_history_bp.route('/<int:nav_id>', methods=['DELETE'])
def delete_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    db.session.delete(nv)
    db.session.commit()
    return ''


@nav_history_bp.route('/crawl', methods=['POST'])
def crawl_nav_history():
    data = request.get_json()  # 改为获取 JSON 数据
    ho_code = data.get("ho_code")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if not ho_code:
        raise BizException(message="缺少基金代码")

    try:
        data = crawl_fund_history(ho_code, start_date, end_date)
        if not data:
            raise BizException(message="未获取到数据")

        print(f"爬取基金 {len(data)} 条")
        save_nav_history_to_db(data, ho_code, start_date, end_date)
        return ''
    except Exception as e:
        db.session.rollback()
        raise BizException(message=f"爬取失败: {e}")


def save_nav_history_to_db(data_list, ho_code, start_date, end_date):
    # 查询日期内的数据
    result = NavHistory.query.filter(
        NavHistory.ho_code == ho_code,
        NavHistory.tr_date >= start_date,
        NavHistory.tr_date <= end_date
    ).all()
    # key:date val:identity
    result_map = {item.date: item for item in result}

    """
    将爬取的数据存入数据库，避免重复插入
    """
    for item in data_list:
        # 检查是否已存在该基金+日期的记录
        net_val_db = result_map.get(item['date'])
        if net_val_db:
            # 检查数据是否有变化，避免不必要的更新
            if (net_val_db.unit_net_value != item['unit_net_value'] or
                    net_val_db.nav_accumulated_per_unit != item['nav_accumulated_per_unit']):
                net_val_db.unit_net_value = item['unit_net_value']
                net_val_db.nav_accumulated_per_unit = item['nav_accumulated_per_unit']
        else:
            nv = NavHistory(
                ho_code=item['ho_code'],
                date=item['date'],
                unit_net_value=item['unit_net_value'],
                nav_accumulated_per_unit=item['nav_accumulated_per_unit']
            )
        db.session.add(nv)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"保存失败: {e}")


def crawl_fund_history(ho_code, start_date=None, end_date=None):
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
            print("接口返回内容：", resp.json())
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
                    'date': datetime.strptime(item['FSRQ'], '%Y-%m-%d').date(),
                    'unit_net_value': float(item['DWJZ']),
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


def crawl_missing_nav_history():
    # 查询所有基金的最近一条净值记录
    # 先找到每个ho_code的最大date
    subquery = db.session.query(
        NavHistory.ho_code,
        func.max(NavHistory.tr_date).label('max_date')
    ).group_by(NavHistory.ho_code).subquery()

    # 然后关联查询获取完整记录
    results = db.session.query(NavHistory).join(
        subquery,
        db.and_(
            NavHistory.ho_code == subquery.c.ho_code,
            NavHistory.tr_date == subquery.c.max_date
        )
    ).all()

    yesterday = datetime.now() - timedelta(days=1)
    yesterday_str = yesterday.strftime('%Y-%m-%d')

    total_inserted = 0
    errors = []

    for item in results:
        if item.date < yesterday_str:
            try:
                data = crawl_fund_history(item.ho_code, item.date, yesterday_str)
                if data:
                    save_nav_history_to_db(data, item.ho_code, item.date, yesterday_str)
                    total_inserted += len(data)
                time.sleep(0.5)
            except Exception as e:
                db.session.rollback()
                errors.append(f"{item.ho_code}: {e}")

    # print(f"inserted: {total_inserted}, 'errors': {errors}")
    current_app.logger.info(f"crawl_missing_nav_history：inserted: {total_inserted}, 'errors': {errors}")
    return {'inserted': total_inserted, 'errors': errors}


@nav_history_bp.route('/crawl_all', methods=['POST'])
def crawl_all_funds():
    result = crawl_missing_nav_history()
    if result['errors']:
        raise BizException(message='; '.join(result['errors']))
    return ''
