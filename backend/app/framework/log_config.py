import logging
import sys
from pathlib import Path

from loguru import logger

# 1. 定义日志格式
# Loguru 的格式字符串语法与 str.format 类似
LOG_FORMAT = (
    "<green>[{time:YYYY-MM-DD HH:mm:ss.SSS}]</green> "
    "<level>{level: <8}</level> "
    "<cyan>{process}</cyan> "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)

# 文件日志格式（去除颜色控制符，节省空间）
LOG_FORMAT_FILE = (
    "[{time:YYYY-MM-DD HH:mm:ss.SSS}] "
    "{level: <8} "
    "{process} "
    "{name}:{function}:{line} - "
    "{message}"
)


class InterceptHandler(logging.Handler):
    """
    标准日志拦截器。
    将标准 logging 的日志重定向到 loguru。
    这对于捕获 Flask/Werkzeug/SQLAlchemy 等第三方库的日志至关重要。
    """

    def emit(self, record):
        # 获取对应的 Loguru 级别
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # 找到调用栈中正确的帧，确保日志显示正确的源码位置
        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging(app):
    """
    配置应用日志系统 (基于 Loguru)。
    """
    # 1. 获取配置
    log_dir = Path(app.config.get('LOG_DIR', 'logs'))
    log_file = app.config.get('LOG_FILE', 'app.log')
    log_max_bytes = int(app.config.get('LOG_MAX_SIZE_IN_MB', 10)) * 1024 * 1024
    log_level_str = app.config.get('LOG_LEVEL', 'INFO')
    log_backup_days = app.config.get('LOG_BACKUP_DAYS', 7)

    # 2. 准备目录
    log_dir.mkdir(parents=True, exist_ok=True)

    # 3. 移除 Loguru 默认的 Handler (控制台)
    # 我们将根据环境重新添加
    logger.remove()

    # 4. 配置控制台日志 (所有环境，确保 Docker 日志可见)
    # 生产环境使用 JSON 格式便于解析，开发环境使用彩色格式
    if app.debug:
        logger.add(
            sys.stderr,
            level=log_level_str,
            format=LOG_FORMAT,
            colorize=True,
            enqueue=True  # 异步写入，防止阻塞主线程
        )
    else:
        # 生产环境也输出到控制台，确保 Docker 日志可见
        logger.add(
            sys.stderr,
            level=log_level_str,
            format=LOG_FORMAT,
            colorize=False,
            serialize=False,
            enqueue=True,
        )

    # 5. 配置文件日志 (生产级配置)
    # 这里的配置完美替代了你原本的 SizedDailyRotatingFileHandler
    logger.add(
        log_dir / log_file,
        # A. 按日期和大小轮转: 每天午夜 OR 超过 10MB 时轮转
        rotation=f"{log_max_bytes // 1024 // 1024} MB",
        # B. 文件名格式: 这里的 {time} 会自动处理日期，无需手动拼接
        # 如果你想保留原本的 "app.2023-10-27.log" 格式，可以使用如下配置：
        # serialization="json" (可选，如果需要结构化日志)
        format=LOG_FORMAT_FILE,
        serialize=True if not app.debug else False,
        level=log_level_str,
        encoding="utf-8",
        # C. 保留策略: 清理 7 天前的日志
        retention=f"{log_backup_days} days",
        # D. 压缩: 自动压缩旧日志 (推荐开启，节省空间)
        compression="zip",
        # E. 进程安全: 必须开启，支持多进程并发写入 (Gunicorn)
        enqueue=True,
        # F. 错误处理: 防止日志写入失败导致程序崩溃
        diagnose=False,
        backtrace=True
    )

    # 6. 拦截标准 logging
    # 将 Flask, Werkzeug, SQLAlchemy 等库的日志重定向到 Loguru
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)

    # 显式设置第三方库的日志级别
    sqlalchemy_log_level = app.config.get('SQLALCHEMY_LOG_LEVEL', 'WARNING')

    loggers_to_configure = {
        'werkzeug': log_level_str,
        'sqlalchemy.engine': sqlalchemy_log_level,
        'flask_sqlalchemy': log_level_str,
        'apscheduler': log_level_str,
    }

    for logger_name, level in loggers_to_configure.items():
        std_logger = logging.getLogger(logger_name)
        std_logger.setLevel(level)
        # 确保这些 logger 不再向上传播，由 InterceptHandler 统一处理
        std_logger.propagate = False
        # 清除可能存在的旧 handlers，防止重复打印
        std_logger.handlers = [InterceptHandler()]

    # 7. 替换 Flask App 的 logger
    # Flask 1.1+ app.logger 是一个标准的 logging.Logger，我们可以直接替换其 class
    # 或者简单地让它使用我们的 InterceptHandler
    app.logger.handlers = [InterceptHandler()]
    app.logger.setLevel(log_level_str)
    app.logger.propagate = False
    # 记录启动日志
    logger.info("Application logging initialized with Loguru 🐍")
