import logging
import threading

from flask import Blueprint, request, current_app
from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.constant.biz_enums import ErrorMessageEnum
from app.framework.auth import auth_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.models import db, FundNavHistory, Holding
from app.schemas_marshall import FundNavHistorySchema, marshal_pagination
from app.service.nav_history_service import FundNavHistoryService

nav_history_bp = Blueprint('nav_history', __name__, url_prefix='/api/nav_history')
logger = logging.getLogger(__name__)


@nav_history_bp.route('/page_history', methods=['POST'])
@auth_required
def page_history():
    data = request.get_json()
    ho_id = data.get('ho_id')
    keyword = data.get('keyword')
    page = data.get('page')
    per_page = data.get('per_page')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    query = FundNavHistory.query.options(joinedload(FundNavHistory.holding))

    if ho_id:
        query = query.filter_by(ho_id=ho_id)
    if start_date:
        query = query.filter(FundNavHistory.nav_date >= start_date)
    if end_date:
        query = query.filter(FundNavHistory.nav_date <= end_date)
    if keyword:
        query = query.join(Holding, FundNavHistory.ho_id == Holding.id).filter(
            or_(
                Holding.ho_code.ilike(f'%{keyword}%'),
                Holding.ho_short_name.ilike(f'%{keyword}%')
            )
        )
    # 分页查询
    pagination = query.order_by(FundNavHistory.nav_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    result = marshal_pagination(pagination, FundNavHistorySchema)

    return Res.success(result)


@nav_history_bp.route('list_history', methods=['POST'])
@auth_required
def list_history():
    data = request.get_json()
    ho_id = data.get('ho_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    data = FundNavHistoryService.search_list(ho_id, start_date, end_date)
    return Res.success(FundNavHistorySchema(many=True).dump(data))


@nav_history_bp.route('', methods=['POST'])
@auth_required
def create_net_value():
    data = request.get_json()
    required_fields = ['ho_code', 'nav_date', 'nav_per_unit']
    if not all(field in data for field in required_fields):
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD)
    new_nv = FundNavHistorySchema().load(data)
    db.session.add(new_nv)
    db.session.commit()
    return Res.success()


@nav_history_bp.route('/<int:nav_id>', methods=['GET'])
@auth_required
def get_net_value(nav_id):
    nv = FundNavHistory.query.get_or_404(nav_id)
    return Res.success(FundNavHistorySchema().dump(nv))


@nav_history_bp.route('/<int:nav_id>', methods=['PUT'])
@auth_required
def update_net_value(nav_id):
    nv = FundNavHistory.query.get_or_404(nav_id)
    data = request.get_json()
    updated_data = FundNavHistorySchema().load(data, instance=nv, partial=True)

    db.session.add(updated_data)
    db.session.commit()
    return Res.success()


@nav_history_bp.route('/<int:nav_id>', methods=['DELETE'])
@auth_required
def delete_net_value(nav_id):
    nv = FundNavHistory.query.get_or_404(nav_id)
    db.session.delete(nv)
    db.session.commit()
    return Res.success()


@nav_history_bp.route('/crawl', methods=['POST'])
@auth_required
def crawl_nav_history():
    data = request.get_json()
    ho_id = data.get("ho_id")
    ho_code = data.get("ho_code")
    start_date = data.get("start_date")
    end_date = data.get("end_date")

    if not ho_code or not ho_id:
        raise BizException(msg=ErrorMessageEnum.MISSING_FIELD)
    if not start_date or not end_date:
        raise BizException(msg="缺少时间限制")

    holding = Holding.query.filter_by(id=ho_id).first()
    if not holding:
        raise BizException(msg="持仓不存在")

    FundNavHistoryService.crawl_one_nav_and_insert(holding, start_date, end_date)

    # app = current_app._get_current_object()
    #
    # # 启动异步任务
    # thread = threading.Thread(
    #     target=async_crawl_task,
    #     args=(app, holding, start_date, end_date)
    # )
    # thread.start()

    return Res.success()


def async_crawl_task(app, holding, start_date, end_date):
    with app.app_context():
        FundNavHistoryService.crawl_one_nav_and_insert(holding, start_date, end_date)


@nav_history_bp.route('/crawl_all', methods=['GET'])
@auth_required
def crawl_all():
    app = current_app._get_current_object()
    # 启动异步任务
    thread = threading.Thread(
        target=async_crawl_all,
        args=(app,)
    )
    thread.start()
    return Res.success()


def async_crawl_all(app):
    with app.app_context():
        app.logger.info('Starting async crawl_all task')
        data = FundNavHistoryService.crawl_all_nav_history()
        app.logger.info('Crawl_all task completed successfully')
        return data
