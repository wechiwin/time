from flask import Response as FlaskResponse  # Rename the imported Response to avoid conflict
import json


def make_response(data=None, code=0, message="ok"):
    # 手动生成 JSON 字符串，并禁用 ASCII 转义
    json_str = json.dumps(
        {
            "code": code,
            "message": message,
            "data": data
        },
        ensure_ascii=False  # 关键！禁用 Unicode 转义
    )
    # 返回 Response 对象，并指定 UTF-8 编码
    return FlaskResponse(  # Use the renamed FlaskResponse here
        json_str,
        mimetype="application/json; charset=utf-8"  # 明确声明 UTF-8
    )


class Response:
    @staticmethod
    def success(data=None, message="ok"):
        return make_response(data=data, code=0, message=message)

    @staticmethod
    def error(code=1, message="error"):
        return make_response(data=None, code=code, message=message)