# app/framework/error_handler.py
from flask import Flask
from app.framework.res import Res
from app.framework.exceptions import BizException
from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR, RESPONSE_CODE_NOT_FOUND


def register_error_handler(app: Flask):
    # 业务异常
    @app.errorhandler(BizException)
    def handle_biz(err):
        return Res.fail(err.code, err.msg), 200  # http 状态码仍是 200，业务码在 body

    # 404
    @app.errorhandler(RESPONSE_CODE_NOT_FOUND)
    def handle_404(_):
        return Res.fail(RESPONSE_CODE_NOT_FOUND, "resource not found"), 200

    # 500 / 未捕获异常
    @app.errorhandler(Exception)
    def handle_all(err):
        app.logger.exception(err)
        return Res.fail(RESPONSE_CODE_ERROR, "internal error"), 200
