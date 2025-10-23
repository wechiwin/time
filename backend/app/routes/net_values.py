import time
from datetime import datetime, timedelta
import requests
from app.framework.response import Response
from app.models import db, NetValue, Holding
from flask import Blueprint, request, current_app
from sqlalchemy import func

net_values_bp = Blueprint('net_values', __name__, url_prefix='/api/net_values')


@net_values_bp.route('', methods=['GET'])
def get_net_values():
    fund_code = request.args.get('fund_code')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    # 基础查询：左连接 Holding 表
    query = db.session.query(NetValue, Holding.fund_name).outerjoin(
        Holding, NetValue.fund_code == Holding.fund_code
    )

    # query = NetValue.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)

    # 分页查询
    pagination = query.order_by(NetValue.date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # results = query.order_by(NetValue.date).all() or []
    results = pagination.items or []

    data = [{
        'id': nv.id,
        'fund_code': nv.fund_code,
        'fund_name': fund_name,
        'date': nv.date,
        'unit_net_value': nv.unit_net_value,
        'accumulated_net_value': nv.accumulated_net_value
    } for nv, fund_name in results]

    # return Response.success(data=data)
    return Response.success(data={
        'items': data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@net_values_bp.route('', methods=['POST'])
def create_net_value():
    data = request.get_json()
    required_fields = ['fund_code', 'date', 'unit_net_value']
    if not all(field in data for field in required_fields):
        return Response.error(code=400, message="缺少必要字段")
    new_nv = NetValue(
        fund_code=data['fund_code'],
        date=data['date'],
        unit_net_value=data['unit_net_value'],
        accumulated_net_value=data['accumulated_net_value']
    )
    db.session.add(new_nv)
    db.session.commit()
    return Response.success(message="净值添加成功")


@net_values_bp.route('/<int:id>', methods=['GET'])
def get_net_value(id):
    nv = NetValue.query.get_or_404(id)
    data = {
        'id': nv.id,
        'fund_code': nv.fund_code,
        'date': nv.date,
        'unit_net_value': nv.unit_net_value,
        'accumulated_net_value': nv.accumulated_net_value
    }
    return Response.success(data=data)


@net_values_bp.route('/<int:id>', methods=['PUT'])
def update_net_value(id):
    nv = NetValue.query.get_or_404(id)
    data = request.get_json()
    nv.fund_code = data.get('fund_code', nv.fund_code)
    nv.date = data.get('date', nv.date)
    nv.unit_net_value = data.get('unit_net_value', nv.unit_net_value)
    nv.accumulated_net_value = data.get('accumulated_net_value', nv.accumulated_net_value)
    db.session.commit()
    return Response.success(message="净值更新成功")


@net_values_bp.route('/<int:id>', methods=['DELETE'])
def delete_net_value(id):
    nv = NetValue.query.get_or_404(id)
    db.session.delete(nv)
    db.session.commit()
    return Response.success(message="净值删除成功")


@net_values_bp.route('/crawl', methods=['POST'])
def crawl_net_values():
    data = request.get_json()  # 改为获取 JSON 数据
    fund_code = data.get("fund_code")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if not fund_code:
        return Response.error(code=400, message="缺少基金代码")

    try:
        data = crawl_fund_history(fund_code, start_date, end_date)
        if not data:
            return Response.error(message="未获取到数据")

        print(f"爬取基金 {len(data)} 条")
        save_net_values_to_db(data, fund_code, start_date, end_date)
        return Response.success(message=f"成功新增 {len(data)} 条历史净值")
    except Exception as e:
        db.session.rollback()
        return Response.error(code=500, message=f"爬取失败: {e}")


def save_net_values_to_db(data_list, fund_code, start_date, end_date):
    # 查询日期内的数据
    result = NetValue.query.filter(
        NetValue.fund_code == fund_code,
        NetValue.date >= start_date,
        NetValue.date <= end_date
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
                    net_val_db.accumulated_net_value != item['accumulated_net_value']):
                net_val_db.unit_net_value = item['unit_net_value']
                net_val_db.accumulated_net_value = item['accumulated_net_value']
        else:
            nv = NetValue(
                fund_code=item['fund_code'],
                date=item['date'],
                unit_net_value=item['unit_net_value'],
                accumulated_net_value=item['accumulated_net_value']
            )
        db.session.add(nv)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"保存失败: {e}")


def crawl_fund_history(fund_code, start_date=None, end_date=None):
    """
    爬取单只基金的历史净值
    :param fund_code: 基金代码，如 '000001'
    :param start_date: 开始日期，格式 'YYYY-MM-DD'
    :param end_date: 结束日期，格式 'YYYY-MM-DD'
    :return: 净值列表（字典）
    """
    url = "https://api.fund.eastmoney.com/f10/lsjz"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": f"http://fundf10.eastmoney.com/jjjz_{fund_code}.html",
        "X-Requested-With": "XMLHttpRequest",
    }
    params = {
        "fundCode": fund_code,
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
                    'fund_code': fund_code,
                    'date': datetime.strptime(item['FSRQ'], '%Y-%m-%d').date(),
                    'unit_net_value': float(item['DWJZ']),
                    'accumulated_net_value': float(item['LJJZ']) if item['LJJZ'] else None,
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


def crawl_missing_net_values():
    # 查询所有基金的最近一条净值记录
    # 先找到每个fund_code的最大date
    subquery = db.session.query(
        NetValue.fund_code,
        func.max(NetValue.date).label('max_date')
    ).group_by(NetValue.fund_code).subquery()

    # 然后关联查询获取完整记录
    results = db.session.query(NetValue).join(
        subquery,
        db.and_(
            NetValue.fund_code == subquery.c.fund_code,
            NetValue.date == subquery.c.max_date
        )
    ).all()

    yesterday = datetime.now() - timedelta(days=1)
    yesterday_str = yesterday.strftime('%Y-%m-%d')

    total_inserted = 0
    errors = []

    for item in results:
        if item.date < yesterday_str:
            try:
                data = crawl_fund_history(item.fund_code, item.date, yesterday_str)
                if data:
                    save_net_values_to_db(data, item.fund_code, item.date, yesterday_str)
                    total_inserted += len(data)
                time.sleep(0.5)
            except Exception as e:
                db.session.rollback()
                errors.append(f"{item.fund_code}: {e}")

    # print(f"inserted: {total_inserted}, 'errors': {errors}")
    current_app.logger.info(f"crawl_missing_net_values：inserted: {total_inserted}, 'errors': {errors}")
    return {'inserted': total_inserted, 'errors': errors}


@net_values_bp.route('/crawl_all', methods=['POST'])
def crawl_all_funds():
    result = crawl_missing_net_values()  # 纯函数
    if result['errors']:
        return Response.error(code=500, message='; '.join(result['errors']))
    return Response.success(message=f"成功新增 {result['inserted']} 条历史净值")
