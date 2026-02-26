# app/scheduler/cleanup_old_task_logs.py
"""
定时清理过期的异步任务日志。
每两周清理一次创建时间超过两周的日志。
"""
from datetime import datetime, timedelta

from loguru import logger
from sqlalchemy import delete

from app.extension import db
from app.models import AsyncTaskLog


def cleanup_old_task_logs():
    """
    清理两周前的异步任务日志。

    删除条件：
    - created_at < 14 天前
    """
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=14)

        # 使用 delete 语句批量删除，性能更高
        result = db.session.execute(
            delete(AsyncTaskLog).where(AsyncTaskLog.created_at < cutoff_date)
        )
        deleted_count = result.rowcount
        db.session.commit()

        logger.info(f"Cleaned up {deleted_count} old task logs (older than {cutoff_date})")
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Failed to cleanup old task logs: {e}")
