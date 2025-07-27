# backend/app/__init__.py
import logging

# Import the db instance from your database module
from app.database import db
from flask import Flask, jsonify

from .routes.holdings import holdings_bp
from .routes.net_values import net_values_bp
from .routes.transactions import transactions_bp

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    # 禁用 ASCII 转义
    app.config["JSON_AS_ASCII"] = False
    # 默认 UTF-8 # --- Configuration ---
    app.config["JSONIFY_MIMETYPE"] = "application/json; charset=utf-8"
    # You should configure your database URI here or load it from a config file.
    # Example: app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
    # app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Recommended to disable this for performance
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize the SQLAlchemy instance with the Flask app
    # This is the crucial step to connect Flask-SQLAlchemy to your app
    db.init_app(app)

    # --- Register Blueprints ---
    app.register_blueprint(holdings_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(net_values_bp)

    # --- Add a root route for basic testing/info ---
    @app.route('/')
    def index():
        """
        A simple root route to confirm the backend is running.
        """
        return jsonify({
            "message": "Welcome to the Fund Management API!",
            "available_endpoints": {
                "holdings": "/api/holdings",
                "net_values": "/api/net_values",
                "transactions": "/api/transactions"
            }
        })

    # --- Example of a simple health check endpoint ---
    @app.route('/health')
    def health_check():
        """
        A health check endpoint to verify the application's status.
        """
        return jsonify({"status": "healthy", "message": "API is running."}), 200

    return app
