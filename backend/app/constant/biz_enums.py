from enum import Enum

from flask_babel import lazy_gettext


class HoldingTypeEnum(str, Enum):
    FUND = 'FUND'

    @property
    def view(self):
        if self == HoldingTypeEnum.FUND:
            return lazy_gettext('HOLDING_TYPE_FUND')
        return self.name


class HoldingStatusEnum(str, Enum):
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


class AlertEmailStatusEnum(str, Enum):
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


class DividendTypeEnum(str, Enum):
    CASH = 'CASH'
    REINVEST = 'REINVEST'

    @property
    def view(self):
        if self == DividendTypeEnum.CASH:
            return lazy_gettext('CASH')
        elif self == DividendTypeEnum.REINVEST:
            return lazy_gettext('REINVEST')
        return self.name


class TradeTypeEnum(str, Enum):
    BUY = 'BUY'
    SELL = 'SELL'
    DIVIDEND = 'DIVIDEND'

    # SPLIT = (3, gettext('TR_SPLIT'))
    # TRANSFER_IN = (4, gettext('TR_TRANSFER_IN'))
    # TRANSFER_OUT = (5, gettext('TR_TRANSFER_OUT'))

    @property
    def view(self):
        if self == TradeTypeEnum.SELL:
            return lazy_gettext('TR_SELL')
        elif self == TradeTypeEnum.BUY:
            return lazy_gettext('TR_BUY')
        elif self == TradeTypeEnum.DIVIDEND:
            return lazy_gettext('TR_DIVIDEND')
        return self.name


class AlertRuleActionEnum(str, Enum):
    BUY = 'BUY'
    SELL = 'SELL'

    @property
    def view(self):
        if self == AlertRuleActionEnum.SELL:
            return lazy_gettext('TR_SELL')
        elif self == AlertRuleActionEnum.BUY:
            return lazy_gettext('TR_BUY')
        return self.name


class CurrencyEnum(str, Enum):
    CNY = 'CNY'

    @property
    def view(self):
        return self.name


class FundTradeMarketEnum(str, Enum):
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


class FundDividendMethodEnum(str, Enum):
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


class ErrorMessageEnum(str, Enum):
    """
    错误提示语常量类
    """
    MISSING_FIELD = "缺少必要字段"
    DATA_NOT_FOUND = "数据不存在"
    DUPLICATE_DATA = "数据已存在"
    OVERSOLD = "卖出份额不应大于买入份额"
    NO_AUTH = "暂无操作权限"
    NOT_TRADE_DAY = "不是交易日期"
    OPERATION_FAILED = "操作失败"
    NO_FILE_UPLOAD = "没有上传文件"

    @property
    def view(self):
        if self == ErrorMessageEnum.MISSING_FIELD:
            return lazy_gettext('MISSING_FIELD')
        elif self == ErrorMessageEnum.DATA_NOT_FOUND:
            return lazy_gettext('DATA_NOT_FOUND')
        elif self == ErrorMessageEnum.DUPLICATE_DATA:
            return lazy_gettext('DUPLICATE_DATA')
        elif self == ErrorMessageEnum.OVERSOLD:
            return lazy_gettext('OVERSOLD')
        elif self == ErrorMessageEnum.NO_AUTH:
            return lazy_gettext('NO_AUTH')
        elif self == ErrorMessageEnum.NOT_TRADE_DAY:
            return lazy_gettext('NOT_TRADE_DAY')
        elif self == ErrorMessageEnum.OPERATION_FAILED:
            return lazy_gettext('OPERATION_FAILED')
        elif self == ErrorMessageEnum.NO_FILE_UPLOAD:
            return lazy_gettext('NO_FILE_UPLOAD')
        return self.name


class TaskStatusEnum(str, Enum):
    PENDING = 'PENDING'  # 已创建，等待执行
    RUNNING = 'RUNNING'  # 正在执行
    SUCCESS = 'SUCCESS'  # 执行成功
    RETRYING = 'RETRYING'  # 执行失败，等待重试
    FAILED = 'FAILED'  # 达到最大重试次数，最终失败
    CANCELLED = 'CANCELLED'  # 手动取消

    @property
    def view(self):
        if self == TaskStatusEnum.PENDING:
            return lazy_gettext('PENDING')
        elif self == TaskStatusEnum.RUNNING:
            return lazy_gettext('RUNNING')
        elif self == TaskStatusEnum.SUCCESS:
            return lazy_gettext('SUCCESS')
        elif self == TaskStatusEnum.RETRYING:
            return lazy_gettext('RETRYING')
        elif self == TaskStatusEnum.FAILED:
            return lazy_gettext('FAILED')
        elif self == TaskStatusEnum.CANCELLED:
            return lazy_gettext('CANCELLED')
        return self.name


class AnalyticsWindowEnum(str, Enum):
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
