# app/scheduler/__init__.py
import os
from .daily_snapshot_consume_job import consume_async_tasks
from .daily_snapshot_produce_job import produce_async_tasks
from .net_value_jobs import crawl_holding_data


def _context_wrapper(app, func):
    """把 app 带进来的闭包"""

    def inner():
        with app.app_context():
            func()

    return inner


# 把调度器初始化逻辑集中到这里
def init_scheduler(app, scheduler):
    """注册所有定时任务"""
    # 检查是否是迁移模式，如果是则跳过 scheduler 初始化
    if os.environ.get('MIGRATION_MODE'):
        app.logger.info("Migration mode detected, skipping scheduler initialization")
        return

    # 初始化调度器
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
        minutes=3,
        replace_existing=True
    )

    scheduler.start()
    app.logger.info("APScheduler started with jobs")

    #     scheduler.add_job(
#         id='test_job',
#         func=crawl_all_fund_net_values,
#         trigger='interval',
#         seconds=10
#     )
# scheduler.add_job(
#     crawl_all_fund_net_values,
#     'cron',
#     hour=0,
#     minute=1,
#     id='crawl_all_fund_net_values'
# )
