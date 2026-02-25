from io import BytesIO

import pandas as pd
from flask import Blueprint, request, send_file, g
from flask_babel import gettext
from loguru import logger
from sqlalchemy import or_

from app.constant.biz_enums import ErrorMessageEnum, HoldingStatusEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, Holding, UserHolding
from app.schemas_marshall import HoldingSchema, UserHoldingSchema, marshal_pagination, FundDetailSchema
from app.service.holding_service import HoldingService
from app.utils.user_util import get_or_raise

holding_bp = Blueprint('holding', __name__, url_prefix='/holding')



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

    # 通过 UserHolding 查询用户持有的基金，同时获取 UserHolding 的字段
    query = db.session.query(Holding, UserHolding).join(
        UserHolding, Holding.id == UserHolding.ho_id
    ).filter(
        UserHolding.user_id == g.user.id
    )

    # 执行模糊查询
    results = query.filter(
        or_(
            Holding.ho_code.ilike(f'%{keyword}%'),
            Holding.ho_name.ilike(f'%{keyword}%')
        )
    ).all()

    # 组装返回数据：合并 Holding 和 UserHolding 的字段
    data = []
    user_holding_schema = UserHoldingSchema()
    for holding, user_holding in results:
        holding_data = HoldingSchema().dump(holding)
        # 使用 UserHoldingSchema 序列化以正确处理枚举字段
        user_holding_data = user_holding_schema.dump(user_holding)
        holding_data['ho_status'] = user_holding_data.get('ho_status')
        holding_data['ho_nickname'] = user_holding.ho_nickname
        data.append(holding_data)

    return Res.success(data)


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

    # 通过 UserHolding 查询用户持有的基金，同时获取 UserHolding 的字段
    query = db.session.query(Holding, UserHolding).join(
        UserHolding, Holding.id == UserHolding.ho_id
    ).filter(
        UserHolding.user_id == g.user.id
    )

    if ho_code:
        query = query.filter(Holding.ho_code == ho_code)
    if ho_name:
        query = query.filter(Holding.ho_name == ho_name)

    # 多选支持逻辑 (IN 查询)
    if ho_type:
        if isinstance(ho_type, list) and len(ho_type) > 0:
            query = query.filter(Holding.ho_type.in_(ho_type))
        elif isinstance(ho_type, str) and ho_type.strip():
            query = query.filter(Holding.ho_type == ho_type)
    if ho_status:
        if isinstance(ho_status, list) and len(ho_status) > 0:
            query = query.filter(UserHolding.ho_status.in_(ho_status))
        elif isinstance(ho_status, str) and ho_status.strip():
            query = query.filter(UserHolding.ho_status == ho_status)

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

    # 组装返回数据：合并 Holding 和 UserHolding 的字段
    items = []
    user_holding_schema = UserHoldingSchema()
    for holding, user_holding in pagination.items:
        holding_data = HoldingSchema().dump(holding)
        # 使用 UserHoldingSchema 序列化以正确处理枚举字段
        user_holding_data = user_holding_schema.dump(user_holding)
        holding_data['ho_status'] = user_holding_data.get('ho_status')
        holding_data['ho_nickname'] = user_holding.ho_nickname
        items.append(holding_data)

    # 构建分页响应
    result = {
        'items': items,
        'pagination': {
            'total': pagination.total,
            'pages': pagination.pages,
            'page': pagination.page,
            'per_page': pagination.per_page,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
        }
    }

    return Res.success(result)


@holding_bp.route('add_ho', methods=['POST'])
@auth_required
def add_ho():
    data = request.get_json()
    if not data.get('ho_name') or not data.get('ho_code'):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.view)

    # 使用 Service 层创建基金
    HoldingService.create_holding(data, g.user.id)
    return Res.success()


@holding_bp.route('/get_ho', methods=['POST'])
@auth_required
def get_ho():
    data = request.get_json()
    id = data.get('id')

    # 验证用户是否有权限访问该 Holding
    user_holding = UserHolding.query.filter_by(
        user_id=g.user.id,
        ho_id=id
    ).first()

    if not user_holding:
        raise BizException(msg=ErrorMessageEnum.DATA_NOT_FOUND.view)

    h = Holding.query.get(id)
    return Res.success(HoldingSchema().dump(h))


