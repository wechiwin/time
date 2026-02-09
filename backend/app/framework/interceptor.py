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
    # 使用集合(set)以便进行更高效的成员检查
    SENSITIVE_PATH_KEYWORDS = {'login', 'refresh', 'pwd', 'register'}

    @app.before_request
    def initialize_request_context():
        """
        在每个请求开始前执行，仅用于初始化请求上下文。
        1. 生成唯一的 Trace ID 用于追踪整个请求生命周期。
        2. 记录请求开始时间用于计算耗时。
        """
        g.trace_id = str(uuid.uuid4())
        g.start_time = time.time()
        logger.patch(lambda record: record["extra"].update(trace_id=g.trace_id))

    @app.after_request
    def log_and_finalize_request(response):
        """
        在每个请求处理完成后执行。
        1. 收集请求和响应信息，生成单条结构化日志。
        2. 将 Trace ID 添加到响应头。
        3. 添加安全响应头。
        """
        # 1. 构建日志上下文数据
        log_context = build_log_context(response)
        # 2. 绑定上下文并记录日志
        # 无论环境如何，调用方式都一样
        log_message = (
            f"{request.method} {request.path} - "
            f"{response.status_code} in {log_context['duration_ms']}ms"
        )

        # 使用 bind 将结构化数据附加到日志记录中
        # Loguru 会根据 sink 的配置（serialize=True/False）决定如何处理它
        logger.bind(request_log=log_context).info(log_message)
        # 3. 添加 Trace ID 和安全头
        response.headers['X-Trace-ID'] = g.trace_id
        add_security_headers(response)
        return response

    def build_log_context(response):
        """
        构建包含请求/响应详细信息的日志上下文。
        """
        duration_ms = round((time.time() - g.start_time) * 1000)

        context = {
            "http": {
                "method": request.method,
                "path": request.path,
                "remote_addr": request.remote_addr,
                "status_code": response.status_code,
                "response_size_bytes": response.content_length,
            },
            "duration_ms": duration_ms,
        }
        is_sensitive = any(keyword in request.path for keyword in SENSITIVE_PATH_KEYWORDS)
        if not is_sensitive:
            context["http"]["request_args"] = dict(request.args)
            try:
                request_body = request.get_data(as_text=True)
                if request_body:
                    context["http"]["request_body"] = (
                                request_body[:1024] + '...') if len(request_body) > 1024 else request_body
            except Exception:
                context["http"]["request_body"] = "[Error reading body]"
            try:
                if response.is_json:
                    context["http"]["response_body"] = response.get_json()
                else:
                    resp_text = response.get_data(as_text=True)
                    context["http"]["response_body"] = (
                                resp_text[:1024] + '...') if len(resp_text) > 1024 else resp_text
            except Exception:
                context["http"]["response_body"] = "[Error reading response body]"

        return context

    def add_security_headers(response):
        """添加安全响应头的内部函数"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # 在生产环境的 HTTPS 代理后启用 HSTS
        # if not current_app.debug:
        #     response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

