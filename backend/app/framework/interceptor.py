# app/framework/interceptor.py
from flask import Flask, jsonify, make_response, Response,request, g
from app.framework.res import Res
import json
import time


def register_response_interceptor(app: Flask):
    @app.after_request
    def uniform_response(response):
        # 1. 如果已经是 JSON 或空响应
        try:
            data = json.loads(response.get_data(as_text=True))
        except Exception:
            text = response.get_data(as_text=True)
            if text in (None, ''):
                data = None
            else:
                # 非 JSON 内容直接返回（比如 HTML 或文件）
                return response

        # 2. 已经是统一格式就直接返回
        if isinstance(data, dict) and "code" in data and "msg" in data:
            return response

        # 3. 否则包装成统一格式
        unified = {
            "code": 200,
            "msg": "success",
            "data": data
        }
        response = make_response(json.dumps(unified, ensure_ascii=False))
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