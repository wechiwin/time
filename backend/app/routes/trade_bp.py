from io import BytesIO

import pandas as pd
from app.framework.exceptions import BizException
from app.models import db, Trade, Holding
from app.schemas_marshall import TradeSchema, marshal_pagination
from flask import Blueprint, request, send_file
from sqlalchemy import desc

trade_bp = Blueprint('trade', __name__, url_prefix='/api/trade')


@trade_bp.route('', methods=['GET'])
def get_trade():
    ho_code = request.args.get('ho_code')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    # 添加分页参数
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    query = db.session.query(Trade, Holding.ho_short_name).outerjoin(
        Holding, Trade.ho_code == Holding.ho_code
    )
    if ho_code:
        query = query.filter_by(ho_code=ho_code)
    if start_date:
        query = query.filter(Trade.tr_date >= start_date)
    if end_date:
        query = query.filter(Trade.tr_date <= end_date)

    # 使用分页查询
    pagination = query.order_by(desc(Trade.tr_date)).paginate(
        page=page, per_page=per_page, error_out=False
    )
    transactions = pagination.items or []
    data = [{
        'tr_id': t.tr_id,
        'ho_code': t.ho_code,
        'ho_short_name': ho_short_name,
        'tr_type': t.tr_type,
        'tr_date': t.tr_date,
        'tr_nav_per_unit': t.tr_nav_per_unit,
        'tr_shares': t.tr_shares,
        'tr_fee': t.tr_fee,
        'tr_amount': t.tr_amount
    } for t, ho_short_name in transactions]
    # 返回分页信息
    return {
        'items': data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }


@trade_bp.route('', methods=['POST'])
def create_transaction():
    data = request.get_json()
    required_fields = ['ho_code', 'tr_type', 'tr_date', 'tr_net_value',
                       'tr_shares', 'tr_fee', 'tr_amount']
    if not all(field in data for field in required_fields):
        raise BizException(message="缺少必要字段")
    new_transaction = TradeSchema().load(data)
    db.session.add(new_transaction)
    db.session.commit()
    return ''


@trade_bp.route('/<int:tr_id>', methods=['GET'])
def get_transaction(tr_id):
    t = Trade.query.get_or_404(tr_id)
    return TradeSchema().dump(t)


@trade_bp.route('/<int:tr_id>', methods=['PUT'])
def update_transaction(tr_id):
    t = Trade.query.get_or_404(tr_id)
    data = request.get_json()
    updated_data = TradeSchema().load(data, instance=t, partial=True)

    db.session.add(updated_data)
    db.session.commit()
    return ''


@trade_bp.route('/<int:tr_id>', methods=['DELETE'])
def delete_transaction(tr_id):
    t = Trade.query.get_or_404(tr_id)
    db.session.delete(t)
    db.session.commit()
    return ''


@trade_bp.route('/export', methods=['GET'])
def export_trade():
    trade = Trade.query.all()
    df = pd.DataFrame([{
        '基金代码': t.ho_code,
        '交易类型': t.tr_type,
        '交易日期': t.tr_date,
        '交易净值': t.tr_net_value,
        '交易份数': t.tr_shares,
        '交易费用': t.tr_fee,
        '交易金额': t.tr_amount
    } for t in trade])

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


@trade_bp.route('/template', methods=['GET'])
def download_template():
    # 创建一个空的DataFrame，只有列名
    df = pd.DataFrame(columns=[
        '基金代码',
        '交易类型',
        '交易日期',
        '交易净值',
        '交易份数',
        '交易费用',
        '交易金额',
    ])

    # 添加示例数据（使用concat替代append）
    example_data = pd.DataFrame([{
        '基金代码': '示例代码',
        '交易类型': '买入',
        '交易日期': '2023-01-01',
        '交易净值': 1.0,
        '交易份数': 100,
        '交易费用': 0.1,
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


@trade_bp.route('/import', methods=['POST'])
def import_trade():
    if 'file' not in request.files:
        raise BizException(message="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        raise BizException(message="没有选择文件")

    try:
        df = pd.read_excel(file, dtype={'基金代码': str})
        required_columns = ['基金代码',
                            '交易类型',
                            '交易日期',
                            '交易净值',
                            '交易份数',
                            '交易费用',
                            '交易金额', ]
        if not all(col in df.columns for col in required_columns):
            raise BizException(message="Excel缺少必要列")

        # 检查ho_code是否存在
        ho_codes = df['基金代码'].unique()
        existing_holdings = Holding.query.filter(Holding.ho_code.in_(ho_codes)).all()
        existing_codes = {h.ho_code for h in existing_holdings}

        missing_codes = set(ho_codes) - existing_codes
        if missing_codes:
            raise BizException(
                code=400,
                message=f"以下基金代码不存在于持仓表中: {', '.join(map(str, missing_codes))}"
            )

        # 转换日期列为字符串格式
        df['交易日期'] = df['交易日期'].dt.strftime('%Y-%m-%d')  # 处理Timestamp类型

        # 转换数值列为float（防止整数被识别为其他类型）
        numeric_cols = ['交易净值', '交易份数', '交易费用', '交易金额']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # 开始事务
        # db.session.begin()
        for _, row in df.iterrows():
            transaction = Trade(
                ho_code=str(row['基金代码']),  # 确保是字符串
                tr_type=str(row['交易类型']),
                tr_date=str(row['交易日期']),  # 已转换为字符串
                tr_nav_per_unit=float(row['交易净值']),
                tr_shares=float(row['交易份数']),
                tr_fee=float(row['交易费用']),
                tr_amount=float(row['交易金额'])
            )
            db.session.add(transaction)

        db.session.commit()
        return ''
    except Exception as e:
        db.session.rollback()
        error_message = str(e)
    raise BizException(message=f"导入失败: {error_message}")


@trade_bp.route('/list_by_code/ho_code=<ho_code>', methods=['GET'])
def list_by_code(ho_code):
    if not ho_code or not ho_code.strip():
        return ''

    result_list = Trade.query.filter_by(ho_code=ho_code).all()
    return TradeSchema(many=True).dump(result_list)
