from datetime import datetime

from flask import current_app
from flask_babel import gettext as _
from loguru import logger
from sqlalchemy import func, desc, or_

from app.constant.biz_enums import AlertRuleActionEnum, AlertEmailStatusEnum
from app.framework.exceptions import BizException
from app.models import db, AlertRule, AlertHistory, Holding, UserSetting, FundNavHistory
from app.service.mail_service import send_email
from app.service.nav_history_service import FundNavHistoryService
from app.utils.date_util import get_yesterday_date_str


class AlertService:
    @classmethod
    def check_alert_rules(cls):
        """检查所有活跃的提醒规则"""
        active_rules = AlertRule.query.filter_by(ar_is_active=True).all()
        # # 获取active_rules所有的持仓代码 ho_code
        # ho_codes = list(set(rule.ho_code for rule in active_rules if hasattr(rule, 'ho_code') and rule.ho_code))
        # # 获取代码最近的一个净值
        # nav_list= NavHistory.query.filter(NavHistory.ho_code.in_(ho_codes))

        latest_records_subq = db.session.query(
            FundNavHistory,
            func.row_number().over(
                partition_by=FundNavHistory.ho_code,
                order_by=desc(FundNavHistory.nav_date)
            ).label('row_num')
        ).join(
            AlertRule, FundNavHistory.ho_code == AlertRule.ho_code
        ).filter(
            AlertRule.ar_is_active == 1
        ).subquery()

        # 查询每组的第一条记录
        latest_nav_list = db.session.query(FundNavHistory) \
            .join(
            latest_records_subq,
            FundNavHistory.ho_code == latest_records_subq.c.ho_code
        ) \
            .filter(latest_records_subq.c.row_num == 1) \
            .all()

        nav_map = {item.ho_code: item for item in latest_nav_list}

        for rule in active_rules:
            try:
                cls.check_single_rule(rule, nav_map.get(rule.ho_code))
            except Exception as e:
                # 记录错误但继续处理其他规则
                logger.info(f"处理规则 {str(rule)} 时出错: {str(e)}")

    @classmethod
    def check_single_rule(cls, rule, nav):
        """检查单个提醒规则"""
        ar_tracked_date = rule.tracked_date
        yesterday = get_yesterday_date_str()
        if ar_tracked_date >= yesterday:
            return

        # 获取从 ar_tracked_date 到昨天的净值
        nav_data = FundNavHistoryService.search_list(
            ho_code=rule.ho_code,
            start_date=ar_tracked_date,
            end_date=yesterday
        )
        # nav_map = {nav.nav_date: nav.nav_per_unit for nav in nav_data}
        target_price = rule.target_price
        for nav_item in nav_data:
            if nav_item['nav_date'] <= ar_tracked_date:
                continue

            ar_type = rule.action
            nav_per_unit = nav_item['nav_per_unit']
            # 分情况判断
            if AlertRuleActionEnum.BUY.value == ar_type:
                if nav_per_unit <= target_price:
                    cls._add_history(rule, nav_item)
            elif AlertRuleActionEnum.SELL.value == ar_type:
                if nav_per_unit >= target_price:
                    cls._add_history(rule, nav_item)
            # 更新rule追踪日期
            rule.tracked_date = nav_item['nav_date']
            db.session.add(rule)
            db.session.commit()

    @classmethod
    def _add_history(cls, rule, nav_item):
        try:
            # 创建提醒历史记录
            history = AlertHistory(
                ar_id=rule.id,
                ah_status=AlertEmailStatusEnum.PENDING,  # 初始状态为待发送
                ho_code=rule.ho_code,
                ah_ar_type=rule.action,
                ah_nav_per_unit=nav_item['nav_per_unit'],
                ah_trigger_nav_date=nav_item['nav_date'],
                ah_target_price=rule.target_price,
                ah_ar_name=rule.ar_name,
            )
            db.session.add(history)
            # 更新rule跟踪日期
            if history.trigger_nav_date > rule.tracked_date:
                rule.tracked_date = nav_item['nav_date']
            db.session.add(rule)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.info(e)
            raise BizException(_("ALERT_RECORD_CREATE_FAILED"))

    @classmethod
    def trigger_alert_job(cls):
        """触发提醒并发送邮件"""
        # 检查所有需要发送的
        pending_histories = AlertHistory.query.filter(
            or_(
                AlertHistory.send_status == AlertEmailStatusEnum.PENDING,
                AlertHistory.send_status == AlertEmailStatusEnum.FAILED
            )
        ).all()
        if not pending_histories:
            logger.info("没有待发送的提醒邮件")
            return

        # key:ar_id value:ah_list
        from collections import defaultdict
        histories_by_rule = defaultdict(list)
        for history in pending_histories:
            histories_by_rule[history.id].append(history)

        # 获取rule
        ar_ids = list(histories_by_rule.keys())
        # ar_ids = set({ahl.ar_id for ahl in active_history_list})
        alert_rules = AlertRule.query.filter(AlertRule.id.in_(ar_ids)).all()

        for rule in alert_rules:
            # rule下所有的history
            ah_list = histories_by_rule.get(rule.id, [])
            if not ah_list:
                continue

            # 获取用户
            # user = UserSetting.query.get(rule.user_id)
            user = UserSetting.query.first()
            # 获取基金信息
            holding = Holding.query.filter_by(ho_code=rule.ho_code).first()

            # 如果没用户信息 备注
            if not user or not user.email_address:
                for history in ah_list:
                    # 更新history状态
                    history.send_status = 'FAILED'
                    history.remark = _("USER_EMAIL_NOT_EXISTS")

                # db.session.add(ah_list)
                # db.session.add(rule)
                db.session.commit()
                continue
            # 有用户信息 发送邮件
            for history in ah_list:
                try:
                    send_email(
                        to=user.email_address,
                        subject=f"{_('EMAIL_SUBJECT_TRIGGER_ALERT')}: {history.ar_name}",
                        template='alert_notification.html',
                        user=user,
                        history=history,
                        ho_code=rule.ho_code,
                        ho_name=holding.ho_name,
                        action=history.action,
                        current_year=datetime.now().year
                    )

                    # 更新状态为已发送
                    history.send_status = AlertEmailStatusEnum.SENT
                    history.sent_time = datetime.now()
                    history.remark = ''
                    rule.tracked_date = history.trigger_nav_date
                    # db.session.commit()
                except Exception as e:
                    # db.session.rollback()
                    # 记录发送失败
                    history.send_status = AlertEmailStatusEnum.FAILED
                    error_msg = _("SEND_EMAIL_FAILED") % {"error": str(e)}
                    history.remark = error_msg
                    # db.session.commit()
                    current_app.logger.exception(error_msg)
                db.session.commit()
