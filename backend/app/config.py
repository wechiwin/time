import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv('.flaskenv')
load_dotenv('.env')


class Config:
    ENV = os.getenv('FLASK_ENV', 'development').lower()

    """基础配置"""
    # SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')

    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False  # 禁用事件系统提升性能
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
    # i18n
    BABEL_DEFAULT_LOCALE = 'zh',
    BABEL_TRANSLATION_DIRECTORIES = '../translations'
    # jwt
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    SALT = os.getenv('SALT')
    ITERATIONS = os.getenv('ITERATIONS')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_ACCESS_COOKIE_NAME = "access_token"
    JWT_REFRESH_COOKIE_NAME = "refresh_token"

    # -------------------------------------------------------
    # 前端使用 Authorization Header 发送 Access Token，
    # Header 方式天然免疫 CSRF，不需要开启此选项。
    # 开启会导致后端忽略 Header 而去校验 Cookie 的 CSRF，从而导致 401。
    # -------------------------------------------------------
    JWT_COOKIE_CSRF_PROTECT = False

    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_DOMAIN = None
    JWT_REFRESH_COOKIE_PATH = '/api'
    JWT_ACCESS_COOKIE_PATH = '/api'

    # CORS配置
    CORS_ORIGINS = [
        'http://192.168.3.33:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ]
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

    LOG_DIR = 'logs'
    LOG_FILE = 'app.log'
    LOG_MAX_BYTES = 8 * 1024 * 1024

    # 自动识别当前环境配置
    @classmethod
    def get_config(cls):
        env = cls.ENV
        if env == 'production':
            return ProductionConfig
        elif env == 'testing':
            return TestingConfig
        else:
            return DevelopmentConfig


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = True  # 开发时显示SQL日志
    JWT_AUTH_REQUIRED = True
    JWT_COOKIE_SECURE = False
    MAIL_DEBUG = True  # 开启调试
    SCHEDULER_ENABLED = True
    LOG_LEVEL = 'DEBUG'
    LOG_BACKUP_COUNT = 7


class TestingConfig(Config):
    JWT_AUTH_REQUIRED = os.getenv('JWT_AUTH_REQUIRED', 'True').lower() == 'true'
    SCHEDULER_ENABLED = True
    # JWT_COOKIE_SECURE = True
    # """测试环境配置"""
    # TESTING = True
    # SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL',
    #                                     'sqlite:///test.db')
    # WTF_CSRF_ENABLED = False  # 测试时禁用 CSRF
    LOG_LEVEL = 'INFO'  # 生产环境推荐 INFO
    pass


class ProductionConfig(Config):
    JWT_AUTH_REQUIRED = True
    JWT_COOKIE_SECURE = True

    SCHEDULER_ENABLED = True
    SCHEDULER_API_ENABLED = False
    # """生产环境配置"""
    # SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    LOG_LEVEL = 'INFO'  # 生产环境推荐 INFO
    LOG_BACKUP_COUNT = 30  # 保留30天日志
    pass
