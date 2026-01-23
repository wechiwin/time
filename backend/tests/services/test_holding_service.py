# backend/tests/test_holding_service.py
# backend/test_import_holdings.py
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import patch, MagicMock
from app.service.holding_service import HoldingService


def setup_mocks():
    """设置常用的 mock 对象"""
    # 清理之前的 patch
    patch.stopall()

    # 创建 mocks
    mock_query = patch('app.service.holding_service.Holding.query').start()
    mock_crawl_fund = patch.object(HoldingService, 'crawl_fund_info').start()
    mock_create_holding = patch.object(HoldingService, 'create_holding').start()

    return mock_query, mock_crawl_fund, mock_create_holding


def test_normal_import():
    """测试正常导入场景"""
    print("🧪 测试正常导入...")

    mock_query, mock_crawl_fund, mock_create_holding = setup_mocks()

    # 设置 mock 行为
    mock_query.filter_by.return_value.first.return_value = None  # 都不存在
    mock_crawl_fund.side_effect = [
        {'ho_code': '001', 'ho_name': 'Fund A', 'ho_type': 'fund'},
        {'ho_code': '002', 'ho_name': 'Fund B', 'ho_type': 'fund'}
    ]
    mock_create_holding.return_value = MagicMock()

    # 执行测试
    result = HoldingService.import_holdings(['001', '002'])

    # 验证结果
    assert result == 2, f"期望导入2个，实际导入{result}个"
    assert mock_crawl_fund.call_count == 2
    assert mock_create_holding.call_count == 2

    print("✅ 正常导入测试通过")


def test_skip_existing():
    """测试跳过已存在的持仓"""
    print("🧪 测试跳过已存在...")

    mock_query, mock_crawl_fund, mock_create_holding = setup_mocks()

    # 第一个已存在，第二个不存在
    existing_holding = MagicMock()
    mock_query.filter_by.return_value.first.side_effect = [existing_holding, None]

    mock_crawl_fund.return_value = {'ho_code': '002', 'ho_name': 'Fund B', 'ho_type': 'fund'}
    mock_create_holding.return_value = MagicMock()

    result = HoldingService.import_holdings(['001', '002'])

    assert result == 1, f"期望导入1个，实际导入{result}个"
    mock_crawl_fund.assert_called_once_with('002')
    mock_create_holding.assert_called_once()

    print("✅ 跳过已存在测试通过")


def test_handle_crawl_failure():
    """测试处理爬取失败"""
    print("🧪 测试处理爬取失败...")

    mock_query, mock_crawl_fund, mock_create_holding = setup_mocks()

    # 设置第一个失败，第二个成功
    def crawl_side_effect(code):
        if code == '001':
            raise Exception("网络错误")
        return {'ho_code': code, 'ho_name': f'Fund {code}', 'ho_type': 'fund'}

    mock_query.filter_by.return_value.first.return_value = None
    mock_crawl_fund.side_effect = crawl_side_effect
    mock_create_holding.return_value = MagicMock()

    result = HoldingService.import_holdings(['001', '002'])

    assert result == 1, f"期望导入1个，实际导入{result}个"
    assert mock_crawl_fund.call_count == 2  # 两个都尝试了
    mock_create_holding.assert_called_once()  # 只成功创建了一个

    print("✅ 处理爬取失败测试通过")


def test_all_failures():
    """测试全部失败的情况"""
    print("🧪 测试全部失败...")

    mock_query, mock_crawl_fund, mock_create_holding = setup_mocks()

    mock_query.filter_by.return_value.first.return_value = None
    mock_crawl_fund.side_effect = Exception("全部失败")
    mock_create_holding.return_value = MagicMock()

    result = HoldingService.import_holdings(['001', '002'])

    assert result == 0, f"期望导入0个，实际导入{result}个"
    assert mock_crawl_fund.call_count == 2
    mock_create_holding.assert_not_called()

    print("✅ 全部失败测试通过")


def test_empty_input():
    """测试空输入"""
    print("🧪 测试空输入...")

    result = HoldingService.import_holdings([])

    assert result == 0, f"期望导入0个，实际导入{result}个"

    print("✅ 空输入测试通过")


def test_mixed_scenarios():
    """测试混合场景"""
    print("🧪 测试混合场景...")

    mock_query, mock_crawl_fund, mock_create_holding = setup_mocks()

    # 场景：已存在 + 成功 + 失败
    existing_holding = MagicMock()
    mock_query.filter_by.return_value.first.side_effect = [
        existing_holding,  # 001 已存在
        None,  # 002 不存在
        None  # 003 不存在
    ]

    def crawl_side_effect(code):
        if code == '003':
            raise Exception("爬取失败")
        return {'ho_code': code, 'ho_name': f'Fund {code}', 'ho_type': 'fund'}

    mock_crawl_fund.side_effect = crawl_side_effect
    mock_create_holding.return_value = MagicMock()

    result = HoldingService.import_holdings(['001', '002', '003'])

    assert result == 1, f"期望导入1个，实际导入{result}个"
    assert mock_crawl_fund.call_count == 2  # 002 和 003 被尝试
    mock_create_holding.assert_called_once()  # 只有 002 成功

    print("✅ 混合场景测试通过")


def run_all_tests():
    """运行所有测试"""
    print("🚀 开始测试 HoldingService.import_holdings 方法")
    print("=" * 50)

    try:
        test_empty_input()
        test_normal_import()
        test_skip_existing()
        test_handle_crawl_failure()
        test_all_failures()
        test_mixed_scenarios()

        print("=" * 50)
        print("🎉 所有测试通过！import_holdings 方法工作正常！")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        raise
    finally:
        # 清理 patches
        patch.stopall()


def test_import():
    result = HoldingService.import_holdings(['160218'])
    print(result)


if __name__ == '__main__':
    test_import()
