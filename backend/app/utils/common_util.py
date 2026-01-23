from typing import Any


def is_blank(value: Any) -> bool:
    """
    判断一个值是否“空”：
    - None
    - 字符串的空白、空串、'null'/'none'/'nil' 等字面量（忽略大小写）
    - 其他类型一律视为非空
    """
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in {"", "null", "none", "nil"}
    return False


def is_not_blank(value: Any) -> bool:
    """
    判断一个值是否“非空”：
    """
    return not is_blank(value)
