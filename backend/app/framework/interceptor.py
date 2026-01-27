# app/framework/interceptor.py
import time
import uuid
import json
from flask import request, g, current_app

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

    @app.after_request
    def log_and_finalize_request(response):
        """
        在每个请求处理完成后执行。
        1. 收集请求和响应信息，生成单条结构化日志。
        2. 将 Trace ID 添加到响应头。
        3. 添加安全响应头。
        """
        # 1. 收集日志信息
        log_data = build_log_data(response)

        # 2. 将日志数据序列化为 JSON 字符串并记录
        # 使用 current_app.logger 确保使用配置好的 logger 实例
        current_app.logger.info(json.dumps(log_data, ensure_ascii=False))

        # 3. 添加 Trace ID 到响应头
        response.headers['X-Trace-ID'] = g.trace_id

        # 4. 添加安全头
        add_security_headers(response)

        return response

    def build_log_data(response):
        """
        构建结构化的日志数据字典。
        """
        # 计算耗时（毫秒）
        duration_ms = round((time.time() - g.start_time) * 1000)

        log_data = {
            "trace_id": g.trace_id,
            "remote_addr": request.remote_addr,
            "method": request.method,
            "path": request.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "response_size_bytes": response.content_length,
        }

        # 检查是否为敏感路径，如果是，则不记录详细的请求和响应数据
        is_sensitive = any(keyword in request.path for keyword in SENSITIVE_PATH_KEYWORDS)

        if not is_sensitive:
            # 记录非敏感的请求参数和响应体
            log_data["request_args"] = dict(request.args)

            # 安全地获取请求体
            try:
                # get_data 比 get_json 更通用，但需要注意缓存
                request_body = request.get_data(as_text=True)
                if request_body:
                    # 同样截断过长的请求体
                    log_data["request_body"] = (request_body[:1024] + '... [truncated]') if len(request_body) > 1024 else request_body
            except Exception:
                log_data["request_body"] = "[Error reading body]"

            # 安全地获取响应体
            try:
                # 仅当响应类型为 JSON 时尝试解析
                if response.is_json:
                    resp_data = response.get_json()
                    log_data["response_body"] = resp_data
                else:
                    # 对于非 JSON 响应，获取文本并截断
                    resp_text = response.get_data(as_text=True)
                    log_data["response_body"] = (resp_text[:1024] + '... [truncated]') if len(resp_text) > 1024 else resp_text
            except Exception:
                log_data["response_body"] = "[Error reading response body]"

        return log_data

    def add_security_headers(response):
        """添加安全响应头的内部函数"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # 在生产环境的 HTTPS 代理后启用 HSTS
        # if not current_app.debug:
        #     response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