@holding_bp.route('/update_ho', methods=['POST'])
@auth_required
def update_holding():
    data = request.get_json()
    id = data.get('id')

    # 验证用户是否有权限访问该 Holding
    user_holding = UserHolding.query.filter_by(
        user_id=g.user.id,
        ho_id=id
    ).first()

    if not user_holding:
        raise BizException(msg=ErrorMessageEnum.DATA_NOT_FOUND.view)

    h = Holding.query.get(id)

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
        logger.exception(f"Error updating holding {id}: {e}")
        # 可以根据异常类型返回更具体的错误信息
        raise BizException(msg=ErrorMessageEnum.OPERATION_FAILED.view)
    return Res.success()


@holding_bp.route('/del_ho', methods=['POST'])
@auth_required
def del_ho():
    data = request.get_json()
    holding_id = data.get('id')
    # dry_run 参数用于区分检查阶段和实际删除阶段
    is_dry_run = data.get('dry_run', False)

    # 验证用户是否有权限访问该 Holding
    user_holding = UserHolding.query.filter_by(
        user_id=g.user.id,
        ho_id=holding_id
    ).first()

    if not user_holding:
        raise BizException(msg=ErrorMessageEnum.DATA_NOT_FOUND.view)

    holding = Holding.query.get(holding_id)

    if is_dry_run:
        # 检查模式：返回将要被删除的关联数据信息
        cascade_info = HoldingService.get_cascade_delete_info(holding)
        return Res.success(cascade_info)
    else:
        # 删除模式：执行实际的删除操作
        HoldingService.delete_holding_with_cascade(holding)
        return Res.success()


@holding_bp.route('/batch_del_ho', methods=['POST'])
@auth_required
def batch_del_ho():
    """
    批量删除持仓接口。

    请求参数:
        ids: 持仓 ID 列表
        dry_run: 是否仅检查级联信息（不实际删除）

    Returns:
        dry_run=True: 返回级联删除信息汇总
        dry_run=False: 返回删除结果
    """
    data = request.get_json()
    holding_ids = data.get('ids', [])
    is_dry_run = data.get('dry_run', False)

    if not holding_ids or not isinstance(holding_ids, list):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.view)

    if is_dry_run:
        # 检查模式：返回批量级联删除信息
        cascade_info = HoldingService.get_batch_cascade_delete_info(holding_ids, g.user.id)
        return Res.success(cascade_info)
    else:
        # 删除模式：执行批量删除
        result = HoldingService.batch_delete_holdings_with_cascade(holding_ids, g.user.id)
        return Res.success(result)


@holding_bp.route('/export', methods=['GET'])
@auth_required
def export_holdings():
    # 通过 UserHolding 查询用户持有的基金，同时获取 UserHolding 的字段
    results = db.session.query(Holding, UserHolding).join(
        UserHolding, Holding.id == UserHolding.ho_id
    ).filter(
        UserHolding.user_id == g.user.id
    ).all()

    df = pd.DataFrame([{
        gettext('COL_HO_CODE'): holding.ho_code,
        gettext('COL_HO_NAME'): holding.ho_name,
        gettext('COL_HO_TYPE'): holding.ho_type,
        gettext('COL_HO_ESTABLISH_DATE'): holding.establishment_date,
        gettext('COL_HO_SHORT_NAME'): holding.ho_short_name,
        gettext('COL_HO_STATUS'): user_holding.ho_status,
        gettext('COL_HO_NICKNAME'): user_holding.ho_nickname,
    } for holding, user_holding in results])

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
        raise BizException(msg=ErrorMessageEnum.NO_FILE_UPLOAD.view)

    file = request.files['file']
    if file.filename == '':
        raise BizException(msg=ErrorMessageEnum.NO_FILE_UPLOAD.view)

    try:
        df = pd.read_excel(file, dtype={gettext('COL_HO_CODE'): str})
        if gettext('COL_HO_CODE') not in df.columns:
            raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.view)

        ho_codes = df[gettext('COL_HO_CODE')].dropna().unique().tolist()

        success_count = HoldingService.import_holdings(ho_codes, g.user.id)
        return Res.success(success_count)
    except Exception as e:
        logger.exception(e)
        raise BizException(msg=ErrorMessageEnum.OPERATION_FAILED.view)


@holding_bp.route('/crawl_fund', methods=['POST'])
@auth_required
def crawl_fund():
    ho_code = request.form.get('ho_code')  # 表单
    fund_data = HoldingService.crawl_fund_info(ho_code)
    return Res.success(fund_data)
