# app/scheduler/async_task_log_job.py
import time
from datetime import datetime
from flask import current_app

from app import scheduler
from app.constant.biz_enums import TaskStatusEnum
from app.framework.async_task_manager import AsyncTaskManager
from app.models import AsyncTaskLog


def retry_pending_tasks():
    """定时任务：扫描并执行需要重试的任务"""
    # TODO pending的任务没有扫啊？
    try:
        # 查找所有状态为 RETRYING 且已到重试时间的任务
        tasks_to_retry = AsyncTaskLog.query.filter(
            AsyncTaskLog.status == TaskStatusEnum.RETRYING.value,
            AsyncTaskLog.next_retry_at <= datetime.utcnow()
        ).all()
        if not tasks_to_retry:
            return
        current_app.logger.info(f"Found {len(tasks_to_retry)} tasks to retry.")
        for task_log in tasks_to_retry:
            # 使用 add_job 来异步执行，避免阻塞定时器线程
            # 注意：这里我们再次调用 run_by_log_id，它会重新判断状态并执行
            scheduler.add_job(
                func=AsyncTaskManager.run_by_log_id,
                trigger='date',  # 立即执行
                run_date=datetime.now(),
                args=[task_log.id],
                id=f"retry_task_{task_log.id}_{int(time.time())}",  # 确保job_id唯一
                replace_existing=True
            )
    except Exception as e:
        current_app.logger.error(f"Error in retry_pending_tasks scheduler job: {e}", exc_info=True)
