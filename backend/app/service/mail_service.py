import threading

from flask import current_app, render_template
from flask_mail import Message
from loguru import logger


def send_async_email(app, msg):
    """异步发送邮件"""
    with app.app_context():
        try:
            # 打印当前配置（调试用）
            logger.info(f"邮件配置: server={app.config.get('MAIL_SERVER')}, "
                        f"port={app.config.get('MAIL_PORT')}, "
                        f"use_ssl={app.config.get('MAIL_USE_SSL')}, "
                        f"use_tls={app.config.get('MAIL_USE_TLS')}")
            # 运行时动态获取 mail 扩展
            mail = current_app.extensions.get('mail')
            if not mail:
                raise RuntimeError("Flask-Mail extension not initialized")

            # 测试连接
            logger.info("正在连接SMTP服务器...")
            mail.send(msg)
            current_app.logger.info(f"邮件发送成功: {msg.subject}")
        except Exception as e:
            current_app.logger.exception(f"邮件发送失败: {str(e)}")
            raise  # 重新抛出异常，让调用者知道发送失败


def send_email(to, subject, template=None, async_mode=False, **kwargs):
    """
    发送邮件核心方法

    参数:
        to: 收件人邮箱地址
        subject: 邮件主题
        template: 邮件模板路径(可选)
        async_mode: 是否异步发送(默认False，同步发送)
        **kwargs: 模板参数
    """
    app = current_app._get_current_object()

    # 获取 mail 扩展实例
    mail = app.extensions.get('mail')
    if not mail:
        raise RuntimeError("Flask-Mail extension not initialized")
    # 创建邮件消息
    msg = Message(
        subject=subject,
        recipients=[to],
        sender=app.config['MAIL_DEFAULT_SENDER']
    )

    # 如果有模板则使用模板，否则使用简单文本
    if template:
        msg.html = render_template(template, **kwargs)
    else:
        msg.body = kwargs.get('body', '')

    if async_mode:
        # 异步发送邮件
        thr = threading.Thread(target=send_async_email, args=(app, msg))
        thr.start()
        return thr
    else:
        # 同步发送邮件
        mail.send(msg)
        logger.info(f"邮件发送成功: {subject}")
        return True
