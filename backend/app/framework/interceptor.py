# app/framework/interceptor.py
import json
import time

from flask import Flask, request, g


def register_response_interceptor(app: Flask):
    @app.after_request
    def uniform_response(response):
        # 跳过流式响应
        if getattr(response, 'direct_passthrough', False):
            return response

        # 如果已经是统一格式，直接返回
        try:
            data = json.loads(response.get_data(as_text=True))
            if isinstance(data, dict) and "code" in data and "msg" in data:
                return response
        except Exception:
            pass

        # 对非JSON响应（如空字符串）进行包装
        try:
            data = json.loads(response.get_data(as_text=True))
        except Exception:
            data = response.get_data(as_text=True) or None

        # 只对200响应进行包装（错误响应已在error_handler中处理）
        if response.status_code == 200:
            unified = {
                "code": 200,
                "msg": "success",
                "data": data
            }
            response.set_data(json.dumps(unified, ensure_ascii=False))
            response.content_type = "application/json; charset=utf-8"

        return response


def register_request_response_logger(app):
    @app.before_request
    def log_request_info():
        g.start_time = time.time()

        # 获取 body 参数（可能是 JSON）
        try:
            body = request.get_json(silent=True)
        except Exception:
            body = None

        app.logger.info(f"""
        ===== Request Begin =====
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

        app.logger.info(f"""
        ===== Response Begin =====
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
