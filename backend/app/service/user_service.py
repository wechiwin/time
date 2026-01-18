# app/services/auth_service.py
import logging
import uuid
from datetime import datetime

from flask_jwt_extended import create_access_token, create_refresh_token

from app.framework.exceptions import BizException
from app.models import UserSetting, DeviceType, db, LoginHistory, LoginStatus
from app.utils.user_util import generate_device_fingerprint, calculate_risk_score
from app.schemas_marshall import UserSettingSchema # 导入 UserSettingSchema

logger = logging.getLogger(__name__)

user_setting_schema = UserSettingSchema() # 实例化 Schema


class UserService:

    @classmethod
    def execute_login(cls, username, password, ip, user_agent):
        if not username or not password:
            raise BizException("用户名和密码不能为空", code=400)

        # 1. 查询用户
        user = UserSetting.query.filter_by(username=username).first()

        # 2. 校验密码
        if not user or not UserSetting.verify_password(password, user.pwd_hash):
            # 记录失败日志（可选，防止暴力破解分析）
            # 注意：这里不记录 user_id，因为可能是无效用户名，避免信息泄露
            cls.record_login_history(
                user_id=user.id if user else None, # 如果用户不存在，user_id 为 None
                login_ip=ip,
                user_agent=user_agent,
                device_type=DeviceType.UNKNOWN.value,
                failure_reason="Invalid credentials"
            )
            raise BizException("用户名或密码错误", code=401)

        # 3. 【关键】检查账号是否被锁定
        if user.is_locked:
            # 记录尝试登录被阻断的日志
            cls.record_login_history(
                user_id=user.id,
                login_ip=ip,
                user_agent=user_agent,
                device_type=DeviceType.UNKNOWN.value,
                failure_reason="Account locked"
            )
            raise BizException("账号已被锁定，请联系管理员", code=403)

        # 4. 生成设备指纹和 Session ID
        device_fingerprint = generate_device_fingerprint()
        session_id = str(uuid.uuid4())
        additional_claims = {
            "device_fingerprint": device_fingerprint,
            "session_id": session_id
        }

        # 5. 生成 Token
        access_token = create_access_token(
            identity=user.uuid,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=user.uuid,
            additional_claims=additional_claims
        )

        # 6. 记录成功登录历史
        cls.record_login_history(
            user_id=user.id, # 内部使用 id
            login_ip=ip,
            user_agent=user_agent,
            device_type=DeviceType.UNKNOWN.value,
            session_id=session_id
        )

        # 7. 更新最后登录时间
        user.last_login_at = datetime.now()
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(e, exc_info=True)

        # 8. 返回结果
        return {
            "refresh_token": refresh_token,
            "data": {
                "access_token": access_token,
                # 修改：使用 UserSettingSchema 序列化用户对象，排除 id
                "user": user_setting_schema.dump(user)
            }
        }

    # 用于记录登录历史的辅助函数
    @staticmethod
    def record_login_history(user_id: int | None, login_ip: str, user_agent: str, device_type: str, session_id: str = None, failure_reason: str = None) -> LoginHistory:
        """记录登录历史"""
        # 如果 user_id 为 None (例如用户名不存在)，则不设置外键
        login_history = LoginHistory(
            user_id=user_id,
            login_ip=login_ip,
            user_agent=user_agent,
            device_type=DeviceType(device_type),
            session_id=session_id,
            login_status=LoginStatus.SUCCESS if failure_reason is None else LoginStatus.FAILED,
            failure_reason=failure_reason,
            risk_score=0,  # 由后续计算
            is_suspicious=False
        )
        # 计算风险评分（可选：根据IP、User-Agent、时间等）
        login_history.risk_score = calculate_risk_score(login_ip, user_agent)
        login_history.is_suspicious = login_history.risk_score > 50
        try:
            db.session.add(login_history)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(e, exc_info=True)

        return login_history

