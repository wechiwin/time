from io import BytesIO

import pandas as pd
import requests
from app.framework.exceptions import BizException
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, Holding
from app.schemas import HoldingSchema
# from app.schemas import FundBase
from app.service.net_value_service import NetValueService
from app.service.transaction_service import TransactionService
from flask import Blueprint, request, send_file
from sqlalchemy import or_

holdings_bp = Blueprint('holdings', __name__, url_prefix='/api/holdings')


@holdings_bp.route('/search_list', methods=['GET'])
def search_list():
    """
    参数:
        keyword: 搜索关键词(基金代码或名称)
    """
    keyword = request.args.get('keyword', '').strip()

    from urllib.parse import unquote
    keyword = unquote(keyword)

    query = Holding.query

    # 执行模糊查询
    holdings = Holding.query.filter(
        or_(
            Holding.fund_code.ilike(f'%{keyword}%'),
            Holding.fund_name.ilike(f'%{keyword}%')
        )
    ).all()

    results = [{
        'id': h.id,
        'fund_code': h.fund_code,
        'fund_name': h.fund_name,
        'fund_type': h.fund_type
    } for h in holdings]

    return results


@holdings_bp.route('search_page', methods=['GET'])
def search_page():
    """
    基金模糊搜索API
    参数:
    keyword: 搜索关键词(基金代码或名称)
    page: 页码(默认1)
    per_page: 每页数量(默认10)
    """
    fund_code = request.args.get('fund_code')
    fund_name = request.args.get('fund_name')
    fund_type = request.args.get('fund_type')
    keyword = request.args.get('keyword')

    # 添加分页参数
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    query = Holding.query
    if fund_code:
        query = query.filter_by(fund_code=fund_code)
    if fund_name:
        query = query.filter_by(fund_name=fund_name)
    if fund_type:
        query = query.filter_by(fund_type=fund_type)
    if keyword:
        query = query.filter(
            or_(
                Holding.fund_code.ilike(f'%{keyword}%'),
                Holding.fund_name.ilike(f'%{keyword}%')
            )
        )

    # 使用分页查询
    pagination = query.paginate(
        page=page, per_page=per_page, error_out=False
    )

    holdings = pagination.items or []
    data = [{
        'id': h.id,
        'fund_name': h.fund_name,
        'fund_code': h.fund_code,
        'fund_type': h.fund_type
    } for h in holdings]

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


@holdings_bp.route('', methods=['POST'])
def create_holding():
    data = request.get_json()
    if not data.get('fund_name') or not data.get('fund_code'):
        raise BizException(code=400, msg="缺少必要字段")

    # 检查基金代码是否已存在
    if Holding.query.filter_by(fund_code=data['fund_code']).first():
        raise BizException(code=400, msg="基金代码已存在")

    new_holding = Holding(
        fund_name=data['fund_name'],
        fund_code=data['fund_code'],
        fund_type=data.get('fund_type', '')
    )
    db.session.add(new_holding)
    db.session.commit()
    return None


@holdings_bp.route('/<int:id>', methods=['GET'])
def get_holding(id):
    h = Holding.query.get_or_404(id)
    # fund_code = h.fund_code
    # net_val_list = NetValueService.search_list(fund_code)
    # transaction_list = TransactionService.list_transaction(fund_code)
    data = {
        'id': h.id,
        'fund_name': h.fund_name,
        'fund_code': h.fund_code,
        'fund_type': h.fund_type,
        # 'net_value_list': net_val_list,
        # 'transaction_list': transaction_list
    }
    return data


@holdings_bp.route('/<id>', methods=['PUT'])
def update_holding(id):
    h = Holding.query.get_or_404(id)
    data = request.get_json()
    # 检查基金代码是否与其他记录冲突
    if 'fund_code' in data and data['fund_code'] != h.fund_code:
        if Holding.query.filter(Holding.fund_code == data['fund_code'], Holding.id != id).first():
            raise BizException(code=400, msg="基金代码已存在")

    h.fund_name = data.get('fund_name', h.fund_name)
    h.fund_code = data.get('fund_code', h.fund_code)
    h.fund_type = data.get('fund_type', h.fund_type)
    db.session.commit()
    return None


@holdings_bp.route('/<id>', methods=['DELETE'])
def delete_holding(id):
    h = Holding.query.get_or_404(id)
    db.session.delete(h)
    db.session.commit()
    return None


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
        raise BizException(code=400, msg="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        raise BizException(code=400, msg="没有选择文件")

    try:
        df = pd.read_excel(file, dtype={'基金代码': str})
        required_columns = ['基金代码',
                            '基金名称',
                            '基金类型']
        if not all(col in df.columns for col in required_columns):
            raise BizException(code=400, msg="Excel缺少必要列")

        # 检查fund_code是否存在
        fund_codes = df['基金代码'].unique()
        existing_holdings = Holding.query.filter(Holding.fund_code.in_(fund_codes)).all()
        existing_codes = {h.fund_code for h in existing_holdings}
        if existing_codes:
            raise BizException(
                code=400,
                msg=f"以下基金已存在: {', '.join(map(str, existing_codes))}"
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
        return None
    except Exception as e:
        db.session.rollback()
        error_message = str(e)
    raise BizException(code=500, msg=f"导入失败: {error_message}")


@holdings_bp.route('/crawl', methods=['POST'])
def get_fund_info():
    fund_code = request.form.get('fund_code')  # 表单
    # url = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo"
    url_api = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation"
    params = {
        "FCODE": fund_code,
        "deviceid": "pc",
        "plat": "web",
        "product": "EFund",
        "version": "2.0.0"
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": f"http://fund.eastmoney.com/{fund_code}.html"
    }
    resp = requests.get(url_api, params=params, headers=headers)
    print("接口返回内容：", resp.json())
    data = resp.json().get("Datas", {})
    if not data:
        raise BizException(msg="未爬取到相关信息")
    return {
        "fund_code": data.get("FCODE"),
        "fund_name": data.get("SHORTNAME"),
        "fund_type": data.get("FTYPE"),
        "company": data.get("JJGS"),
        "establish_date": data.get("CLRQ"),
        "latest_net_value": data.get("ENDNAV"),
        "risk_level": data.get("RISKLEVEL"),
    }


@holdings_bp.route('/fund_code=<fund_code>', methods=['GET'])
def get_by_code(fund_code):
    if not fund_code or not fund_code.strip():
        return None

    h = Holding.query.filter_by(fund_code=fund_code).first()
    return HoldingSchema().dump(h)
    # return FundBase.from_orm(h).dict()
