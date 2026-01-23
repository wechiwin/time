import logging

from flask import Blueprint, request

from app.constant.biz_enums import *
from app.framework.auth import auth_required
from app.framework.res import Res

logger = logging.getLogger(__name__)

common_bp = Blueprint('common', __name__, url_prefix='/api/common')


@common_bp.route('/get_enum', methods=['GET'])
@auth_required
def get_enum():
    """
    根据枚举类名称获取枚举值列表
    :return: 包含枚举code和value的JSON数组
    """
    enum_name = request.args.get('enum_name')
    if not enum_name:
        return Res.fail(ErrorMessageEnum.MISSING_FIELD.value)

    ENUM_MAPPING = {
        'HoldingTypeEnum': HoldingTypeEnum,
        'HoldingStatusEnum': HoldingStatusEnum,
        'AlertEmailStatusEnum': AlertEmailStatusEnum,
        'TradeTypeEnum': TradeTypeEnum,
        'AlertRuleActionEnum': AlertRuleActionEnum,
        'FundTradeMarketEnum': FundTradeMarketEnum,
        'CurrencyEnum': CurrencyEnum,
        'FundDividendMethodEnum': FundDividendMethodEnum,
        'DividendTypeEnum': DividendTypeEnum,
        'TaskStatusEnum': TaskStatusEnum,
        # 添加其他枚举类...
    }

    enum_class = ENUM_MAPPING.get(enum_name)
    if not enum_class:
        return Res.fail(f'Enum {enum_name} not found')

    # 构建枚举值列表
    enum_list = []
    for member in enum_class:
        enum_list.append({
            'value': member.value,  # 枚举值（数字）
            'label': member.view  # 显示文本（已翻译）
        })

    return Res.success(enum_list)
