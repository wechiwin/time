# app/scheduler/async_task_log_job.py
from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.framework.async_task_manager import create_task
from app.models import UserSetting


def produce_async_tasks():
    """
    创建每天需要运行的快照任务
    """
    try:
        logger.info("Starting produce_async_tasks...")
        prev_date = trade_calendar.prev_trade_day()
        user_list = UserSetting.query.all()

        for user in user_list:
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating holding snapshots",
                module_path="app.service.task_service",
                method_name="generate_yesterday_snapshot",
                kwargs={"user_id": user.id, "start_date": str(prev_date), "end_date": str(prev_date)},
            )

        logger.info("produce_async_tasks finished.")

    except Exception as e:
        logger.exception(f"Error in produce_async_tasks job: {e}")
