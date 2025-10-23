from flask import Response as FlaskResponse, request  # Rename the imported Response to avoid conflict
import json
import logging

logger = logging.getLogger(__name__)  # 使用当前模块 logger


def make_response(data=None, code=0, message="ok"):
    result = {
        "code": code,
        "message": message,
        "data": data
    }

    try:
        # 截断长响应防止日志爆炸
        preview = json.dumps(result, ensure_ascii=False)
        preview = preview[:500] + "..." if len(preview) > 500 else preview
        logger.info(f"[Response] {request.method} {request.path} => {preview}")
    except Exception as e:
        logger.warning(f"[Log Error] Failed to log response: {e}")

    # 手动生成 JSON 字符串，并禁用 ASCII 转义
    json_str = json.dumps(result, ensure_ascii=False)
    # 返回 Response 对象，并指定 UTF-8 编码
    return FlaskResponse(  # Use the renamed FlaskResponse here
        json_str,
        mimetype="application/json; charset=utf-8"  # 明确声明 UTF-8
    )


class Response:
    @staticmethod
    def success(data=None, message="ok"):
        return make_response(data=data, code=200, message=message)

    @staticmethod
    def error(code=400, message="error"):
        return make_response(data=None, code=code, message=message)
