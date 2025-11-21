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
    ho_id = db.Column(db.Integer, primary_key=True)
    ho_name = db.Column(db.String(100))
    ho_code = db.Column(db.String(50), unique=True)
    ho_type = db.Column(db.String(50))
    ho_establish_date = db.Column(db.Date)
    ho_short_name = db.Column(db.String(100))


class Trade(TimestampMixin, db.Model):
    tr_id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50), db.ForeignKey('holding.ho_code'))
    tr_type = db.Column(db.String(10))
    tr_date = db.Column(db.String(20))
    tr_nav_per_unit = db.Column(db.Float)
    tr_shares = db.Column(db.Float)
    tr_fee = db.Column(db.Float)
    tr_amount = db.Column(db.Float)


class NavHistory(db.Model):
    nav_id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50), db.ForeignKey('holding.ho_code'))
    nav_date = db.Column(db.String(20))
    nav_per_unit = db.Column(db.Float)  # 单位净值
    nav_accumulated_per_unit = db.Column(db.Float)  # 累计净值=单位净值+分红

    __table_args__ = (
        db.UniqueConstraint('ho_code', 'nav_date', name='navh_code_date_uk'),
    )
