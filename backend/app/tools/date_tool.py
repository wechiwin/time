from datetime import date, timedelta

def get_today_str():
    today = date.today()
    return str(today)

def get_yesterday_str():
    yesterday = date.today() - timedelta(days=1)
    return str(yesterday)
