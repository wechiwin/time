import base64
import json
from collections import defaultdict
from decimal import Decimal
from typing import List, Tuple, Dict, Any

from loguru import logger
from flask_babel import gettext as _
from sqlalchemy import desc, or_
from sqlalchemy.exc import IntegrityError

from app.calendars.trade_calendar import trade_calendar
from app.config import Config
from app.constant.biz_enums import HoldingStatusEnum, TradeTypeEnum, ErrorMessageEnum, DividendTypeEnum
from app.constant.sys_enums import GlobalYesOrNo
from app.extension import openai_client
from app.framework.exceptions import BizException
from app.models import db, Holding, Trade, UserHolding
from app.utils.common_util import is_not_blank
from app.utils.date_util import str_to_date, date_to_str

ZERO = Decimal(0)

# 指定模型名称，建议使用支持视觉的模型，如 gpt-4o, qwen-vl-max 等 如果使用不支持视觉的模型（如 deepseek-v3），则仍需保留 OCR 步骤
MODEL_NAME = Config.MODEL_NAME


class TradeService:
    def __init__(self):
        pass

    @classmethod
    def process_trade_image_online(cls, file_bytes: bytes) -> Dict[str, Any]:
        """
        处理交易截图：直接发送图片给大模型进行解析 (Vision API)
        不再依赖本地 PaddleOCR
        """
        try:
            # 1. 将图片字节流转换为 Base64 编码
            base64_image = base64.b64encode(file_bytes).decode('utf-8')

            # 2. 构造 Prompt 和 消息体
            system_prompt = """
你是一个专业的基金交易单据解析专家。你的任务是从图片中提取结构化数据。
请严格遵循以下逻辑进行提取和校验：
1. 识别关键字段：持仓代码(ho_code), 名称(ho_short_name), 交易类型(tr_type), 日期(tr_date), 净值(tr_nav_per_unit), 份额(tr_shares), 金额(tr_amount), 手续费(tr_fee)。
2. 逻辑校验：
   - 交易金额(tr_amount) 理论上应等于 净值 * 份额。
   - 实际收付现金(cash_amount) 计算规则：
     * 买入(BUY): cash_amount = tr_amount + tr_fee
     * 卖出(SELL): cash_amount = tr_amount - tr_fee
3. 如果图片中的金额与计算不符，以图片中明确显示的“发生金额”或“实收/付金额”为准，反推其他字段。

【输出要求】
- 只输出纯 JSON 字符串，不要包含 Markdown 标记（如 ```json ... ```）。
- 必须包含字段：ho_code, ho_short_name, tr_type (BUY/SELL), tr_date (YYYY-MM-DD), tr_nav_per_unit, tr_shares, tr_amount, tr_fee, cash_amount。
- 数值类型保持为数字，不要用字符串。
- 无法识别的字段设为 null 或 0。
"""

            # 3. 调用大模型 API
            response = openai_client.client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "请解析这张基金交易确认单："},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.1,  # 低温度以保证数据提取的确定性
                # response_format={"type": "json_object"} # 如果模型支持 JSON 模式建议开启
            )

            content = response.choices[0].message.content
            logger.info(response)
            # 4. 解析返回的 JSON
            parsed_json = cls._clean_and_parse_json(content)

            # 5. 业务数据补全 (关联数据库中的持仓代码)
            if is_not_blank(parsed_json.get('ho_short_name')) or is_not_blank(parsed_json.get('ho_code')):
                h = Holding.query.filter(
                    or_(Holding.ho_short_name.like(f"%{parsed_json['ho_short_name']}%"),
                        Holding.ho_code.like(f"%{parsed_json['ho_code']}%"))
                ).first()
                if h:
                    parsed_json['ho_short_name'] = h.ho_short_name
                    parsed_json['ho_code'] = h.ho_code
                    parsed_json['ho_id'] = h.id

            logger.info(f"LLM Vision 解析结果: {parsed_json}")

            return {
                "ocr_text": "[由大模型直接通过视觉识别]",  # 兼容前端字段
                "parsed_json": parsed_json
            }

        except Exception as e:
            logger.exception(f"图片解析失败: {e}")
            return {"error": f"解析失败: {str(e)}", "parsed_json": {}}

    @staticmethod
    def _clean_and_parse_json(text: str) -> Dict:
        """
        清洗 LLM 返回的文本并解析为 JSON
        """
        try:
            # 去除可能存在的 Markdown 代码块标记
            cleaned_text = text.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned_text)
        except json.JSONDecodeError:
            logger.exception(f"JSON 解析失败，原始文本: {text}")
            return {}

    @classmethod
    def list_trade(cls, ho_code: int):
        query = Trade.query
        if ho_code:
            query = query.filter_by(ho_code=ho_code)

        # results = query.order_by(Transaction.date).all() or []
        results = query.all() or []

        data = [{
            'tr_id': t.id,
            'ho_code': t.ho_code,
            'tr_type': t.tr_type,
            'tr_date': t.tr_date,
            'tr_nav_per_unit': t.tr_nav_per_unit,
            'tr_shares': t.tr_shares,
            'tr_amount': t.tr_amount,
            'tr_fee': t.tr_fee,
            'cash_amount': t.cash_amount,
        } for t in results]
        return data

    @classmethod
    def create_transaction(cls, new_trade):
        try:
            # 1. 关联 Holding
            # 如果前端传了 ho_id，直接用；如果只传了 ho_code，查一下
            if not new_trade.ho_id and new_trade.ho_code:
                h = Holding.query.filter_by(ho_code=new_trade.ho_code).first()
                if h:
                    new_trade.ho_id = h.id

            if not new_trade.ho_id:
                raise BizException(ErrorMessageEnum.MISSING_FIELD.view)
            if not trade_calendar.is_trade_day(new_trade.tr_date):
                raise BizException(f"{date_to_str(new_trade.tr_date)}{ErrorMessageEnum.NOT_TRADE_DAY.view}")

            # 2. 先保存新记录 (此时 tr_cycle 可能不准，没关系，马上重算)
            # 默认给个 1 或者 0 都可以
            new_trade.tr_cycle = 1
            db.session.add(new_trade)
            # 需要 flush 获取 new_trade.id，保证重算时的排序稳定性
            db.session.flush()

            # 3. 调用重算逻辑
            cls.recalculate_holding_trades(new_trade.ho_id, new_trade.user_id)

            # 4. 提交事务
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logger.exception(f"创建交易记录失败: {e}")
            if isinstance(e, BizException):
                raise e
            return False

    @classmethod
    def update_trade_record(cls, tr_id, update_data: dict):
        try:
            trade = Trade.query.get(tr_id)
            if not trade:
                raise BizException(ErrorMessageEnum.DATA_NOT_FOUND.view)

            # 记录旧的 ho_id，防止用户修改了关联的持仓（虽然一般不允许改 ho_id）
            old_ho_id = trade.ho_id

            # 使用 marshmallow load 后的数据更新对象
            # 假设 update_data 已经是处理好的字典或对象
            for key, value in update_data.items():
                if hasattr(trade, key):
                    setattr(trade, key, value)

            db.session.flush()

            # 重算
            cls.recalculate_holding_trades(trade.ho_id, trade.user_id)

            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logger.exception(f"更新交易记录失败: {e}")
            raise e

    @classmethod
    def import_trade(cls, import_trades: List[Trade], user_id: str):
        """
        批量导入交易记录
        """
        if not import_trades:
            return True
        # 1. 按 ho_code 分组并按交易日期排序
        transactions_by_code = defaultdict(list)
        for tx in import_trades:
            transactions_by_code[tx.ho_code].append(tx)

        for code in transactions_by_code:
            transactions_by_code[code].sort(key=lambda x: x.tr_date)

        ho_codes = list(transactions_by_code.keys())

        # 2. 一次性查询所有相关的持仓记录（包含UserHolding关系）
        user_holdings = db.session.query(UserHolding).join(
            Holding, Holding.id == UserHolding.ho_id
        ).filter(
            Holding.ho_code.in_(ho_codes),
            UserHolding.user_id == user_id
        ).all()
        user_holding_map = {uh.holding.ho_code: uh for uh in user_holdings}

        # 3. 检查是否存在未创建的持仓
        missing_codes = set(ho_codes) - set(user_holding_map.keys())
        if missing_codes and len(missing_codes) > 0 and missing_codes is not None:
            raise BizException(_("FUND_CODE_NOT_IN_HOLDINGS") % {"codes": ', '.join(map(str, missing_codes))})

        try:
            # 4. 循环处理每个基金的交易列表
            for ho_code, new_trades in transactions_by_code.items():
                user_holding = user_holding_map[ho_code]
                holding = user_holding.holding

                # 获取该基金在导入前数据库中的状态
                uncleared_trades_db, initial_tr_cycle = cls.list_uncleared(holding, user_holding.ho_status)
                # 生成新集合
                to_iterate_trades = [*uncleared_trades_db, *new_trades]
                to_iterate_trades.sort(key=lambda t: t.tr_date)

                # 初始化内存中的状态变量
                current_shares = ZERO
                current_tr_cycle = initial_tr_cycle

                # 5. 按时间顺序处理该基金的每一笔新交易
                for trade in to_iterate_trades:
                    trade_shares = Decimal(str(trade.tr_shares))
                    if isinstance(trade.tr_date, str):
                        trade.tr_date = str_to_date(trade.tr_date)

                    if trade.tr_type == TradeTypeEnum.SELL.value and (
                            current_shares.is_zero() or trade_shares > current_shares):
                        raise BizException(_("FUND_IMPORT_FAILED_OVERSOLD") % {"ho_code": ho_code, "trade_tr_date": trade.tr_date, "trade_shares": trade_shares, "current_shares": current_shares})

                    # 为当前交易分配正确的轮次
                    trade.tr_cycle = current_tr_cycle

                    if trade.tr_type == TradeTypeEnum.BUY.value:
                        current_shares += trade_shares

                    elif trade.tr_type == TradeTypeEnum.SELL.value:
                        current_shares -= trade_shares
                        # 检测是否清仓
                        if current_shares < Decimal('0.0001'):
                            trade.is_cleared = GlobalYesOrNo.YES
                            current_shares = Decimal('0')  # 修正精度
                            current_tr_cycle += 1  # 轮次+1

                    if trade.id is None:
                        # 新增
                        trade.ho_id = holding.id
                        trade.ho_code = holding.ho_code
                        trade.user_id = user_id
                        db.session.add(trade)
                    else:
                        # 更新
                        pass

                # 6. 处理完一个基金的所有新交易后，根据最终份额更新持仓状态
                # 使用一个小的阈值来判断是否为零，避免浮点精度问题
                if current_shares < Decimal('0.0001'):
                    user_holding.ho_status = HoldingStatusEnum.CLOSED.value
                else:
                    user_holding.ho_status = HoldingStatusEnum.HOLDING.value

                db.session.add(user_holding)  # 添加到会话以更新状态

            # 7. 所有基金都处理完毕后，统一提交事务
            db.session.commit()
            return True

        except IntegrityError as e:
            db.session.rollback()
            # 针对数据库约束错误进行专门记录
            logger.exception(f"数据库约束错误，导入失败: {e}")
            raise BizException(_("IMPORT_PROCESS_ERROR"))
        except Exception as e:
            db.session.rollback()
            logger.exception(f"导入交易处理异常: {e}")
            if isinstance(e, BizException):
                raise e
            raise BizException(_("IMPORT_PROCESS_ERROR"))

    @staticmethod
    def list_uncleared(holding, ho_status: str) -> Tuple[List[Trade], int]:
        """
        参数:
          holding: 持仓对象
          ho_status: 持仓状态
        返回：
            一个元组 (trades, tr_cycle)，其中:
            - trades: 未清仓的所有交易记录列表
            - tr_cycle: 新建交易记录应使用的 tr_cycle (int)
        """
        # 获取最新一条记录
        latest_trade = Trade.query.filter_by(ho_id=holding.id).order_by(desc(Trade.id)).first()

        if not latest_trade:
            # 如果没有任何交易记录，则为第一轮
            return [], 1

        if HoldingStatusEnum.HOLDING.value == ho_status:
            trades = Trade.query.filter_by(ho_id=holding.id, tr_cycle=latest_trade.tr_cycle).order_by(Trade.tr_date, Trade.id).all()
            return trades, latest_trade.tr_cycle
        else:
            return [], latest_trade.tr_cycle + 1

    @staticmethod
    def calculate_position(uncleared_trade_list):
        """
        计算未清仓交易列表的持仓总份额和持仓总成本

        参数:
            uncleared_trade_list: 未清仓的交易列表(Trade对象列表)

        返回:
            tuple: (持仓总份额, 持仓总成本)
        """
        total_shares = 0.0
        total_cost = 0.0

        # 按交易日期排序，确保交易按时间顺序处理
        sorted_trades = sorted(uncleared_trade_list, key=lambda x: x.tr_date)

        for trade in sorted_trades:
            if trade.tr_type == 1:  # 买入交易
                total_shares += trade.tr_shares
                total_cost += trade.cash_amount  # 总成本包含交易费用
            elif trade.tr_type == 0:  # 卖出交易
                # 使用移动平均法计算卖出成本 TODO 之后增加选项FIFO给用户
                if total_shares > 0:
                    avg_cost = total_cost / total_shares
                    sell_cost = trade.tr_shares * avg_cost
                    total_shares -= trade.tr_shares
                    total_cost -= sell_cost

        return total_shares, total_cost

    @classmethod
    def recalculate_holding_trades(cls, ho_id: int, user_id: int = None):
        """
        核心方法：重新计算指定持仓的所有交易记录的轮次(tr_cycle)和清仓状态(is_cleared)。
        适用于：新增、修改、删除交易记录后，修正后续数据。
        注意：此方法需要在事务中调用，或者调用后由上层commit。
        """
        # 1. 获取持仓信息
        holding = Holding.query.get(ho_id)
        if not holding:
            raise BizException(_("HOLDING_NOT_EXISTS"))

        # 2. 获取该持仓下所有交易记录，严格按时间正序排列
        # secondary sort by id ensures deterministic order for same-day trades
        trades = Trade.query.filter_by(ho_id=ho_id).order_by(Trade.tr_date.asc(), Trade.id.asc()).all()

        if not trades:
            # 如果没有交易记录，重置持仓状态为 CLOSED (或者根据业务逻辑删除持仓)
            if user_id:
                user_holding = UserHolding.query.filter_by(ho_id=ho_id, user_id=user_id).first()
                if user_holding:
                    user_holding.ho_status = HoldingStatusEnum.CLOSED.value
                    db.session.add(user_holding)
            return

        # 3. 初始化状态变量
        current_shares = Decimal('0')
        current_cycle = 1

        # 用于浮点数比较的极小值
        EPSILON = Decimal('0.0001')

        # 4. 遍历重放
        for trade in trades:
            # 强制转换类型以防万一
            trade_shares = Decimal(str(trade.tr_shares))

            # 重置当前记录的状态
            trade.tr_cycle = current_cycle
            trade.is_cleared = GlobalYesOrNo.NO

            if trade.tr_type == TradeTypeEnum.BUY.value:
                current_shares += trade_shares

            elif trade.tr_type == TradeTypeEnum.SELL.value:
                current_shares -= trade_shares

                # 校验：不允许卖空
                # 如果计算过程中份额小于0 (考虑到精度误差，使用 < -EPSILON)
                if current_shares < -EPSILON:
                    raise BizException(
                        _("OPERATION_OVERSOLD") % {"trade_tr_date": trade.tr_date, "current_shares": current_shares}
                    )

                # 判断是否清仓
                # 如果剩余份额非常接近0，视为清仓
                if abs(current_shares) < EPSILON:
                    current_shares = Decimal('0')  # 修正为绝对0
                    trade.is_cleared = GlobalYesOrNo.YES
                    # 只有在清仓发生的这一笔交易完成后，下一笔交易才进入下一个周期
                    current_cycle += 1

            elif trade.tr_type == TradeTypeEnum.DIVIDEND:
                # 如果是分红再投资，它会增加持仓份额
                if trade.dividend_type == DividendTypeEnum.REINVEST and trade.tr_shares and trade.tr_shares > 0:
                    current_shares += Decimal(str(trade.tr_shares))
                # 现金分红不影响持仓份额，所以无需处理

            # 更新数据库对象（SQLAlchemy 会自动追踪变更）
            db.session.add(trade)

        # 5. 更新 UserHolding 表的总状态
        if user_id:
            user_holding = UserHolding.query.filter_by(ho_id=ho_id, user_id=user_id).first()
            if user_holding:
                if current_shares > EPSILON:
                    user_holding.ho_status = HoldingStatusEnum.HOLDING.value
                else:
                    user_holding.ho_status = HoldingStatusEnum.CLOSED.value
                db.session.add(user_holding)
        # 注意：这里不执行 commit，交由调用方统一 commit，以便发生异常时回滚
