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
        # 调用 Manager 的核心方法
        # batch_size=20 表示每次轮询最多处理 20 个任务，防止瞬间负载过高
        logger.info("Starting produce_async_tasks...")
        # TODO 查询用户 分用户创建任务
        prev_date = trade_calendar.prev_trade_day()
        user_list = UserSetting.query.all()
        for user in user_list:
            # hs
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating holding snapshots",
                module_path="app.service.holding_snapshot_service_new",
                method_name="generate_snapshots",
                kwargs={"start_date": prev_date, "end_date": prev_date},
            )
            # has
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating holding analytics snapshots",
                module_path="app.service.holding_analytics_snapshot_service_new",
                class_name="HoldingAnalyticsSnapshotService",
                method_name="generate_analytics",
                kwargs={"start_date": prev_date, "end_date": prev_date},
            )
            # ias
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating portofolio snapshots",
                module_path="app.service.holding_analytics_snapshot_service",
                class_name="InvestedAssetAnalyticsSnapshotService",
                method_name="generate_snapshots",
                kwargs={"start_date": prev_date, "end_date": prev_date},
            )
            # iaas
            create_task(
                user_id=user.id,
                task_name=f"{prev_date} daily job: generating portofolio analytics snapshots",
                module_path="app.service.invested_asset_analytics_snapshot_service_new",
                class_name="InvestedAssetAnalyticsSnapshotService",
                method_name="generate_analytics",
                kwargs={"start_date": prev_date, "end_date": prev_date},
            )
        logger.info("produce_async_tasks finished.")

    except Exception as e:
        # 这里的异常通常是数据库连接问题，记录日志即可，不要抛出，防止 APScheduler 停止该 Job
        logger.exception(f"Error in consume_async_tasks job: {e}")
