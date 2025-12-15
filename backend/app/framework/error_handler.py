# app/framework/error_handler.py
import uuid

from flask import Flask, request
from app.framework.res import Res
from app.framework.exceptions import BizException
from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR, RESPONSE_CODE_NOT_FOUND


def register_error_handler(app: Flask):
    # 生成追踪ID
    def generate_trace_id():
        return f"{uuid.uuid4().hex[:12]}"

    # 业务异常
    @app.errorhandler(BizException)
    def handle_biz(err):
        return Res.fail(err.code, err.msg), 200  # http 状态码仍是 200，业务码在 body

    # 404
    @app.errorhandler(RESPONSE_CODE_NOT_FOUND)
    def handle_404(_):
        return Res.fail(RESPONSE_CODE_NOT_FOUND, "resource not found"), 404

    # 500 / 未捕获异常
    @app.errorhandler(Exception)
    def handle_all(err):
        trace_id = generate_trace_id()

        # 记录详细错误日志
        app.logger.error(
            f"【系统异常】TraceID: {trace_id} | "
            f"Path: {request.path} | "
            f"Method: {request.method} | "
            f"Error: {str(err)}",
            exc_info=True
        )

        # 开发环境返回详细错误，生产环境返回通用信息
        error_message = str(err) if app.debug else "Internal Server Error"

        return Res.fail(
            code=RESPONSE_CODE_ERROR,
            msg=error_message,
            data={"trace_id": trace_id}  # 返回追踪ID方便排查
        ), 500  # 关键：返回500状态码

    # # 注册SQLAlchemy异常处理（可选，更精细）
    # try:
    #     from sqlalchemy.exc import IntegrityError, OperationalError
    #
    #     @app.errorhandler(IntegrityError)
    #     def handle_db_integrity(err):
    #         trace_id = generate_trace_id()
    #         app.logger.error(f"【数据库约束错误】TraceID: {trace_id} | {err}", exc_info=True)
    #         return Res.fail(RESPONSE_CODE_ERROR, "数据冲突或违反约束"), 500
    #
    #     @app.errorhandler(OperationalError)
    #     def handle_db_connection(err):
    #         trace_id = generate_trace_id()
    #         app.logger.error(f"【数据库连接错误】TraceID: {trace_id} | {err}", exc_info=True)
    #         return Res.fail(RESPONSE_CODE_ERROR, "数据库连接失败"), 500
    # except ImportError:
    #     pass
