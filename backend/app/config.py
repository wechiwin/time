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
    JWT_COOKIE_CSRF_PROTECT = True
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
        'X-CSRF-Token',
        'x-csrf-token',
        'X-Request-ID',
        'Content-Type',
        'Authorization',
        'Accept-Language'
    ]
    CORS_SUPPORTS_CREDENTIALS = True
    CORS_ALLOW_HEADERS = ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Accept-Language', 'X-Request-ID',
                          'Set-Cookie']
    CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']

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


class TestingConfig(Config):
    JWT_AUTH_REQUIRED = os.getenv('JWT_AUTH_REQUIRED', 'True').lower() == 'true'
    # JWT_COOKIE_SECURE = True
    # """测试环境配置"""
    # TESTING = True
    # SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL',
    #                                     'sqlite:///test.db')
    # WTF_CSRF_ENABLED = False  # 测试时禁用 CSRF
    pass


class ProductionConfig(Config):
    JWT_AUTH_REQUIRED = True
    JWT_COOKIE_SECURE = True
    # """生产环境配置"""
    # SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    pass
