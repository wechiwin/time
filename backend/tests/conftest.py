import os
from datetime import datetime, date, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from dotenv import load_dotenv

# 强制使用测试环境 - 必须在导入 app 相关模块之前设置
os.environ['FLASK_ENV'] = 'testing'

# 加载测试环境配置文件（使用绝对路径，override=True 确保覆盖默认值）
env_test_path = Path(__file__).parent.parent / '.env.test'
load_dotenv(env_test_path, override=True)

# 现在才导入 app 相关模块，此时 FLASK_ENV 和 .env.test 已加载完成
from flask import Flask
from loguru import logger

from app.constant.biz_enums import HoldingStatusEnum, TradeTypeEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.extension import db as _db
from app.models import (
    UserSetting, Holding, UserHolding, FundDetail, Trade,
    HoldingSnapshot, InvestedAssetSnapshot, InvestedAssetAnalyticsSnapshot,
    AlertRule, AlertHistory, FundNavHistory
)

logger.info(f"Loaded test environment from: {env_test_path}")


@pytest.fixture(scope='session')
def app() -> Flask:
    """Create application for the tests using test database."""
    # Patch setup_logging to use simple console logging for tests
    with patch('app.factory.setup_logging'):
        from app import create_app
        app = create_app()

    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['SERVER_NAME'] = 'localhost'
    app.config['RATELIMIT_ENABLED'] = False
    app.config['LOG_LEVEL'] = 'DEBUG'

    # 数据库 URI 已从 .env.test 加载
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI')
    logger.info(f"Test database URI: {db_uri}")

    # 安全检查：确保使用的是测试数据库
    if not db_uri or 'test' not in db_uri.lower():
        raise RuntimeError(
            f"SAFETY CHECK FAILED: Tests must run on a test database! "
            f"Current URI: {db_uri}. "
            f"Please ensure .env.test is configured with a test database."
        )

    with app.app_context():
        # 创建所有表
        _db.create_all()
        yield app
        # 清理：仅关闭 session，不删除表和数据
        _db.session.remove()


