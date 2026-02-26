# gunicorn.conf.py
# Gunicorn 配置文件 - 用于生产环境部署
#
# 核心目的：确保 APScheduler 只在一个 Worker 中运行
# 原因：每个 Worker 都启动 Scheduler 会导致：
#   1. 重复执行定时任务
#   2. 大量后台线程（进程状态变成 Sl）
#   3. 内存占用翻倍

import os
import fcntl

# Worker 数量 - 对于 1GB 内存的机器，2 个 worker 已经很勉强
workers = 2

# 绑定地址
bind = "0.0.0.0:8080"

# 工作模式
worker_class = "sync"

# 每个 worker 的线程数 - 保持 1
threads = 1

# 超时时间（秒）
timeout = 120

# 优雅重启超时
graceful_timeout = 30

# Keep-alive 时间
keepalive = 5

# 预加载应用 - 节省内存，共享代码段
preload_app = True

# ============================================
# 内存保护机制（关键！）
# ============================================
# 处理完 N 个请求后自动重启 worker，防止内存泄漏和 Swap 堆积
# 对于 1GB 内存的机器，这是必须的
max_requests = 500
# 随机偏移，防止所有 worker 同时重启
max_requests_jitter = 50

# 日志配置
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Lock file for ensuring only one worker runs scheduler
_scheduler_lock_file = "/tmp/gunicorn_scheduler.lock"
_scheduler_lock_fd = None

# ============================================
# Gunicorn Hooks
# ============================================

def on_starting(server):
    """
    Master 进程启动时调用（仅一次）
    禁用 scheduler，防止在 master 进程中启动
    """
    server.log.info("Gunicorn master process starting...")
    os.environ['RUN_SCHEDULER'] = 'false'
    # Clean up any stale lock file
    try:
        os.unlink(_scheduler_lock_file)
    except FileNotFoundError:
        pass


def post_fork(server, worker):
    """
    fork 后在每个 Worker 中调用
    使用文件锁确保只有一个 worker 启动 APScheduler
    """
    global _scheduler_lock_fd

    try:
        _scheduler_lock_fd = open(_scheduler_lock_file, 'w')
        # Try to acquire an exclusive non-blocking lock
        fcntl.flock(_scheduler_lock_fd.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        worker.log.info(f"Worker pid={worker.pid} - Acquired scheduler lock, enabling APScheduler")
        os.environ['RUN_SCHEDULER'] = 'true'
        _init_scheduler(worker)
    except (IOError, OSError):
        # Lock not acquired, another worker already has it
        worker.log.info(f"Worker pid={worker.pid} - APScheduler disabled (another worker runs scheduler)")
        os.environ['RUN_SCHEDULER'] = 'false'
        if _scheduler_lock_fd:
            _scheduler_lock_fd.close()
            _scheduler_lock_fd = None


def _init_scheduler(worker):
    """
    在获得锁的 worker 中初始化并启动 scheduler
    """
    try:
        # 获取全局 app 实例（由 wsgi.py 创建）
        from wsgi import app
        from app.extension import scheduler
        from app.scheduler import init_scheduler

        # 先初始化 scheduler（绑定 app），再添加 jobs
        scheduler.init_app(app)
        init_scheduler(app, scheduler)
        worker.log.info(f"Worker pid={worker.pid} - APScheduler initialized successfully")
    except Exception as e:
        worker.log.error(f"Worker pid={worker.pid} - Failed to initialize APScheduler: {e}")


def worker_exit(server, worker):
    """
    Worker 退出时调用
    """
    global _scheduler_lock_fd
    worker.log.info(f"Worker pid={worker.pid} exiting...")
    if _scheduler_lock_fd:
        try:
            fcntl.flock(_scheduler_lock_fd.fileno(), fcntl.LOCK_UN)
            _scheduler_lock_fd.close()
        except:
            pass
        _scheduler_lock_fd = None
