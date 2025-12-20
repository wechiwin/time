from io import BytesIO

import pandas as pd
import requests
from flask import Blueprint, request, send_file
from flask_babel import gettext
from sqlalchemy import or_

from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, Holding
from app.schemas_marshall import HoldingSchema, marshal_pagination

holding_bp = Blueprint('holding', __name__, url_prefix='/api/holding')


@holding_bp.route('/search_list', methods=['GET'])
@auth_required
def search_list():
    """
    参数:
        keyword: 搜索关键词(基金代码或名称)
    """
    keyword = request.args.get('keyword', '').strip()

    from urllib.parse import unquote
    keyword = unquote(keyword)

    # query = Holding.query

    # 执行模糊查询
    holdings = Holding.query.filter(
        or_(
            Holding.ho_code.ilike(f'%{keyword}%'),
            Holding.ho_name.ilike(f'%{keyword}%')
        )
    ).all()

    return HoldingSchema(many=True).dump(holdings)


@holding_bp.route('search_page', methods=['GET'])
@auth_required
def search_page():
    """
    基金模糊搜索API
    参数:
    keyword: 搜索关键词(基金代码或名称)
    page: 页码(默认1)
    per_page: 每页数量(默认10)
    """
    ho_code = request.args.get('ho_code')
    ho_name = request.args.get('ho_name')
    ho_type = request.args.get('ho_type')
    keyword = request.args.get('keyword')

    # 添加分页参数
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    query = Holding.query
    if ho_code:
        query = query.filter_by(ho_code=ho_code)
    if ho_name:
        query = query.filter_by(ho_name=ho_name)
    if ho_type:
        query = query.filter_by(ho_type=ho_type)
    if keyword:
        query = query.filter(
            or_(
                Holding.ho_code.ilike(f'%{keyword}%'),
                Holding.ho_name.ilike(f'%{keyword}%')
            )
        )

    # 使用分页查询
    pagination = query.paginate(
        page=page, per_page=per_page, error_out=False
    )

    return marshal_pagination(pagination, HoldingSchema)


@holding_bp.route('', methods=['POST'])
@auth_required
def create_holding():
    data = request.get_json()
    if not data.get('ho_name') or not data.get('ho_code'):
        raise BizException(msg="缺少必要字段")

    # 检查基金代码是否已存在
    if Holding.query.filter_by(ho_code=data['ho_code']).first():
        raise BizException(msg="基金代码已存在")

    try:
        # new_holding = Holding(
        #     ho_name=data['ho_name'],
        #     ho_code=data['ho_code'],
        #     ho_type=data.get('ho_type', ''),
        #     ho_establish_date=datetime.strptime(data.get('ho_establish_date'), '%Y-%m-%d').date()
        # )
        new_holding = HoldingSchema().load(data)  # 注意：这里不传 instance，因为是新建
        db.session.add(new_holding)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        raise BizException(msg=str(e))
    return ''


@holding_bp.route('/<int:ho_id>', methods=['GET'])
@auth_required
def get_holding(ho_id):
    h = Holding.query.get_or_404(ho_id)
    # ho_code = h.ho_code
    # net_val_list = NetValueService.search_list(ho_code)
    # transaction_list = TransactionService.list_transaction(ho_code)
    return HoldingSchema().dump(h)


@holding_bp.route('/<int:ho_id>', methods=['PUT'])
@auth_required
def update_holding(ho_id):
    h = Holding.query.get_or_404(ho_id)
    data = request.get_json()
    # 检查基金代码是否与数据库一致
    if 'ho_code' in data and data['ho_code'] != h.ho_code:
        raise BizException(msg="基金代码非法")

    updated_data = HoldingSchema().load(data, instance=h, partial=True)

    db.session.add(updated_data)
    db.session.commit()

    return ''


@holding_bp.route('/<ho_id>', methods=['DELETE'])
@auth_required
def delete_holding(ho_id):
    h = Holding.query.get_or_404(ho_id)
    db.session.delete(h)
    db.session.commit()
    return ''


@holding_bp.route('/export', methods=['GET'])
@auth_required
def export_holdings():
    holdings = Holding.query.all()
    df = pd.DataFrame([{
        gettext('COL_HO_CODE'): t.ho_code,
        gettext('COL_HO_NAME'): t.ho_name,
        gettext('COL_HO_TYPE'): t.ho_type,
        gettext('COL_HO_ESTABLISH_DATE'): t.ho_establish_date,
        gettext('COL_HO_SHORT_NAME'): t.ho_short_name,
        gettext('COL_HO_MANAGE_EXP_RATE'): t.ho_manage_exp_rate,
        gettext('COL_HO_TRUSTEE_EXP_RATE'): t.ho_trustee_exp_rate,
        gettext('COL_HO_SALES_EXP_RATE'): t.ho_sales_exp_rate,
        gettext('COL_HO_STATUS'): t.ho_status,
    } for t in holdings])

    output = BytesIO()
    writer = pd.ExcelWriter(output, engine='xlsxwriter')
    df.to_excel(writer, index=False, sheet_name=gettext('HO_LOG'))
    writer.close()
    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=(gettext('HO_LOG') + '.xlsx')
    )


