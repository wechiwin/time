from app.framework.response import Response
from app.models import db, Holding
from flask import Blueprint, request
from sqlalchemy import or_

holdings_bp = Blueprint('holdings', __name__, url_prefix='/api/holdings')


@holdings_bp.route('', methods=['GET'])
def get_holdings():
    holdings = Holding.query.all() or []
    data = [{
        'id': h.id,
        'fund_name': h.fund_name,
        'fund_code': h.fund_code,
        'fund_type': h.fund_type
    } for h in holdings]
    return Response.success(data=data)


@holdings_bp.route('', methods=['POST'])
def create_holding():
    data = request.get_json()
    if not data.get('fund_name') or not data.get('fund_code'):
        return Response.error(code=400, message="缺少必要字段")

        # 检查基金代码是否已存在
    if Holding.query.filter_by(fund_code=data['fund_code']).first():
        return Response.error(code=400, message="基金代码已存在")

    new_holding = Holding(
        fund_name=data['fund_name'],
        fund_code=data['fund_code'],
        fund_type=data.get('fund_type', '')
    )
    db.session.add(new_holding)
    db.session.commit()
    return Response.success(message="持仓添加成功")


@holdings_bp.route('/<int:id>', methods=['GET'])
def get_holding(id):
    h = Holding.query.get_or_404(id)
    data = {
        'id': h.id,
        'fund_name': h.fund_name,
        'fund_code': h.fund_code,
        'fund_type': h.fund_type
    }
    return Response.success(data=data)


@holdings_bp.route('/<int:id>', methods=['PUT'])
def update_holding(id):
    h = Holding.query.get_or_404(id)
    data = request.get_json()
    # 检查基金代码是否与其他记录冲突
    if 'fund_code' in data and data['fund_code'] != h.fund_code:
        if Holding.query.filter(Holding.fund_code == data['fund_code'], Holding.id != id).first():
            return Response.error(code=400, message="基金代码已存在")

    h.fund_name = data.get('fund_name', h.fund_name)
    h.fund_code = data.get('fund_code', h.fund_code)
    h.fund_type = data.get('fund_type', h.fund_type)
    db.session.commit()
    return Response.success(message="持仓更新成功")


@holdings_bp.route('/<int:id>', methods=['DELETE'])
def delete_holding(id):
    h = Holding.query.get_or_404(id)
    db.session.delete(h)
    db.session.commit()
    return Response.success(message="持仓删除成功")


@holdings_bp.route('/search', methods=['GET'])
def search_holdings():
    """
    基金模糊搜索API
    参数:
        q: 搜索关键词(基金代码或名称)
        limit: 返回结果数量(默认10)
    """
    search_term = request.args.get('q', '').strip()
    limit = min(int(request.args.get('limit', 10)), 50)  # 限制最大返回50条

    if not search_term:
        return Response.error(code=400, message="请输入搜索关键词")

    # 执行模糊查询
    holdings = Holding.query.filter(
        or_(
            Holding.fund_code.ilike(f'%{search_term}%'),
            Holding.fund_name.ilike(f'%{search_term}%')
        )
    ).limit(limit).all()

    results = [{
        'id': h.id,
        'fund_code': h.fund_code,
        'fund_name': h.fund_name,
        'fund_type': h.fund_type
    } for h in holdings]

    return Response.success(data=results)
