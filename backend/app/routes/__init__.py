from flask import Flask

from .holdings import holdings_bp
from .net_values import net_values_bp
from .transactions import transactions_bp


def register_routes(app: Flask):
    app.register_blueprint(holdings_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(net_values_bp)
