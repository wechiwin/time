import logging
from io import BytesIO

import pandas as pd
from flask import Blueprint, request, send_file, g
from flask_babel import gettext
from sqlalchemy import or_

from app.constant.biz_enums import ErrorMessageEnum, HoldingStatusEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, Holding
from app.schemas_marshall import HoldingSchema, marshal_pagination, FundDetailSchema
from app.service.holding_service import HoldingService
from app.utils.user_util import get_or_raise

holding_bp = Blueprint('holding', __name__, url_prefix='/api/holding')
logger = logging.getLogger(__name__)


@holding_bp.route('/list_ho', methods=['POST'])
@auth_required
def list_ho():
    """
    参数:
        keyword: 搜索关键词(基金代码或名称)
    """
    keyword = request.args.get('keyword', '').strip()

    from urllib.parse import unquote
    keyword = unquote(keyword)

    query = Holding.query
    query = query.filter_by(user_id=g.user.id)

    # 执行模糊查询
    holdings = query.filter(
        or_(
            Holding.ho_code.ilike(f'%{keyword}%'),
            Holding.ho_name.ilike(f'%{keyword}%')
        )
    ).all()

    return Res.success(HoldingSchema(many=True).dump(holdings))


@holding_bp.route('page_holding', methods=['POST'])
@auth_required
def page_holding():
    data = request.get_json()
    ho_code = data.get('ho_code')
    ho_name = data.get('ho_name')
    keyword = data.get('keyword')
    page = data.get('page') or 1
    per_page = data.get('per_page') or DEFAULT_PAGE_SIZE

    # 可能是字符串，也可能是列表
    ho_type = data.get('ho_type')
    ho_status = data.get('ho_status')

    query = Holding.query
    query = query.filter_by(user_id=g.user.id)

    if ho_code:
        query = query.filter_by(ho_code=ho_code)
    if ho_name:
        query = query.filter_by(ho_name=ho_name)

    # 多选支持逻辑 (IN 查询)
    if ho_type:
        if isinstance(ho_type, list) and len(ho_type) > 0:
            query = query.filter(Holding.ho_type.in_(ho_type))
        elif isinstance(ho_type, str) and ho_type.strip():
            query = query.filter_by(ho_type=ho_type)
    if ho_status:
        if isinstance(ho_status, list) and len(ho_status) > 0:
            query = query.filter(Holding.ho_status.in_(ho_status))
        elif isinstance(ho_status, str) and ho_status.strip():
            query = query.filter_by(ho_status=ho_status)

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


@holding_bp.route('add_ho', methods=['POST'])
@auth_required
def add_ho():
    data = request.get_json()
    if not data.get('ho_name') or not data.get('ho_code'):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.value)

    # 检查基金代码是否已存在
    if Holding.query.filter_by(ho_code=data['ho_code']).first():
        raise BizException(msg="基金代码已存在")

    try:
        fund_detail_data = data.pop('fund_detail', None)
        new_fund_detail = FundDetailSchema().load(fund_detail_data, session=db.session)
        new_fund_detail.user_id = g.user.id

        new_holding = HoldingSchema().load(data)  # 注意：这里不传 instance，因为是新建
        new_holding.ho_status = HoldingStatusEnum.NOT_HELD.value
        new_holding.user_id = g.user.id

        new_holding.fund_detail = new_fund_detail
        db.session.add(new_holding)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(e, exc_info=True)
        raise BizException(msg=str(e))
    return Res.success()


@holding_bp.route('/get_ho', methods=['POST'])
@auth_required
def get_ho():
    data = request.get_json()
    id = data.get('id')
    h = get_or_raise(Holding, id)

    return Res.success(HoldingSchema().dump(h))


@holding_bp.route('/update_ho', methods=['POST'])
@auth_required
def update_holding():
    data = request.get_json()
    id = data.get('id')
    h = get_or_raise(Holding, id)

    # 将嵌套数据从请求中分离出来
    fund_detail_data = data.pop('fund_detail', None)
    # logger.info(fund_detail_data)

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


@holding_bp.route('/del_ho', methods=['POST'])
@auth_required
def del_ho():
    data = request.get_json()
    id = data.get('id')
    h = get_or_raise(Holding, id)

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
        # gettext('COL_HO_NAME'),
        # # gettext('COL_HO_TYPE'),
        # gettext('COL_HO_ESTABLISH_DATE'),
        # gettext('COL_HO_SHORT_NAME'),
        # gettext('COL_HO_MANAGE_EXP_RATE'),
        # gettext('COL_HO_TRUSTEE_EXP_RATE'),
        # gettext('COL_HO_SALES_EXP_RATE'),
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
        if gettext('COL_HO_CODE') not in df.columns:
            raise BizException(msg="Excel缺少必要列")

        ho_codes = df[gettext('COL_HO_CODE')].dropna().unique().tolist()

        success_count = HoldingService.import_holdings(ho_codes)
        return Res.success(success_count)
    except Exception as e:
        logger.error(e, exc_info=True)
        raise BizException(msg="持仓导入失败")


@holding_bp.route('/crawl_fund', methods=['POST'])
@auth_required
def crawl_fund():
    ho_code = request.form.get('ho_code')  # 表单
    fund_data = HoldingService.crawl_fund_info(ho_code)
    return Res.success(fund_data)

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
