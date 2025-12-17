from datetime import date, timedelta

def get_today_date_str():
    """YYYY-MM-DD"""
    today = date.today()
    return str(today)

def get_yesterday_date_str():
    """YYYY-MM-DD"""
    yesterday = date.today() - timedelta(days=1)
    return str(yesterday)
