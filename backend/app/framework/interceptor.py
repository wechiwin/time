# app/framework/interceptor.py
import time
import uuid

from flask import request, g


def register_request_response_logger(app):
    no_log_api = {'login', 'refresh', 'pwd', 'register'}

    @app.before_request
    def before_request():
        g.trace_id = str(uuid.uuid4())

    @app.after_request
    def after_request(response):
        response.headers['X-Trace-ID'] = g.trace_id
        return response

    @app.before_request
    def log_request_info():
        g.start_time = time.time()

        # 获取 body 参数（可能是 JSON）
        try:
            body = request.get_json(silent=True)
        except Exception:
            body = None

        if any(sensitive in request.path for sensitive in no_log_api):
            # 敏感路径：简单记录
            app.logger.info(f"[{g.trace_id}] - [{request.method}] - {request.path}")
        else:
            app.logger.info(f"""
            ===== Request Begin =====
            TraceId: {g.trace_id}
            Method: {request.method}
            Path: {request.path}
            Args: {dict(request.args)}
            JSON Body: {body}
            Form Data: {dict(request.form)} 
            Remote Addr: {request.remote_addr}
            ===== Request End =====
            """)

    @app.after_request
    def log_response_info(response):
        elapsed = time.time() - g.get('start_time', time.time())
        try:
            resp_data = response.get_json()
        except Exception:
            resp_data = response.get_data(as_text=True)

        # 只截取前 1KB 防止日志爆炸
        if isinstance(resp_data, str) and len(resp_data) > 1024:
            resp_data = resp_data[:1024] + '... [truncated]'

        if any(sensitive in request.path for sensitive in no_log_api):
            # 敏感路径：简单记录
            app.logger.info(f"[{g.trace_id}] - [{request.method}] - {request.path}")
        else:
            app.logger.info(f"""
            ===== Response Begin =====
            TraceId: {g.trace_id}
            Path: {request.path}
            Status: {response.status}
            Duration: {elapsed:.3f}s
            Response: {resp_data}
            ===== Response End =====
            """)
        return response

    @app.after_request
    def add_security_headers(resp):
        resp.headers['X-Content-Type-Options'] = 'nosniff'
        resp.headers['X-Frame-Options'] = 'DENY'
        resp.headers['X-XSS-Protection'] = '1; mode=block'
        resp.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return resp
