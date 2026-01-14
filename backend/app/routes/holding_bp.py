from io import BytesIO
import logging

import akshare
import pandas as pd
import requests
from flask import Blueprint, request, send_file
from flask_babel import gettext
from sqlalchemy import or_

from app.constant.biz_enums import ErrorMessageEnum, HoldingTypeEnum, HoldingStatusEnum, FundTradeMarketEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, Holding
from app.schemas_marshall import HoldingSchema, marshal_pagination, FundDetailSchema

holding_bp = Blueprint('holding', __name__, url_prefix='/api/holding')
logger = logging.getLogger(__name__)


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

    return Res.success(HoldingSchema(many=True).dump(holdings))


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

    return Res.success(marshal_pagination(pagination, HoldingSchema))


@holding_bp.route('', methods=['POST'])
@auth_required
def create_holding():
    data = request.get_json()
    if not data.get('ho_name') or not data.get('ho_code'):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD)

    # 检查基金代码是否已存在
    if Holding.query.filter_by(ho_code=data['ho_code']).first():
        raise BizException(msg="基金代码已存在")

    try:
        new_holding = HoldingSchema().load(data)  # 注意：这里不传 instance，因为是新建
        new_holding.ho_status = HoldingStatusEnum.NOT_HELD.value
        # fund_detail = FundDetailSchema().load(data)
        db.session.add(new_holding)
        # db.session.add(fund_detail)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(e, exc_info=True)
        raise BizException(msg=str(e))
    return Res.success()


@holding_bp.route('/get_by_id', methods=['POST'])
@auth_required
def get_by_id():
    data = request.get_json()
    id = data.get('id')

    if not id:
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD)

    h = Holding.query.get_or_404(id)

    if not h:
        raise BizException(msg=ErrorMessageEnum.NO_SUCH_DATA)

    return Res.success(HoldingSchema().dump(h))


@holding_bp.route('/edit', methods=['POST'])
@auth_required
def update_holding():
    data = request.get_json()
    id = data.get('id')

    h = db.session.get(Holding, id)
    if not h:
        raise BizException(msg=ErrorMessageEnum.NO_SUCH_DATA)

    # 将嵌套数据从请求中分离出来
    fund_detail_data = data.pop('fund_detail', None)
    logger.info(fund_detail_data)

    # 3. 更新主对象 (Holding)
    # 此时的 data 中已经不包含 fund_detail
    holding_schema = HoldingSchema()
    holding_schema.load(data, instance=h, partial=True, session=db.session)
    logger.info(holding_schema)

    if fund_detail_data:
        fund_detail_schema = FundDetailSchema()
        # 检查是否已存在关联的 fund_detail 记录
        if h.fund_detail:
            # 如果存在，则加载数据到该实例上进行更新
            fund_detail_schema.load(fund_detail_data, instance=h.fund_detail, partial=True, session=db.session)
        else:
            # 如果不存在，则创建一个新的实例并关联到主对象
            new_fund_detail = fund_detail_schema.load(fund_detail_data, session=db.session)
            h.fund_detail = new_fund_detail
    try:
        # 5. 提交事务
        # 由于对象 h 及其关联的 fund_detail 都是从 session 中获取或已添加到 session 中的，
        # SQLAlchemy 会自动追踪它们的变更。因此 `db.session.add(h)` 是不必要的。
        db.session.commit()
    except Exception as e:
        db.session.rollback()  # 发生错误时回滚事务
        logger.error(f"Error updating holding {id}: {e}", exc_info=True)
        # 可以根据异常类型返回更具体的错误信息
        raise BizException(msg="更新持仓信息失败")
    return Res.success()


@holding_bp.route('/<ho_id>', methods=['DELETE'])
@auth_required
def delete_holding(ho_id):
    h = Holding.query.get_or_404(ho_id)
    db.session.delete(h)
    db.session.commit()
    return Res.success()


