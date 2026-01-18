from functools import wraps
from flask import request, current_app, g
from flask_jwt_extended import verify_jwt_in_request, get_current_user
from flask_jwt_extended.exceptions import JWTExtendedException
from app.framework.exceptions import BizException


def token_required(optional=False, refresh=False):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 1. 全局开关检查（方便测试环境关闭认证）
            if not current_app.config.get('JWT_AUTH_REQUIRED', True):
                return fn(*args, **kwargs)

            # --- 认证逻辑开始 ---
            try:
                # 2. 验证 Token (验证签名、过期、黑名单)
                verify_jwt_in_request(optional=optional, refresh=refresh)

                # 3. 获取用户 (触发 jwt_config.py 中的 user_lookup_loader)
                user = get_current_user()

                # 4. 强校验逻辑
                if not optional and not user:
                    # 可能是 Token 有效但数据库里用户被删了
                    raise BizException("用户不存在或状态异常", code=401)

                # 5. 业务锁定检查 (这是自定义装饰器的核心价值)
                if user and user.is_locked:
                    raise BizException("账号已被锁定，无法操作", code=403)

                # 6. 挂载到全局 g 对象
                g.user = user

            except BizException:
                # 业务异常直接抛出
                raise
            except JWTExtendedException as e:
                msg = "刷新令牌无效或已过期，请重新登录" if refresh else "身份认证失效"
                # 捕获 JWT 库的特定异常，转化为统一格式
                # 可以根据 e 的类型细分：ExpiredSignatureError 等
                current_app.logger.info(f"JWT Auth failed: {e}")

                if optional:
                    g.user = None
                    # 如果是可选认证失败，不抛错，继续执行业务逻辑（但在 try 块外执行）
                else:
                    raise BizException(msg, code=401)
            except Exception as e:
                current_app.logger.error(f"Auth system error: {e}", exc_info=True)
                raise BizException("认证服务暂时不可用", code=401)
            # --- 认证逻辑结束 ---

            # 7. 执行业务视图函数 (移出 try 块)
            # 这样业务逻辑中的 TypeError, ValueError 等不会被误认为是认证错误
            return fn(*args, **kwargs)

        return wrapper

    return decorator


# 导出实例，方便调用
auth_required = token_required(optional=False)
auth_refresh_required = token_required(optional=False, refresh=True)
