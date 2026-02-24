# app/scheduler/__init__.py
import os

from .check_alert_rules import check_alert_rules, send_alert_mail
from .crawl_holding_data import crawl_holding_data
from .daily_snapshot_consume_job import consume_async_tasks
from .daily_snapshot_produce_job import produce_async_tasks


def _context_wrapper(app, func):
    """把 app 带进来的闭包"""

    def inner():
        with app.app_context():
            func()

    return inner


# 把调度器初始化逻辑集中到这里
def init_scheduler(app, scheduler):
    """
    注册所有定时任务并启动调度器

    注意：scheduler.init_app(app) 应该在 factory.py 中调用
    这里只负责添加 jobs 和启动 scheduler
    """
    # 检查是否是迁移模式，如果是则跳过 scheduler 初始化
    if os.environ.get('MIGRATION_MODE'):
        app.logger.info("Migration mode detected, skipping scheduler initialization")
        return

    # 检查是否应该运行 scheduler（Gunicorn 多 worker 场景）
    # RUN_SCHEDULER 由 gunicorn.conf.py 的 post_worker_init 钩子设置
    # 只有 worker 0 会设置 RUN_SCHEDULER=true
    run_scheduler = os.environ.get('RUN_SCHEDULER', 'true').lower() == 'true'
    if not run_scheduler:
        app.logger.info("RUN_SCHEDULER=false, skipping scheduler initialization (non-primary worker)")
        return

    # 检查 scheduler 是否已经绑定 app
    if not hasattr(scheduler, 'app') or scheduler.app is None:
        app.logger.warning("Scheduler not bound to app, calling init_app first")
        scheduler.init_app(app)

    # 统一加任务
    scheduler.add_job(
        id='crawl_holding_data',
        func=_context_wrapper(app, crawl_holding_data),
        trigger='cron',
        hour=0,
        minute=24,
        second=3,
        replace_existing=True
    )

    scheduler.add_job(
        id='produce_async_tasks',
        func=_context_wrapper(app, produce_async_tasks),
        trigger='cron',
        hour=1,
        minute=22,
        second=3,
        replace_existing=True
    )

    scheduler.add_job(
        id='consume_async_tasks',
        func=_context_wrapper(app, consume_async_tasks),
        trigger='interval',
        minutes=10,
        replace_existing=True
    )

    scheduler.add_job(
        id='check_alert_rules',
        func=_context_wrapper(app, check_alert_rules),
        trigger='cron',
        hour=3,
        minute=24,
        second=3,
        replace_existing=True
    )

    scheduler.add_job(
        id='send_alert_mail',
        func=_context_wrapper(app, send_alert_mail),
        trigger='cron',
        hour=3,
        minute=54,
        second=3,
        replace_existing=True
    )

    scheduler.start()
    app.logger.info("APScheduler started with jobs")
