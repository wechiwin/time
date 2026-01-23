import json
from unittest.mock import patch

class TestHoldingBlueprint:
    """Test API endpoints"""

    def test_add_ho_success(self, client, auth_headers, db):
        payload = {
            "ho_code": "000001",
            "ho_name": "Test Fund",
            "fund_detail": {
                "fund_type": "股票型"
            }
        }

        response = client.post(
            '/api/holding/add_ho',
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
        assert holding.fund_detail.fund_type == "股票型"

    @patch('app.service.holding_service.HoldingService.crawl_fund_info')
    def test_crawl_fund_endpoint(self, mock_crawl, client, auth_headers):
        mock_crawl.return_value = {
            "ho_code": "000001",
            "ho_name": "Mocked Fund",
            "fund_detail": {}
        }

        response = client.post(
            '/api/holding/crawl_fund',
            data={'ho_code': '000001'},
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['data']['ho_code'] == "000001"

    def test_add_ho_missing_fields(self, client, auth_headers):
        response = client.post(
            '/api/holding/add_ho',
            data=json.dumps({"ho_code": "000001"}),  # 缺少 ho_name
            content_type='application/json',
            headers=auth_headers
        )
        assert response.status_code == 400  # BizException 应返回 400
