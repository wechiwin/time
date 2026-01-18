from enum import Enum

from flask_babel import lazy_gettext


class HoldingTypeEnum(Enum):
    FUND = 'FUND'

    @property
    def view(self):
        if self == HoldingTypeEnum.FUND:
            return lazy_gettext('HOLDING_TYPE_FUND')
        return self.name


class HoldingStatusEnum(Enum):
    NOT_HELD = 'NOT_HELD'
    HOLDING = 'HOLDING'
    CLOSED = 'CLOSED'

    @property
    def view(self):
        if self == HoldingStatusEnum.NOT_HELD:
            return lazy_gettext('HO_STATUS_NOT_HOLDING')
        elif self == HoldingStatusEnum.HOLDING:
            return lazy_gettext('HO_STATUS_HOLDING')
        elif self == HoldingStatusEnum.CLOSED:
            return lazy_gettext('HO_STATUS_CLEARED')
        return self.name


class AlertEmailStatusEnum(Enum):
    PENDING = 'PENDING'
    SENT = 'SENT'
    FAILED = 'FAILED'

    @property
    def view(self):
        if self == AlertEmailStatusEnum.PENDING:
            return lazy_gettext('AR_EM_PENDING')
        elif self == AlertEmailStatusEnum.SENT:
            return lazy_gettext('AR_EM_SENT')
        elif self == AlertEmailStatusEnum.FAILED:
            return lazy_gettext('AR_EM_FAILED')
        return self.name


class TradeTypeEnum(Enum):
    BUY = 'BUY'
    SELL = 'SELL'

    # DIVIDEND = 'DIVIDEND'

    # SPLIT = (3, gettext('TR_SPLIT'))
    # TRANSFER_IN = (4, gettext('TR_TRANSFER_IN'))
    # TRANSFER_OUT = (5, gettext('TR_TRANSFER_OUT'))

    @property
    def view(self):
        if self == TradeTypeEnum.SELL:
            return lazy_gettext('TR_SELL')
        elif self == TradeTypeEnum.BUY:
            return lazy_gettext('TR_BUY')
        # elif self == TradeTypeEnum.DIVIDEND:
        #     return lazy_gettext('TR_DIVIDEND')
        return self.name


class AlertRuleActionEnum(Enum):
    BUY = 'BUY'
    SELL = 'SELL'

    @property
    def view(self):
        if self == AlertRuleActionEnum.SELL:
            return lazy_gettext('TR_SELL')
        elif self == AlertRuleActionEnum.BUY:
            return lazy_gettext('TR_BUY')
        return self.name


class CurrencyEnum(Enum):
    CNY = 'CNY'

    @property
    def view(self):
        return self.name


class FundTradeMarketEnum(Enum):
    """
    交易市场枚举：场内交易/场外交易
    """
    EXCHANGE = "EXCHANGE"
    OFF_EXCHANGE = "OFF_EXCHANGE"
    BOTH = "BOTH"

    @property
    def view(self):
        if self == FundTradeMarketEnum.EXCHANGE:
            return lazy_gettext('FD_TR_EX')
        elif self == FundTradeMarketEnum.OFF_EXCHANGE:
            return lazy_gettext('FD_TR_OFF_EX')
        elif self == FundTradeMarketEnum.BOTH:
            return lazy_gettext('FD_TR_BOTH')
        return self.name


class FundDividendMethodEnum(Enum):
    """
    基金分红方式枚举："现金分红", "分红再投资"
    """
    CASH = 'CASH'
    REINVEST = 'REINVEST'

    @property
    def view(self):
        if self == FundDividendMethodEnum.REINVEST:
            return lazy_gettext('FD_DIVIDEND_REINVEST')
        elif self == FundDividendMethodEnum.CASH:
            return lazy_gettext('FD_DIVIDEND_CASH')
        return self.name


class ErrorMessageEnum(Enum):
    """
    错误提示语常量类（中文默认，支持未来扩展多语言）
    """
    MISSING_FIELD = "缺少必要字段"
    NO_SUCH_DATA = "数据不存在"
    OVERSOLD = "卖出份额不应大于买入份额"
    NO_AUTH = "暂无操作权限"


class TaskStatusEnum(Enum):
    PENDING = 'PENDING'  # 已创建，等待执行
    RUNNING = 'RUNNING'  # 正在执行
    SUCCESS = 'SUCCESS'  # 执行成功
    RETRYING = 'RETRYING'  # 执行失败，等待重试
    FAILED = 'FAILED'  # 达到最大重试次数，最终失败
    CANCELLED = 'CANCELLED'  # 手动取消


class AnalyticsWindowEnum(Enum):
    # expanding
    ALL = "ALL"
    """
    自建仓以来
    """
    CUR = "CUR"
    """
    本轮持仓（since last clear）
    """
    # rolling
    R21 = "R21"
    """
    一个月
    """
    R63 = "R63"
    """
    三个月
    """
    R126 = "R126"
    """
    半年
    """
    R252 = "R252"
    """
    一年
    """

    @classmethod
    def rolling_windows(cls):
        return {
            cls.R21,
            cls.R63,
            cls.R126,
            cls.R252,
        }

    @classmethod
    def expanding_windows(cls):
        return {
            cls.ALL,
            cls.CUR,
        }


class DeviceType(Enum):
    WEB = 'web'
    MOBILE = 'mobile'
    DESKTOP = 'desktop'
    TABLET = 'tablet'
    UNKNOWN = 'unknown'


class LoginStatus(Enum):
    SUCCESS = 'success'
    FAILED = 'failed'
    BLOCKED = 'blocked'
