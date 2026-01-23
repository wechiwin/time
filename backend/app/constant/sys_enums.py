from enum import Enum


class DeviceType(str, Enum):
    WEB = 'WEB'
    MOBILE = 'MOBILE'
    DESKTOP = 'DESKTOP'
    TABLET = 'TABLET'
    BOT = 'BOT'
    UNKNOWN = 'UNKNOWN'


class LoginStatus(str, Enum):
    SUCCESS = 'SUCCESS'
    FAILED = 'FAILED'
    BLOCKED = 'BLOCKED'


class GlobalYesOrNo(int, Enum):
    YES = 1
    NO = 0
