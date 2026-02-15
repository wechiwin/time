# app/framework/system_task_wrapper.py
import functools
from datetime import datetime
from loguru import logger

from app.extension import db
from app.models import AsyncTaskLog
from app.constant.biz_enums import TaskStatusEnum


def with_task_logging(task_name: str):
    """
    Decorator for system scheduled tasks to add AsyncTaskLog records.

    Usage:
        @with_task_logging("Crawl all fund net values")
        def crawl_all_fund_net_values():
            # Original logic unchanged
            ...

    The decorator will:
    1. Create a RUNNING status AsyncTaskLog before execution
    2. Update to SUCCESS after successful completion
    3. Update to FAILED if an exception occurs
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            task_log = AsyncTaskLog(
                user_id=None,  # System task - no user association
                task_name=f"[System] {task_name}",
                params={"module_path": func.__module__, "method_name": func.__name__},
                status=TaskStatusEnum.RUNNING,
                max_retries=0
            )

            try:
                db.session.add(task_log)
                db.session.commit()

                logger.info(f"System task '{task_name}' started, log_id={task_log.id}")

                result = func(*args, **kwargs)

                task_log.status = TaskStatusEnum.SUCCESS
                task_log.result_summary = str(result) if result else None
                db.session.commit()

                logger.info(f"System task '{task_name}' completed successfully, log_id={task_log.id}")
                return result

            except Exception as e:
                logger.exception(f"System task '{task_name}' failed: {e}")

                # Rollback any partial transaction from the task
                db.session.rollback()

                # Create new task log entry for the failure
                task_log = AsyncTaskLog(
                    user_id=None,
                    task_name=f"[System] {task_name}",
                    params={"module_path": func.__module__, "method_name": func.__name__},
                    status=TaskStatusEnum.FAILED,
                    error_message=str(e),
                    max_retries=0
                )
                db.session.add(task_log)
                db.session.commit()

                raise

        return wrapper
    return decorator