@pytest.fixture(scope='function')
def db(app):
    """Create a fresh database for each test."""
    with app.app_context():
        # 每个测试前清空数据（不重建表，提高速度）
        # 按依赖顺序删除
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()
        yield _db
        # 测试后回滚未提交的事务
        _db.session.rollback()


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
        email_address='test@example.com',
        is_locked=GlobalYesOrNo.NO,
        risk_free_rate=Decimal('0.02000')
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def auth_headers(mock_user, client):
    """获取认证头（用于需要登录的 API）"""
    login_resp = client.post('/time/user_setting/login', json={
        'username': 'testuser',
        'password': 'password123'
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.get_json()}"
    token = login_resp.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def mock_holding(db):
    """创建一个测试持仓（基金）"""
    holding = Holding(
        ho_code='000001',
        ho_name='Test Fund Name',
        ho_short_name='Test Fund',
        ho_type='FUND',
        currency='CNY'
    )
    db.session.add(holding)
    db.session.flush()

    fund_detail = FundDetail(
        ho_id=holding.id,
        fund_type='股票型',
        risk_level=3,
        trade_market='场外'
    )
    db.session.add(fund_detail)
    db.session.commit()
    return holding


@pytest.fixture
def mock_user_holding(db, mock_user, mock_holding):
    """创建用户-持仓关联"""
    user_holding = UserHolding(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        ho_status=HoldingStatusEnum.HOLDING.value,
        ho_nickname='My Test Fund'
    )
    db.session.add(user_holding)
    db.session.commit()
    return user_holding


@pytest.fixture
def mock_trade(db, mock_user, mock_holding):
    """创建一个测试交易记录"""
    trade = Trade(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        ho_code=mock_holding.ho_code,
        tr_type=TradeTypeEnum.BUY.value,
        tr_date=date(2024, 1, 15),
        tr_nav_per_unit=Decimal('1.5000'),
        tr_shares=Decimal('1000.00'),
        tr_amount=Decimal('1500.00'),
        tr_fee=Decimal('1.50'),
        cash_amount=Decimal('1501.50'),
        tr_cycle=1,
        is_cleared=GlobalYesOrNo.NO
    )
    db.session.add(trade)
    db.session.commit()
    return trade


@pytest.fixture
def mock_trades_buy_sell(db, mock_user, mock_holding):
    """创建买入+卖出交易记录组"""
    trades = []
    # 买入
    buy_trade = Trade(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        ho_code=mock_holding.ho_code,
        tr_type=TradeTypeEnum.BUY.value,
        tr_date=date(2024, 1, 15),
        tr_nav_per_unit=Decimal('1.5000'),
        tr_shares=Decimal('1000.00'),
        tr_amount=Decimal('1500.00'),
        tr_fee=Decimal('1.50'),
        cash_amount=Decimal('1501.50'),
        tr_cycle=1,
        is_cleared=GlobalYesOrNo.NO
    )
    trades.append(buy_trade)
    db.session.add(buy_trade)

    # 卖出
    sell_trade = Trade(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        ho_code=mock_holding.ho_code,
        tr_type=TradeTypeEnum.SELL.value,
        tr_date=date(2024, 2, 15),
        tr_nav_per_unit=Decimal('1.8000'),
        tr_shares=Decimal('1000.00'),
        tr_amount=Decimal('1800.00'),
        tr_fee=Decimal('1.80'),
        cash_amount=Decimal('1798.20'),
        tr_cycle=1,
        is_cleared=GlobalYesOrNo.YES
    )
    trades.append(sell_trade)
    db.session.add(sell_trade)
    db.session.commit()
    return trades


@pytest.fixture
def mock_nav_history(db, mock_holding):
    """创建净值历史记录"""
    nav_records = []
    base_date = date(2024, 1, 1)
    for i in range(10):
        nav = FundNavHistory(
            ho_id=mock_holding.id,
            ho_code=mock_holding.ho_code,
            nav_date=base_date + timedelta(days=i),
            nav_per_unit=Decimal('1.5000') + Decimal(str(i * 0.01)),
            nav_accumulated_per_unit=Decimal('1.5000') + Decimal(str(i * 0.01)),
            nav_return=Decimal('0.01')
        )
        nav_records.append(nav)
        db.session.add(nav)
    db.session.commit()
    return nav_records


@pytest.fixture
def mock_holding_snapshot(db, mock_user, mock_holding):
    """创建持仓快照"""
    snapshot = HoldingSnapshot(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        snapshot_date=date(2024, 1, 15),
        holding_shares=Decimal('1000.00'),
        hos_holding_cost=Decimal('1501.50'),
        avg_cost=Decimal('1.5015'),
        market_price=Decimal('1.5000'),
        hos_market_value=Decimal('1500.00'),
        hos_total_buy_amount=Decimal('1501.50'),
        hos_total_sell_amount=Decimal('0'),
        hos_total_cash_dividend=Decimal('0'),
        hos_total_reinvest_dividend=Decimal('0'),
        hos_unrealized_pnl=Decimal('-1.50'),
        hos_total_pnl=Decimal('-1.50'),
        tr_cycle=1,
        is_cleared=GlobalYesOrNo.NO
    )
    db.session.add(snapshot)
    db.session.commit()
    return snapshot


@pytest.fixture
def mock_invested_asset_snapshot(db, mock_user):
    """创建投资资产快照"""
    snapshot = InvestedAssetSnapshot(
        user_id=mock_user.id,
        snapshot_date=date(2024, 1, 15),
        ias_market_value=Decimal('10000.00'),
        ias_holding_cost=Decimal('9500.00'),
        ias_unrealized_pnl=Decimal('500.00'),
        ias_total_pnl=Decimal('500.00'),
        ias_total_pnl_ratio=Decimal('0.0526'),
        ias_total_realized_pnl=Decimal('0'),
        ias_total_cash_dividend=Decimal('0'),
        ias_total_dividend=Decimal('0'),
        ias_total_buy_amount=Decimal('9500.00'),
        ias_total_sell_amount=Decimal('0')
    )
    db.session.add(snapshot)
    db.session.commit()
    return snapshot


@pytest.fixture
def mock_alert_rule(db, mock_user, mock_holding):
    """创建预警规则"""
    rule = AlertRule(
        user_id=mock_user.id,
        ho_id=mock_holding.id,
        ho_code=mock_holding.ho_code,
        ar_name='Test Alert',
        action='BUY',
        target_price=Decimal('1.4000'),
        ar_is_active=GlobalYesOrNo.YES
    )
    db.session.add(rule)
    db.session.commit()
    return rule


@pytest.fixture
def mock_alert_history(db, mock_user, mock_holding, mock_alert_rule):
    """创建预警历史"""
    history = AlertHistory(
        user_id=mock_user.id,
        ar_id=mock_alert_rule.id,
        ho_id=mock_holding.id,
        ho_code=mock_holding.ho_code,
        ar_name=mock_alert_rule.ar_name,
        action='BUY',
        trigger_price=Decimal('1.4000'),
        trigger_nav_date=date(2024, 1, 10),
        target_price=Decimal('1.4000'),
        send_status='sent',
        sent_time=datetime(2024, 1, 10, 10, 0, 0)
    )
    db.session.add(history)
    db.session.commit()
    return history


# ========== Helper functions ==========

def create_trade(user_id, ho_id, ho_code, tr_type, tr_date, shares, nav, fee=Decimal('0')):
    """Helper to create a Trade object"""
    amount = shares * nav
    if tr_type == TradeTypeEnum.BUY.value:
        cash_amount = amount + fee
    else:
        cash_amount = amount - fee

    return Trade(
        user_id=user_id,
        ho_id=ho_id,
        ho_code=ho_code,
        tr_type=tr_type,
        tr_date=tr_date,
        tr_nav_per_unit=nav,
        tr_shares=shares,
        tr_amount=amount,
        tr_fee=fee,
        cash_amount=cash_amount,
        tr_cycle=1,
        is_cleared=GlobalYesOrNo.NO
    )
