# app/scheduler/async_task_log_job.py
from loguru import logger

from app.framework.async_task_manager import AsyncTaskManager


def consume_async_tasks():
    """
    【核心消费者】
    定期扫描 AsyncTaskLog，获取 PENDING 或 RETRYING 的任务并执行。
    由 APScheduler 每分钟触发一次。
    """
    try:
        # 调用 Manager 的核心方法
        # batch_size=20 表示每次轮询最多处理 20 个任务，防止瞬间负载过高
        logger.info("Starting async task consumption cycle...")
        AsyncTaskManager.fetch_and_execute_tasks(batch_size=2)
        logger.info("Async task consumption cycle finished.")

    except Exception as e:
        # 这里的异常通常是数据库连接问题，记录日志即可，不要抛出，防止 APScheduler 停止该 Job
        logger.exception(f"Error in consume_async_tasks job: {e}")
