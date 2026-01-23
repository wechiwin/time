import glob
import logging
import os
import re
import time
from logging.handlers import BaseRotatingHandler


class SizedDailyRotatingFileHandler(BaseRotatingHandler):
    """
    同时按天和大小轮转的日志处理器

    特性：
    1. 每天午夜自动创建新日志文件
    2. 当天日志超过指定大小时，自动分片（.1, .2, .3...）
    3. 自动清理超过指定天数的旧日志（包括所有分片）
    4. 线程安全，性能更好
    """

    def __init__(self, filename, maxBytes=0, backupDays=7, encoding=None, delay=False):
        self.maxBytes = maxBytes
        self.backupDays = backupDays
        self.base_filename = filename
        self.current_day = time.strftime("%Y-%m-%d")
        self.current_filename = self._get_current_filename()

        super().__init__(self.current_filename, 'a', encoding, delay)

    def _get_current_filename(self):
        """获取当前日期对应的日志文件名"""
        today = time.strftime("%Y-%m-%d")
        return f"{self.base_filename}.{today}"

    def _get_next_filename(self, base_name):
        """获取下一个可用的分片文件名"""
        counter = 1
        while os.path.exists(f"{base_name}.{counter}"):
            counter += 1
        return f"{base_name}.{counter}"

    def shouldRollover(self, record):
        """检查是否需要轮转"""
        now_day = time.strftime("%Y-%m-%d")
        if now_day != self.current_day:
            return True

        if self.maxBytes > 0:
            current_file = self.baseFilename
            if os.path.exists(current_file):
                try:
                    file_size = os.path.getsize(current_file)
                    should_rotate = file_size >= self.maxBytes
                    if should_rotate:
                        print(f"大小轮转: {current_file} 大小: {file_size}/{self.maxBytes}")
                    return should_rotate
                except OSError as e:
                    print(f"获取文件大小失败: {e}")
                    return False

        return False

    def doRollover(self):
        """执行轮转"""
        if self.stream:
            self.stream.close()
            self.stream = None

        now_day = time.strftime("%Y-%m-%d")
        if now_day != self.current_day:
            # 日期变化，重置
            self.current_day = now_day
            self.current_filename = self._get_current_filename()
            self.baseFilename = self.current_filename
        else:
            # 同一天内分片
            self.baseFilename = self._get_next_filename(self.current_filename)

        if not self.delay:
            self.stream = self._open()

        self._cleanup_old_files()

    def _cleanup_old_files(self):
        """清理超过指定天数的旧日志文件"""
        if self.backupDays <= 0:
            return

        cutoff_time = time.time() - (self.backupDays * 86400)
        pattern = f"{self.base_filename}.*"

        for filepath in glob.glob(pattern):
            try:
                if filepath != self.baseFilename and os.path.getmtime(filepath) < cutoff_time:
                    os.remove(filepath)
            except (OSError, FileNotFoundError):
                pass

    def emit(self, record):
        """线程安全的日志输出"""
        try:
            if self.shouldRollover(record):
                self.doRollover()
            super().emit(record)
        except Exception:
            self.handleError(record)


# 设置日志格式
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s:%(funcName)s:%(lineno)d: %(message)s'
)


def setup_logging(app):
    """
    配置应用日志系统。
    """
    # 1. 从配置中获取参数，提供默认值
    log_dir = app.config.get('LOG_DIR', 'logs')
    log_file = app.config.get('LOG_FILE', 'app.log')
    log_max_bytes = int(app.config.get('LOG_MAX_SIZE_IN_MB', 10)) * 1024 * 1024
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
    file_handler = SizedDailyRotatingFileHandler(
        filename='logs/app.log',  # 自动生成 app.log.2025-10-23 等文件
        maxBytes=log_max_bytes,
        encoding='utf-8',
        delay=True
    )
    file_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
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
    sqlalchemy_engine_logger.propagate = True

    # Flask-SQLAlchemy ORM 层日志
    flask_sqlalchemy_logger = logging.getLogger('flask_sqlalchemy')
    flask_sqlalchemy_logger.setLevel(logging.INFO)
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

    return logger
