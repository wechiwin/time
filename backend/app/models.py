from app.database import db


class Holding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_name = db.Column(db.String(100))
    fund_code = db.Column(db.String(50), unique=True)
    fund_type = db.Column(db.String(50))


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_code = db.Column(db.Integer, db.ForeignKey('holding.fund_code'))
    transaction_type = db.Column(db.String(10))
    transaction_date = db.Column(db.String(20))
    transaction_net_value = db.Column(db.Float)
    transaction_shares = db.Column(db.Float)
    transaction_fee = db.Column(db.Float)


class NetValue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fund_code = db.Column(db.Integer, db.ForeignKey('holding.fund_code'))
    date = db.Column(db.String(20))
    unit_net_value = db.Column(db.Float)
    accumulated_net_value = db.Column(db.Float)
