# app/__init__.py
import pathlib
import subprocess

from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from flask_apscheduler import APScheduler
from flask_babel import Babel
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail

from app.database import db
from app.framework.error_handler import register_error_handler
from app.framework.interceptor import register_request_response_logger
from app.framework.log_config import setup_logging, get_early_logger
from app.routes.user_bp import user_bp
from .config import Config
from .framework.cache_manager import CacheManager
from .framework.jwt_config import configure_jwt
from .scheduler import init_scheduler
from .routes import register_routes

scheduler = APScheduler()
babel = Babel()
log = get_early_logger(__name__)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri='memory://'  # 明确指定后警告会消失
)
# 初始化邮件扩展
mail = Mail()
cache_manager = CacheManager()


def get_locale():
    """获取i18n语言"""
    try:
        # 检查是否有请求上下文
        if not request:
            return 'zh'  # 默认返回中文

        lang = request.args.get("lang")
        if lang in ['zh', 'it', 'en']:
            return lang

        # 处理 accept_languages 可能返回 None 的情况
        best_match = request.accept_languages.best_match(['zh', 'it', 'en'])
        return best_match if best_match else 'zh'
    except RuntimeError:
        # 无请求上下文时返回默认语言
        return 'zh'


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
    app = Flask(__name__)
    # 加载config
    app.config.from_object(Config.get_config())

    # 初始化CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": app.config.get('CORS_METHODS', ["GET", "POST", "PUT", "DELETE", "OPTIONS"]),
            "supports_credentials": app.config['CORS_SUPPORTS_CREDENTIALS'],
            "expose_headers": app.config['CORS_EXPOSE_HEADERS'],
            "allow_headers": app.config.get('CORS_ALLOW_HEADERS', ["Content-Type", "Authorization"]),
            "max_age": 3600  # 预检请求缓存1小时
        }
    })

    # 检查环境一致性
    if app.config['ENV'] == 'production' and app.debug:
        raise RuntimeError("生产环境不能开启调试模式！")
    # 编译国际化文件
    compile_all_po()
    babel.init_app(app, locale_selector=get_locale)

    jwt = JWTManager(app)
    configure_jwt(jwt)

    mail.init_app(app)
    if not app.debug:
        limiter.init_app(app)

    # 禁用 ASCII 转义
    app.json = NoAsciiJSONProvider(app)
    # app.config["JSON_AS_ASCII"] = False
    # 默认 UTF-8
    app.config["JSONIFY_MIMETYPE"] = "application/json; charset=utf-8"
    app.config['PREFERRED_URL_SCHEME'] = 'https'

    # 初始化日志
    setup_logging(app)
    # log_response(app)
    register_request_response_logger(app)

    # Initialize the SQLAlchemy instance with the Flask app
    # This is the crucial step to connect Flask-SQLAlchemy to your app
    db.init_app(app)

    # 初始化缓存
    cache_manager.init_app(app)

    # Register Blueprints
    register_routes(app)

    # 初始化调度器
    scheduler.init_app(app)
    init_scheduler(app, scheduler)

    # 统一异常处理
    register_error_handler(app)

    # --- Add a root route for basic testing/info ---
    # --- Example of a simple health check endpoint ---
    @app.route('/health')
    def health_check():
        """
        A health check endpoint to verify the application's status.
        """
        return jsonify({"status": "healthy", "message": "API is running."}), 200

    return app