@holding_bp.route('/template', methods=['GET'])
@auth_required
def download_template():
    # 创建一个空的DataFrame，只有列名
    df = pd.DataFrame(columns=[
        gettext('COL_HO_CODE'),
        gettext('COL_HO_NAME'),
        gettext('COL_HO_TYPE'),
        gettext('COL_HO_ESTABLISH_DATE'),
        gettext('COL_HO_SHORT_NAME'),
        gettext('COL_HO_MANAGE_EXP_RATE'),
        gettext('COL_HO_TRUSTEE_EXP_RATE'),
        gettext('COL_HO_SALES_EXP_RATE'),
        gettext('COL_HO_STATUS'),
    ])

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name=gettext('TEMPLATE_HO_IMPORT'))

        # 添加数据验证（可选）
        workbook = writer.book
        worksheet = writer.sheets[gettext('TEMPLATE_HO_IMPORT')]

    output.seek(0)

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='FundImportTemplate.xlsx'
    )


@holding_bp.route('/import', methods=['POST'])
@auth_required
def import_holdings():
    if 'file' not in request.files:
        raise BizException(msg="没有上传文件")

    file = request.files['file']
    if file.filename == '':
        raise BizException(msg="没有选择文件")

    try:
        df = pd.read_excel(file, dtype={gettext('COL_HO_CODE'): str})
        required_columns = [
            gettext('COL_HO_CODE'),
            gettext('COL_HO_NAME'),
            gettext('COL_HO_TYPE'),
            gettext('COL_HO_ESTABLISH_DATE'),
        ]
        if not all(col in df.columns for col in required_columns):
            raise BizException(msg="Excel缺少必要列")

        # 检查ho_code是否存在
        ho_codes = df[gettext('COL_HO_CODE')].unique()
        existing_holdings = Holding.query.filter(Holding.ho_code.in_(ho_codes)).all()
        existing_codes = {h.ho_code for h in existing_holdings}
        if existing_codes:
            raise BizException(
                msg=f"以下基金已存在: {', '.join(map(str, existing_codes))}"
            )

        # 开始事务
        # db.session.begin()
        for _, row in df.iterrows():
            holding = Holding(
                ho_code=str(row[gettext('COL_HO_CODE')]),
                ho_name=str(row[gettext('COL_HO_NAME')]),
                ho_type=str(row[gettext('COL_HO_TYPE')]),
                ho_establish_date=str(row[gettext('COL_HO_ESTABLISH_DATE')]),
                ho_short_name=str(row[gettext('COL_HO_SHORT_NAME'),]),
                ho_manage_exp_rate=str(row[gettext('COL_HO_MANAGE_EXP_RATE'),]),
                ho_trustee_exp_rate=str(row[gettext('COL_HO_TRUSTEE_EXP_RATE'),]),
                ho_sales_exp_rate=str(row[gettext('COL_HO_SALES_EXP_RATE'),]),
                ho_status=str(row[gettext('COL_HO_STATUS'),]),
            )
            db.session.add(holding)

        db.session.commit()
        return ''
    except Exception as e:
        db.session.rollback()
        error_message = str(e)
    raise BizException(code=500, msg=f"导入失败: {error_message}")


@holding_bp.route('/crawl', methods=['POST'])
@auth_required
def get_fund_info():
    ho_code = request.form.get('ho_code')  # 表单
    # url = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo"
    url_api = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation"
    params = {
        "FCODE": ho_code,
        "deviceid": "pc",
        "plat": "web",
        "product": "EFund",
        "version": "2.0.0"
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": f"http://fund.eastmoney.com/{ho_code}.html"
    }
    resp = requests.get(url_api, params=params, headers=headers)
    # print("接口返回内容：", resp.json())
    data = resp.json().get("Datas", {})
    if not data:
        raise BizException(msg="未爬取到相关信息")
    return {
        "ho_code": data.get("FCODE"),
        "ho_name": data.get("SHORTNAME"),
        "ho_type": data.get("FTYPE"),
        "ho_company": data.get("JJGS"),
        "ho_establish_date": data.get("ESTABDATE"),
        # "risk_level": data.get("RISKLEVEL"),
        "ho_manage_expense_rate": data.get("MGREXP"),  # 管理费
        "ho_trust_expense_rate": data.get("TRUSTEXP"),  # 托管费
        "ho_sale_expense_rate": data.get("SALESEXP"),  # 销售服务费
    }


@holding_bp.route('/get_by_code', methods=['GET'])
@auth_required
def get_by_code():
    ho_code = request.args.get('ho_code')
    if not ho_code or not ho_code.strip():
        return ''

    h = Holding.query.filter_by(ho_code=ho_code).first()
    return HoldingSchema().dump(h)
    # return FundBase.from_orm(h).dict()
