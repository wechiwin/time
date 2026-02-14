import uuid
from datetime import datetime

from flask import Blueprint, request, current_app, g
from flask_jwt_extended import (
    create_access_token, create_refresh_token, get_jwt,
    set_refresh_cookies, unset_refresh_cookies, get_jwt_identity
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_babel import gettext as _
from loguru import logger

from app.constant.sys_enums import GlobalYesOrNo
from app.framework.auth import auth_required, auth_refresh_required
from app.framework.exceptions import BizException
from app.framework.res import Res
from app.models import TokenBlacklist, UserSetting, db, UserSession
from app.schemas_marshall import UserSettingSchema
from app.service.user_service import UserService
from app.utils.device_parser import DeviceParser
from app.utils.user_util import generate_device_fingerprint

user_setting_bp = Blueprint('user_setting', __name__, url_prefix='/user_setting')
limiter = Limiter(key_func=get_remote_address)

user_setting_schema = UserSettingSchema()


@user_setting_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        raise BizException(_("USERNAME_PASSWORD_REQUIRED"))

    if len(username) < 3 or len(password) < 6:
        raise BizException(_("USERNAME_MIN_PASSWORD_MIN"))

    # 检查用户名是否已存在
    existing_user = UserSetting.query.filter_by(username=username).first()
    if existing_user:
        raise BizException(_("USERNAME_ALREADY_EXISTS"))

    # 创建新用户
    pwd_hash = UserSetting.hash_password(password)
    new_user = UserSetting(
        username=username,
        pwd_hash=pwd_hash,
    )
    new_user.is_locked = GlobalYesOrNo.NO
    try:
        db.session.add(new_user)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.exception()
        raise BizException(_("REGISTRATION_FAILED"), code=500)

    # 记录注册登录历史
    UserService.record_login_history(
        user_id=new_user.id,  # 内部使用 id
        login_ip=get_remote_address(),
        user_agent=request.headers.get('User-Agent', ''),
        device_type=DeviceParser.parse(request.headers.get('User-Agent', '')),
        session_id=str(uuid.uuid4()),
        failure_reason=None
    )

    # 注册成功后自动返回token
    # 修改：identity 使用 uuid
    access_token = create_access_token(identity=new_user.uuid)
    refresh_token = create_refresh_token(identity=new_user.uuid)

    response = Res.success({
        "access_token": access_token,
        # 修改：使用 UserSettingSchema 序列化用户对象，排除 id
        "user": user_setting_schema.dump(new_user)
    })

    set_refresh_cookies(response, refresh_token)

    return response


@user_setting_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        raise BizException(_("USERNAME_PASSWORD_REQUIRED"), code=400)

    # 获取客户端信息用于日志
    ip = get_remote_address()
    user_agent = request.headers.get('User-Agent', '')

    login_result = UserService.execute_login(
        username=username,
        password=password,
        ip=ip,
        user_agent=user_agent
    )

    # login_result['data']['user'] 已经在 UserService 中通过 Schema 序列化
    response = Res.success(login_result['data'])

    # 设置 HttpOnly Cookie (Refresh Token)
    set_refresh_cookies(response, login_result['refresh_token'])
    return response


@user_setting_bp.route('/refresh', methods=['POST'])
@auth_refresh_required
@limiter.limit("10 per hour")
def refresh():
    # 强制要求自定义 Header，利用 CORS 机制防御 CSRF
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        raise BizException(_("INVALID_REQUEST_MISSING_SECURITY_HEADER"), code=400)
    try:
        # 修改：get_jwt_identity() 现在返回 uuid
        current_user = g.user
        jwt_data = get_jwt()
        old_jti = jwt_data["jti"]
        old_session_id = jwt_data.get("session_id")

        # 检查refresh token是否在黑名单中
        blacklisted = TokenBlacklist.query.filter_by(jti=old_jti).first()
        if blacklisted:
            logger.warning(f"refresh：Token {old_jti} was in TokenBlacklist")
            raise BizException(_("TOKEN_EXPIRED"), code=401)

        # 刷新时也检查活跃设备数
        active_sessions = UserSession.query.filter_by(
            user_id=current_user.id,
            is_active=GlobalYesOrNo.YES
        ).filter(
            UserSession.session_id != old_session_id  # 排除当前即将被替换的会话
        ).order_by(UserSession.created_at.asc()).all()
        if len(active_sessions) >= UserService.MAX_CONCURRENT_DEVICES:
            oldest = active_sessions[0]
            oldest.is_active = GlobalYesOrNo.NO
            blacklisted_old = TokenBlacklist(
                jti=oldest.session_id,
                user_id=current_user.id,
                token_type='access',
                expires_at=datetime.utcnow()
            )
            db.session.add(blacklisted_old)
            db.session.add(oldest)
            logger.info(f"Kicked oldest session during refresh: {oldest.session_id}")

        # 验证设备指纹
        current_fingerprint = generate_device_fingerprint()
        stored_fingerprint = jwt_data.get("device_fingerprint")

        if stored_fingerprint != current_fingerprint:
            # 指纹不匹配，可能被盗用
            logger.warning(f"Device fingerprint mismatch for user {current_user}:old:{stored_fingerprint} → new:{current_fingerprint}")

            blacklisted = TokenBlacklist(jti=old_jti,
                                         user_id=current_user.id,
                                         token_type='refresh',
                                         expires_at=datetime.now() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES'])
            db.session.add(blacklisted)

            # 记录异常登录历史
            # 修改：通过 uuid 查找用户，获取其 id
            UserService.record_login_history(
                user_id=current_user.id,
                login_ip=get_remote_address(),
                user_agent=request.headers.get('User-Agent', ''),
                device_type=DeviceParser.parse(request.headers.get('User-Agent', '')),
                failure_reason="Device fingerprint mismatch"
            )
            raise BizException(_("TOKEN_INVALID"), code=401)

        # 生成新的access_token
        # 修改：identity 使用 uuid
        new_access_token = create_access_token(
            identity=current_user.uuid,
            additional_claims={
                "device_fingerprint": current_fingerprint,
                "session_id": jwt_data.get("session_id")
            },
        )

        # 生成新的refresh token
        # 修改：identity 使用 uuid
        new_refresh_token = create_refresh_token(
            identity=current_user.uuid,
            additional_claims={
                "device_fingerprint": current_fingerprint,
                "session_id": jwt_data.get("session_id")
            },
        )
        # 更新会话最后活跃时间
        session_record = UserSession.query.filter_by(session_id=old_session_id).first()
        if session_record:
            session_record.last_active = datetime.utcnow()
            session_record.device_fingerprint = current_fingerprint
            db.session.add(session_record)
        else:
            # 极端情况：找不到记录，新建（理论上不应发生）
            new_session = UserSession(
                user_id=current_user.id,
                session_id=old_session_id,
                device_fingerprint=current_fingerprint,
                login_ip=get_remote_address(),
                user_agent=request.headers.get('User-Agent', ''),
                created_at=datetime.utcnow(),
                last_active=datetime.utcnow(),
                is_active=GlobalYesOrNo.YES
            )
            db.session.add(new_session)
        # 使旧refresh token失效
        # g.user 已经由 auth_refresh_required 装饰器设置，且 user_lookup_loader 已改为 uuid 查找
        blacklisted = TokenBlacklist(jti=old_jti,
                                     user_id=current_user.id,  # g.user 已经是一个 UserSetting 对象
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
        logger.exception(f"Refresh token failed: {e}")
        raise BizException(_("REFRESH_TOKEN_FAILED"), code=401)


@user_setting_bp.route('/user', methods=['GET'])
@auth_required
def get_user():
    if not g.user:
        raise BizException(_("USER_NOT_FOUND"))

    result = user_setting_schema.dump(g.user)
    return Res.success(result)


@user_setting_bp.route('/update_user', methods=['POST'])
@auth_required
def update_user():
    """更新用户基本信息"""
    user = g.user
    if not user:
        raise BizException(_("USER_NOT_FOUND"))

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


@user_setting_bp.route('/pwd', methods=['POST'])
@auth_required
def edit_password():
    user = g.user
    if not user:
        raise BizException(_("USER_NOT_FOUND"))

    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')

    if not old_password or not new_password:
        raise BizException(_("OLD_NEW_PASSWORD_REQUIRED"))
    if old_password == new_password:
        raise BizException(_("NEW_PASSWORD_SAME_AS_OLD"))
    if len(new_password) < 6:
        raise BizException(_("NEW_PASSWORD_MIN_LENGTH"))

    # 验证原密码
    if not UserSetting.verify_password(old_password, user.pwd_hash):
        raise BizException(_("OLD_PASSWORD_INCORRECT"))

    try:
        # 1. 获取当前 access token 的 JTI
        current_jwt = get_jwt()
        access_jti = current_jwt["jti"]

        # 2. 将当前 access token 加入黑名单
        blacklisted_access = TokenBlacklist(
            jti=access_jti,
            user_id=user.id,  # 关联用户ID
            token_type='access',
            expires_at=datetime.now() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        )
        db.session.add(blacklisted_access)

        # 3. 尝试将当前请求的 refresh token 加入黑名单 (增强安全性)
        refresh_token_cookie = request.cookies.get(current_app.config['JWT_REFRESH_COOKIE_NAME'])
        if refresh_token_cookie:
            try:
                from flask_jwt_extended import decode_token
                # 允许解码已过期的 token，以便获取 JTI
                decoded_refresh = decode_token(refresh_token_cookie, allow_expired=True)
                refresh_jti = decoded_refresh["jti"]
                blacklisted_refresh = TokenBlacklist(
                    jti=refresh_jti,
                    user_id=user.id,
                    token_type='refresh',
                    expires_at=datetime.fromtimestamp(decoded_refresh['exp'])  # 使用 refresh token 自身的过期时间
                )
                db.session.add(blacklisted_refresh)
                logger.info(f"Blacklisted refresh token during password change for user {user.username}")
            except Exception as e:
                logger.warning(f"Failed to blacklist refresh token during password change: {e}")
        else:
            logger.warning(f"No refresh token in cookie during password change for user {user.username}")

        # 4. 更新为新密码
        user.pwd_hash = UserSetting.hash_password(new_password)
        db.session.commit()

        # 5. 记录密码修改日志
        UserService.record_login_history(
            user_id=user.id,
            login_ip=get_remote_address(),
            user_agent=request.headers.get('User-Agent', ''),
            device_type=DeviceParser.parse(request.headers.get('User-Agent', '')),
            failure_reason="Password changed"
        )

        # 6. 生成新的access_token和refresh_token
        # 修改：identity 使用 uuid
        new_access_token = create_access_token(identity=user.uuid)
        new_refresh_token = create_refresh_token(identity=user.uuid)

        response = Res.success({
            "access_token": new_access_token,
            # refresh_token 不直接返回，通过 cookie 设置
        })
        set_refresh_cookies(response, new_refresh_token)  # 设置新的 refresh token cookie
        return response
    except BizException:
        db.session.rollback()
        raise
    except Exception as e:
        logger.exception()
        db.session.rollback()
        raise BizException(_("PASSWORD_CHANGE_FAILED"), code=500)


@user_setting_bp.route('/logout', methods=['POST'])
@auth_required
def logout():
    try:
        # 修改：get_jwt_identity() 现在返回 uuid
        current_user_uuid = get_jwt_identity()
        access_jti = get_jwt()["jti"]
        session_id = get_jwt().get("session_id")  # 获取 session_id
        if session_id:
            session = UserSession.query.filter_by(session_id=session_id).first()
            if session:
                session.is_active = GlobalYesOrNo.NO
                db.session.add(session)
        # 1. 处理 refresh token (从 cookie 中获取并黑名单)
        refresh_token = request.cookies.get(current_app.config['JWT_REFRESH_COOKIE_NAME'])
        if refresh_token:
            try:
                from flask_jwt_extended import decode_token
                decoded_refresh = decode_token(refresh_token, allow_expired=True)
                refresh_jti = decoded_refresh["jti"]

                # g.user 已经由 auth_required 装饰器设置，且 user_lookup_loader 已改为 uuid 查找
                blacklisted_refresh = TokenBlacklist(
                    jti=refresh_jti,
                    user_id=g.user.id,  # g.user 已经是一个 UserSetting 对象
                    token_type='refresh',
                    expires_at=datetime.fromtimestamp(decoded_refresh['exp'])
                )
                db.session.add(blacklisted_refresh)
                logger.info(f"Blacklisted refresh token for user {current_user_uuid}")
            except Exception as e:
                logger.warning(f"Failed to process refresh token: {e}")
        else:
            logger.warning(f"No refresh token in cookie for user {current_user_uuid}")

        # 2. 将 access token 加入黑名单
        # g.user 已经由 auth_required 装饰器设置
        blacklisted_access = TokenBlacklist(
            jti=access_jti,
            user_id=g.user.id,  # g.user 已经是一个 UserSetting 对象
            token_type='access',
            expires_at=datetime.now() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES']
        )
        db.session.add(blacklisted_access)

        db.session.commit()
        logger.info(f"User {current_user_uuid} logged out successfully")

        # 3. 清除 cookie
        response = Res.success()
        unset_refresh_cookies(response)
        return response
    except BizException:
        db.session.rollback()
        raise
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Logout failed: {e}")
        raise BizException(_("LOGOUT_FAILED"), code=500)
