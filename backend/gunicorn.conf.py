# gunicorn.conf.py
# Gunicorn 配置文件 - 用于生产环境部署
#
# 核心目的：确保 APScheduler 只在一个 Worker 中运行
# 原因：每个 Worker 都启动 Scheduler 会导致：
#   1. 重复执行定时任务
#   2. 大量后台线程（进程状态变成 Sl）
#   3. 内存占用翻倍

import os

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


def post_fork(server, worker):
    """
    fork 后在每个 Worker 中调用
    只有 worker 0 会启动 APScheduler
    """
    if worker.id == 0:
        worker.log.info(f"Worker {worker.id} - Enabling APScheduler")
        os.environ['RUN_SCHEDULER'] = 'true'

        # 重新初始化 scheduler
        _init_scheduler(worker)
    else:
        worker.log.info(f"Worker {worker.id} - APScheduler disabled (only worker 0 runs scheduler)")
        os.environ['RUN_SCHEDULER'] = 'false'


def _init_scheduler(worker):
    """
    在 worker 0 中初始化并启动 scheduler
    """
    try:
        # 获取全局 app 实例（由 wsgi.py 创建）
        from wsgi import app
        from app.extension import scheduler
        from app.scheduler import init_scheduler

        init_scheduler(app, scheduler)
        worker.log.info(f"Worker {worker.id} - APScheduler initialized successfully")
    except Exception as e:
        worker.log.error(f"Worker {worker.id} - Failed to initialize APScheduler: {e}")


def worker_exit(server, worker):
    """
    Worker 退出时调用
    """
    worker.log.info(f"Worker {worker.id} exiting...")
