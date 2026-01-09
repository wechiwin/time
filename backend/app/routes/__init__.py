from flask import Flask

from .alert_bp import alert_bp
from .common_bp import common_bp
from .dashboard_bp import dashboard_bp
from .holding_analytics_snapshot_bp import holding_analytics_snapshot_bp
from .holding_bp import holding_bp
from .holding_snapshot_bp import holding_snapshot_bp
from .nav_history_bp import nav_history_bp
from .portfolio_snapshot_bp import portfolio_snapshot_bp
# from .stock_price_history_bp import stock_price_history_bp
from .trade_bp import trade_bp
from .user_bp import user_bp


def register_routes(app: Flask):
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(holding_bp)
    app.register_blueprint(trade_bp)
    app.register_blueprint(nav_history_bp)
    app.register_blueprint(alert_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(portfolio_snapshot_bp)
    app.register_blueprint(holding_snapshot_bp)
    # app.register_blueprint(stock_price_history_bp)
    app.register_blueprint(common_bp)
    app.register_blueprint(holding_analytics_snapshot_bp)
