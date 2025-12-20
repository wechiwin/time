from functools import wraps
from flask import request, jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from flask_jwt_extended.exceptions import JWTExtendedException

from app.framework.exceptions import BizException

def token_required(optional=False):
    """
    自定义 token 验证装饰器
    :param optional: 是否为可选验证（验证失败不报错）
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 检查是否启用 token 验证
            if not current_app.config.get('JWT_AUTH_REQUIRED', True):
                # 不验证 token，直接执行函数
                return fn(*args, **kwargs)

            try:
                # 验证 JWT token
                verify_jwt_in_request()
                # 获取当前用户身份（可选，用于日志等）
                current_user = get_jwt_identity()
                current_app.logger.debug(f"Authenticated user: {current_user}")

                return fn(*args, **kwargs)
            except JWTExtendedException as e:
                if optional:
                    # 可选验证模式下，验证失败继续执行
                    current_app.logger.debug(f"Optional auth failed: {e}")
                    return fn(*args, **kwargs)
                else:
                    raise BizException("Token验证失败", code=401)

        return wrapper
    return decorator

# 创建便捷的装饰器别名
auth_required = token_required(optional=False)
optional_auth = token_required(optional=True)
