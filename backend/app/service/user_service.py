# app/services/auth_service.py
import uuid
from datetime import datetime

from flask_jwt_extended import create_access_token, create_refresh_token
from flask_babel import gettext as _
from loguru import logger

from app.config import Config
from app.constant.sys_enums import GlobalYesOrNo, LoginStatus
from app.framework.exceptions import BizException
from app.models import UserSetting, db, LoginHistory, UserSession, TokenBlacklist
from app.schemas_marshall import UserSettingSchema
from app.utils.device_parser import DeviceParser
from app.utils.user_util import generate_device_fingerprint, calculate_risk_score

user_setting_schema = UserSettingSchema()  # 实例化 Schema


class UserService:
    MAX_CONCURRENT_DEVICES = Config.MAX_CONCURRENT_DEVICES

    @classmethod
    def execute_login(cls, username, password, ip, user_agent):
        if not username or not password:
            raise BizException(_("USERNAME_PASSWORD_REQUIRED"), code=400)

        # 校验用户
        user = UserSetting.query.filter_by(username=username).first()
        if not user or not UserSetting.verify_password(password, user.pwd_hash):
            cls.record_login_history(
                user_id=user.id if user else None,  # 如果用户不存在，user_id 为 None
                login_ip=ip,
                user_agent=user_agent,
                device_type=DeviceParser.parse(user_agent),
                failure_reason="Invalid credentials"
            )
            raise BizException(_("INVALID_CREDENTIALS"), code=401)

        # 检查账号是否被锁定
        if user.is_locked:
            # 记录尝试登录被阻断的日志
            cls.record_login_history(
                user_id=user.id,
                login_ip=ip,
                user_agent=user_agent,
                device_type=DeviceParser.parse(user_agent),
                failure_reason="Account locked"
            )
            raise BizException(_("ACCOUNT_LOCKED"), code=403)

        # 检查并清理旧会话
        active_sessions = UserSession.query.filter_by(
            user_id=user.id,
            is_active=GlobalYesOrNo.YES
        ).order_by(UserSession.created_at.asc()).all()
        if len(active_sessions) >= cls.MAX_CONCURRENT_DEVICES:
            oldest = active_sessions[0]
            oldest.is_active = GlobalYesOrNo.NO
            # 将其 Token 加入黑名单（增强安全性）
            blacklisted = TokenBlacklist(
                jti=oldest.session_id,
                user_id=user.id,
                token_type='access',
                expires_at=datetime.utcnow()
            )
            db.session.add(blacklisted)
            db.session.add(oldest)
            logger.info(f"Kicked oldest session {oldest.session_id} for user {user.username}")

        # 创建新会话
        device_fingerprint = generate_device_fingerprint()
        session_id = str(uuid.uuid4())
        new_session = UserSession(
            user_id=user.id,
            session_id=session_id,
            device_fingerprint=device_fingerprint,
            login_ip=ip,
            user_agent=user_agent,
            created_at=datetime.utcnow(),
            last_active=datetime.utcnow(),
            is_active=GlobalYesOrNo.YES
        )
        db.session.add(new_session)

        # 生成 Token
        additional_claims = {
            "device_fingerprint": device_fingerprint,
            "session_id": session_id
        }
        access_token = create_access_token(
            identity=user.uuid,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=user.uuid,
            additional_claims=additional_claims
        )

        # 记录成功登录历史
        cls.record_login_history(
            user_id=user.id,
            login_ip=ip,
            user_agent=user_agent,
            device_type=DeviceParser.parse(user_agent),
            session_id=session_id
        )

        # 7. 更新最后登录时间
        user.last_login_at = datetime.now()
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.exception(e, exc_info=True)

        # 8. 返回结果
        return {
            "refresh_token": refresh_token,
            "data": {
                "access_token": access_token,
                # 修改：使用 UserSettingSchema 序列化用户对象，排除 id
                "user": user_setting_schema.dump(user)
            }
        }

    @classmethod
    def _manage_active_sessions(cls, user: UserSetting, exclude_session_id: str = None):
        """
        私有辅助方法：管理用户的活跃会话，确保不超过最大设备数。
        如果超出，则将最旧的会话踢出。
        """
        query = UserSession.query.filter_by(
            user_id=user.id,
            is_active=GlobalYesOrNo.YES
        )
        if exclude_session_id:
            query = query.filter(UserSession.session_id != exclude_session_id)

        active_sessions = query.order_by(UserSession.created_at.asc()).all()

        if len(active_sessions) >= cls.MAX_CONCURRENT_DEVICES:
            # 从最旧的会话开始踢出，直到满足数量要求
            sessions_to_kick_count = len(active_sessions) - cls.MAX_CONCURRENT_DEVICES + 1
            sessions_to_kick = active_sessions[:sessions_to_kick_count]

            for session in sessions_to_kick:
                session.is_active = GlobalYesOrNo.NO
                # 将其关联的 Token 加入黑名单（增强安全性）
                # 注意：这里用 session_id 作为 jti 的代理，假设它们在创建时是一致的
                blacklisted = TokenBlacklist(
                    jti=session.session_id,
                    user_id=user.id,
                    token_type='refresh',  # 将 refresh token 拉黑更有效
                    expires_at=datetime.utcnow()  # 立即失效
                )
                db.session.add(blacklisted)
                db.session.add(session)
                logger.info(f"Kicked oldest session {session.session_id} for user {user.username}")

    # 用于记录登录历史的辅助函数
    @staticmethod
    def record_login_history(user_id: int | None, login_ip: str, user_agent: str, device_type: str, session_id: str = None, failure_reason: str = None) -> LoginHistory:
        """记录登录历史"""
        # 如果 user_id 为 None (例如用户名不存在)，则不设置外键
        login_history = LoginHistory(
            user_id=user_id,
            login_ip=login_ip,
            user_agent=user_agent,
            device_type=device_type,
            session_id=session_id,
            login_status=LoginStatus.SUCCESS if failure_reason is None else LoginStatus.FAILED,
            failure_reason=failure_reason,
            risk_score=0,  # 由后续计算
            is_suspicious=GlobalYesOrNo.NO
        )
        # 计算风险评分（可选：根据IP、User-Agent、时间等）
        login_history.risk_score = calculate_risk_score(login_ip, user_agent)
        login_history.is_suspicious = GlobalYesOrNo.YES if login_history.risk_score > 50 else GlobalYesOrNo.NO
        try:
            db.session.add(login_history)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.exception(e, exc_info=True)

        return login_history
