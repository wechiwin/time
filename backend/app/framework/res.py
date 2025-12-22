# app/framework/response.py
from flask import jsonify, Response
import json

from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR


class Res(object):
    @staticmethod
    def success(data=None, msg="ok"):
        """成功响应 - 支持多种数据类型"""
        return Res._create_response(RESPONSE_CODE_OK, msg, data)

    @staticmethod
    def fail(code=RESPONSE_CODE_ERROR, msg="error", data=None):
        """失败响应"""
        return Res._create_response(code, msg, data)

    @staticmethod
    def _create_response(code, msg, data):
        """创建统一格式的响应"""
        # 如果已经是 Response 对象，直接返回
        if isinstance(data, Response):
            return data

        # 构建统一响应格式
        response_data = {
            "code": code,
            "msg": msg,
            "data": data
        }

        return jsonify(response_data)

    @staticmethod
    def stream(data_generator, msg="ok"):
        """流式响应 - 避免内存问题"""

        def generate():
            yield json.dumps({
                "code": RESPONSE_CODE_OK,
                "msg": msg,
                "data": ""
            })[:-2]  # 去掉最后的 } 和空格

            for chunk in data_generator:
                if isinstance(chunk, (dict, list)):
                    yield ',"data":' + json.dumps(chunk, ensure_ascii=False)
                else:
                    yield ',"data":"' + str(chunk) + '"'

            yield "}"

        return Response(
            generate(),
            mimetype='application/json; charset=utf-8'
        )
