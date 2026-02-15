# app/scheduler/net_value_jobs.py
from flask import current_app

from app.framework.system_task_wrapper import with_task_logging
from app.service.nav_history_service import FundNavHistoryService


@with_task_logging("Crawl all fund net values")
def crawl_all_fund_net_values():
    """爬取基金净值数据 - 自动在应用上下文中执行"""
    current_app.logger.info('[crawl_all_fund_net_values] Job开始')
    result = FundNavHistoryService.crawl_all_nav_history()
    if result['errors']:
        current_app.logger.error('[Job] 出错: %s', result['errors'])
    else:
        current_app.logger.info('[Job] 完成，共 %s 条', result['inserted'])
    return result
