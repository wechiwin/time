from flask import jsonify

from app.database import db
from app.framework.exceptions import BizException
from app.models import TokenBlacklist, UserSetting


def configure_jwt(jwt):
    """
    配置 JWT 扩展的回调函数
    :param jwt: JWTManager 实例
    """

    # 1. 检查 Token 是否在黑名单中
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload["jti"]
        # 查询数据库中是否存在该 jti
        token = db.session.query(TokenBlacklist.id).filter_by(jti=jti).scalar()
        return token is not None

    # 2. 自动加载用户对象 (可选，但推荐)
    # 这样在视图中可以直接使用 current_user 获取 User 模型对象
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return UserSetting.query.filter_by(uuid=identity).one_or_none()

    # 3. 自定义错误响应
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "code": 401,
            "msg": "Token has been revoked. Please log in again.",
            "data": None
        }), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            "code": 401,
            "msg": "Token has expired. Please log in again.",
            "data": None
        }), 401
