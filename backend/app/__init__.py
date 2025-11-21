from app.database import db
from app.framework.log_config import setup_logging
from app.framework.error_handler import register_error_handler
from app.framework.interceptor import register_response_interceptor
from flask import Flask, jsonify, request
from flask_apscheduler import APScheduler
from flask.json.provider import DefaultJSONProvider
from app.framework.interceptor import register_request_response_logger


from .routes.holding_bp import holding_bp
from .routes.nav_history_bp import nav_history_bp
from .routes.trade_bp import trade_bp
from .scheduler import init_scheduler

scheduler = APScheduler()

class NoAsciiJSONProvider(DefaultJSONProvider):
    ensure_ascii = False

def create_app():
    app = Flask(__name__)

    # 禁用 ASCII 转义
    app.json = NoAsciiJSONProvider(app)
    # app.config["JSON_AS_ASCII"] = False

    # 默认 UTF-8 # --- Configuration ---
    app.config["JSONIFY_MIMETYPE"] = "application/json; charset=utf-8"
    # You should configure your database URI here or load it from a config file.
    # Example: app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
    # app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Recommended to disable this for performance
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ECHO'] = True

    # 初始化日志
    setup_logging(app)
    # log_response(app)
    register_request_response_logger(app)

    # Initialize the SQLAlchemy instance with the Flask app
    # This is the crucial step to connect Flask-SQLAlchemy to your app
    db.init_app(app)

    # --- Register Blueprints ---
    app.register_blueprint(holding_bp)
    app.register_blueprint(trade_bp)
    app.register_blueprint(nav_history_bp)

    # 初始化调度器
    init_scheduler(app, scheduler)

    # 统一响应/异常
    register_error_handler(app)
    register_response_interceptor(app)

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

    # 请求日志
    @app.before_request
    def log_request():
        app.logger.info(f"[Request] {request.method} {request.path} {request.args}")

    # 异常日志
    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.exception("An error occurred:")
        return {"error": "Internal Server Error"}, 500

    return app
