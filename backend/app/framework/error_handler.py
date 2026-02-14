# app/framework/error_handler.py
from flask import Flask, jsonify
from loguru import logger
from werkzeug.exceptions import HTTPException

from app.framework.exceptions import BizException


def register_error_handler(app: Flask):
    @app.errorhandler(Exception)
    def handle_exception(e):
        # 1. 如果是已知业务异常 (BizException)
        if isinstance(e, BizException):
            logger.warning(
                f"Business exception: {e.msg} (code: {e.code})"
            )
            # 关键修改：HTTP状态码直接使用 e.code (如 401, 403)，而不是固定 200
            return jsonify({
                "code": e.code,
                "msg": e.msg,
                "data": None
            }), e.code

        # 2. 如果是 Flask/Werkzeug 的标准 HTTP 异常 (如 404, 405)
        if isinstance(e, HTTPException):
            logger.warning(
                f"HTTP exception: {e.description} (code: {e.code})"
            )
            return jsonify({
                "code": e.code,
                "msg": e.description,
                "data": None
            }), e.code

        # 3. 未知系统异常 (500)
        logger.exception("Internal Server Error")
        return jsonify({
            "code": 500,
            "msg": "Internal Server Error",
            "data": str(e) if app.debug else None
        }), 500

    # # 注册SQLAlchemy异常处理（可选，更精细）
    # try:
    #     from sqlalchemy.exc import IntegrityError, OperationalError
    #
    #     @app.errorhandler(IntegrityError)
    #     def handle_db_integrity(err):
    #         trace_id = generate_trace_id()
    #         app.logger.exception(f"【数据库约束错误】TraceID: {trace_id} | {err}", exc_info=True)
    #         return Res.fail(RESPONSE_CODE_ERROR, "数据冲突或违反约束"), 500
    #
    #     @app.errorhandler(OperationalError)
    #     def handle_db_connection(err):
    #         trace_id = generate_trace_id()
    #         app.logger.exception(f"【数据库连接错误】TraceID: {trace_id} | {err}", exc_info=True)
    #         return Res.fail(RESPONSE_CODE_ERROR, "数据库连接失败"), 500
    # except ImportError:
    #     pass
