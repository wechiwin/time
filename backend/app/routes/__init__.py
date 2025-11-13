from flask import Flask

from .holding_bp import holding_bp
from .nav_history_bp import nav_history_bp
from .trade_bp import trade_bp


def register_routes(app: Flask):
    app.register_blueprint(holding_bp)
    app.register_blueprint(trade_bp)
    app.register_blueprint(nav_history_bp)
