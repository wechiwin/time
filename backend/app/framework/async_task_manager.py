# app/framework/async_task_manager.py
import hashlib
import importlib
import json
import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Any, Dict, Optional

from app.constant.biz_enums import TaskStatusEnum
from app.models import db, AsyncTaskLog

logger = logging.getLogger(__name__)


class AsyncTaskExecutionError(Exception):
    pass


class DeduplicationStrategy(Enum):
    """去重策略枚举"""
    NONE = "none"  # 不去重
    EXACT_MATCH = "exact_match"  # 精确匹配所有参数
    BUSINESS_KEY = "business_key"  # 业务关键字段匹配
    TIME_WINDOW = "time_window"  # 时间窗口内去重


class AsyncTaskManager:
    """
    负责任务的执行、重试和状态管理。
    这是框架的“引擎”。
    """

    @staticmethod
    def run_by_log_id(task_log_id: int):
        """通过日志ID执行任务，这是重试的入口"""
        task_log = AsyncTaskLog.query.get(task_log_id)
        if not task_log:
            logger.error(f"TaskLog with id {task_log_id} not found.")
            return

        if task_log.status not in [TaskStatusEnum.PENDING, TaskStatusEnum.RETRYING]:
            logger.warning(f"TaskLog {task_log_id} is in {task_log.status.value} state, skipping execution.")
            return

        params = task_log.params
        module_path = params['module_path']
        class_name = params.get('class_name')
        method_name = params['method_name']
        args = params.get('args', [])
        kwargs = params.get('kwargs', {})

        try:
            # --- 反射调用 ---
            module = importlib.import_module(module_path)
            if class_name:
                cls = getattr(module, class_name)
                # 对于类方法，需要实例化类（假设构造函数不需要参数）
                instance = cls()
                method = getattr(instance, method_name)
            else:
                # 对于模块级函数
                method = getattr(module, method_name)

            # 1. 更新状态为 RUNNING
            AsyncTaskManager._update_status(task_log, TaskStatusEnum.RUNNING)

            # 2. 执行方法
            start_time = time.time()
            result = method(*args, **kwargs)
            duration = round(time.time() - start_time, 2)

            # 3. 成功，更新状态为 SUCCESS
            AsyncTaskManager._update_status(
                task_log,
                TaskStatusEnum.SUCCESS,
                result_summary=json.dumps(result, default=str)  # 使用 default=str 处理非序列化对象
            )
            logger.info(f"Task {task_log.id} ({task_log.task_name}) succeeded in {duration}s.")
            return result

        except Exception as e:
            # 4. 失败，处理重试逻辑
            task_log.retry_count += 1
            error_message = f"Attempt {task_log.retry_count}/{task_log.max_retries + 1} failed: {str(e)}"
            logger.error(error_message, exc_info=True)

            if task_log.retry_count > task_log.max_retries:
                AsyncTaskManager._update_status(task_log, TaskStatusEnum.FAILED, error_message=error_message)
                logger.error(f"Task {task_log.id} failed permanently.")
                raise AsyncTaskExecutionError(f"Task failed after {task_log.max_retries} retries.") from e
            else:
                retry_delay = AsyncTaskManager._get_retry_delay(task_log.retry_count)
                next_retry_at = datetime.utcnow() + timedelta(seconds=retry_delay)
                AsyncTaskManager._update_status(
                    task_log,
                    TaskStatusEnum.RETRYING,
                    error_message=error_message,
                    next_retry_at=next_retry_at
                )
                logger.info(f"Task {task_log.id} will retry at {next_retry_at}.")
                # 在实际应用中，这里会调用 APScheduler 或 Celery 来安排下次执行
                # scheduler.add_job(AsyncTaskManager.run_by_log_id, 'date', run_date=next_retry_at, args=[task_log.id])
                # 为演示，我们直接返回，让外部调度器处理
                return {"status": "RETRYING", "next_retry_at": next_retry_at.isoformat()}

    @staticmethod
    def _update_status(task_log: AsyncTaskLog, status: TaskStatusEnum, result_summary: str = None, error_message: str = None, next_retry_at: datetime = None):
        try:
            task_log.status = status
            task_log.result_summary = result_summary
            task_log.error_message = error_message
            task_log.next_retry_at = next_retry_at
            db.session.commit()
        except Exception as e:
            logger.error(f"CRITICAL: Failed to update task log {task_log.id}: {e}")
            db.session.rollback()
            raise AsyncTaskExecutionError("Failed to update task log status.") from e

    @staticmethod
    def _get_retry_delay(attempt: int) -> int:
        base_delay = 10
        max_delay = 600
        delay = base_delay * (2 ** (attempt - 1))
        return min(delay, max_delay)

    @staticmethod
    def _generate_task_fingerprint(
            task_name: str,
            module_path: str,
            method_name: str,
            args: List[Any],
            kwargs: Dict[str, Any],
            class_name: Optional[str] = None
    ) -> str:
        """
        生成任务指纹，用于去重判断

        使用 SHA256 生成唯一标识，确保相同参数的任务生成相同的指纹
        """
        # 构建可序列化的字典
        fingerprint_data = {
            "task_name": task_name,
            "module_path": module_path,
            "method_name": method_name,
            "class_name": class_name,
            "args": args,
            "kwargs": kwargs
        }

        # 序列化为 JSON 字符串，确保顺序一致
        fingerprint_str = json.dumps(
            fingerprint_data,
            sort_keys=True,  # 确保键的顺序一致
            default=str  # 处理非序列化对象
        )

        # 生成 SHA256 哈希
        return hashlib.sha256(fingerprint_str.encode()).hexdigest()

    @staticmethod
    def _find_existing_task(
            task_fingerprint: str,
            statuses: List[TaskStatusEnum] = None,
            time_window_minutes: int = 30
    ) -> Optional[AsyncTaskLog]:
        """
        查找已存在的任务

        Args:
            task_fingerprint: 任务指纹
            statuses: 需要检查的状态列表，默认检查 PENDING 和 RUNNING 状态
            time_window_minutes: 时间窗口（分钟），用于 TIME_WINDOW 策略

        Returns:
            已存在的任务记录，如果不存在则返回 None
        """
        if statuses is None:
            statuses = [TaskStatusEnum.PENDING, TaskStatusEnum.RUNNING, TaskStatusEnum.RETRYING]

        query = AsyncTaskLog.query.filter(
            AsyncTaskLog.task_fingerprint == task_fingerprint,
            AsyncTaskLog.status.in_(statuses)
        )

        if time_window_minutes > 0:
            time_threshold = datetime.utcnow() - timedelta(minutes=time_window_minutes)
            query = query.filter(AsyncTaskLog.created_at >= time_threshold)

        return query.order_by(AsyncTaskLog.created_at.desc()).first()


