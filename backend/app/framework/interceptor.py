# app/framework/interceptor.py
import time
import uuid

from flask import request, g
from loguru import logger


def register_interceptors(app):
    """
    注册应用的拦截器，包括请求初始化、日志记录和安全头。
    """
    # 定义不需要记录详细请求/响应体的敏感 API 路径关键词
    SENSITIVE_PATH_KEYWORDS = {'login', 'refresh', 'pwd', 'register'}

    @app.before_request
    def log_request():
        """记录请求信息"""
        g.trace_id = str(uuid.uuid4())
        g.start_time = time.time()

        # 构建请求日志
        parts = [f"--> {request.method} {request.path}"]
        if request.args:
            parts.append(f"args={dict(request.args)}")

        is_sensitive = any(kw in request.path for kw in SENSITIVE_PATH_KEYWORDS)
        if not is_sensitive:
            try:
                body = request.get_data(as_text=True)
                if body:
                    parts.append(f"body={body[:500]}{'...' if len(body) > 500 else ''}")
            except Exception:
                pass

        logger.info(" | ".join(parts))

    @app.after_request
    def log_response(response):
        """记录响应信息"""
        # 使用 getattr 安全获取 start_time，防止异常处理时 g.start_time 不存在
        start_time = getattr(g, 'start_time', None)
        duration_ms = round((time.time() - start_time) * 1000) if start_time else 0

        # 构建响应日志
        parts = [f"<-- {request.method} {request.path} {response.status_code} ({duration_ms}ms)"]

        is_sensitive = any(kw in request.path for kw in SENSITIVE_PATH_KEYWORDS)
        if not is_sensitive:
            try:
                if response.is_json:
                    resp = response.get_json()
                    # 截断过长的响应
                    resp_str = str(resp)
                    if len(resp_str) > 300:
                        resp_str = resp_str[:300] + '...'
                    parts.append(f"resp={resp_str}")
            except Exception:
                pass

        logger.info(" | ".join(parts))

        # 添加 Trace ID 和安全头
        trace_id = getattr(g, 'trace_id', 'unknown')
        response.headers['X-Trace-ID'] = trace_id
        add_security_headers(response)
        return response

    def add_security_headers(response):
        """添加安全响应头"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'

