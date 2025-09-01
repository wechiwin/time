import logging
from logging.handlers import RotatingFileHandler
import os


def setup_logging(app):
    # 创建logs目录（如果不存在）
    if not os.path.exists('logs'):
        os.mkdir('logs')

    # 清除默认的handlers
    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    # 设置日志格式
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

    # 控制台handler - 只在开发环境使用
    # if app.config.get('ENV') == 'development':
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    app.logger.addHandler(console_handler)

    file_handler = RotatingFileHandler("logs/app.log",
                                       maxBytes=10 * 1024 * 1024,
                                       backupCount=5,
                                       encoding='utf-8',
                                       delay=True)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    file_handler.suffix = '%Y-%m-%d'  # 按日期命名日志文件
    app.logger.addHandler(file_handler)

    # 设置日志级别
    app.logger.setLevel(logging.DEBUG if app.debug else logging.INFO)

    # 禁用werkzeug的默认日志处理
    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.setLevel(logging.WARNING)
    for handler in werkzeug_logger.handlers[:]:
        werkzeug_logger.removeHandler(handler)

    app.logger.info('Application logging initialized')
