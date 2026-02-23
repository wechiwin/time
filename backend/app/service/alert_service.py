from datetime import datetime

from flask_babel import gettext as _, force_locale
from loguru import logger
from sqlalchemy import or_

from app.constant.biz_enums import AlertRuleActionEnum, AlertEmailStatusEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.framework.exceptions import BizException
from app.models import db, AlertRule, AlertHistory, Holding, UserSetting, FundNavHistory
from app.service.mail_service import send_email
from app.service.nav_history_service import FundNavHistoryService
from app.utils.date_util import get_yesterday_date


class AlertService:
    @classmethod
    def check_alert_rules(cls):
        """检查所有活跃的提醒规则"""
        active_rules = AlertRule.query.filter_by(ar_is_active=GlobalYesOrNo.YES).all()
        if not active_rules:
            logger.info("no active rules")
            return

        for rule in active_rules:
            # 提前存储rule名称，避免异常后访问懒加载属性
            rule_name = rule.ar_name
            try:
                cls.check_single_rule(rule)
            except Exception as e:
                # 回滚会话以重置状态
                db.session.rollback()
                # 记录错误但继续处理其他规则
                logger.error(f"error when handle rule [{rule_name}]: {str(e)}")

    @classmethod
    def check_single_rule(cls, rule: AlertRule):
        """检查单个提醒规则"""
        ar_tracked_date = rule.tracked_date
        yesterday = get_yesterday_date()
        if ar_tracked_date >= yesterday:
            return

        holding = Holding.query.filter_by(id=rule.ho_id).first()
        if not holding:
            logger.warning(f"cannot find holding with id:{rule.ho_id}")
            return

        # 获取从 ar_tracked_date 到昨天的净值
        nav_data = FundNavHistoryService.search_list(
            ho_id=holding.id,
            start_date=ar_tracked_date,
            end_date=yesterday
        )
        target_price = rule.target_price
        for nav_item in nav_data:
            if nav_item.nav_date <= ar_tracked_date:
                continue

            ar_type = rule.action
            nav_per_unit = nav_item.nav_per_unit
            # 分情况判断
            if AlertRuleActionEnum.BUY.value == ar_type:
                if nav_per_unit <= target_price:
                    cls._add_history(rule, nav_item)
            elif AlertRuleActionEnum.SELL.value == ar_type:
                if nav_per_unit >= target_price:
                    cls._add_history(rule, nav_item)
            # 更新rule追踪日期
            rule.tracked_date = nav_item.nav_date
            db.session.add(rule)
            db.session.commit()

    @classmethod
    def _add_history(cls, rule: AlertRule, nav_item: FundNavHistory):
        try:
            # 创建提醒历史记录
            history = AlertHistory(
                ar_id=rule.id,
                user_id=rule.user_id,
                ho_id=rule.ho_id,
                ho_code=rule.ho_code,
                ar_name=rule.ar_name,
                action=rule.action,
                trigger_price=nav_item.nav_per_unit,
                trigger_nav_date=nav_item.nav_date,
                target_price=rule.target_price,
                send_status=AlertEmailStatusEnum.PENDING.value,
            )
            db.session.add(history)
            # 更新rule跟踪日期
            if history.trigger_nav_date > rule.tracked_date:
                rule.tracked_date = nav_item.nav_date
            db.session.add(rule)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.info(e)
            raise BizException(_("ALERT_RECORD_CREATE_FAILED"))

    @classmethod
    def send_alert_mail(cls):
        """发送提醒邮件"""
        # 检查所有需要发送的
        to_send_histories = AlertHistory.query.filter(
            or_(
                AlertHistory.send_status == AlertEmailStatusEnum.PENDING.value,
                AlertHistory.send_status == AlertEmailStatusEnum.FAILED.value
            )
        ).all()
        if not to_send_histories:
            logger.info("no history to send email")
            return

        from collections import defaultdict

        # 预加载所有用户信息 {user_id: UserSetting}
        user_ids = list(set(h.user_id for h in to_send_histories if h.user_id))
        users = UserSetting.query.filter(UserSetting.id.in_(user_ids)).all()
        user_map = {user.id: user for user in users}

        # 预加载所有持仓信息 {ho_id: Holding}
        ho_ids = list(set(h.ho_id for h in to_send_histories if h.ho_id))
        holdings = Holding.query.filter(Holding.id.in_(ho_ids)).all()
        holding_map = {h.id: h for h in holdings}

        # 按用户分组，便于使用用户语言设置
        histories_by_user = defaultdict(list)
        for history in to_send_histories:
            histories_by_user[history.user_id].append(history)

        for user_id, ah_list in histories_by_user.items():
            # 从预加载的map中获取用户
            user = user_map.get(user_id)
            if not user or not user.email_address:
                for history in ah_list:
                    history.send_status = AlertEmailStatusEnum.FAILED.value
                    history.remark = _("USER_EMAIL_NOT_EXISTS")
                db.session.commit()
                continue

            # 获取用户的语言设置，默认英语
            user_locale = user.default_lang or 'en'
            if user_locale not in {'zh', 'en', 'it'}:
                user_locale = 'en'

            # 发送邮件（使用用户的语言设置）
            with force_locale(user_locale):
                for history in ah_list:
                    # 从预加载的map中获取持仓
                    holding = holding_map.get(history.ho_id)
                    ho_name = holding.ho_name if holding else history.ho_code

                    try:
                        send_email(
                            to=user.email_address,
                            subject=f"{_('EMAIL_SUBJECT_TRIGGER_ALERT')}: {history.ar_name}",
                            template='alert_notification.html',
                            user=user,
                            history=history,
                            ho_code=history.ho_code,
                            ho_name=ho_name,
                            action=history.action,
                            current_year=datetime.now().year
                        )

                        # 更新状态为已发送
                        history.send_status = AlertEmailStatusEnum.SENT.value
                        history.sent_time = datetime.now()
                        history.remark = ''

                    except Exception as e:
                        # 记录发送失败
                        history.send_status = AlertEmailStatusEnum.FAILED.value
                        error_msg = _("SEND_EMAIL_FAILED") % {"error": str(e)}
                        history.remark = error_msg
                        logger.exception(error_msg)

            db.session.commit()
