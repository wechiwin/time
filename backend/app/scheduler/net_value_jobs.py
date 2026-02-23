# app/scheduler/net_value_jobs.py
from flask import current_app
from loguru import logger

from app.framework.system_task_wrapper import with_task_logging
from app.service.nav_history_service import FundNavHistoryService


@with_task_logging("crawl_holding_data")
def crawl_holding_data():
    """爬取昨天的价格等数据"""
    logger.info('[crawl_holding_data] Job开始')
    result = FundNavHistoryService.crawl_yesterday_nav_history()
    if result['errors']:
        logger.error('[crawl_holding_data] 出错: %s', result['errors'])
    else:
        logger.info('[crawl_holding_data] 完成，共 %s 条', result['inserted'])
    return result
