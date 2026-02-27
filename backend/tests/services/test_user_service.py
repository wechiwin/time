"""
Tests for UserService
"""
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

from app.constant.sys_enums import GlobalYesOrNo, LoginStatus
from app.framework.exceptions import BizException
from app.models import UserSetting, UserSession, TokenBlacklist, LoginHistory
from app.service.user_service import UserService


class TestUserServiceExecuteLogin:
    """Tests for UserService.execute_login"""

    def test_login_success(self, db, mock_user):
        """Test successful login"""
        result = UserService.execute_login(
            username='testuser',
            password='password123',
            ip='127.0.0.1',
            user_agent='TestAgent/1.0'
        )

        assert 'refresh_token' in result
        assert 'data' in result
        assert 'access_token' in result['data']
        assert 'user' in result['data']
        assert result['data']['user']['username'] == 'testuser'

    def test_login_empty_credentials(self, db):
        """Test login with empty credentials"""
        with pytest.raises(BizException) as exc_info:
            UserService.execute_login(
                username='',
                password='password123',
                ip='127.0.0.1',
                user_agent='TestAgent/1.0'
            )
        assert exc_info.value.code == 400

        with pytest.raises(BizException) as exc_info:
            UserService.execute_login(
                username='testuser',
                password='',
                ip='127.0.0.1',
                user_agent='TestAgent/1.0'
            )
        assert exc_info.value.code == 400

    def test_login_invalid_username(self, db):
        """Test login with invalid username"""
        with pytest.raises(BizException) as exc_info:
            UserService.execute_login(
                username='nonexistent',
                password='password123',
                ip='127.0.0.1',
                user_agent='TestAgent/1.0'
            )
        assert exc_info.value.code == 401

    def test_login_invalid_password(self, db, mock_user):
        """Test login with invalid password"""
        with pytest.raises(BizException) as exc_info:
            UserService.execute_login(
                username='testuser',
                password='wrongpassword',
                ip='127.0.0.1',
                user_agent='TestAgent/1.0'
            )
        assert exc_info.value.code == 401

    def test_login_locked_account(self, db):
        """Test login with locked account"""
        # Create locked user
        locked_user = UserSetting(
            username='lockeduser',
            pwd_hash=UserSetting.hash_password('password123'),
            email_address='locked@example.com',
            is_locked=GlobalYesOrNo.YES
        )
        db.session.add(locked_user)
        db.session.commit()

        with pytest.raises(BizException) as exc_info:
            UserService.execute_login(
                username='lockeduser',
                password='password123',
                ip='127.0.0.1',
                user_agent='TestAgent/1.0'
            )
        assert exc_info.value.code == 403

    def test_login_creates_session(self, db, mock_user):
        """Test that login creates a new session"""
        UserService.execute_login(
            username='testuser',
            password='password123',
            ip='127.0.0.1',
            user_agent='TestAgent/1.0'
        )

        # Verify session was created
        session = UserSession.query.filter_by(user_id=mock_user.id, is_active=GlobalYesOrNo.YES).first()
        assert session is not None
        assert session.login_ip == '127.0.0.1'
        assert session.user_agent == 'TestAgent/1.0'

    def test_login_updates_last_login_time(self, db, mock_user):
        """Test that login updates last_login_at"""
        original_login_time = mock_user.last_login_at

        UserService.execute_login(
            username='testuser',
            password='password123',
            ip='127.0.0.1',
            user_agent='TestAgent/1.0'
        )

        db.session.refresh(mock_user)
        assert mock_user.last_login_at is not None
        if original_login_time:
            assert mock_user.last_login_at > original_login_time


