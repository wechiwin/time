from app.utils.device_parser import DeviceParser
from app.constant.sys_enums import DeviceType


class TestDeviceParser:
    """Test device parsing logic"""

    def test_mobile_user_agent(self):
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
        assert DeviceParser.parse(ua) == DeviceType.MOBILE

    def test_tablet_user_agent(self):
        ua = "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)"
        assert DeviceParser.parse(ua) == DeviceType.TABLET

    def test_desktop_user_agent(self):
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        assert DeviceParser.parse(ua) == DeviceType.DESKTOP

    def test_bot_user_agent(self):
        ua = "python-requests/2.31.0"
        assert DeviceParser.parse(ua) == DeviceType.BOT

    def test_unknown_user_agent(self):
        assert DeviceParser.parse("") == DeviceType.UNKNOWN
        assert DeviceParser.parse(None) == DeviceType.UNKNOWN

    def test_android_user_agent(self):
        """Test Android mobile detection"""
        ua = "Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36"
        assert DeviceParser.parse(ua) == DeviceType.MOBILE

    def test_curl_user_agent(self):
        """Test curl detection"""
        ua = "curl/7.68.0"
        assert DeviceParser.parse(ua) == DeviceType.BOT

    def test_mac_safari_user_agent(self):
        """Test Mac Safari detection"""
        ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
        assert DeviceParser.parse(ua) == DeviceType.DESKTOP

    def test_kindle_user_agent(self):
        """Test Kindle tablet detection"""
        ua = "Mozilla/5.0 (Kindle Fire; Android 4.4.4) AppleWebKit/537.36"
        assert DeviceParser.parse(ua) == DeviceType.TABLET
