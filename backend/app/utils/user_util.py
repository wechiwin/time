import hashlib

from flask import request, g
from flask_limiter.util import get_remote_address

from app.constant.biz_enums import ErrorMessageEnum
from app.framework.exceptions import BizException


def generate_device_fingerprint() -> str:
    """基于请求信息生成设备指纹"""
    user_agent = request.headers.get('User-Agent', '')
    accept_lang = request.headers.get('Accept-Language', '')
    ip = get_remote_address()

    # 创建哈希
    fingerprint = hashlib.sha256(
        f"{user_agent}|{ip}|{accept_lang}".encode()
    ).hexdigest()

    return fingerprint


def calculate_risk_score(login_ip: str, user_agent: str) -> int:
    """简化风险评分计算"""
    score = 0
    if login_ip.startswith(('192.168.', '10.', '172.')):
        score += 10  # 内网IP
    if user_agent and ('bot' in user_agent.lower() or 'spider' in user_agent.lower()):
        score += 20
    # 可扩展：根据时间（凌晨登录）、地理位置、设备类型等
    return min(score, 100)


def get_or_raise(model_cls, resource_id):
    """针对多用户表格的数据校验，会对传入的resource_id和返回的对象进行判空校验并抛出异常"""
    if not resource_id:
        raise BizException(ErrorMessageEnum.MISSING_FIELD.value)

    obj = model_cls.get_by_id_and_user(resource_id, g.user.id)

    if not obj:
        raise BizException(ErrorMessageEnum.NO_SUCH_DATA)

    return obj
