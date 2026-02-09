# app/routes/task_log_bp.py
import threading
from datetime import datetime

from flask import Blueprint, request, g, current_app
from sqlalchemy import desc, or_

from app.framework.auth import auth_required
from app.framework.res import Res
from app.framework.sys_constant import DEFAULT_PAGE_SIZE
from app.models import AsyncTaskLog
from app.schemas_marshall import marshal_pagination, AsyncTaskLogSchema
from app.service.task_service import TaskService

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

    # 1. 基础查询，并强制关联用户ID，这是最重要的安全措施
    query = AsyncTaskLog.query.filter_by(user_id=g.user.id)

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
    """
    user_id = g.user.id
    # TaskService.redo_all_snapshot(user_id)
    # 启动后台线程 (Daemon=True 防止主进程退出时线程卡死)
    app = current_app._get_current_object()

    def background_task(user_id):
        with app.app_context():
            try:
                app.logger.info(f"开始为用户 {user_id} 重跑所有快照任务...")
                TaskService.redo_all_snapshot(user_id)
                app.logger.info(f"用户 {user_id} 的快照任务重跑完成。")
            except Exception as e:
                app.logger.exception(f"后台任务执行失败: {str(e)}", exc_info=True)

    thread = threading.Thread(target=background_task, args=(user_id,))
    thread.daemon = True
    thread.start()

    return Res.success()


@task_log_bp.route('/redo_yesterday_snapshot_job', methods=['GET'])
@auth_required
def async_redo_yesterday_snapshot_job():
    """
    重新执行所有的快照任务
    """
    user_id = g.user.id
    username = g.user.username
    # TaskService.redo_all_snapshot(user_id)
    # 启动后台线程 (Daemon=True 防止主进程退出时线程卡死)
    app = current_app._get_current_object()

    def background_task(user_id, username):
        with app.app_context():
            try:
                app.logger.info(f"start: do redo_yesterday_snapshot_job for user {username} ...")
                TaskService.generate_yesterday_snapshot(user_id)
                app.logger.info(f"done: redo_yesterday_snapshot_job for user {username} ...")
            except Exception as e:
                app.logger.exception(f"failed: redo_yesterday_snapshot_job for user {username} ...", str(e))

    thread = threading.Thread(target=background_task, args=(user_id, username))
    thread.daemon = True
    thread.start()

    return Res.success()
