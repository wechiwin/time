# app/factory.py
import pathlib
import subprocess

from flask import Flask, request
from loguru import logger

from app.cache import cache
from app.config import get_config
from app.extension import db, migrate, scheduler, babel, cors, jwt, mail, limiter, openai_client
from app.framework.error_handler import register_error_handler
from app.framework.interceptor import register_interceptors
from app.framework.jwt_config import configure_jwt
from app.framework.log_config import setup_logging
from app.routes import register_routes
from app.scheduler import init_scheduler
from app.cli import init_app as init_cli


def _get_locale():
    """Babel locale_selector"""
    try:
        if not request:
            return 'en'
        lang = request.args.get('lang')
        if lang in {'zh', 'it', 'en'}:
            return lang
        return request.accept_languages.best_match({'zh', 'it', 'en'}) or 'en'
    except RuntimeError:
        return 'en'


def _compile_all_po(app: Flask):
    """按需编译 .po -> .mo"""
    logger.info('checking if po files need to translate ...')
    translations_dir = pathlib.Path(app.root_path).parent / 'translations'
    need = any(po.with_suffix('.mo').exists() is False or
               po.stat().st_mtime > po.with_suffix('.mo').stat().st_mtime
               for po in translations_dir.rglob('*.po'))
    if need:
        logger.info('po files changed，translating mo files ...')
        subprocess.run(['pybabel', 'compile', '--use-fuzzy', '-d', str(translations_dir)],
                       check=True)
    else:
        logger.info('mo files already up-to-date, skipping translation ...')


def build_app() -> Flask:
    """真正的应用工厂 (已修正初始化顺序)"""
    # -----------------------------------------------------------------
    # 步骤 1: 创建 Flask 实例
    # -----------------------------------------------------------------
    app = Flask(__name__)
    # -----------------------------------------------------------------
    # 步骤 2: 加载配置
    # 这是最关键的一步，必须在所有其他操作之前完成。
    # 只有这样，app.debug, app.config['...'] 等才会生效。
    # -----------------------------------------------------------------
    app.config.from_object(get_config())
    # Configure JSON to not escape non-ASCII characters (e.g., Chinese)
    app.json.ensure_ascii = False
    # -----------------------------------------------------------------
    # 步骤 3: 基于已加载的配置，初始化日志系统
    # -----------------------------------------------------------------
    setup_logging(app)
    # --- 从现在开始，日志系统已完全配置好，可以安全使用 ---
    logger.info("Flask application created, configuration loaded, logging setup complete.")
    logger.info(f"Running in '{app.config.get('ENV')}' mode, DEBUG is {app.debug}.")
    # -----------------------------------------------------------------
    # 步骤 4: 初始化所有扩展 (DB, JWT, CORS, etc.)
    # -----------------------------------------------------------------
    _compile_all_po(app)  # 传递 app 实例
    babel.init_app(app, locale_selector=_get_locale)
    cors.init_app(app, resources={
        r"/time/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": app.config.get('CORS_METHODS', ["GET", "POST", "PUT", "DELETE", "OPTIONS"]),
            "supports_credentials": app.config['CORS_SUPPORTS_CREDENTIALS'],
            "expose_headers": app.config['CORS_EXPOSE_HEADERS'],
            "allow_headers": app.config.get('CORS_ALLOW_HEADERS', ["Content-Type", "Authorization"]),
            "max_age": 3600
        }
    })
    jwt.init_app(app)
    configure_jwt(jwt)
    mail.init_app(app)
    if not app.debug:
        limiter.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)
    cache.init_app(app)
    # 检查是否是迁移模式，如果是则跳过 scheduler 初始化
    import os
    if not os.environ.get('MIGRATION_MODE'):
        scheduler.init_app(app)
    init_scheduler(app, scheduler)
    openai_client.init_app(app)
    # -----------------------------------------------------------------
    # 步骤 5: 注册蓝图、拦截器、错误处理等
    # -----------------------------------------------------------------
    register_interceptors(app)
    register_routes(app)
    register_error_handler(app)
    init_cli(app)  # Register CLI commands (flask seed)
    # -----------------------------------------------------------------
    # 步骤 6: 返回最终配置好的 app 实例
    # -----------------------------------------------------------------
    logger.success("Application build complete. Ready to run.")
    return app
