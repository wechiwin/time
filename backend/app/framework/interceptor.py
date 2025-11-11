# app/framework/interceptor.py
from flask import Flask, jsonify, make_response, Response
from app.framework.res import Res
import json


def register_response_interceptor(app: Flask):
    @app.after_request
    def uniform_response(response):
        # 如果已经是 JSON，就直接返回
        if response.is_json:
            data = response.get_json()
            # 判断是否已是统一格式（防止重复包装）
            if isinstance(data, dict) and "code" in data:
                return response
            else:
                unified = {
                    "code": 200,
                    "msg": "success",
                    "data": data
                }
                # 使用 ensure_ascii=False 禁用 ASCII 转义
                response = make_response(json.dumps(unified, ensure_ascii=False))
                response.content_type = "application/json; charset=utf-8"
        return response
