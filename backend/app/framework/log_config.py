import logging
import os
import re
import time
from logging.handlers import TimedRotatingFileHandler


class SizedTimedRotatingFileHandler(TimedRotatingFileHandler):
    """
    自定义Handler，同时满足：
    1. 每天午夜轮转（TimedRotatingFileHandler的基础功能）
    2. 如果当天日志超过指定大小（maxBytes）则立即轮转
    """

    def __init__(self, filename, maxBytes=0, **kwargs):
        self.maxBytes = maxBytes
        self.current_day = time.strftime("%Y-%m-%d")
        super().__init__(filename, **kwargs)

    def shouldRollover(self, record):
        """
        双重检查：
        1. 是否到了时间轮转点（父类逻辑）
        2. 当前文件是否超过maxBytes
        """
        # 检查日期变化
        now_day = time.strftime("%Y-%m-%d")
        if now_day != self.current_day:
            self.current_day = now_day
            return 1  # 强制轮转

        # 检查文件大小
        if self.maxBytes > 0:
            try:
                # 使用 os.path.getsize 更可靠，即使 stream 未打开也能工作
                if os.path.getsize(self.baseFilename) >= self.maxBytes:
                    return 1
            except FileNotFoundError:
                # 如果文件不存在，则不需要轮转
                pass

        # 父类的时间检查（when/interval）
        return super().shouldRollover(record)


# 设置日志格式
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s:%(funcName)s:%(lineno)d: %(message)s'
)


def setup_logging(app):
    """
    配置应用日志系统。
    期望在 app.config 中有以下配置项：
    - LOG_DIR: 日志文件目录 (默认: 'logs')
    - LOG_FILE: 日志文件名 (默认: 'app.log')
    - LOG_LEVEL: 应用日志级别 (默认: 'INFO')
    - LOG_MAX_BYTES: 日志文件最大大小 (默认: 10MB)
    - LOG_BACKUP_COUNT: 日志备份数量 (默认: 7)
    """
    # 1. 从配置中获取参数，提供默认值
    log_dir = app.config.get('LOG_DIR', 'logs')
    log_file = app.config.get('LOG_FILE', 'app.log')
    log_path = os.path.join(log_dir, log_file)
    log_level_str = app.config.get('LOG_LEVEL', 'INFO')
    log_level = getattr(logging, log_level_str.upper(), logging.INFO)

    # 创建logs目录（如果不存在）
    if not os.path.exists(log_dir):
        os.mkdir(log_dir)

    # 清除所有现有 logger 的 handlers
    root_logger = logging.getLogger()
    for h in root_logger.handlers[:]:
        root_logger.removeHandler(h)
    # 清除 app.logger 的 handlers
    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    # 5. 创建并配置 Handlers
    handlers = []

    # 控制台handler - 只在开发环境使用
    if app.config.get('ENV') == 'development':
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)

    # 文件Handler
    file_handler = SizedTimedRotatingFileHandler(
        filename='logs/app.log',  # 自动生成 app.log.2025-10-23 等文件
        maxBytes=2 * 1024 * 1024,  # 2MB大小限制
        when='midnight',  # 每天凌晨轮转
        interval=1,  # 间隔 1 天
        backupCount=7,  # 最多保留 7 天日志
        encoding='utf-8',
        delay=True
    )
    file_handler.setLevel(logging.DEBUG) if app.debug else logging.INFO
    file_handler.setFormatter(formatter)
    file_handler.suffix = '%Y-%m-%d'  # 按日期命名日志文件
    file_handler.extMatch = re.compile(r'^\d{4}-\d{2}-\d{2}(\.\d+)?$')  # 匹配带数字后缀的文件
    handlers.append(file_handler)

    # 6. 配置 App Logger
    app.logger.setLevel(log_level)
    for h in handlers:
        app.logger.addHandler(h)
    app.logger.propagate = False

    # 7. 配置第三方库的Logger (使用传播，而非直接添加Handler)
    # 这样做的好处是，所有日志都由 app.logger 的 handlers 统一处理，格式和输出位置一致

    # 禁用werkzeug的默认日志处理
    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.setLevel(logging.WARNING)
    werkzeug_logger.propagate = True  # 防止日志被传递到root logger再次处理

    # SQLAlchemy 引擎日志（记录 SQL 数据库日志）
    sqlalchemy_level = logging.DEBUG if app.debug else logging.INFO
    sqlalchemy_engine_logger = logging.getLogger('sqlalchemy.engine')
    sqlalchemy_engine_logger.setLevel(sqlalchemy_level)
    # sqlalchemy_engine_logger.addHandler(file_handler)
    # sqlalchemy_engine_logger.addHandler(console_handler)
    sqlalchemy_engine_logger.propagate = True

    # Flask-SQLAlchemy ORM 层日志
    flask_sqlalchemy_logger = logging.getLogger('flask_sqlalchemy')
    flask_sqlalchemy_logger.setLevel(logging.INFO)
    # flask_sqlalchemy_logger.addHandler(file_handler)
    # flask_sqlalchemy_logger.addHandler(console_handler)
    flask_sqlalchemy_logger.propagate = True

    app.logger.info('Application logging initialized')


def get_early_logger(name: str = 'flask.app'):
    """
    create_app() 之前就能用的 logger，等 setup_logging(app) 执行后会自动接管。
    """
    logger = logging.getLogger(name)

    for h in logger.handlers[:]:
        logger.removeHandler(h)
    logger.propagate = False

    # 先临时写一条到控制台，格式保持一致
    if not logger.handlers:
        tmp_handler = logging.StreamHandler()
        tmp_handler.setFormatter(formatter)
        logger.addHandler(tmp_handler)
        logger.setLevel(logging.DEBUG)
        return logger
