from flask import Flask

from ._time_bp import time_bp
from .system_bp import system_bp


def register_routes(app: Flask):
    app.register_blueprint(system_bp)

    app.register_blueprint(time_bp)
