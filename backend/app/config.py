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
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'False').lower() == 'true'
    MAIL_USE_SSL = os.getenv('MAIL_USE_SSL', 'True').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER')
    # 调试配置
    MAIL_DEBUG = True  # 开启调试
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
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_ACCESS_COOKIE_NAME = "access_token"
    JWT_REFRESH_COOKIE_NAME = "refresh_token"
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_DOMAIN = None


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


class TestingConfig(Config):
    pass
    # """测试环境配置"""
    # TESTING = True
    # SQLALCHEMY_DATABASE_URI = os.getenv('TEST_DATABASE_URL',
    #                                     'sqlite:///test.db')
    # WTF_CSRF_ENABLED = False  # 测试时禁用 CSRF


class ProductionConfig(Config):
    pass
    # """生产环境配置"""
    # SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    #
    # @classmethod
    # def init_app(cls, app):
    #     Config.init_app(app)
    #     # 生产环境特定初始化
    #     import logging
    #     from logging.handlers import SMTPHandler
    #     # 配置邮件日志处理器等...

# 配置映射
# config = {
#     'development': DevelopmentConfig,
#     'testing': TestingConfig,
#     'production': ProductionConfig,
#     'default': DevelopmentConfig
# }
