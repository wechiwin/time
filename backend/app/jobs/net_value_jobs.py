from app.routes.nav_history_bp import crawl_missing_nav_history
from flask import current_app


def crawl_all_fund_net_values():
    """爬取基金净值数据 - 自动在应用上下文中执行"""
    current_app.logger.info('[crawl_all_fund_net_values] Job开始')
    result = crawl_missing_nav_history()
    if result['errors']:
        current_app.logger.error('[Job] 出错: %s', result['errors'])
    else:
        current_app.logger.info('[Job] 完成，共 %s 条', result['inserted'])
