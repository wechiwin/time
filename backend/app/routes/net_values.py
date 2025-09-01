from app.framework.response import Response
from app.models import db, NetValue, Holding
from flask import Blueprint, request
import requests
from datetime import datetime
import time

net_values_bp = Blueprint('net_values', __name__, url_prefix='/api/net_values')


@net_values_bp.route('', methods=['GET'])
def get_net_values():
    fund_code = request.args.get('fund_code')

    # 基础查询：左连接 Holding 表
    query = db.session.query(NetValue, Holding.fund_name).outerjoin(
        Holding, NetValue.fund_code == Holding.fund_code
    )

    # query = NetValue.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    results = query.order_by(NetValue.date).all() or []
    data = [{
        'id': nv.id,
        'fund_code': nv.fund_code,
        'fund_name': fund_name,
        'date': nv.date,
        'unit_net_value': nv.unit_net_value,
        'accumulated_net_value': nv.accumulated_net_value
    } for nv, fund_name in results]
    return Response.success(data=data)


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
    fund_code = request.form.get("fund_code")
    start_date = request.form.get("start_date")
    end_date = request.form.get("end_date")
    if not fund_code:
        return Response.error(code=400, message="缺少基金代码")

    try:
        data = crawl_fund_history(fund_code,start_date,end_date)
        if not data:
            return Response.error(message="未获取到数据")

        save_net_values_to_db(data)
        return Response.success(message=f"成功新增 {len(data)} 条历史净值")
    except Exception as e:
        db.session.rollback()
        return Response.error(code=500, message=f"爬取失败: {e}")


def save_net_values_to_db(data_list):
    """
    将爬取的数据存入数据库，避免重复插入
    """
    for item in data_list:
        # 检查是否已存在该基金+日期的记录
        exists = NetValue.query.filter_by(fund_code=item['fund_code'], date=item['date']).first()
        if not exists:
            nv = NetValue(
                fund_code=item['fund_code'],
                date=item['date'],
                unit_net_value=item['unit_net_value'],
                accumulated_net_value=item['accumulated_net_value']
            )
            db.session.add(nv)
        else:
            # 可选：更新现有记录
            # exists.unit_net_value = item['unit_net_value']
            # exists.accumulated_net_value = item['accumulated_net_value']
            pass

    try:
        db.session.commit()
        print(f"成功保存 {len(data_list)} 条净值数据")
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
