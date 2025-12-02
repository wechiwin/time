import pathlib
import subprocess

from app.database import db
from app.framework.error_handler import register_error_handler
from app.framework.interceptor import register_request_response_logger, register_response_interceptor
from app.framework.log_config import setup_logging, get_early_logger
from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_apscheduler import APScheduler
from flask_babel import Babel

from .routes.holding_bp import holding_bp
from .routes.nav_history_bp import nav_history_bp
from .routes.trade_bp import trade_bp
from .scheduler import init_scheduler

scheduler = APScheduler()
babel = Babel()
log = get_early_logger(__name__)


def get_locale():
    lang = request.args.get("lang")
    if lang in ['zh', 'it', 'en']:
        return lang
    return request.accept_languages.best_match(['zh', 'it', 'en'])


class NoAsciiJSONProvider(DefaultJSONProvider):
    ensure_ascii = False


def compile_all_po():
    log.info('检查翻译文件是否需要编译 …')
    translations_dir = pathlib.Path('translations')
    # 如果目录里任意 .po 比对应 .mo 新，就整目录重新编译
    need = False
    for po in translations_dir.rglob('*.po'):
        mo = po.with_suffix('.mo')
        if not mo.exists() or po.stat().st_mtime > mo.stat().st_mtime:
            need = True
            break
    if need:
        log.info('检测到翻译更新，自动编译 .mo 文件')
        subprocess.run(['pybabel', 'compile', '--use-fuzzy', '-d', str(translations_dir)],
                       check=True)
    else:
        log.info('翻译文件已是最新，跳过编译')


def create_app():
    log.info('创建 Flask 应用')
    compile_all_po()
    app = Flask(__name__)

    app.config.from_mapping(
        # SECRET_KEY='dev',
        BABEL_DEFAULT_LOCALE='zh',
        # BABEL_DEFAULT_TIMEZONE='UTC',
        # BABEL_TRANSLATION_DIRECTORIES=os.path.join(os.path.dirname(__file__), 'i18n/translations')
        BABEL_TRANSLATION_DIRECTORIES='../translations'
    )
    babel.init_app(app, locale_selector=get_locale)

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
    scheduler.init_app(app)
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
