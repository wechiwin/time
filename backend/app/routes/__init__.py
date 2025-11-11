from flask import Flask

from .holding_bp import holdings_bp
from .net_value_bp import net_values_bp
from .transactions_bp import transactions_bp


def register_routes(app: Flask):
    app.register_blueprint(holdings_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(net_values_bp)
