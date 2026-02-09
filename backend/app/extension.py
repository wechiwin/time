# app/extension.py
from flask import Flask
from flask_apscheduler import APScheduler
from flask_babel import Babel
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from openai import OpenAI

# 扩展实例化（未绑定 app）
db = SQLAlchemy()
migrate = Migrate()
scheduler = APScheduler()
babel = Babel()
cors = CORS()
jwt = JWTManager()
mail = Mail()
limiter = Limiter(key_func=get_remote_address,
                  default_limits=["200 per day", "50 per hour"],
                  storage_uri='memory://')


class FlaskOpenAI:
    def __init__(self, app: Flask = None):
        self.client: OpenAI | None = None  # 使用类型提示，更清晰
        # 正确的写法是 'is not None'
        if app is not None:
            self.init_app(app)

    def init_app(self, app: Flask):
        # 从 app.config 读取配置来初始化真正的 OpenAI 客户端
        api_key = app.config.get('API_KEY')  # 建议在 config.py 中使用更明确的键名
        base_url = app.config.get('BASE_URL')
        if not api_key or not base_url:
            # 如果没有配置，可以选择抛出异常或保持 client 为 None
            raise RuntimeError("OpenAI API key and base URL must be configured.")
            # return  # 或者静默失败
        self.client = OpenAI(api_key=api_key, base_url=base_url)

        # 将实例存储在 app.extensions 中，这是 Flask 的标准做法
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['openai_client'] = self


# 2. 像其他扩展一样，实例化这个包装类
openai_client = FlaskOpenAI()
