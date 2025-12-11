from binascii import hexlify
from datetime import datetime

from Crypto.Protocol.KDF import PBKDF2
from flask import current_app
from werkzeug.security import generate_password_hash, check_password_hash

from app.database import db


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
    ho_name = db.Column(db.String(100))  # 基金名称
    ho_code = db.Column(db.String(50), unique=True)  # 基金代码
    ho_type = db.Column(db.String(50))  # 基金类型
    ho_establish_date = db.Column(db.String(100))  # 创建时间
    ho_short_name = db.Column(db.String(100))  # 基金简称
    ho_manage_exp_rate = db.Column(db.Float)  # 管理费率
    ho_trustee_exp_rate = db.Column(db.Float)  # 托管费率
    ho_sales_exp_rate = db.Column(db.Float)  # 销售费率
    ho_status = db.Column(db.Integer) # 状态：0,已关注;1,已持仓；2.已清仓


class Trade(TimestampMixin, db.Model):
    tr_id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50))
    tr_type = db.Column(db.Integer)  # 交易类型：1.买入；0.卖出
    tr_date = db.Column(db.String(20))  # 交易日期
    tr_nav_per_unit = db.Column(db.Float)  # 单位净值
    tr_shares = db.Column(db.Float)  # 交易份额
    tr_net_amount = db.Column(db.Float)  # 交易净额(不含交易费用)
    tr_fee = db.Column(db.Float)  # 交易费用
    tr_amount = db.Column(db.Float)  # 交易总额(含交易费用)
    is_cleared = db.Column(db.Integer)  # 是否清仓：1.是；0.否


class NavHistory(db.Model):
    nav_id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50))
    nav_date = db.Column(db.String(20))
    nav_per_unit = db.Column(db.Float)  # 单位净值
    nav_accumulated_per_unit = db.Column(db.Float)  # 累计净值=单位净值+分红

    __table_args__ = (
        db.UniqueConstraint('ho_code', 'nav_date', name='navh_code_date_uk'),
    )


class AlertRule(TimestampMixin, db.Model):
    ar_id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50))
    ar_type = db.Column(db.Integer)  # 提醒类型：1.买入/2.加仓/0.卖出
    ar_target_navpu = db.Column(db.Float)  # 目标单位净值
    ar_is_active = db.Column(db.Integer)  # 是否激活:1.是;0.否
    ar_tracked_date = db.Column(db.String(20))  # 已追踪日期


class AlertHistory(TimestampMixin, db.Model):
    ah_id = db.Column(db.Integer, primary_key=True)
    ar_id = db.Column(db.Integer)
    ah_nav_date = db.Column(db.String(100))  # 实际净值日
    ah_status = db.Column(db.Integer)  # 发送状态:0:'pending', 1:'sent', 2:'failed'
    ho_code = db.Column(db.String(50))
    ah_ar_type = db.Column(db.Integer)  # 提醒类型：1.买入/2.加仓/0.卖出
    ah_target_navpu = db.Column(db.Float)  # 目标单位净值
    ah_nav_per_unit = db.Column(db.Float)  # 实际净值


class UserSetting(TimestampMixin, db.Model):
    us_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128))
    pwd_hash = db.Column(db.String(128))
    default_lang = db.Column(db.String(20))
    email_address = db.Column(db.String(50))

    def set_password(self, password):
        """将密码转换为哈希值并存储到 pwd_hash 字段"""
        self.pwd_hash = generate_password_hash(password)

    def check_password(self, password):
        """检查提供的密码是否与存储的哈希值匹配"""
        return check_password_hash(self.pwd_hash, password)

    def generate_hash(password: str) -> str:
        """生成加盐哈希"""
        dk = PBKDF2(
            password.encode(),
            current_app.config['SALT'],
            dkLen=64,
            count=current_app.config['ITERATIONS']
        )
        return hexlify(dk).decode()
