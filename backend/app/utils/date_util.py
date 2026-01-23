from datetime import date, timedelta, datetime


def get_today_date_str():
    """
    返回今天日期的字符串 YYYY-MM-DD
    """
    today_str = date.today().strftime('%Y-%m-%d')
    return today_str


def get_yesterday_date():
    """
    返回昨天日期的字符串 YYYY-MM-DD
    """
    yesterday = date.today() - timedelta(days=1)
    return yesterday


def get_yesterday_date_str():
    """
    返回昨天日期的字符串 YYYY-MM-DD
    """
    yesterday_str = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
    return yesterday_str


def date_to_str(date_entity):
    """
    返回指定日期的字符串 YYYY-MM-DD
    """
    date_str = date_entity.strftime('%Y-%m-%d')
    return date_str


def datetime_to_str(datetime_entity):
    """
    返回指定时间的字符串 YYYY-MM-DD HH:MM:SS
    """
    if datetime_entity is None:
        return None
    return datetime_entity.strftime('%Y-%m-%d %H:%M:%S')


def str_to_date(date_str: str):
    """
    根据日期字符串YYYY-MM-DD，返回日期date对象
    """
    date_entity = datetime.strptime(date_str, '%Y-%m-%d').date()
    return date_entity


def the_day_after_date_str():
    """
    返回昨天日期的字符串 YYYY-MM-DD
    """
    yesterday_str = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
    return yesterday_str
