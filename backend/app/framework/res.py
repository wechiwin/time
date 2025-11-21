# app/framework/response.py
from flask import jsonify

from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR


class Res(object):
    @staticmethod
    def success(data=None, msg="ok"):
        return jsonify({"code": RESPONSE_CODE_OK, "msg": msg, "data": data})

    @staticmethod
    def fail(code=RESPONSE_CODE_ERROR, msg="error", data=None):
        return jsonify({"code": code, "msg": msg, "data": data})
