# app/scheduler/async_task_log_job.py
from datetime import date, timedelta

from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.constant.biz_enums import TaskStatusEnum
from app.framework.async_task_manager import create_task
from app.models import db, UserSetting, AsyncTaskLog


def produce_async_tasks():
    """
    创建每天需要运行的快照任务。
    如果昨天不是交易日（周末/节假日），记录跳过日志，不创建快照任务。
    """
    try:
        logger.info("Starting produce_async_tasks...")
        yesterday = date.today() - timedelta(days=1)

        user_list = UserSetting.query.all()
        is_trade_day = trade_calendar.is_trade_day(yesterday)

        if not is_trade_day:
            logger.info(f"Yesterday ({yesterday}) is not a trading day, skipping snapshot generation.")
            _batch_create_skip_logs(yesterday, user_list)
            return

        prev_date = trade_calendar.prev_trade_day()

        for user in user_list:
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating holding snapshots",
                module_path="app.service.task_service",
                class_name="TaskService",
                method_name="generate_yesterday_snapshot",
                args=[user.id],
            )

        logger.info("produce_async_tasks finished.")

    except Exception as e:
        logger.exception(f"Error in produce_async_tasks job: {e}")


def _batch_create_skip_logs(target_date: date, user_list: list):
    """昨天非交易日时，批量写入 CANCELLED 状态的任务日志作为审计记录。"""
    for user in user_list:
        db.session.add(AsyncTaskLog(
            user_id=user.id,
            task_name=f"{target_date} daily job: generating holding snapshots",
            params={"reason": "not_a_trading_day"},
            status=TaskStatusEnum.CANCELLED,
            result_summary=f"{target_date} is not a trading day, skipped.",
        ))
    db.session.commit()
