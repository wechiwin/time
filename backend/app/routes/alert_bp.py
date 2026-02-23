from flask import Blueprint, request, g
from sqlalchemy import or_, desc
from sqlalchemy.orm import joinedload

from app.constant.biz_enums import ErrorMessageEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, AlertRule, AlertHistory, Holding
from app.schemas_marshall import AlertRuleSchema, AlertHistorySchema, marshal_pagination
from app.service.alert_service import AlertService
from app.utils.date_util import get_yesterday_date
from app.utils.user_util import get_or_raise

alert_bp = Blueprint('alert', __name__, url_prefix='/alert')


# AlertRule 接口
@alert_bp.route('/rule', methods=['POST'])
@auth_required
def create_rule():
    data = request.get_json()
    if not data.get('ho_code') or not data.get('action') or not data.get('ar_is_active') or not data.get(
            'target_price'):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.view)

    new_rule = AlertRuleSchema().load(data)
    new_rule.user_id = g.user.id
    new_rule.tracked_date = get_yesterday_date()
    db.session.add(new_rule)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/get_rule', methods=['POST'])
@auth_required
def get_rule():
    data = request.get_json()
    id = data.get('id')
    rule = get_or_raise(AlertRule, id)
    return Res.success(AlertRuleSchema().dump(rule))


@alert_bp.route('/rule/update_rule', methods=['POST'])
@auth_required
def update_rule():
    data = request.get_json()
    id = data.get('id')
    rule = get_or_raise(AlertRule, id)

    updated_data = AlertRuleSchema().load(data, instance=rule, partial=True)
    db.session.add(updated_data)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/del_rule', methods=['POST'])
@auth_required
def del_rule():
    data = request.get_json()
    id = data.get('id')
    rule = get_or_raise(AlertRule, id)
    db.session.delete(rule)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/page_rule', methods=['POST'])
@auth_required
def page_rule():
    data = request.get_json()
    ho_code = data.get('ho_code')
    ar_type = data.get('ar_type')
    ar_is_active = data.get('ar_is_active')
    keyword = data.get('keyword')
    page = data.get('page') or 1
    per_page = data.get('per_page') or DEFAULT_PAGE_SIZE

    # query = AlertRule.query
    query = AlertRule.query.options(joinedload(AlertRule.holding))
    query = query.filter_by(user_id=g.user.id)

    if ho_code:
        query = query.filter_by(ho_code=ho_code)
    if ar_type:
        query = query.filter_by(ar_type=ar_type)
    if ar_is_active:
        query = query.filter_by(ar_is_active=ar_is_active)
    if keyword:
        query = query.filter(
            or_(
                AlertRule.ho_code.ilike(f'%{keyword}%'),
                Holding.ho_short_name.ilike(f'%{keyword}%'),
                Holding.ho_name.ilike(f'%{keyword}%'),
            )
        )

    pagination = query.order_by(desc(AlertRule.updated_at)).paginate(
        page=page, per_page=per_page, error_out=False)

    result = marshal_pagination(pagination, AlertRuleSchema)

    return Res.success(result)


# AlertHistory 接口
@alert_bp.route('/history/get_rule_hist', methods=['POST'])
@auth_required
def get_rule_hist():
    data = request.get_json()
    id = data.get('id')
    rule_hist = get_or_raise(AlertRule, id)

    return Res.success(AlertHistorySchema().dump(rule_hist))


@alert_bp.route('/history/page_rule_his', methods=['POST'])
@auth_required
def page_rule_his():
    data = request.get_json()
    ar_id = data.get('ar_id')
    ah_status = data.get('ah_status')
    keyword = data.get('keyword')
    page = data.get('page') or 1
    per_page = data.get('per_page') or DEFAULT_PAGE_SIZE

    # query = AlertHistory.query
    query = AlertHistory.query.options(joinedload(AlertHistory.holding))
    query = query.filter_by(user_id=g.user.id)

    if ar_id:
        query = query.filter_by(ar_id=ar_id)
    if ah_status:
        query = query.filter_by(ah_status=ah_status)
    if keyword:
        query = query.filter(
            or_(
                AlertHistory.ah_triggered_time.ilike(f'%{keyword}%'),
            )
        )

    pagination = query.order_by(desc(AlertHistory.updated_at)).paginate(
        page=page, per_page=per_page, error_out=False)

    result = marshal_pagination(pagination, AlertHistorySchema)

    return Res.success(result)


@alert_bp.route('/history/alert_job', methods=['GET'])
@auth_required
def alert_job():
    AlertService.check_alert_rules()
    return Res.success()


@alert_bp.route('/history/mail_job', methods=['GET'])
@auth_required
def mail_job():
    AlertService.send_alert_mail()
    return Res.success()
