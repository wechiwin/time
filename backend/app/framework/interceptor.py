# app/framework/interceptor.py
import time
import uuid

from flask import request, g


def register_request_response_logger(app):
    """
    注册请求和响应日志拦截器
    """
    # 定义不需要记录详细信息的敏感 API 路径
    NO_LOG_PATHS = {'login', 'refresh', 'pwd', 'register'}

    @app.before_request
    def before_request():
        """
        在每个请求开始前执行
        1. 生成唯一的 Trace ID 用于追踪整个请求生命周期
        2. 记录请求开始时间用于计算耗时
        """
        # 将所有初始化放在一起，确保原子性
        g.trace_id = str(uuid.uuid4())
        g.start_time = time.time()

    @app.after_request
    def after_request(response):
        """
        在每个请求处理后执行
        1. 将 Trace ID 添加到响应头，方便前端排查问题
        2. 记录响应信息
        3. 添加安全响应头
        """
        # 1. 安全地获取 Trace ID，如果 g.trace_id 不存在（例如在 before_request 阶段就出错），则使用默认值
        trace_id = g.get('trace_id', 'N/A')
        response.headers['X-Trace-ID'] = trace_id

        # 2. 记录响应日志
        _log_response_info(response, trace_id)

        # 3. 添加安全头
        _add_security_headers(response)

        return response

    def _log_request_info():
        """记录请求详情的内部函数"""
        # 获取 body 参数（可能是 JSON）
        try:
            body = request.get_json(silent=True)
        except Exception:
            body = None

        # 从 g 对象安全获取 trace_id，因为 before_request 可能失败
        trace_id = g.get('trace_id', 'N/A')

        if any(sensitive in request.path for sensitive in NO_LOG_PATHS):
            # 敏感路径：简单记录
            app.logger.info(f"[{trace_id}] - [{request.method}] - {request.path}")
        else:
            app.logger.info(f"""
            ===== Request Begin =====
            TraceId: {trace_id}
            Method: {request.method}
            Path: {request.path}
            Args: {dict(request.args)}
            JSON Body: {body}
            Form Data: {dict(request.form)} 
            Remote Addr: {request.remote_addr}
            ===== Request End =====
            """)

    def _log_response_info(response, trace_id):
        """记录响应详情的内部函数"""
        # 安全地获取开始时间，如果不存在则使用当前时间，耗时为0
        start_time = g.get('start_time', time.time())
        elapsed = time.time() - start_time

        try:
            resp_data = response.get_json()
        except Exception:
            resp_data = response.get_data(as_text=True)

        # 只截取前 1KB 防止日志爆炸
        if isinstance(resp_data, str) and len(resp_data) > 1024:
            resp_data = resp_data[:1024] + '... [truncated]'

        if any(sensitive in request.path for sensitive in NO_LOG_PATHS):
            # 敏感路径：简单记录
            app.logger.info(f"[{trace_id}] - [{request.method}] - {request.path}")
        else:
            app.logger.info(f"""
            ===== Response Begin =====
            TraceId: {trace_id}
            Path: {request.path}
            Status: {response.status}
            Duration: {elapsed:.3f}s
            Response: {resp_data}
            ===== Response End =====
            """)

    def _add_security_headers(response):
        """添加安全响应头的内部函数"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # 注意：HSTS 头在生产环境且使用 HTTPS 时启用
        # response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

    # 将请求日志记录也注册为 before_request，确保在初始化之后执行
    # Flask 按注册顺序执行 before_request
    app.before_request(_log_request_info)
