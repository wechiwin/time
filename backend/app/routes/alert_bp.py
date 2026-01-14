from flask import Blueprint, request
from sqlalchemy import or_, desc

from app.constant.biz_enums import ErrorMessageEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import db, AlertRule, AlertHistory, Holding
from app.schemas_marshall import AlertRuleSchema, AlertHistorySchema
from app.service.alert_service import AlertService
from app.tools.date_tool import get_yesterday_date_str

alert_bp = Blueprint('alert', __name__, url_prefix='/api/alert')


# AlertRule 接口
@alert_bp.route('/rule', methods=['POST'])
@auth_required
def create_rule():
    data = request.get_json()
    if not data.get('ho_code') or not data.get('ar_type') or not data.get('ar_is_active') or not data.get(
            'ar_target_navpu'):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD)

    new_rule = AlertRuleSchema().load(data)
    new_rule.tracked_date = get_yesterday_date_str()
    db.session.add(new_rule)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/<int:ar_id>', methods=['GET'])
@auth_required
def get_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    return Res.success(AlertRuleSchema().dump(rule))


@alert_bp.route('/rule/<int:ar_id>', methods=['PUT'])
@auth_required
def update_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    data = request.get_json()
    updated_data = AlertRuleSchema().load(data, instance=rule, partial=True)
    db.session.add(updated_data)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/<int:ar_id>', methods=['DELETE'])
@auth_required
def delete_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    db.session.delete(rule)
    db.session.commit()
    return Res.success()


@alert_bp.route('/rule/search_page', methods=['GET'])
@auth_required
def search_rule_page():
    ho_code = request.args.get('ho_code')
    ar_type = request.args.get('ar_type')
    ar_is_active = request.args.get('ar_is_active')
    keyword = request.args.get('keyword')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    # query = AlertRule.query
    query = db.session.query(AlertRule, Holding.ho_short_name).outerjoin(
        Holding, AlertRule.ho_code == Holding.ho_code
    )
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
    rules = pagination.items or []
    items = [{
        'ar_id': r.id,
        'ho_code': r.ho_code,
        'ho_short_name': ho_short_name,
        'ar_is_active': r.ar_is_active,
        'ar_target_navpu': r.target_navpu,
        'ar_tracked_date': r.tracked_date,
        'ar_type': r.action,
        'ar_name': r.ar_name,
        'created_at': r.created_at,
        'updated_at': r.updated_at
    } for r, ho_short_name in rules]
    # 返回分页信息
    data = {
        'items': items,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }
    return Res.success(data)


# AlertHistory 接口
@alert_bp.route('/history/<int:ah_id>', methods=['GET'])
@auth_required
def get_history(ah_id):
    history = AlertHistory.query.get_or_404(ah_id)
    return Res.success(AlertHistorySchema().dump(history))


@alert_bp.route('/history/search_page', methods=['GET'])
@auth_required
def search_history_page():
    ar_id = request.args.get('ar_id')
    ah_status = request.args.get('ah_status')
    keyword = request.args.get('keyword')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    # query = AlertHistory.query
    query = db.session.query(AlertHistory, Holding.ho_short_name).outerjoin(
        Holding, AlertHistory.ho_code == Holding.ho_code
    )
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
    rule_histories = pagination.items or []
    items = [{
        'ah_id': r.id,
        'ar_id': r.id,
        'ho_code': r.ho_code,
        'ho_short_name': ho_short_name,
        'ah_nav_date': r.ah_nav_date,
        'ah_status': r.send_status,
        'ah_ar_type': r.action,
        'ah_target_navpu': r.target_navpu,
        'ah_nav_per_unit': r.trigger_navpu,
        'created_at': r.created_at,
        'updated_at': r.updated_at
    } for r, ho_short_name in rule_histories]
    # 返回分页信息
    data = {
        'items': items,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }
    return Res.success(data)


@alert_bp.route('/history/alert_job', methods=['GET'])
@auth_required
def alert_job():
    AlertService.check_alert_rules()
    return Res.success()


@alert_bp.route('/history/mail_job', methods=['GET'])
@auth_required
def mail_job():
    AlertService.trigger_alert_job()
    return Res.success()
