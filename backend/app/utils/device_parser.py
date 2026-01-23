import re
from typing import Optional

from app.constant.sys_enums import DeviceType, GlobalYesOrNo


class DeviceParser:
    """设备类型解析器 - 生产级实现"""

    # 正则规则库（按优先级排序）
    RULES = [
        (re.compile(r'tablet|ipad|playbook|kindle', re.I), DeviceType.TABLET),
        (re.compile(r'mobile|android|iphone|ipod|blackberry', re.I), DeviceType.MOBILE),
        (re.compile(r'bot|crawler|spider|curl', re.I), DeviceType.BOT),
        (re.compile(r'windows|macintosh|linux|x11', re.I), DeviceType.DESKTOP)
    ]

    @classmethod
    def parse(cls, user_agent: Optional[str]) -> DeviceType:
        """
        解析 User-Agent 获取设备类型
        :param user_agent: HTTP User-Agent 头
        :return: 设备类型枚举
        """
        if not user_agent or not isinstance(user_agent, str):
            return DeviceType.UNKNOWN

        # 优先检查已知机器人特征（安全关键）
        if cls._is_suspicious_bot(user_agent):
            return DeviceType.BOT

        # 按优先级匹配规则
        for pattern, device_type in cls.RULES:
            if pattern.search(user_agent):
                return device_type

        return DeviceType.UNKNOWN

    @staticmethod
    def _is_suspicious_bot(user_agent: str) -> int:
        """增强机器人检测（防御性安全措施）"""
        # 检查无浏览器特征的请求
        if 'curl' in user_agent.lower() or 'python-requests' in user_agent.lower():
            return GlobalYesOrNo.YES

        # 检查常见扫描工具
        if any(tool in user_agent.lower() for tool in ['nikto', 'sqlmap', 'wpscan']):
            return GlobalYesOrNo.YES

        return GlobalYesOrNo.NO
