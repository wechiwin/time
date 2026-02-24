import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
project_root = Path(basedir).parent


def _load_env_and_get_config():
    """
    加载环境变量并返回对应的环境名称

    加载顺序：
    1. 先加载 .flaskenv 获取 FLASK_ENV
    2. 根据 FLASK_ENV 加载对应的 .env 文件
    """
    # Step 1: 先加载 .flaskenv 获取 FLASK_ENV
    flaskenv_file = project_root / '.flaskenv'
    if flaskenv_file.exists():
        load_dotenv(flaskenv_file, override=False)

    # Step 2: 获取环境名称（默认为 development）
    env = os.getenv('FLASK_ENV', 'development').lower()

    # Step 3: 根据 FLASK_ENV 加载对应的 .env 文件
    env_file_map = {
        'testing': '.env.test',
        'production': '.env.prod',
        'development': '.env'
    }
    env_file_name = env_file_map.get(env, '.env')
    env_file = project_root / env_file_name

    # 加载环境变量（override=True 确保 .env 覆盖 .flaskenv 中的同名变量）
    if env_file.exists():
        load_dotenv(env_file, override=True)

    return env


_current_env = _load_env_and_get_config()


class Config:
    """基础配置"""
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI')
    SQLALCHEMY_TRACK_MODIFICATIONS = False  # 禁用事件系统提升性能
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 240,
        "pool_pre_ping": True,
        "pool_timeout": 30,
        "echo": False,
    }
    # 邮件配置
    MAIL_SERVER = os.getenv('MAIL_SERVER')
    MAIL_PORT = os.getenv('MAIL_PORT')
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS')
    MAIL_USE_SSL = os.getenv('MAIL_USE_SSL')
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER')
    # 调试配置
    MAIL_SUPPRESS_SEND = False  # 确保不抑制发送
    # i18n 不配置不生效
    BABEL_DEFAULT_LOCALE = 'en',
    BABEL_TRANSLATION_DIRECTORIES = '../translations'
    # jwt
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')  # 生产环境中从环境变量获取
    # SALT = os.getenv('SALT')
    ITERATIONS = os.getenv('ITERATIONS')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    # JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ACCESS_COOKIE_NAME = "access_token"
    JWT_REFRESH_COOKIE_NAME = "refresh_token"
    MAX_CONCURRENT_DEVICES = 3
    # -------------------------------------------------------
    # 前端使用 Authorization Header 发送 Access Token，
    # Header 方式天然免疫 CSRF，不需要开启此选项。
    # 开启会导致后端忽略 Header 而去校验 Cookie 的 CSRF，从而导致 401。
    # -------------------------------------------------------
    JWT_COOKIE_CSRF_PROTECT = False

    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_DOMAIN = None
    JWT_REFRESH_COOKIE_PATH = '/time'
    JWT_ACCESS_COOKIE_PATH = '/time'

    # CORS配置
    origins_str = os.getenv('CORS_ORIGINS', '')
    CORS_ORIGINS = [origin.strip() for origin in origins_str.split(',')]
    CORS_EXPOSE_HEADERS = [
        'X-Request-ID',
        'Content-Type',
        'Authorization',
        'Accept-Language'
    ]
    CORS_SUPPORTS_CREDENTIALS = True
    CORS_ALLOW_HEADERS = ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept-Language', 'X-Request-ID',
                          'Set-Cookie', 'X-Requested-With']
    CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

    SCHEDULER_TIMEZONE = "Asia/Shanghai"

    LOG_DIR = os.path.join(basedir, '..', 'logs')
    LOG_FILE = 'app.log'
    LOG_MAX_SIZE_IN_MB = int(os.getenv('LOG_MAX_SIZE_IN_MB', 10))

    API_KEY = os.getenv('API_KEY')
    BASE_URL = os.getenv('BASE_URL')
    MODEL_NAME = os.getenv('MODEL_NAME')

    REDIS_SSL = os.environ.get('REDIS_SSL', 'False').lower() == 'true'
    REDIS_URL = os.environ.get('REDIS_URL')
    REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
    CACHE_TYPE = 'SimpleCache'  # 使用内存缓存
    CACHE_DEFAULT_TIMEOUT = 300  # 缓存默认超时时间（秒


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    ENV = 'development'  # 明确设置环境名称
    SQLALCHEMY_ECHO = True  # 开发时显示SQL日志
    JWT_AUTH_REQUIRED = True
    JWT_COOKIE_SECURE = False
    MAIL_DEBUG = True  # 开启调试
    SCHEDULER_ENABLED = True
    LOG_LEVEL = 'DEBUG'
    LOG_BACKUP_COUNT = 7


class TestingConfig(Config):
    # """测试环境配置"""
    TESTING = True
    ENV = 'testing'
    JWT_COOKIE_SECURE = False
    JWT_AUTH_REQUIRED = True
    SCHEDULER_ENABLED = False  # 测试时通常禁用定时任务
    LOG_LEVEL = 'DEBUG'


class ProductionConfig(Config):
    # """生产环境配置"""
    DEBUG = False
    ENV = 'production'

    JWT_AUTH_REQUIRED = True
    JWT_COOKIE_SECURE = True
    SQLALCHEMY_ECHO = False

    SCHEDULER_ENABLED = True
    SCHEDULER_API_ENABLED = False
    LOG_LEVEL = 'INFO'  # 生产环境推荐 INFO
    LOG_BACKUP_COUNT = 30  # 保留30天日志


# 根据 FLASK_ENV 选择配置类
def get_config():
    """根据 FLASK_ENV 返回对应的配置类"""
    if _current_env == 'development':
        return DevelopmentConfig
    elif _current_env == 'testing':
        return TestingConfig
    else:
        return ProductionConfig


# 方便在其他地方直接导入正确的配置对象
config = get_config()
