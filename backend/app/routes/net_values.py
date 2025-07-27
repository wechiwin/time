from app.framework.response import Response
from app.models import db, NetValue
from flask import Blueprint, request

net_values_bp = Blueprint('net_values', __name__, url_prefix='/api/net_values')


@net_values_bp.route('', methods=['GET'])
def get_net_values():
    fund_code = request.args.get('fund_code')
    query = NetValue.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    net_values = query.order_by(NetValue.date).all() or []
    data = [{
        'id': nv.id,
        'fund_code': nv.fund_code,
        'date': nv.date,
        'unit_net_value': nv.unit_net_value,
        'accumulated_net_value': nv.accumulated_net_value
    } for nv in net_values]
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
