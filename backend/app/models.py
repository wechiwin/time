from app.database import db
from datetime import datetime


class TimestampMixin:
    """
    混入类：为继承它的所有模型统一增加
    created_at 和 updated_at 两个时间戳字段
    """
    created_at = db.Column(db.DateTime, default=datetime.now(), nullable=False)
    updated_at = db.Column(db.DateTime,
                           default=datetime.now(),
                           onupdate=datetime.now(),
                           nullable=False)


class Holding(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_name = db.Column(db.String(100))
    fund_code = db.Column(db.String(50), unique=True)
    fund_type = db.Column(db.String(50))


class Transaction(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_code = db.Column(db.String(50), db.ForeignKey('holding.fund_code'))
    transaction_type = db.Column(db.String(10))
    transaction_date = db.Column(db.String(20))
    transaction_net_value = db.Column(db.Float)
    transaction_shares = db.Column(db.Float)
    transaction_fee = db.Column(db.Float)


class NetValue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_code = db.Column(db.String(50), db.ForeignKey('holding.fund_code'))
    date = db.Column(db.String(20))
    unit_net_value = db.Column(db.Float)
    accumulated_net_value = db.Column(db.Float)
