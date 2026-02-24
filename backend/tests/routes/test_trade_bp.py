"""
Tests for Trade Blueprint Routes
"""
import io
import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest

from app.constant.biz_enums import TradeTypeEnum
from app.models import Trade, Holding
from tests.conftest import create_trade


class TestTradePageRoute:
    """Tests for /trade/tr_page endpoint"""

    def test_tr_page_success(self, client, auth_headers, mock_trade):
        """Test successful trade page query"""
        response = client.post(
            '/time/trade/tr_page',
            json={'page': 1, 'per_page': 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200
        assert 'items' in data['data']

    def test_tr_page_with_ho_code_filter(self, client, auth_headers, mock_trade):
        """Test trade page with ho_code filter"""
        response = client.post(
            '/time/trade/tr_page',
            json={'ho_code': '000001', 'page': 1, 'per_page': 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200

    def test_tr_page_with_date_filter(self, client, auth_headers, mock_trade):
        """Test trade page with date filters"""
        response = client.post(
            '/time/trade/tr_page',
            json={
                'start_date': '2024-01-01',
                'end_date': '2024-12-31',
                'page': 1,
                'per_page': 10
            },
            headers=auth_headers
        )

        assert response.status_code == 200

    def test_tr_page_unauthorized(self, client):
        """Test trade page without authentication"""
        response = client.post(
            '/time/trade/tr_page',
            json={'page': 1, 'per_page': 10}
        )

        assert response.status_code == 401

    def test_tr_page_empty_result(self, client, auth_headers):
        """Test trade page with no trades"""
        response = client.post(
            '/time/trade/tr_page',
            json={'page': 1, 'per_page': 10},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['items'] == []


class TestAddTradeRoute:
    """Tests for /trade/add_tr endpoint"""

    @patch('app.service.trade_service.trade_calendar.is_trade_day')
    def test_add_tr_success(self, mock_is_trade_day, client, auth_headers, mock_user_holding):
        """Test successful trade addition"""
        mock_is_trade_day.return_value = True

        response = client.post(
            '/time/trade/add_tr',
            json={
                'ho_id': mock_user_holding.ho_id,
                'ho_code': '000001',
                'tr_type': 'BUY',
                'tr_date': '2024-01-15',
                'tr_nav_per_unit': 1.5,
                'tr_shares': 1000,
                'tr_amount': 1500,
                'tr_fee': 1.5,
                'cash_amount': 1501.5
            },
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200

        # Verify trade was created
        trade = Trade.query.filter_by(ho_code='000001').first()
        assert trade is not None

    def test_add_tr_missing_fields(self, client, auth_headers):
        """Test trade addition with missing fields"""
        response = client.post(
            '/time/trade/add_tr',
            json={
                'ho_code': '000001',
                'tr_type': 'BUY'
                # Missing required fields
            },
            headers=auth_headers
        )

        assert response.status_code in [400, 500]  # Validation error

    def test_add_tr_unauthorized(self, client):
        """Test trade addition without authentication"""
        response = client.post(
            '/time/trade/add_tr',
            json={
                'ho_code': '000001',
                'tr_type': 'BUY',
                'tr_date': '2024-01-15',
                'tr_nav_per_unit': 1.5,
                'tr_shares': 1000,
                'tr_amount': 1500,
                'tr_fee': 1.5,
                'cash_amount': 1501.5
            }
        )

        assert response.status_code == 401


class TestGetTradeRoute:
    """Tests for /trade/get_tr endpoint"""

    def test_get_tr_success(self, client, auth_headers, mock_trade):
        """Test successful trade retrieval"""
        response = client.post(
            '/time/trade/get_tr',
            json={'id': mock_trade.id},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200
        # The schema returns 'id' not 'tr_id'
        assert data['data']['id'] == mock_trade.id

    def test_get_tr_not_found(self, client, auth_headers):
        """Test trade retrieval with non-existent ID"""
        response = client.post(
            '/time/trade/get_tr',
            json={'id': 99999},
            headers=auth_headers
        )

        assert response.status_code in [400, 500]  # Not found error


class TestUpdateTradeRoute:
    """Tests for /trade/update_tr endpoint"""

    def test_update_tr_success(self, client, auth_headers, mock_trade, db):
        """Test successful trade update"""
        response = client.post(
            '/time/trade/update_tr',
            json={
                'id': mock_trade.id,
                'tr_shares': 2000,
                'tr_amount': 3000,
                'cash_amount': 3001.5
            },
            headers=auth_headers
        )

        assert response.status_code == 200

        # Verify update
        db.session.refresh(mock_trade)
        assert mock_trade.tr_shares == Decimal('2000')

    def test_update_tr_not_found(self, client, auth_headers):
        """Test trade update with non-existent ID"""
        response = client.post(
            '/time/trade/update_tr',
            json={'id': 99999, 'tr_shares': 100},
            headers=auth_headers
        )

        assert response.status_code in [400, 500]  # Not found error


class TestDeleteTradeRoute:
    """Tests for /trade/del_tr endpoint"""

    def test_del_tr_success(self, client, auth_headers, mock_trade):
        """Test successful trade deletion"""
        trade_id = mock_trade.id

        response = client.post(
            '/time/trade/del_tr',
            json={'id': trade_id},
            headers=auth_headers
        )

        assert response.status_code == 200

        # Verify deletion
        deleted = Trade.query.get(trade_id)
        assert deleted is None

    def test_del_tr_not_found(self, client, auth_headers):
        """Test trade deletion with non-existent ID"""
        response = client.post(
            '/time/trade/del_tr',
            json={'id': 99999},
            headers=auth_headers
        )

        assert response.status_code in [400, 500]  # Not found error


class TestListByHoIdRoute:
    """Tests for /trade/list_by_ho_id endpoint"""

    def test_list_by_ho_id_success(self, client, auth_headers, mock_trade, mock_user_holding):
        """Test successful trade list by holding ID"""
        response = client.post(
            '/time/trade/list_by_ho_id',
            json={'ho_id': mock_user_holding.ho_id},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200
        assert len(data['data']) >= 1

    def test_list_by_ho_id_empty(self, client, auth_headers, mock_holding, db):
        """Test trade list with holding that has no trades"""
        # Create a holding without trades
        new_holding = Holding(
            ho_code='000002',
            ho_name='Another Fund',
            ho_short_name='Another',
            ho_type='FUND'
        )
        db.session.add(new_holding)
        db.session.commit()

        response = client.post(
            '/time/trade/list_by_ho_id',
            json={'ho_id': new_holding.id},
            headers=auth_headers
        )

        # Should fail because user doesn't own this holding
        assert response.status_code in [400, 500]  # Not found error

    def test_list_by_ho_id_missing_ho_id(self, client, auth_headers):
        """Test trade list without ho_id"""
        response = client.post(
            '/time/trade/list_by_ho_id',
            json={},
            headers=auth_headers
        )

        assert response.status_code == 200
        # Returns empty string when no ho_id


class TestUploadRoute:
    """Tests for /trade/upload endpoint"""

    @patch('app.service.trade_service.TradeService.process_trade_image_online')
    def test_upload_success(self, mock_process, client, auth_headers):
        """Test successful file upload"""
        mock_process.return_value = {
            'ocr_text': 'Sample OCR text',
            'parsed_json': {'ho_code': '000001', 'tr_amount': 1500}
        }

        # Create a fake image file
        file_content = b'fake image content'
        file = io.BytesIO(file_content)

        response = client.post(
            '/time/trade/upload',
            data={'file': (file, 'test_image.jpg')},
            headers=auth_headers,
            content_type='multipart/form-data'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200
        assert 'parsed_json' in data['data']

    def test_upload_no_file(self, client, auth_headers):
        """Test upload without file"""
        response = client.post(
            '/time/trade/upload',
            data={},
            headers=auth_headers,
            content_type='multipart/form-data'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert 'error' in data


class TestTradeTypeMapping:
    """Tests for trade type mapping functions"""

    def test_map_trade_type_chinese(self):
        """Test Chinese trade type mapping"""
        from app.routes.trade_bp import map_trade_type

        assert map_trade_type('买入') == 'BUY'
        assert map_trade_type('卖出') == 'SELL'

    def test_map_trade_type_english(self):
        """Test English trade type mapping"""
        from app.routes.trade_bp import map_trade_type

        assert map_trade_type('Buy') == 'BUY'
        assert map_trade_type('Sell') == 'SELL'

    def test_map_trade_type_invalid(self):
        """Test invalid trade type"""
        from app.routes.trade_bp import map_trade_type
        from app.framework.exceptions import BizException

        with pytest.raises(BizException):
            map_trade_type('Invalid')

    def test_reverse_map_trade_type(self):
        """Test reverse trade type mapping"""
        from app.routes.trade_bp import reverse_map_trade_type

        # The function uses gettext, so we test structure
        result = reverse_map_trade_type('BUY')
        assert result is not None

        result = reverse_map_trade_type('SELL')
        assert result is not None
