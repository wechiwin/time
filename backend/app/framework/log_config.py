# /app/framework/log_config.py

import logging
import re
from datetime import date, timedelta
from logging.handlers import BaseRotatingHandler
from pathlib import Path

# 设置日志格式，保持不变
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s:%(funcName)s:%(lineno)d: %(message)s'
)


class SizedDailyRotatingFileHandler(BaseRotatingHandler):
    """
    一个健壮的、同时按日期和大小轮转的日志处理器。

    重构亮点:
    1.  文件名管理逻辑更清晰，减少了内部状态变量的复杂性。
    2.  轮转 (doRollover) 逻辑简化，职责更分明。
    3.  日志清理 (_cleanup_old_files) 逻辑更健壮，通过解析文件名中的日期来判断是否过期，
        而非依赖可能变化的文件修改时间 (mtime)。
    4.  线程安全 (继承自 BaseRotatingHandler，emit 方法是线程安全的)。
    """

    def __init__(self, filename, maxBytes=0, backupDays=7, encoding=None, delay=False):
        self.base_filename = Path(filename)
        self.maxBytes = maxBytes
        self.backupDays = backupDays
        self._current_date = date.today()

        # 初始化时，直接计算出当前应该写入的文件名
        current_log_path = self._get_dated_filename(self._current_date)
        super().__init__(current_log_path, 'a', encoding, delay)

    def _get_dated_filename(self, for_date: date) -> Path:
        """根据基础文件名和日期生成带日期的日志文件名"""
        # 例如: /path/to/app.log -> /path/to/app.2026-01-25.log
        stem = self.base_filename.stem
        suffix = self.base_filename.suffix
        return self.base_filename.with_name(f"{stem}.{for_date.strftime('%Y-%m-%d')}{suffix}")

    def shouldRollover(self, record):
        """
        判断是否需要执行轮转。
        触发条件：日期改变 或 当前日志文件大小超限。
        """
        # 1. 检查日期是否改变
        if date.today() != self._current_date:
            return True

        # 2. 检查文件大小是否超限
        if self.maxBytes > 0 and self.stream and self.stream.tell() >= self.maxBytes:
            return True

        return False

    def doRollover(self):
        """
        执行轮转操作。
        """
        if self.stream:
            self.stream.close()
            self.stream = None

        today = date.today()
        # 如果是日期变化导致的轮转
        if today != self._current_date:
            self._current_date = today
            self.baseFilename = self._get_dated_filename(today)
            # 日期变化后，清理一次旧日志
            self._cleanup_old_files()
        else:
            # 如果是因大小超限导致的轮转 (在同一天内)
            # 生成分片文件名，如 app.2026-01-25.log -> app.2026-01-25.log.1
            counter = 1
            new_filename = Path(f"{self.baseFilename}.{counter}")
            while new_filename.exists():
                counter += 1
                new_filename = Path(f"{self.baseFilename}.{counter}")
            self.baseFilename = new_filename

        if not self.delay:
            self.stream = self._open()

    def _cleanup_old_files(self):
        """
        清理超过指定天数的旧日志文件。
        通过解析文件名中的日期来判断，比检查 mtime 更可靠。
        """
        if self.backupDays <= 0:
            return

        cutoff_date = date.today() - timedelta(days=self.backupDays)
        log_dir = self.base_filename.parent
        base_stem = self.base_filename.stem

        # 正则表达式匹配形如 "app.2026-01-25.log" 或 "app.2026-01-25.log.1" 的文件名
        date_pattern = re.compile(rf"{re.escape(base_stem)}\.(\d{{4}}-\d{{2}}-\d{{2}}).*")

        try:
            for filepath in log_dir.iterdir():
                if not filepath.is_file():
                    continue

                match = date_pattern.match(filepath.name)
                if match:
                    log_date_str = match.group(1)
                    try:
                        log_date = date.fromisoformat(log_date_str)
                        if log_date < cutoff_date:
                            filepath.unlink()  # os.remove(filepath)
                    except (ValueError, OSError):
                        # 忽略解析错误或删除失败的文件
                        continue
        except OSError:
            # 忽略目录读取错误
            pass

    def emit(self, record):
        """线程安全的日志输出"""
        try:
            if self.shouldRollover(record):
                self.doRollover()
            super().emit(record)
        except Exception:
            self.handleError(record)