class TestUserServiceSessionManagement:
    """Tests for UserService session management"""

    def test_max_concurrent_devices_limit(self, db):
        """Test that old sessions are kicked when max devices reached"""
        # Create user
        user = UserSetting(
            username='sessionuser',
            pwd_hash=UserSetting.hash_password('password123'),
            email_address='session@example.com',
            is_locked=GlobalYesOrNo.NO
        )
        db.session.add(user)
        db.session.commit()

        # Create max sessions
        max_devices = UserService.MAX_CONCURRENT_DEVICES
        for i in range(max_devices):
            session = UserSession(
                user_id=user.id,
                session_id=f'session_{i}',
                device_fingerprint=f'fp_{i}',
                login_ip='127.0.0.1',
                user_agent=f'Agent_{i}',
                is_active=GlobalYesOrNo.YES,
                created_at=datetime.utcnow()
            )
            db.session.add(session)
        db.session.commit()

        # Login again - should kick oldest session
        UserService.execute_login(
            username='sessionuser',
            password='password123',
            ip='127.0.0.1',
            user_agent='NewAgent'
        )

        # Verify oldest session was deactivated
        oldest = UserSession.query.filter_by(session_id='session_0').first()
        assert oldest.is_active == GlobalYesOrNo.NO

        # Verify new session was created
        active_sessions = UserSession.query.filter_by(
            user_id=user.id, is_active=GlobalYesOrNo.YES
        ).all()
        assert len(active_sessions) == max_devices


class TestUserServiceRecordLoginHistory:
    """Tests for UserService.record_login_history"""

    def test_record_successful_login(self, db, mock_user):
        """Test recording successful login history"""
        history = UserService.record_login_history(
            user_id=mock_user.id,
            login_ip='192.168.1.1',
            user_agent='Mozilla/5.0',
            device_type='Desktop',
            session_id='test_session_123'
        )

        assert history.id is not None
        assert history.login_status == LoginStatus.SUCCESS
        assert history.failure_reason is None
        assert history.login_ip == '192.168.1.1'
        assert history.session_id == 'test_session_123'

    def test_record_failed_login(self, db, mock_user):
        """Test recording failed login history"""
        history = UserService.record_login_history(
            user_id=mock_user.id,
            login_ip='10.0.0.1',
            user_agent='Bot/1.0',
            device_type='Unknown',
            failure_reason='Invalid credentials'
        )

        assert history.id is not None
        assert history.login_status == LoginStatus.FAILED
        assert history.failure_reason == 'Invalid credentials'

    def test_record_login_with_none_user_id(self, db):
        """Test recording login with None user_id (non-existent username)"""
        history = UserService.record_login_history(
            user_id=None,
            login_ip='192.168.1.1',
            user_agent='TestAgent',
            device_type='Desktop',
            failure_reason='Invalid username'
        )

        assert history.id is not None
        assert history.user_id is None
        assert history.login_status == LoginStatus.FAILED

    def test_risk_score_calculation(self, db, mock_user):
        """Test that risk score is calculated"""
        history = UserService.record_login_history(
            user_id=mock_user.id,
            login_ip='192.168.1.1',  # Internal IP
            user_agent='TestAgent',
            device_type='Desktop'
        )

        # Risk score should be calculated
        assert history.risk_score is not None
        assert isinstance(history.risk_score, int)
        assert 0 <= history.risk_score <= 100


class TestUserSettingPasswordMethods:
    """Tests for UserSetting password methods"""

    def test_hash_password(self):
        """Test password hashing"""
        hashed = UserSetting.hash_password('mypassword')
        assert hashed is not None
        assert hashed != 'mypassword'
        assert hashed.startswith('$pbkdf2-sha256$')

    def test_verify_password_success(self):
        """Test password verification success"""
        hashed = UserSetting.hash_password('mypassword')
        assert UserSetting.verify_password('mypassword', hashed) is True

    def test_verify_password_failure(self):
        """Test password verification failure"""
        hashed = UserSetting.hash_password('mypassword')
        assert UserSetting.verify_password('wrongpassword', hashed) is False

    def test_verify_password_empty_hash(self):
        """Test password verification with empty hash"""
        assert UserSetting.verify_password('password', '') is False
        assert UserSetting.verify_password('password', None) is False

    def test_verify_password_invalid_hash_format(self):
        """Test password verification with invalid hash format"""
        assert UserSetting.verify_password('password', 'invalid_hash') is False

    def test_hash_different_passwords_differently(self):
        """Test that different passwords produce different hashes"""
        hash1 = UserSetting.hash_password('password1')
        hash2 = UserSetting.hash_password('password2')
        assert hash1 != hash2

    def test_hash_same_password_differently(self):
        """Test that same password produces different hashes (salt)"""
        hash1 = UserSetting.hash_password('password')
        hash2 = UserSetting.hash_password('password')
        # Different due to random salt
        assert hash1 != hash2
        # But both should verify
        assert UserSetting.verify_password('password', hash1)
        assert UserSetting.verify_password('password', hash2)
