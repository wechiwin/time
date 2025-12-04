from io import BytesIO
import pandas as pd
from flask import Blueprint, request
from flask_babel import gettext
from sqlalchemy import or_
from app.models import db, AlertRule, AlertHistory
from app.schemas_marshall import AlertRuleSchema, AlertHistorySchema, marshal_pagination
from app.framework.exceptions import BizException
from app.framework.sys_constant import DEFAULT_PAGE_SIZE

alert_bp = Blueprint('alert', __name__, url_prefix='/api/alert')


# AlertRule 接口
@alert_bp.route('/rule', methods=['POST'])
def create_rule():
    data = request.get_json()
    if not data.get('ho_code') or not data.get('ar_type'):
        raise BizException(msg="缺少必要字段")

    new_rule = AlertRuleSchema().load(data)
    db.session.add(new_rule)
    db.session.commit()
    return ''


@alert_bp.route('/rule/<int:ar_id>', methods=['GET'])
def get_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    return AlertRuleSchema().dump(rule)


@alert_bp.route('/rule/<int:ar_id>', methods=['PUT'])
def update_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    data = request.get_json()
    updated_data = AlertRuleSchema().load(data, instance=rule, partial=True)
    db.session.add(updated_data)
    db.session.commit()
    return ''


@alert_bp.route('/rule/<int:ar_id>', methods=['DELETE'])
def delete_rule(ar_id):
    rule = AlertRule.query.get_or_404(ar_id)
    db.session.delete(rule)
    db.session.commit()
    return ''


@alert_bp.route('/rule/search_page', methods=['GET'])
def search_rule_page():
    ho_code = request.args.get('ho_code')
    ar_type = request.args.get('ar_type')
    ar_is_active = request.args.get('ar_is_active')
    keyword = request.args.get('keyword')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    query = AlertRule.query
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
            )
        )

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return marshal_pagination(pagination, AlertRuleSchema)


# AlertHistory 接口
@alert_bp.route('/history/<int:ah_id>', methods=['GET'])
def get_history(ah_id):
    history = AlertHistory.query.get_or_404(ah_id)
    return AlertHistorySchema().dump(history)


@alert_bp.route('/history/search_page', methods=['GET'])
def search_history_page():
    ar_id = request.args.get('ar_id')
    ah_status = request.args.get('ah_status')
    keyword = request.args.get('keyword')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', DEFAULT_PAGE_SIZE, type=int)

    query = AlertHistory.query
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

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return marshal_pagination(pagination, AlertHistorySchema)
