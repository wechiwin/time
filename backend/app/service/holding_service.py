import time
from decimal import Decimal
from typing import Optional, Any

import requests
from loguru import logger
from sqlalchemy.exc import SQLAlchemyError

from app.constant.biz_enums import (
    HoldingTypeEnum,
    HoldingStatusEnum,
    FundTradeMarketEnum,
    ErrorMessageEnum
)
from app.framework.exceptions import BizException
from app.models import db, Holding, FundDetail, UserHolding
from app.utils.date_util import str_to_date


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
                raise BizException(ErrorMessageEnum.CRAWL_NO_INFO.view)

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
            logger.exception(f"爬取基金信息失败: {str(e)}")
            raise BizException(ErrorMessageEnum.OPERATION_FAILED.view)

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
    def create_holding(data: dict, user_id) -> Holding:
        """
        创建持仓及其基金详情
        使用 SQLAlchemy 的 relationship 自动处理外键关联
        """
        if not data.get('ho_code'):
            raise BizException(msg=ErrorMessageEnum.MISSING_FIELD.view)

        # 检查用户是否已持有该基金
        ho_code = data['ho_code']
        existing_user_holding = db.session.query(UserHolding).join(
            Holding, UserHolding.ho_id == Holding.id
        ).filter(
            Holding.ho_code == ho_code,
            UserHolding.user_id == user_id
        ).first()

        if existing_user_holding:
            raise BizException(ErrorMessageEnum.DUPLICATE_DATA.view)

        try:
            # 分离 fund_detail 数据
            fund_detail_data = data.pop('fund_detail', None)

            # 检查 Holding 表中是否已存在该基金（通过 ho_code 查找）
            holding = Holding.query.filter_by(ho_code=ho_code).first()

            if holding:
                # 基金已存在，更新信息
                for key, value in data.items():
                    if hasattr(holding, key):
                        setattr(holding, key, value)

                # 日期转换处理
                if isinstance(holding.establishment_date, str) and holding.establishment_date:
                    holding.establishment_date = str_to_date(holding.establishment_date)
                else:
                    holding.establishment_date = None

                # 更新关联的 FundDetail
                if fund_detail_data:
                    if holding.fund_detail:
                        # FundDetail 已存在，更新
                        for key, value in fund_detail_data.items():
                            if hasattr(holding.fund_detail, key):
                                setattr(holding.fund_detail, key, value)
                    else:
                        # FundDetail 不存在，创建新的
                        fund_detail = FundDetail(**fund_detail_data)
                        holding.fund_detail = fund_detail
            else:
                # 基金不存在，创建新的
                holding = Holding(**data)
                holding.ho_type = HoldingTypeEnum.FUND.value
                # 日期转换处理
                if isinstance(holding.establishment_date, str) and holding.establishment_date:
                    holding.establishment_date = str_to_date(holding.establishment_date)
                else:
                    holding.establishment_date = None

                # 处理关联的 FundDetail
                if fund_detail_data:
                    fund_detail = FundDetail(**fund_detail_data)
                    holding.fund_detail = fund_detail

                db.session.add(holding)
                db.session.flush()  # 获取 holding.id

            # 创建 UserHolding 记录
            user_holding = UserHolding(
                user_id=user_id,
                ho_id=holding.id,
                ho_status=HoldingStatusEnum.NOT_HELD.value
            )
            db.session.add(user_holding)
            db.session.commit()
            return holding

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.exception(f"创建持仓数据库错误: {str(e)}")
            raise BizException(msg=f"{ho_code}:{ErrorMessageEnum.OPERATION_FAILED.view}")
        except Exception as e:
            db.session.rollback()
            logger.exception(f"创建持仓未知错误: {str(e)}")
            raise BizException(msg=f"{ho_code}:{ErrorMessageEnum.OPERATION_FAILED.view}")

    @staticmethod
    def import_holdings(ho_codes: list, user_id: str) -> dict:
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
            # 1. 检查用户是否已持有 (避免不必要的爬虫请求)
            if db.session.query(UserHolding).join(
                Holding, UserHolding.ho_id == Holding.id
            ).filter(
                Holding.ho_code == code,
                UserHolding.user_id == user_id
            ).first():
                results["skipped"] += 1
                continue
            try:
                # 2. 爬取数据
                # 简单判断：如果是6位数字且以0/1/5/6开头通常是基金，
                # 但股票也是6位。这里假设目前只处理基金。
                # 实际项目中建议根据用户选择或正则更精确判断。
                data = HoldingService.crawl_fund_info(code)
                # 3. 写入数据库
                HoldingService.create_holding(data, user_id)
                results["success"] += 1

                # 礼貌性延时，防止被封IP
                time.sleep(0.3)
            except BizException as be:
                logger.warning(f"导入 {code} 业务异常: {be.msg}")
                results["failed"] += 1
                results["errors"].append(f"{code}: {be.msg}")
            except Exception as e:
                logger.exception(f"导入 {code} 未知异常: {str(e)}")
                results["failed"] += 1
                results["errors"].append(f"{code}: 系统错误")
        return results

    @staticmethod
    def get_cascade_delete_info(holding: Holding) -> dict:
        """
        获取删除一个 Holding 将会级联删除的关联数据摘要。
        只执行 COUNT 查询，性能高。
        """
        if not holding:
            return {}
        # 使用 relationship 属性来查询关联对象的数量
        # 这会触发高效的 COUNT(*) 查询
        cascade_counts = {
            'trades': len(holding.trades),
            'alert_rules': len(holding.alert_rules),
            'fund_nav_histories': len(holding.fund_nav_history_list),
            'holding_snapshots': len(holding.holding_snapshots),
            # 添加其他需要检查的关联模型
        }
        # 只返回数量大于0的项，简化前端处理
        return {k: v for k, v in cascade_counts.items() if v > 0}

    @staticmethod
    def delete_holding_with_cascade(holding: Holding):
        """
        在一个事务中删除 Holding 及其所有关联数据。
        依赖于在 models.py 中定义的 cascade="all, delete-orphan"。
        """
        try:
            # SQLAlchemy 将基于 model 中定义的 cascade 规则自动删除所有关联数据
            db.session.delete(holding)
            db.session.commit()
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.exception(f"删除持仓 {holding.ho_code} 失败: {e}")
            raise BizException(ErrorMessageEnum.OPERATION_FAILED.view)
