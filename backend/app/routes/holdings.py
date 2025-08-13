from io import BytesIO

import pandas as pd
from app.framework.response import Response
from app.models import db, Holding
from flask import Blueprint, request, send_file
from sqlalchemy import or_

holdings_bp = Blueprint('holdings', __name__, url_prefix='/api/holdings')


@holdings_bp.route('', methods=['GET'])
def get_holdings():
    fund_code = request.args.get('fund_code')
    fund_name = request.args.get('fund_name')
    fund_type = request.args.get('fund_type')

    query = Holding.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    if fund_name:
        query = query.filter_by(fund_name=fund_name)
    if fund_type:
        query = query.filter_by(fund_type=fund_code)

    holdings = query.all() or []
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
    return Response.success()


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
    return Response.success()


@holdings_bp.route('/<int:id>', methods=['DELETE'])
def delete_holding(id):
    h = Holding.query.get_or_404(id)
    db.session.delete(h)
    db.session.commit()
    return Response.success()


@holdings_bp.route('/search', methods=['GET'])
def search_holdings():
    """
    基金模糊搜索API
    参数:
        q: 搜索关键词(基金代码或名称)
        limit: 返回结果数量(默认10)
    """
    search_term = request.args.get('keyword', '').strip()
    limit = min(int(request.args.get('limit', 10)), 50)  # 限制最大返回50条

    # if not search_term:
    #     return Response.success(data=[])

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


@holdings_bp.route('/export', methods=['GET'])
def export_holdings():
    holdings = Holding.query.all()
    df = pd.DataFrame([{
        '基金代码': t.fund_code,
        '基金名称': t.fund_name,
        '基金类型': t.fund_type,
    } for t in holdings])

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


@holdings_bp.route('/template', methods=['GET'])
def download_template():
    # 创建一个空的DataFrame，只有列名
    df = pd.DataFrame(columns=[
        '基金代码',
        '基金名称',
        '基金类型',
    ])

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='基金导入模板')

        # 添加数据验证（可选）
        workbook = writer.book
        worksheet = writer.sheets['基金导入模板']

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='FundImportTemplate.xlsx'
    )


@holdings_bp.route('/import', methods=['POST'])
def import_holdings():
    if 'file' not in request.files:
        return Response.error(code=400, message="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        return Response.error(code=400, message="没有选择文件")

    try:
        df = pd.read_excel(file, dtype={'基金代码': str})
        required_columns = ['基金代码',
                            '基金名称',
                            '基金类型']
        if not all(col in df.columns for col in required_columns):
            return Response.error(code=400, message="Excel缺少必要列")

        # 检查fund_code是否存在
        fund_codes = df['基金代码'].unique()
        existing_holdings = Holding.query.filter(Holding.fund_code.in_(fund_codes)).all()
        existing_codes = {h.fund_code for h in existing_holdings}
        if existing_codes:
            return Response.error(
                code=400,
                message=f"以下基金已存在: {', '.join(map(str, existing_codes))}"
            )

        # 开始事务
        # db.session.begin()
        for _, row in df.iterrows():
            holding = Holding(
                fund_code=str(row['基金代码']),
                fund_name=str(row['基金名称']),
                fund_type=str(row['基金类型']),
            )
            db.session.add(holding)

        db.session.commit()
        return Response.success(message=f"成功导入 {len(df)} 条记录")
    except Exception as e:
        db.session.rollback()
        error_message = str(e)
    return Response.error(code=500, message=f"导入失败: {error_message}")
