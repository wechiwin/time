import os

import pytest
from flask import Flask

from app import create_app
from app.extension import db as _db
from app.models import UserSetting

# 强制使用测试环境
os.environ['FLASK_ENV'] = 'testing'


@pytest.fixture(scope='session')
def app() -> Flask:
    """Create application for the tests."""
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # 内存数据库
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['SERVER_NAME'] = 'localhost'  # 必需，否则 url_for 失败

    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope='function')
def db(app):
    """Create a fresh database for each test."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def mock_user(db):
    """创建一个测试用户"""
    user = UserSetting(
        username='testuser',
        pwd_hash=UserSetting.hash_password('password123'),
        email_address='test@example.com'
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def auth_headers(mock_user, client):
    """获取认证头（用于需要登录的 API）"""
    login_resp = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'password123'
    })
    token = login_resp.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}
