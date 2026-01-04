from app.service.nav_history_service import FundNavHistoryService
from flask import current_app

service = FundNavHistoryService()


def crawl_all_fund_net_values():
    """爬取基金净值数据 - 自动在应用上下文中执行"""
    current_app.logger.info('[crawl_all_fund_net_values] Job开始')
    result = service.crawl_all_nav_history()
    if result['errors']:
        current_app.logger.error('[Job] 出错: %s', result['errors'])
    else:
        current_app.logger.info('[Job] 完成，共 %s 条', result['inserted'])
