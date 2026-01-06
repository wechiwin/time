# app/framework/async_task_manager.py
import importlib
import json
import logging
import time
from datetime import datetime, timedelta
from functools import wraps
from typing import Callable

from app.constant.biz_enums import TaskStatusEnum
from app.models import db, AsyncTaskLog

logger = logging.getLogger(__name__)


class AsyncTaskExecutionError(Exception):
    pass


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


def async_task(task_name: str, max_retries: int = 3, queue: str = 'default'):
    """
    装饰器：将一个普通方法转变为可管理的异步任务。
    """

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 检查是否已经由任务管理器调用（避免无限递归）
            # 可以通过一个特殊的上下文变量或 kwargs 中的标志来判断
            is_direct_call = kwargs.pop('_is_direct_task_call', False)
            if is_direct_call:
                return func(*args, **kwargs)

            # --- 拦截调用，获取反射信息 ---
            module_path = func.__module__
            class_name = args[0].__class__.__name__ if args and hasattr(args[0], '__class__') else None

            task_log = create_task(
                task_name=task_name,
                module_path=module_path,
                class_name=class_name,
                method_name=func.__name__,
                args=args,
                kwargs=kwargs,
                max_retries=max_retries
            )

            # --- 触发执行 ---
            # 在生产环境中，这里是推送到消息队列
            # queue.enqueue(AsyncTaskManager.run_by_log_id, task_log.id)
            # 为了演示，我们直接同步调用执行器
            try:
                return AsyncTaskManager.run_by_log_id(task_log.id)
            except AsyncTaskExecutionError:
                logger.error(f"Execution of task {task_log.id} failed permanently.")
                return {"error": "Task failed permanently.", "task_log_id": task_log.id}

        return wrapper

    return decorator


def create_task(
        task_name: str,
        module_path: str,
        method_name: str,
        args: list = None,
        kwargs: dict = None,
        class_name: str = None,
        max_retries: int = 3,
        error_message: str = None,
) -> AsyncTaskLog:
    """
    手动创建一个异步任务记录。

    :param task_name: 任务的友好名称。
    :param module_path: 方法所在的模块路径，如 'app.services.my_service'。
    :param method_name: 方法名，如 'my_complex_method'。
    :param args: 调用方法时传递的位置参数列表。
    :param kwargs: 调用方法时传递的关键字参数字典。
    :param class_name: 如果是类方法，提供类名。
    :param max_retries: 最大重试次数。
    :param error_message: 错误消息。
    :return: 创建的 AsyncTaskLog 对象。
    """
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
