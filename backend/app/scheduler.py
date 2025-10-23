from .jobs.net_value_jobs import crawl_all_fund_net_values


def _context_wrapper(app, func):
    """把 app 带进来的闭包"""

    def inner():
        with app.app_context():
            func()

    return inner


# 把调度器初始化逻辑集中到这里
def init_scheduler(app, scheduler):
    """注册所有定时任务"""
    scheduler.init_app(app)

    # 统一加任务
    scheduler.add_job(
        id='crawl_all_fund_net_values',
        func=_context_wrapper(app, crawl_all_fund_net_values),
        trigger='cron',
        hour=2,
        minute=0,
        second=0,
        replace_existing=True
    )

    scheduler.start()

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