def setup_logging(app):
    """
    配置应用日志系统。
    """
    # 1. 从配置中获取参数，提供默认值
    log_dir = Path(app.config.get('LOG_DIR', 'logs'))
    log_file = app.config.get('LOG_FILE', 'app.log')
    log_max_bytes = int(app.config.get('LOG_MAX_SIZE_IN_MB', 10)) * 1024 * 1024
    log_path = log_dir / log_file
    log_level_str = app.config.get('LOG_LEVEL', 'INFO')
    log_level = getattr(logging, log_level_str.upper(), logging.INFO)

    # 2. 创建logs目录，使用 exist_ok=True 避免并发问题
    log_dir.mkdir(parents=True, exist_ok=True)

    # 3. 清理已有 handlers，防止重复日志
    # 在 Gunicorn 环境下，这确保每个 worker 进程都从一个干净的状态开始配置日志
    root_logger = logging.getLogger()
    if root_logger.hasHandlers():
        for h in root_logger.handlers[:]:
            root_logger.removeHandler(h)

    for handler in app.logger.handlers[:]:
        app.logger.removeHandler(handler)

    # 4. 创建并配置 Handlers
    handlers = []

    # 控制台 handler - 只在开发环境使用
    if app.config.get('ENV') == 'development':
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        handlers.append(console_handler)

    # 文件 Handler
    file_handler = SizedDailyRotatingFileHandler(
        filename=log_path,
        maxBytes=log_max_bytes,
        backupDays=app.config.get('LOG_BACKUP_DAYS', 7),
        encoding='utf-8',
        delay=True
    )
    file_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
    file_handler.setFormatter(formatter)
    handlers.append(file_handler)

    # 5. 配置 App Logger
    app.logger.setLevel(log_level)
    for h in handlers:
        app.logger.addHandler(h)
    app.logger.propagate = False  # 极其重要，防止日志向上传递给 root logger 导致重复

    # 6. 配置第三方库的 Logger (这是非常好的实践)
    # 通过设置 propagate = True，让它们的日志汇入 app.logger 统一处理
    loggers_to_configure = {
        'werkzeug': logging.WARNING,
        'sqlalchemy.engine': logging.INFO,
        'flask_sqlalchemy': logging.INFO,
        'apscheduler': logging.INFO,
    }
    if app.debug:
        loggers_to_configure['sqlalchemy.engine'] = logging.DEBUG

    for logger_name, level in loggers_to_configure.items():
        logger = logging.getLogger(logger_name)
        logger.setLevel(level)
        logger.propagate = True

    app.logger.info('Application logging initialized')


def get_early_logger(name: str = 'flask.app'):
    """
    在 create_app() 期间，setup_logging() 完成前，提供一个临时的 logger。

    工作机制:
    1. 首次调用时，创建一个临时的 StreamHandler，日志会输出到控制台。
    2. 当 setup_logging(app) 执行时，它会清除 app.logger 上的所有 handlers（包括这个临时的）。
    3. 然后 setup_logging(app) 会添加最终配置好的 handlers (如 FileHandler)。
    4. 因此，后续通过 app.logger 产生的日志会按最终配置写入文件。
    """
    logger = logging.getLogger(name)
    if not logger.hasHandlers():
        logger.propagate = False
        tmp_handler = logging.StreamHandler()
        tmp_handler.setFormatter(formatter)
        logger.addHandler(tmp_handler)
        logger.setLevel(logging.DEBUG)
    return logger