def create_task(
        task_name: str,
        module_path: str,
        method_name: str,
        args: list = None,
        kwargs: dict = None,
        class_name: str = None,
        max_retries: int = 3,
        error_message: str = None,
        deduplication_strategy: DeduplicationStrategy = DeduplicationStrategy.EXACT_MATCH,
        deduplication_window_minutes: int = 30,
        business_key: str = None,
        force_create: bool = False
) -> AsyncTaskLog:
    """
    手动创建一个异步任务记录，支持去重机制。
    Args:
        task_name: 任务的友好名称。
        module_path: 方法所在的模块路径，如 'app.services.my_service'。
        method_name: 方法名，如 'my_complex_method'。
        args: 调用方法时传递的位置参数列表。
        kwargs: 调用方法时传递的关键字参数字典。
        class_name: 如果是类方法，提供类名。
        max_retries: 最大重试次数。
        error_message: 错误消息。
        deduplication_strategy: 去重策略，默认使用精确匹配。
        deduplication_window_minutes: 去重时间窗口（分钟）。
        business_key: 业务关键字段，用于 BUSINESS_KEY 策略。
        force_create: 是否强制创建新任务（忽略去重）。
    Returns:
        创建的 AsyncTaskLog 对象或已存在的任务记录。
    """

    args = args or []
    kwargs = kwargs or {}

    # 生成任务指纹
    task_fingerprint = AsyncTaskManager._generate_task_fingerprint(
        task_name=task_name,
        module_path=module_path,
        method_name=method_name,
        args=args,
        kwargs=kwargs,
        class_name=class_name
    )
    # 检查是否已存在相同任务（根据策略）
    existing_task = None
    if not force_create and deduplication_strategy != DeduplicationStrategy.NONE:
        if deduplication_strategy == DeduplicationStrategy.EXACT_MATCH:
            # 精确匹配：检查完全相同的任务
            existing_task = AsyncTaskManager._find_existing_task(
                task_fingerprint=task_fingerprint,
                time_window_minutes=deduplication_window_minutes
            )

        elif deduplication_strategy == DeduplicationStrategy.BUSINESS_KEY and business_key:
            # 业务关键字段匹配
            existing_task = AsyncTaskLog.query.filter(
                AsyncTaskLog.task_name == task_name,
                AsyncTaskLog.business_key == business_key,
                AsyncTaskLog.status.in_([TaskStatusEnum.PENDING, TaskStatusEnum.RUNNING, TaskStatusEnum.RETRYING])
            ).first()

        elif deduplication_strategy == DeduplicationStrategy.TIME_WINDOW:
            # 时间窗口内去重：检查相同任务名称在时间窗口内是否存在
            time_threshold = datetime.utcnow() - timedelta(minutes=deduplication_window_minutes)
            existing_task = AsyncTaskLog.query.filter(
                AsyncTaskLog.task_name == task_name,
                AsyncTaskLog.created_at >= time_threshold,
                AsyncTaskLog.status.in_([TaskStatusEnum.PENDING, TaskStatusEnum.RUNNING, TaskStatusEnum.RETRYING])
            ).order_by(AsyncTaskLog.created_at.desc()).first()

    # 如果存在相同任务，返回现有任务
    if existing_task:
        logger.info(f"Found existing task '{task_name}' with ID {existing_task.id}, skipping creation.")
        return existing_task

    params = {
        "module_path": module_path,
        "class_name": class_name,
        "method_name": method_name,
        "args": args or [],
        "kwargs": kwargs or {}
    }

    # 确保参数是可序列化的
    serializable_params = json.loads(json.dumps(params, default=str))

    task_log = AsyncTaskLog(
        task_name=task_name,
        params=serializable_params,
        max_retries=max_retries,
        status=TaskStatusEnum.PENDING,
        error_message=error_message,
    )
    db.session.add(task_log)
    db.session.commit()

    logger.info(f"Manually created task '{task_name}' with log ID: {task_log.id}")
    return task_log
