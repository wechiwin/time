from app.framework.response import Response
from app.models import db, Transaction, Holding
from flask import Blueprint, request, send_file
import pandas as pd
from io import BytesIO

from sqlalchemy import desc

transactions_bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')


@transactions_bp.route('', methods=['GET'])
def get_transactions():
    fund_code = request.args.get('fund_code')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    # 添加分页参数
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = db.session.query(Transaction, Holding.fund_name).outerjoin(
        Holding, Transaction.fund_code == Holding.fund_code
    )
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    # 使用分页查询
    pagination = query.order_by(desc(Transaction.transaction_date)).paginate(
        page=page, per_page=per_page, error_out=False
    )
    transactions = pagination.items or []
    data = [{
        'id': t.id,
        'fund_code': t.fund_code,
        'fund_name': fund_name,
        'transaction_type': t.transaction_type,
        'transaction_date': t.transaction_date,
        'transaction_net_value': t.transaction_net_value,
        'transaction_shares': t.transaction_shares,
        'transaction_fee': t.transaction_fee,
        'transaction_amount': t.transaction_amount
    } for t, fund_name in transactions]
    # 返回分页信息
    return Response.success(data={
        'items': data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@transactions_bp.route('', methods=['POST'])
def create_transaction():
    data = request.get_json()
    required_fields = ['fund_code', 'transaction_type', 'transaction_date', 'transaction_net_value',
                       'transaction_shares', 'transaction_fee', 'transaction_amount']
    if not all(field in data for field in required_fields):
        return Response.error(code=400, message="缺少必要字段")
    new_transaction = Transaction(**data)
    db.session.add(new_transaction)
    db.session.commit()
    # return Response.error(code=400, message="缺少必要字段")
    return Response.success(message="交易添加成功")


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
        'transaction_fee': t.transaction_fee,
        'transaction_amount': t.transaction_amount
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
    t.transaction_amount = data.get('transaction_amount', t.transaction_amount)
    db.session.commit()
    return Response.success(message="交易更新成功")


@transactions_bp.route('/<int:id>', methods=['DELETE'])
def delete_transaction(id):
    t = Transaction.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return Response.success(message="交易删除成功")


@transactions_bp.route('/export', methods=['GET'])
def export_transactions():
    transactions = Transaction.query.all()
    df = pd.DataFrame([{
        '基金代码': t.fund_code,
        '交易类型': t.transaction_type,
        '交易日期': t.transaction_date,
        '交易净值': t.transaction_net_value,
        '交易份数': t.transaction_shares,
        '手续费': t.transaction_fee,
        '交易金额': t.transaction_amount
    } for t in transactions])

    output = BytesIO()
    writer = pd.ExcelWriter(output, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name='交易记录')
    writer.close()
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='tradeLog.xlsx'
    )


@transactions_bp.route('/template', methods=['GET'])
def download_template():
    # 创建一个空的DataFrame，只有列名
    df = pd.DataFrame(columns=[
        '基金代码',
        '交易类型',
        '交易日期',
        '交易净值',
        '交易份数',
        '手续费',
        '交易金额',
    ])

    # 添加示例数据（使用concat替代append）
    example_data = pd.DataFrame([{
        '基金代码': '示例代码',
        '交易类型': '买入',
        '交易日期': '2023-01-01',
        '交易净值': 1.0,
        '交易份数': 100,
        '手续费': 0.1,
        '交易金额': 100.1
    }])

    df = pd.concat([df, example_data], ignore_index=True)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='交易记录模板')

        # 添加数据验证（可选）
        workbook = writer.book
        worksheet = writer.sheets['交易记录模板']

        # 为交易类型列添加下拉验证
        worksheet.data_validation('B2:B100', {
            'validate': 'list',
            'source': ['买入', '卖出']
        })

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='TradeImportTemplate.xlsx'
    )


@transactions_bp.route('/import', methods=['POST'])
def import_transactions():
    if 'file' not in request.files:
        return Response.error(code=400, message="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        return Response.error(code=400, message="没有选择文件")

    try:
        df = pd.read_excel(file, dtype={'基金代码': str})
        required_columns = ['基金代码', '交易类型', '交易日期', '交易净值', '交易份数', '手续费', '交易金额']
        if not all(col in df.columns for col in required_columns):
            return Response.error(code=400, message="Excel缺少必要列")

        # 检查fund_code是否存在
        fund_codes = df['基金代码'].unique()
        existing_holdings = Holding.query.filter(Holding.fund_code.in_(fund_codes)).all()
        existing_codes = {h.fund_code for h in existing_holdings}

        missing_codes = set(fund_codes) - existing_codes
        if missing_codes:
            return Response.error(
                code=400,
                message=f"以下基金代码不存在于持仓表中: {', '.join(map(str, missing_codes))}"
            )

        # 转换日期列为字符串格式
        df['交易日期'] = df['交易日期'].dt.strftime('%Y-%m-%d')  # 处理Timestamp类型

        # 转换数值列为float（防止整数被识别为其他类型）
        numeric_cols = ['交易净值', '交易份数', '手续费', '交易金额']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # 开始事务
        # db.session.begin()
        for _, row in df.iterrows():
            transaction = Transaction(
                fund_code=str(row['基金代码']),  # 确保是字符串
                transaction_type=str(row['交易类型']),
                transaction_date=str(row['交易日期']),  # 已转换为字符串
                transaction_net_value=float(row['交易净值']),
                transaction_shares=float(row['交易份数']),
                transaction_fee=float(row['手续费']),
                transaction_amount=float(row['交易金额'])
            )
            db.session.add(transaction)

        db.session.commit()
        return Response.success(message=f"成功导入 {len(df)} 条交易记录")
    except Exception as e:
        db.session.rollback()
        error_message = str(e)
    return Response.error(code=500, message=f"导入失败: {error_message}")
