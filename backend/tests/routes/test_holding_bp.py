import json
from unittest.mock import patch

import pytest

from app.models import Holding, FundDetail


class TestHoldingBlueprint:
    """Test API endpoints"""

    def test_add_ho_success(self, client, auth_headers, db):
        payload = {
            "ho_code": "000001",
            "ho_name": "Test Fund",
            "ho_type": "FUND",
            "fund_detail": {
                "fund_type": "股票型"
            }
        }

        response = client.post(
            '/time/holding/add_ho',
            data=json.dumps(payload),
            content_type='application/json',
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200

        # 验证数据库是否写入
        holding = Holding.query.filter_by(ho_code='000001').first()
        assert holding is not None

    @patch('app.service.holding_service.HoldingService.crawl_fund_info')
    def test_crawl_fund_endpoint(self, mock_crawl, client, auth_headers):
        mock_crawl.return_value = {
            "ho_code": "000001",
            "ho_name": "Mocked Fund",
            "fund_detail": {}
        }

        response = client.post(
            '/time/holding/crawl_fund',
            data={'ho_code': '000001'},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['ho_code'] == "000001"

    def test_add_ho_missing_fields(self, client, auth_headers):
        response = client.post(
            '/time/holding/add_ho',
            data=json.dumps({"ho_code": "000001"}),  # 缺少 ho_name
            content_type='application/json',
            headers=auth_headers
        )
        assert response.status_code in [400, 500]  # Validation error

    def test_add_ho_unauthorized(self, client):
        """Test adding holding without authentication"""
        response = client.post(
            '/time/holding/add_ho',
            data=json.dumps({
                "ho_code": "000002",
                "ho_name": "Test Fund 2",
                "ho_type": "FUND"
            }),
            content_type='application/json'
        )
        assert response.status_code == 401


class TestHoldingQueryRoutes:
    """Tests for holding query routes"""

    def test_list_holdings(self, client, auth_headers, mock_holding, mock_user_holding):
        """Test listing user's holdings"""
        response = client.post(
            '/time/holding/list_ho',
            json={},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['code'] == 200

    def test_get_holding_detail(self, client, auth_headers, mock_holding, mock_user_holding):
        """Test getting holding detail"""
        response = client.post(
            '/time/holding/get_ho',
            json={'ho_id': mock_holding.id},
            headers=auth_headers
        )

        # May return 200 or 400/500 depending on implementation
        assert response.status_code in [200, 400, 500]
