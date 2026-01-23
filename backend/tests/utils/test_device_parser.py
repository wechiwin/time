from app.utils.device_parser import DeviceParser
from app.models import DeviceType

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