@holding_bp.route('/export', methods=['GET'])
@auth_required
def export_holdings():
    holdings = Holding.query.all()
    df = pd.DataFrame([{
        gettext('COL_HO_CODE'): t.ho_code,
        gettext('COL_HO_NAME'): t.ho_name,
        gettext('COL_HO_TYPE'): t.ho_type,
        gettext('COL_HO_ESTABLISH_DATE'): t.establishment_date,
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
        # gettext('COL_HO_TYPE'),
        gettext('COL_HO_ESTABLISH_DATE'),
        gettext('COL_HO_SHORT_NAME'),
        gettext('COL_HO_MANAGE_EXP_RATE'),
        gettext('COL_HO_TRUSTEE_EXP_RATE'),
        gettext('COL_HO_SALES_EXP_RATE'),
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
            # gettext('COL_HO_TYPE'),
            gettext('COL_HO_ESTABLISH_DATE'),
        ]
        if not all(col in df.columns for col in required_columns):
            raise BizException(msg="Excel缺少必要列")

        # 检查ho_code是否存在
        # ho_codes = df[gettext('COL_HO_CODE')].unique()
        # existing_holdings = Holding.query.filter(Holding.ho_code.in_(ho_codes)).all()
        # existing_codes = {h.ho_code for h in existing_holdings}
        # if existing_codes:
        #     raise BizException(
        #         msg=f"以下基金已存在: {', '.join(map(str, existing_codes))}"
        #     )

        # 开始事务
        # db.session.begin()
        for _, row in df.iterrows():
            holding = Holding(
                ho_code=str(row[gettext('COL_HO_CODE')]),
                ho_name=str(row[gettext('COL_HO_NAME')]),
                ho_type=HoldingTypeEnum.FUND.value,
                ho_establish_date=str(row[gettext('COL_HO_ESTABLISH_DATE')]),
                ho_short_name=str(row[gettext('COL_HO_SHORT_NAME'),]),
                ho_manage_exp_rate=str(row[gettext('COL_HO_MANAGE_EXP_RATE'),]),
                ho_trustee_exp_rate=str(row[gettext('COL_HO_TRUSTEE_EXP_RATE'),]),
                ho_sales_exp_rate=str(row[gettext('COL_HO_SALES_EXP_RATE'),]),
                ho_status=HoldingStatusEnum.NOT_HELD.value,
            )
            db.session.add(holding)

        db.session.commit()
        return Res.success()
    except Exception as e:
        db.session.rollback()
        logger.error(e, exc_info=True)
        raise BizException(msg="持仓导入失败")


@holding_bp.route('/crawl_fund', methods=['POST'])
@auth_required
def crawl_fund():
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
    logger.info(data)
    result = {
        "ho_code": data.get("FCODE"),
        "ho_name": data.get("FULLNAME"),
        "ho_short_name": data.get("SHORTNAME"),
        "ho_type": data.get("FTYPE"),
        "fund_manager": data.get("JJJL"),
        "company_id": data.get("JJGSID"),
        "company_name": data.get("JJGS"),
        "establishment_date": data.get("ESTABDATE"),
        "risk_level": data.get("RISKLEVEL"),
        "index_code": data.get("INDEXCODE"),
        "index_name": data.get("INDEXNAME"),
        "manage_exp_rate": data.get("MGREXP").replace('%', ''),
        "trustee_exp_rate": data.get("TRUSTEXP").replace('%', ''),
        "sales_exp_rate": data.get("SALESEXP").replace('%', ''),
        "feature": data.get("FEATURE"),
        "fund_type": data.get("FTYPE"),
    }

    trade_market = determine_trade_market(result)
    result['trade_market'] = trade_market.value
    return Res.success(result)


def determine_trade_market(fund_data):
    """
    根据基金信息判断交易市场
    """
    short_name = fund_data['ho_short_name']
    full_name = fund_data['ho_name']
    features = fund_data['feature'].split(',')
    sales_exp = fund_data['sales_exp_rate']

    # LOF基金（Listed Open-Ended Fund）场内外均可
    if 'LOF' in short_name or 'LOF' in full_name or '上市开放式' in full_name:
        return FundTradeMarketEnum.BOTH.value
    # 名称中含有“联接” -> 通常是场外（投资于场内ETF的场外基金）
    if '联接' in short_name or '联接' in full_name:
        return FundTradeMarketEnum.OFF_EXCHANGE.value  # 仅场外
    # 有销售服务费(SALESEXP)，通常是场外C类份额
    if sales_exp and sales_exp != '--':
        return FundTradeMarketEnum.OFF_EXCHANGE.value
    # 名称中含有“ETF” -> 场内
    if 'ETF' in short_name or 'ETF' in full_name:
        return FundTradeMarketEnum.EXCHANGE.value  # 仅场内
    # 特征码包含'010' (ETF) -> 场内
    if '010' in features:
        return FundTradeMarketEnum.EXCHANGE.value

    # 默认（普通开放式基金）
    return FundTradeMarketEnum.OFF_EXCHANGE.value


# @holding_bp.route('/crawl_stock', methods=['POST'])
# @auth_required
# def crawl_stock():
#     ho_code = request.form.get('ho_code')  # 表单
#
#     df = akshare.stock_individual_info_em(
#         symbol=ho_code,
#         period="daily",
#         start_date=start_date.replace("-", ""),
#         end_date=end_date.replace("-", ""),
#         adjust=adjust
#     )
#     EASTMONEY_STOCK_URL = "https://push2.eastmoney.com/api/qt/stock/get"
#     return Res.success()


@holding_bp.route('/get_by_code', methods=['GET'])
@auth_required
def get_by_code():
    ho_code = request.args.get('ho_code')
    if not ho_code or not ho_code.strip():
        return Res.success()

    h = Holding.query.filter_by(ho_code=ho_code).first()
    return Res.success(HoldingSchema().dump(h))
