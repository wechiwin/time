from flask import Blueprint, request

from app.cache import cache
from app.constant.biz_enums import get_all_enum_classes, ErrorMessageEnum
from app.framework.res import Res

common_bp = Blueprint('common', __name__, url_prefix='/common')


def _make_enum_key_prefix():
    """Generate cache key prefix for single enum request."""
    data = request.get_json(silent=True) or {}
    enum_name = data.get('enum_name', '')
    lang = request.headers.get('Accept-Language', 'en')
    return f"enum_{enum_name}_{lang}"


def _serialize_enum(enum_class) -> list[dict]:
    """Convert enum class to list of {value, label} dicts."""
    return [
        {'value': member.value, 'label': member.view}
        for member in enum_class
    ]


@common_bp.route('/get_enum', methods=['POST'])
@cache.cached(timeout=300, key_prefix=_make_enum_key_prefix)
def get_enum():
    """
    Get a single enum's values by name.

    Request:
        {"enum_name": "TradeTypeEnum"}

    Response:
        [{"value": "BUY", "label": "Buy"}, ...]
    """
    data = request.get_json(silent=True) or {}
    enum_name = data.get('enum_name')

    if not enum_name:
        return Res.fail(ErrorMessageEnum.MISSING_FIELD.view)

    enum_mapping = get_all_enum_classes()
    enum_class = enum_mapping.get(enum_name)

    if not enum_class:
        return Res.fail(ErrorMessageEnum.DATA_NOT_FOUND.view)

    return Res.success(_serialize_enum(enum_class))


@common_bp.route('/get_all_enums', methods=['POST'])
@cache.cached(timeout=300, key_prefix=lambda: f"all_enums_{request.headers.get('Accept-Language', 'en')}")
def get_all_enums():
    """
    Get all available enums in a single request.

    Response:
        {
            "HoldingTypeEnum": [{"value": "FUND", "label": "Fund"}, ...],
            "TradeTypeEnum": [...],
            ...
        }
    """
    enum_mapping = get_all_enum_classes()

    result = {
        name: _serialize_enum(enum_class)
        for name, enum_class in enum_mapping.items()
    }

    return Res.success(result)
