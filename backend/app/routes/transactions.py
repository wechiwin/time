from app.framework.response import Response
from app.models import db, Transaction
from flask import Blueprint, request

transactions_bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')


@transactions_bp.route('', methods=['GET'])
def get_transactions():
    fund_code = request.args.get('fund_code')
    query = Transaction.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    transactions = query.all() or []
    data = [{
        'id': t.id,
        'fund_code': t.fund_code,
        'transaction_type': t.transaction_type,
        'transaction_date': t.transaction_date,
        'transaction_net_value': t.transaction_net_value,
        'transaction_shares': t.transaction_shares,
        'transaction_fee': t.transaction_fee
    } for t in transactions]
    return Response.success(data=data)


@transactions_bp.route('', methods=['POST'])
def create_transaction():
    data = request.get_json()
    required_fields = ['fund_code', 'transaction_type', 'transaction_date', 'transaction_net_value',
                       'transaction_shares', 'transaction_fee']
    if not all(field in data for field in required_fields):
        return Response.error(code=400, message="缺少必要字段")
    new_transaction = Transaction(**data)
    db.session.add(new_transaction)
    db.session.commit()
    return Response.error(code=400, message="缺少必要字段")
    # return Response.success(message="交易添加成功")


@transactions_bp.route('/<int:id>', methods=['GET'])
def get_transaction(id):
    t = Transaction.query.get_or_404(id)
    data = {
        'id': t.id,
        'fund_code': t.fund_code,
        'transaction_type': t.transaction_type,
        'transaction_date': t.transaction_date,
        'transaction_net_value': t.transaction_net_value,
        'transaction_shares': t.transaction_shares,
        'transaction_fee': t.transaction_fee
    }
    return Response.success(data=data)


@transactions_bp.route('/<int:id>', methods=['PUT'])
def update_transaction(id):
    t = Transaction.query.get_or_404(id)
    data = request.get_json()
    t.fund_code = data.get('fund_code', t.fund_code)
    t.transaction_type = data.get('transaction_type', t.transaction_type)
    t.transaction_date = data.get('transaction_date', t.transaction_date)
    t.transaction_net_value = data.get('transaction_net_value', t.transaction_net_value)
    t.transaction_shares = data.get('transaction_shares', t.transaction_shares)
    t.transaction_fee = data.get('transaction_fee', t.transaction_fee)
    db.session.commit()
    return Response.success(message="交易更新成功")


@transactions_bp.route('/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    t = Transaction.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return Response.success(message="交易删除成功")
