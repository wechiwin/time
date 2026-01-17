import logging
import uuid
from datetime import datetime

from flask import Blueprint, request, current_app, g
from flask_jwt_extended import (
    create_access_token, create_refresh_token, get_jwt,
    set_refresh_cookies, unset_refresh_cookies, get_jwt_identity
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.framework.auth import auth_required, auth_refresh_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.models import TokenBlacklist, DeviceType, UserSetting, db
from app.service.user_service import UserService
from app.utils.user_util import generate_device_fingerprint

logger = logging.getLogger(__name__)

user_bp = Blueprint('user_setting', __name__, url_prefix='/api/user_setting')
limiter = Limiter(key_func=get_remote_address)


@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        raise BizException("用户名和密码不能为空")

    if len(username) < 3 or len(password) < 6:
        raise BizException("用户名至少3位，密码至少6位")

    # 检查用户名是否已存在
    existing_user = UserSetting.query.filter_by(username=username).first()
    if existing_user:
        raise BizException("用户名已存在")

    # 创建新用户
    # 安全哈希后存储
    pwd_hash = UserSetting.hash_password(password)
    new_user = UserSetting(
        username=username,
        pwd_hash=pwd_hash,
    )

    db.session.add(new_user)
    db.session.commit()

    # 注册成功后自动返回token
    access_token = create_access_token(identity=new_user.username)
    refresh_token = create_refresh_token(identity=new_user.username)

    response = Res.success({
        "access_token": access_token,
        "user": {
            "uuid": new_user.uuid,
            "username": new_user.username,
        }
    })

    set_refresh_cookies(response, refresh_token)

    # 记录注册登录历史（可选）
    _record_login_history(
        user_id=new_user.id,
        login_ip=get_remote_address(),
        user_agent=request.headers.get('User-Agent', ''),
        device_type=DeviceType.UNKNOWN.value,
        session_id=str(uuid.uuid4()),
        failure_reason=None
    )

    return response


@user_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        raise BizException("用户名和密码不能为空", code=400)

    # 获取客户端信息用于日志
    ip = get_remote_address()
    user_agent = request.headers.get('User-Agent', '')

    login_result = UserService.execute_login(
        username=username,
        password=password,
        ip=ip,
        user_agent=user_agent
    )

    response = Res.success(login_result['data'])

    # 设置 HttpOnly Cookie (Refresh Token)
    set_refresh_cookies(response, login_result['refresh_token'])
    return response


@user_bp.route('/refresh', methods=['POST'])
@auth_refresh_required
@limiter.limit("10 per hour")
def refresh():
    # 强制要求自定义 Header，利用 CORS 机制防御 CSRF
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        raise BizException("非法请求：缺少安全标识", code=400)
    try:
        current_username = get_jwt_identity()
        jwt_data = get_jwt()
        jti = get_jwt()["jti"]

        # 检查refresh token是否在黑名单中
        blacklisted = TokenBlacklist.query.filter_by(jti=jti).first()
        if blacklisted:
            raise BizException("Token已失效", code=401)

        # 验证设备指纹
        current_fingerprint = generate_device_fingerprint()
        stored_fingerprint = jwt_data.get("device_fingerprint")

        if stored_fingerprint != current_fingerprint:
            # 指纹不匹配，可能被盗用
            logger.warning(f"Device fingerprint mismatch for user {current_username}")

            # 强制登出
            blacklisted = TokenBlacklist(jti=jti,
                                         token_type='refresh',
                                         expires_at=datetime.now() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'])
            db.session.add(blacklisted)
            db.session.commit()

            # 记录异常登录历史
            _record_login_history(
                user_id=UserSetting.query.filter_by(username=current_username).first().id,
                login_ip=get_remote_address(),
                user_agent=request.headers.get('User-Agent', ''),
                device_type=DeviceType.UNKNOWN.value,
                failure_reason="Device fingerprint mismatch"
            )

            raise BizException("安全验证失败，请重新登录", code=401)

        # 生成新的access_token
        new_access_token = create_access_token(
            identity=current_username,
            additional_claims={
                "device_fingerprint": current_fingerprint,
                "session_id": jwt_data.get("session_id")
            },
        )

        # 生成新的refresh token
        new_refresh_token = create_refresh_token(
            identity=current_username,
            additional_claims={
                "device_fingerprint": current_fingerprint,
                "session_id": jwt_data.get("session_id")
            },
        )

        # 使旧refresh token失效
        blacklisted = TokenBlacklist(jti=jti,
                                     user_id=g.user.id,
                                     token_type='refresh',
                                     expires_at=datetime.now() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'])
        db.session.add(blacklisted)
        db.session.commit()

        response = Res.success({
            "access_token": new_access_token,
        })
        set_refresh_cookies(response, new_refresh_token)

        return response
    except BizException:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        logger.error(f"Refresh failed: {e}", exc_info=True)
        raise BizException("Token刷新失败", code=401)


@user_bp.route('/user', methods=['GET'])
@auth_required
def get_user():
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()

    if not user:
        raise BizException("用户不存在")

    result = {
        "id": user.id,
        "username": user.username,
        "default_lang": user.default_lang,
        "email_address": user.email_address,
    }
    return Res.success(result)


@user_bp.route('/user', methods=['PUT'])
@auth_required
def update_user():
    """更新用户基本信息"""
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()

    if not user:
        raise BizException("用户不存在")

    data = request.get_json()
    email_address = data.get('email_address')
    default_lang = data.get('default_lang')

    # 更新
    if email_address and user.email_address != email_address:
        user.email_address = email_address
    if default_lang and user.default_lang != default_lang:
        user.default_lang = default_lang

    db.session.commit()
    return Res.success()


@user_bp.route('/pwd', methods=['POST'])
@auth_required
def edit_password():
    current_username = get_jwt_identity()
    user = UserSetting.query.filter_by(username=current_username).first()
    if not user:
        raise BizException("用户不存在")

    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        raise BizException("原密码和新密码都不能为空")
    if old_password == new_password:
        raise BizException("新密码不能与原密码相同")
    if len(new_password) < 6:
        raise BizException("新密码至少6位")

    # 验证原密码
    if not UserSetting.verify_password(old_password, user.pwd_hash):
        raise BizException("原密码错误")

    try:
        # 更新密码前，将当前token加入黑名单
        current_jti = get_jwt()["jti"]
        blacklisted = TokenBlacklist(
            jti=current_jti,
            token_type='access',
            expires_at=datetime.now() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        )
        db.session.add(blacklisted)

        # 更新为新密码
        user.pwd_hash = UserSetting.hash_password(new_password)
        db.session.commit()

        # 记录密码修改日志（可选：记录到 LoginHistory）
        _record_login_history(
            user_id=user.id,
            login_ip=get_remote_address(),
            user_agent=request.headers.get('User-Agent', ''),
            device_type=DeviceType.UNKNOWN.value,
            failure_reason="Password changed"
        )

        # 返回新token
        access_token = create_access_token(identity=user.username)
        refresh_token = create_refresh_token(identity=user.username)

        response = Res.success({
            "access_token": access_token,
            "refresh_token": refresh_token
        })
        set_refresh_cookies(response, refresh_token)
        return response
    except Exception as e:
        logger.error(e)
        db.session.rollback()
        raise BizException("密码修改失败")


@user_bp.route('/logout', methods=['POST'])
@auth_required
def logout():
    try:
        current_user = get_jwt_identity()
        access_jti = get_jwt()["jti"]
        # 1. 处理 refresh token
        refresh_token = request.cookies.get(current_app.config['JWT_REFRESH_COOKIE_NAME'])
        if refresh_token:
            try:
                from flask_jwt_extended import decode_token
                decoded_refresh = decode_token(refresh_token, allow_expired=True)
                refresh_jti = decoded_refresh["jti"]

                blacklisted_refresh = TokenBlacklist(
                    jti=refresh_jti,
                    token_type='refresh',
                    expires_at=datetime.fromtimestamp(decoded_refresh['exp'])
                )
                db.session.add(blacklisted_refresh)
                logger.info(f"Blacklisted refresh token for user {current_user}")
            except Exception as e:
                logger.warning(f"Failed to process refresh token: {e}", exc_info=True)
        else:
            logger.warning(f"No refresh token in cookie for user {current_user}")
        # 2. 将 access token 加入黑名单
        blacklisted_access = TokenBlacklist(
            jti=access_jti,
            token_type='access',
            expires_at=datetime.now() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        )
        db.session.add(blacklisted_access)

        db.session.commit()
        logger.info(f"User {current_user} logged out successfully")
        # 3. 清除 cookie
        response = Res.success()
        unset_refresh_cookies(response)
        return response
    except BizException:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        raise BizException("登出失败")
