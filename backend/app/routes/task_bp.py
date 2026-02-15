# app/routes/task_log_bp.py
from datetime import datetime

from flask import Blueprint, request, g
from sqlalchemy import desc, or_

from app.framework.auth import auth_required
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.framework.async_task_manager import create_task, DeduplicationStrategy
from app.models import db, AsyncTaskLog
from app.schemas_marshall import marshal_pagination, AsyncTaskLogSchema
from app.utils.user_util import get_or_raise

task_log_bp = Blueprint('task', __name__, url_prefix='/task_log')


@task_log_bp.route('/log_page', methods=['POST'])
@auth_required
def page_task_log():
    """
    分页查询异步任务日志
    """
    data = request.get_json()
    if not data:
        data = {}

    page = data.get('page', 1)
    per_page = data.get('per_page', DEFAULT_PAGE_SIZE)
    keyword = data.get('keyword')
    statuses = data.get('status')  # 前端会传来一个数组
    created_at_range = data.get('created_at')  # 预期格式: ['YYYY-MM-DD', 'YYYY-MM-DD']

    # 1. 基础查询：用户自己的任务 + 系统任务 (user_id is NULL)
    query = AsyncTaskLog.query.filter(
        or_(
            AsyncTaskLog.user_id == g.user.id,
            AsyncTaskLog.user_id.is_(None)  # System tasks
        )
    )

    # 2. 应用筛选条件
    if statuses:  # 检查列表是否非空
        query = query.filter(AsyncTaskLog.status.in_(statuses))

    if created_at_range and len(created_at_range) == 2:
        try:
            start_date = datetime.strptime(created_at_range[0], '%Y-%m-%d')
            # 结束日期需要包含当天所有时间，所以设置为 23:59:59
            end_date = datetime.strptime(created_at_range[1], '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(AsyncTaskLog.created_at.between(start_date, end_date))
        except (ValueError, TypeError):
            # 如果日期格式错误，静默忽略或返回错误，这里选择忽略
            pass

    if keyword:
        # 关键字可以搜索任务名、结果摘要、错误信息和业务键
        search_term = f'%{keyword}%'
        query = query.filter(
            or_(
                AsyncTaskLog.task_name.ilike(search_term),
                AsyncTaskLog.result_summary.ilike(search_term),
                AsyncTaskLog.error_message.ilike(search_term),
                AsyncTaskLog.business_key.ilike(search_term)
            )
        )

    # 3. 排序和分页
    # 默认按创建时间倒序，最新的日志在最前面
    pagination = query.order_by(desc(AsyncTaskLog.created_at)).paginate(
        page=page, per_page=per_page, error_out=False
    )

    # 4. 序列化并返回
    result = marshal_pagination(pagination, AsyncTaskLogSchema)
    return Res.success(result)


@task_log_bp.route('/redo_all_snapshot_job', methods=['GET'])
@auth_required
def async_redo_all_snapshot_job():
    """
    重新执行所有的快照任务
    Creates an AsyncTaskLog record and lets the consumer execute it.
    """
    user_id = g.user.id

    task_log = create_task(
        user_id=user_id,
        task_name="Redo all snapshots",
        module_path="app.service.task_service",
        class_name="TaskService",
        method_name="redo_all_snapshot",
        args=[user_id],
        max_retries=1,
        deduplication_strategy=DeduplicationStrategy.BUSINESS_KEY,
        business_key=f"redo_all_snapshots:user_{user_id}"
    )

    return Res.success({
        "task_id": task_log.id,
        "status": task_log.status
    })


@task_log_bp.route('/redo_yesterday_snapshot_job', methods=['GET'])
@auth_required
def async_redo_yesterday_snapshot_job():
    """
    重新执行昨天的快照任务
    Creates an AsyncTaskLog record and lets the consumer execute it.
    """
    user_id = g.user.id

    task_log = create_task(
        user_id=user_id,
        task_name="Redo yesterday snapshots",
        module_path="app.service.task_service",
        class_name="TaskService",
        method_name="generate_yesterday_snapshot",
        args=[user_id],
        max_retries=1,
        deduplication_strategy=DeduplicationStrategy.BUSINESS_KEY,
        business_key=f"redo_yesterday_snapshots:user_{user_id}"
    )

    return Res.success({
        "task_id": task_log.id,
        "status": task_log.status
    })


@task_log_bp.route('/del_log', methods=['POST'])
@auth_required
def del_log():
    """
    删除异步任务日志
    """
    data = request.get_json()
    id = data.get('id')
    log = get_or_raise(AsyncTaskLog, id)
    db.session.delete(log)
    db.session.commit()
    return Res.success()
