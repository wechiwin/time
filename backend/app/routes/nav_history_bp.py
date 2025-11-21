import threading

from app.framework.exceptions import BizException
from app.models import db, NavHistory, Holding
from app.schemas_marshall import NavHistorySchema
from app.service.nav_history_service import NavHistoryService
from flask import Blueprint, request, current_app

nav_history_bp = Blueprint('nav_history', __name__, url_prefix='/api/nav_history')
service = NavHistoryService()


@nav_history_bp.route('', methods=['GET'])
def get_nav_history():
    ho_code = request.args.get('ho_code')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    # 基础查询：左连接 Holding 表
    query = db.session.query(NavHistory, Holding.ho_short_name).outerjoin(
        Holding, NavHistory.ho_code == Holding.ho_code
    )

    if ho_code:
        query = query.filter_by(ho_code=ho_code)

    # 分页查询
    pagination = query.order_by(NavHistory.nav_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # results = query.order_by(NetValue.date).all() or []
    results = pagination.items or []

    data = [{
        'nav_id': nv.nav_id,
        'ho_code': nv.ho_code,
        'ho_short_name': ho_short_name,
        'nav_date': nv.nav_date,
        'nav_per_unit': nv.nav_per_unit,
        'nav_accumulated_per_unit': nv.nav_accumulated_per_unit
    } for nv, ho_short_name in results]

    return {
        'items': data,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }


@nav_history_bp.route('search_list', methods=['GET'])
def search_list():
    ho_code = request.args.get('ho_code')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    data = service.search_list(ho_code, start_date, end_date)
    return data


@nav_history_bp.route('', methods=['POST'])
def create_net_value():
    data = request.get_json()
    required_fields = ['ho_code', 'nav_date', 'nav_per_unit']
    if not all(field in data for field in required_fields):
        raise BizException(message="缺少必要字段")
    new_nv = NavHistorySchema().load(data)
    db.session.add(new_nv)
    db.session.commit()
    return ''


@nav_history_bp.route('/<int:nav_id>', methods=['GET'])
def get_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    return NavHistorySchema().dump(nv)


@nav_history_bp.route('/<int:nav_id>', methods=['PUT'])
def update_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    data = request.get_json()
    updated_data = NavHistorySchema().load(data, instance=nv, partial=True)

    db.session.add(updated_data)
    db.session.commit()
    return ''


@nav_history_bp.route('/<int:nav_id>', methods=['DELETE'])
def delete_net_value(nav_id):
    nv = NavHistory.query.get_or_404(nav_id)
    db.session.delete(nv)
    db.session.commit()
    return ''


@nav_history_bp.route('/crawl', methods=['POST'])
def crawl_nav_history():
    data = request.get_json()  # 改为获取 JSON 数据
    ho_code = data.get("ho_code")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if not ho_code:
        raise BizException(message="缺少基金代码")

    app = current_app._get_current_object()

    # 启动异步任务
    thread = threading.Thread(
        target=async_crawl_task,
        args=(app, ho_code, start_date, end_date)
    )
    thread.start()

    return ''


def async_crawl_task(app, ho_code, start_date, end_date):
    with app.app_context():
        try:
            data = service.crawl_one_nav_history(ho_code, start_date, end_date)
            if not data:
                print("未获取到数据")
                return
            print(f"爬取基金 {len(data)} 条")
            service.save_nav_history_to_db(data, ho_code, start_date, end_date)
        except Exception as e:
            print("爬取失败：", e)
            db.session.rollback()
