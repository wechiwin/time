import logging
import time
from decimal import Decimal
from typing import Optional, Any

import akshare as ak
import requests
from sqlalchemy.exc import SQLAlchemyError

from app.constant.biz_enums import (
    HoldingTypeEnum,
    HoldingStatusEnum,
    FundTradeMarketEnum,
    ErrorMessageEnum
)
from app.framework.exceptions import BizException
from app.models import db, Holding, FundDetail
from app.utils.date_util import str_to_date

logger = logging.getLogger(__name__)


class HoldingService:
    @staticmethod
    def _safe_decimal(value: Any) -> Optional[Decimal]:
        """辅助方法：安全转换为Decimal，处理 '--', '', None 等情况"""
        if value is None:
            return None
        if isinstance(value, (int, float, Decimal)):
            return Decimal(str(value))
        if isinstance(value, str):
            clean_val = value.replace('%', '').replace(',', '').strip()
            if not clean_val or clean_val == '--':
                return None
            try:
                return Decimal(clean_val)
            except Exception:
                return None
        return None

    @staticmethod
    def crawl_fund_info(ho_code: str) -> dict:
        """爬取基金信息"""
        url_api = "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation"
        params = {
            "FCODE": ho_code,
            "deviceid": "pc",
            "plat": "web",
            "product": "EFund",
            "version": "2.0.0"
        }
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Referer": f"http://fund.eastmoney.com/{ho_code}.html"
        }

        try:
            resp = requests.get(url_api, params=params, headers=headers, timeout=10)
            data = resp.json().get("Datas", {})
            if not data:
                raise BizException(msg="未爬取到相关信息")

            result = {
                "ho_code": data.get("FCODE"),
                "ho_name": data.get("FULLNAME"),
                "ho_short_name": data.get("SHORTNAME"),
                "fund_manager": data.get("JJJL"),
                "company_id": data.get("JJGSID"),
                "company_name": data.get("JJGS"),
                "establishment_date": data.get("ESTABDATE"),
                "risk_level": data.get("RISKLEVEL"),
                "index_code": data.get("INDEXCODE"),
                "index_name": data.get("INDEXNAME"),
                "manage_exp_rate": data.get("MGREXP", "").replace('%', ''),
                "trustee_exp_rate": data.get("TRUSTEXP", "").replace('%', ''),
                "sales_exp_rate": data.get("SALESEXP", "").replace('%', ''),
                "feature": data.get("FEATURE", ""),
                "fund_type": data.get("FTYPE", ""),
            }

            result['trade_market'] = HoldingService._determine_trade_market(result)
            return HoldingService._normalize_fund_data(result)

        except requests.exceptions.RequestException as e:
            logger.error(f"爬取基金信息失败: {str(e)}")
            raise BizException(msg="爬取基金信息失败，请检查网络或稍后重试")

    @staticmethod
    def crawl_stock_info(ho_code: str) -> dict:
        """爬取股票信息"""
        try:
            # 使用akshare获取股票基本信息
            stock_info = ak.stock_individual_info_em(symbol=ho_code)
            if stock_info.empty:
                raise BizException(msg="未找到该股票信息")

            # 转换为字典格式
            info_dict = {row['item']: row['value'] for _, row in stock_info.iterrows()}

            return {
                "ho_code": ho_code,
                "ho_name": info_dict.get('股票简称', ''),
                "ho_short_name": info_dict.get('股票简称', ''),
                "ho_type": HoldingTypeEnum.STOCK.value,
                "establishment_date": info_dict.get('成立日期', ''),
                "trade_market": HoldingService._determine_stock_market(ho_code),
                # 其他股票特有字段...
            }

        except Exception as e:
            logger.error(f"爬取股票信息失败: {str(e)}")
            raise BizException(msg="爬取股票信息失败，请检查股票代码或稍后重试")

    @staticmethod
    def _determine_trade_market(fund_data: dict) -> str:
        """判断基金交易市场"""
        short_name = fund_data.get('ho_short_name', '')
        full_name = fund_data.get('ho_name', '')
        features = fund_data.get('feature', '').split(',')
        sales_exp = fund_data.get('sales_exp_rate', '')

        if 'LOF' in short_name or 'LOF' in full_name or '上市开放式' in full_name:
            return FundTradeMarketEnum.BOTH.value
        if '联接' in short_name or '联接' in full_name:
            return FundTradeMarketEnum.OFF_EXCHANGE.value
        if sales_exp and sales_exp != '--':
            return FundTradeMarketEnum.OFF_EXCHANGE.value
        if 'ETF' in short_name or 'ETF' in full_name:
            return FundTradeMarketEnum.EXCHANGE.value
        if '010' in features:
            return FundTradeMarketEnum.EXCHANGE.value

        return FundTradeMarketEnum.OFF_EXCHANGE.value

    @staticmethod
    def _determine_stock_market(ho_code: str) -> str:
        """判断股票交易市场"""
        # 根据股票代码前缀判断
        if ho_code.startswith(('6', '9')):
            return 'SH'  # 上海
        elif ho_code.startswith(('0', '3')):
            return 'SZ'  # 深圳
        elif ho_code.startswith('4'):
            return 'BJ'  # 北京
        return ''

    @staticmethod
    def _normalize_fund_data(api_data: dict) -> dict:
        """
        标准化基金数据结构
        重点：进行类型转换，防止插入数据库时报错
        """
        return {
            'ho_code': api_data.get('ho_code'),
            'ho_name': api_data.get('ho_name'),
            'ho_short_name': api_data.get('ho_short_name'),
            'establishment_date': api_data.get('establishment_date'),  # 保持字符串，create时转date
            'fund_detail': {
                'fund_type': api_data.get('fund_type'),
                # 风险等级处理：如果是数字字符串转int，如果是中文需映射(此处简化处理)
                'risk_level': int(api_data['risk_level']) if str(api_data.get('risk_level', '0')).isdigit() else 0,
                'trade_market': api_data.get('trade_market'),
                'manage_exp_rate': HoldingService._safe_decimal(api_data.get('manage_exp_rate')),
                'trustee_exp_rate': HoldingService._safe_decimal(api_data.get('trustee_exp_rate')),
                'sales_exp_rate': HoldingService._safe_decimal(api_data.get('sales_exp_rate')),
                'company_id': api_data.get('company_id'),
                'company_name': api_data.get('company_name'),
                'fund_manager': api_data.get('fund_manager'),
                'index_code': api_data.get('index_code'),
                'index_name': api_data.get('index_name'),
                'feature': api_data.get('feature'),
            }
        }

    @staticmethod
    def create_holding(data: dict) -> Holding:
        """
        创建持仓及其基金详情
        使用 SQLAlchemy 的 relationship 自动处理外键关联
        """
        if not data.get('ho_code'):
            raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.value)

        # 检查是否已存在
        if Holding.query.filter_by(ho_code=data['ho_code']).first():
            raise BizException(msg="该代码已存在")

        try:
            # 分离 fund_detail 数据
            fund_detail_data = data.pop('fund_detail', None)

            # 3. 创建 Holding 主对象
            new_holding = Holding(**data)
            new_holding.ho_status = HoldingStatusEnum.NOT_HELD.value
            new_holding.ho_type = HoldingTypeEnum.FUND.value
            # 日期转换处理
            if isinstance(new_holding.establishment_date, str) and new_holding.establishment_date:
                new_holding.establishment_date = str_to_date(new_holding.establishment_date)
            else:
                new_holding.establishment_date = None
            # 4. 处理关联的 FundDetail
            if fund_detail_data and new_holding.ho_type == HoldingTypeEnum.FUND.value:
                # 利用 relationship 直接赋值，SQLAlchemy 会自动处理 ho_id 的回填
                # 这样不需要先 flush 获取 id 再手动赋值
                fund_detail = FundDetail(**fund_detail_data)
                new_holding.fund_detail = fund_detail
            # 5. 添加到会话
            db.session.add(new_holding)
            db.session.commit()
            return new_holding

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"创建持仓数据库错误: {str(e)}")
            raise BizException(msg=f"创建持仓 {data.get('ho_code')} 失败: 数据库错误")
        except Exception as e:
            db.session.rollback()
            logger.error(f"创建持仓未知错误: {str(e)}")
            raise BizException(msg=f"创建持仓 {data.get('ho_code')} 失败: {str(e)}")

    @staticmethod
    def import_holdings(ho_codes: list) -> dict:
        """
        批量导入持仓
        返回详细的导入结果统计
        """
        results = {
            "total": len(ho_codes),
            "success": 0,
            "skipped": 0,
            "failed": 0,
            "errors": []
        }
        for code in ho_codes:
            code = str(code).strip()
            if not code:
                continue
            # 1. 检查是否存在 (避免不必要的爬虫请求)
            if Holding.query.filter_by(ho_code=code).first():
                results["skipped"] += 1
                continue
            try:
                # 2. 爬取数据
                # 简单判断：如果是6位数字且以0/1/5/6开头通常是基金，
                # 但股票也是6位。这里假设目前只处理基金。
                # 实际项目中建议根据用户选择或正则更精确判断。
                data = HoldingService.crawl_fund_info(code)
                # 3. 写入数据库
                HoldingService.create_holding(data)
                results["success"] += 1

                # 礼貌性延时，防止被封IP
                time.sleep(0.3)
            except BizException as be:
                logger.warning(f"导入 {code} 业务异常: {be.msg}")
                results["failed"] += 1
                results["errors"].append(f"{code}: {be.msg}")
            except Exception as e:
                logger.error(f"导入 {code} 未知异常: {str(e)}")
                results["failed"] += 1
                results["errors"].append(f"{code}: 系统错误")
        return results
