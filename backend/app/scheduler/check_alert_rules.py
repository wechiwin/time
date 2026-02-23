# app/scheduler/alert_jobs.py
from loguru import logger

from app.framework.system_task_wrapper import with_task_logging
from app.service.alert_service import AlertService


@with_task_logging("check_alert_rules")
def check_alert_rules():
    """检查所有活跃的提醒规则"""
    logger.info('[check_alert_rules] Job开始')
    try:
        AlertService.check_alert_rules()
        logger.info('[check_alert_rules] 完成')
    except Exception as e:
        logger.exception('[check_alert_rules] 出错: %s', str(e))
        raise


@with_task_logging("send_alert_mail")
def send_alert_mail():
    """发送提醒邮件"""
    logger.info('[send_alert_mail] Job开始')
    try:
        AlertService.send_alert_mail()
        logger.info('[send_alert_mail] 完成')
    except Exception as e:
        logger.exception('[send_alert_mail] 出错: %s', str(e))
        raise
