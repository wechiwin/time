from enum import Enum

from flask_babel import gettext


class HoldingStatusEnum(Enum):
    NOT_HOLDING = (0, gettext('HO_STATUS_NOT_HOLDING'))
    HOLDING = (1, gettext('HO_STATUS_HOLDING'))
    CLEARED = (2, gettext('HO_STATUS_CLEARED'))

    def __init__(self, code, desc):
        self.code = code
        self.desc = desc


class AlertEmailStatusEnum(Enum):
    PENDING = (0, gettext('AR_EM_PENDING'))
    SENT = (1, gettext('AR_EM_SENT'))
    FAILED = (2, gettext('AR_EM_FAILED'))

    def __init__(self, code, desc):
        self.code = code
        self.desc = desc


# # 使用示例
# status = AlertStatus.SENT
# print(status.code)  # 输出: 1
# print(status.desc)  # 输出: '已发送'

class TradeStatusEnum(Enum):
    SELL = (0, gettext('TR_SELL'))
    BUY = (1, gettext('TR_BUY'))

    def __init__(self, code, desc):
        self.code = code
        self.desc = desc


class AlertActionStatusEnum(Enum):
    SELL = (0, gettext('TR_SELL'))
    BUY = (1, gettext('TR_BUY'))
    ADD_POSITION = (2, gettext('TR_ADD_POSITION'))

    def __init__(self, code, desc):
        self.code = code
        self.desc = desc
