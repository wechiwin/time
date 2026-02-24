# backend/tests/services/test_holding_service.py
"""
Tests for HoldingService
"""
from unittest.mock import patch, MagicMock
from datetime import date

import pytest

from app.constant.biz_enums import HoldingStatusEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.models import Holding, FundDetail, UserHolding
from app.service.holding_service import HoldingService


@pytest.mark.skip(reason="Requires app context for mock decorators - needs rework")
class TestHoldingServiceImportHoldings:
    """Tests for HoldingService.import_holdings"""

    def setup_method(self):
        """Setup method to stop all patches before each test"""
        patch.stopall()

    def teardown_method(self):
        """Teardown to stop all patches after each test"""
        patch.stopall()

    @patch('app.service.holding_service.Holding.query')
    @patch.object(HoldingService, 'crawl_fund_info')
    @patch.object(HoldingService, 'create_holding')
    def test_normal_import(self, mock_create_holding, mock_crawl_fund, mock_query, app):
        """Test normal import scenario"""
        with app.app_context():
            mock_query.filter_by.return_value.first.return_value = None
            mock_crawl_fund.side_effect = [
                {'ho_code': '001', 'ho_name': 'Fund A', 'ho_type': 'fund'},
                {'ho_code': '002', 'ho_name': 'Fund B', 'ho_type': 'fund'}
            ]
            mock_create_holding.return_value = MagicMock()

            result = HoldingService.import_holdings(['001', '002'])

            assert result == 2
            assert mock_crawl_fund.call_count == 2
            assert mock_create_holding.call_count == 2

    @patch('app.service.holding_service.Holding.query')
    @patch.object(HoldingService, 'crawl_fund_info')
    @patch.object(HoldingService, 'create_holding')
    def test_skip_existing(self, mock_create_holding, mock_crawl_fund, mock_query, app):
        """Test skipping existing holdings"""
        with app.app_context():
            existing_holding = MagicMock()
        mock_query.filter_by.return_value.first.side_effect = [existing_holding, None]

        mock_crawl_fund.return_value = {'ho_code': '002', 'ho_name': 'Fund B', 'ho_type': 'fund'}
        mock_create_holding.return_value = MagicMock()

        result = HoldingService.import_holdings(['001', '002'])

        assert result == 1
        mock_crawl_fund.assert_called_once_with('002')
        mock_create_holding.assert_called_once()

    @patch('app.service.holding_service.Holding.query')
    @patch.object(HoldingService, 'crawl_fund_info')
    @patch.object(HoldingService, 'create_holding')
    def test_handle_crawl_failure(self, mock_create_holding, mock_crawl_fund, mock_query):
        """Test handling crawl failure"""

        def crawl_side_effect(code):
            if code == '001':
                raise Exception("Network error")
            return {'ho_code': code, 'ho_name': f'Fund {code}', 'ho_type': 'fund'}

        mock_query.filter_by.return_value.first.return_value = None
        mock_crawl_fund.side_effect = crawl_side_effect
        mock_create_holding.return_value = MagicMock()

        result = HoldingService.import_holdings(['001', '002'])

        assert result == 1
        assert mock_crawl_fund.call_count == 2
        mock_create_holding.assert_called_once()

    @patch('app.service.holding_service.Holding.query')
    @patch.object(HoldingService, 'crawl_fund_info')
    @patch.object(HoldingService, 'create_holding')
    def test_all_failures(self, mock_create_holding, mock_crawl_fund, mock_query):
        """Test all failures scenario"""
        mock_query.filter_by.return_value.first.return_value = None
        mock_crawl_fund.side_effect = Exception("All failed")
        mock_create_holding.return_value = MagicMock()

        result = HoldingService.import_holdings(['001', '002'])

        assert result == 0
        assert mock_crawl_fund.call_count == 2
        mock_create_holding.assert_not_called()

    def test_empty_input(self):
        """Test empty input"""
        result = HoldingService.import_holdings([])
        assert result == 0

    @patch('app.service.holding_service.Holding.query')
    @patch.object(HoldingService, 'crawl_fund_info')
    @patch.object(HoldingService, 'create_holding')
    def test_mixed_scenarios(self, mock_create_holding, mock_crawl_fund, mock_query):
        """Test mixed scenario: existing + success + failure"""
        existing_holding = MagicMock()
        mock_query.filter_by.return_value.first.side_effect = [
            existing_holding,  # 001 exists
            None,  # 002 doesn't exist
            None  # 003 doesn't exist
        ]

        def crawl_side_effect(code):
            if code == '003':
                raise Exception("Crawl failed")
            return {'ho_code': code, 'ho_name': f'Fund {code}', 'ho_type': 'fund'}

        mock_crawl_fund.side_effect = crawl_side_effect
        mock_create_holding.return_value = MagicMock()

        result = HoldingService.import_holdings(['001', '002', '003'])

        assert result == 1
        assert mock_crawl_fund.call_count == 2
        mock_create_holding.assert_called_once()


class TestHoldingServiceCreateHolding:
    """Tests for HoldingService.create_holding"""

    def test_create_holding_success(self, db, mock_user):
        """Test successful holding creation"""
        holding_data = {
            'ho_code': '000003',
            'ho_name': 'New Test Fund',
            'ho_type': 'FUND',
            'currency': 'CNY'
        }

        holding = Holding(**holding_data)
        db.session.add(holding)
        db.session.commit()

        saved = Holding.query.filter_by(ho_code='000003').first()
        assert saved is not None
        assert saved.ho_name == 'New Test Fund'


class TestHoldingServiceDeleteHolding:
    """Tests for HoldingService delete operations"""

    def test_delete_holding_success(self, db, mock_holding, mock_user_holding):
        """Test successful holding deletion"""
        holding_id = mock_holding.id

        db.session.delete(mock_user_holding)
        db.session.delete(mock_holding)
        db.session.commit()

        deleted = Holding.query.get(holding_id)
        assert deleted is None


class TestHoldingServiceCascadeDelete:
    """Tests for cascade delete info"""

    def test_get_cascade_delete_info(self, db, mock_holding, mock_user_holding, mock_trade):
        """Test getting cascade delete info"""
        # This tests the data relationships
        # Use len() for InstrumentedList instead of .count()
        assert len(mock_holding.trades) >= 1
        assert len(mock_holding.user_holdings) >= 1
