import json
import os
import tempfile
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

import requests

from app.constant.biz_enums import HoldingStatusEnum, TradeStatusEnum
from app.framework.exceptions import BizException
from app.models import db, Holding, Trade
from paddleocr import PaddleOCR
import logging
from typing import List, Dict, Tuple, Optional

ocr = PaddleOCR(use_angle_cls=True, lang='ch')
# TODO 改为在线？
OLLAMA = r"C:\Users\Administrator\AppData\Local\Programs\Ollama\ollama.exe"
logger = logging.getLogger(__name__)


class TradeService:
    def __init__(self):
        pass

    @classmethod
    def process_trade_image(cls, file_bytes):
        """
        用于 HTTP 和 WebSocket 的通用逻辑
        参数：字节流
        返回 OCR 文本 + LLM JSON
        """

        # 保存到临时文件( OCR模型通常需要路径 )
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(file_bytes)
            img_path = tmp.name

        # ===== 1) OCR =====
        ocr_result = ocr.ocr(img_path)
        os.remove(img_path)

        try:
            texts = ocr_result[0]['rec_texts']
            text = "\n".join(texts)
        except Exception:
            text = ""

        # ===== 2) LLM 解析 =====
        parsed_json = cls.generate_json_from_text(text)
        # logger.info("ocr识别文字：" + text)
        # logger.info("LLM解析json结果：%s", str(parsed_json))
        return {
            "ocr_text": text,
            "parsed_json": parsed_json
        }

    @classmethod
    def generate_json_from_text(cls, text: str):
        template = """{
    "ho_code": "",
    "ho_name": "",
    "tr_type": 1,
    "tr_date": "YYYY-MM-DD",
    "tr_nav_per_unit": 1.0,
    "tr_shares": 100.0,
    "tr_net_amount": 100.0,
    "tr_fee": 0.1,
    "tr_amount": 100.1
}"""

        prompt = f"""
你是一个专业的基金交易单据解析专家。你的任务是从 OCR 文本中提取结构化数据，并确保金额逻辑完全正确。
请严格遵循以下五步推理过程（内部思考，不要输出）：
1. 根据字段含义找出所有关键字段的原始值，字段含义：
   - ho_code: string，持仓代码
   - ho_name: string，持仓名称
   - tr_type: int，交易类型(卖出为0，买入为1)
   - tr_date: string，交易时间(YYYY-MM-DD格式)
   - tr_nav_per_unit: float，交易净值(单位净值)
   - tr_shares: float，交易份额
   - tr_net_amount: float，交易净额，计算公式：tr_nav_per_unit * tr_shares
   - tr_fee: float，手续费
   - tr_amount: float，交易总额，买入时tr_amount=tr_net_amount + tr_fee，卖出时tr_amount=tr_net_amount - tr_fee
2. 根据 tr_type 判断是买入还是卖出
3. 计算理论上的 tr_net_amount = tr_nav_per_unit × tr_shares
4. 检查 tr_amount 和 tr_net_amount 的关系是否符合业务规则：
   - 买入时：tr_amount 应该大于 tr_net_amount（因为含手续费）
   - 卖出时：tr_amount 应该小于 tr_net_amount（因为扣手续费）
5. 如果发现数值颠倒，请自动交换 tr_amount 和 tr_net_amount 的值
【输出要求】
- 只输出最终 JSON，不含任何解释或代码块
- 必须是合法 JSON
- 字段必须包含：ho_code, ho_name, tr_type, tr_date, tr_nav_per_unit, tr_shares, tr_net_amount, tr_fee, tr_amount
- 无法识别的string设为空字符串，无法识别的int或者float设为0
- 数值字段必须为 float/int，不能加引号
【金额逻辑规则】
- tr_net_amount 是扣除/获得手续费前的金额（= 单位净值 × 份额）
- tr_amount 是实际支付（买入）或到账（卖出）的总金额
- 买入：tr_amount = tr_net_amount + tr_fee → 所以 tr_amount > tr_net_amount
- 卖出：tr_amount = tr_net_amount - tr_fee → 所以 tr_amount < tr_net_amount
【示例格式】（注意 tr_net_amount 和 tr_amount 的大小关系）
{template}
OCR 文本：
{text}
现在开始，请只输出 JSON。
"""

        result = cls.call_local_llm(prompt)

        # 尝试提取 JSON
        try:
            data = json.loads(result)
            if data.get('ho_name') and not data.get('ho_code'):
                # 根据名称获取代码
                h = Holding.query.filter_by(ho_name=data.get('ho_name')).first()
                if h:
                    data['ho_code'] = h.ho_code
            # logger.info("LLM解析json结果：%s", str(data))
            return data
        except Exception as e:
            logger.info(e)
            return {"error": "LLM 解析 JSON 失败", "raw": result}

    @classmethod
    def list_trade(cls, ho_code: int):
        query = Trade.query
        if ho_code:
            query = query.filter_by(ho_code=ho_code)

        # results = query.order_by(Transaction.date).all() or []
        results = query.all() or []

        data = [{
            'tr_id': t.tr_id,
            'ho_code': t.ho_code,
            'tr_type': t.tr_type,
            'tr_date': t.tr_date,
            'tr_nav_per_unit': t.tr_nav_per_unit,
            'tr_shares': t.tr_shares,
            'tr_net_amount': t.tr_net_amount,
            'tr_fee': t.tr_fee,
            'tr_amount': t.tr_amount
        } for t in results]
        return data

    @staticmethod
    def call_local_llm(prompt: str):

        """
        调用 Ollama 本地模型
        """
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5:3b", "prompt": prompt, "stream": False},
            timeout=20
        )
        return resp.json()["response"]

    @classmethod
    def create_transaction(cls, new_trade):
        ho_code = new_trade.ho_code
        # 更新持仓状态
        holding = Holding.query.filter_by(ho_code=ho_code).first();
        if not holding:
            raise BizException("持仓不存在")

        trades = cls.list_uncleared_by_ho_code(ho_code)

        # 分别计算目前持有的买入和卖出份数
        current_buy_shares = sum(t.tr_shares for t in trades if t.tr_type == TradeStatusEnum.BUY.code)
        current_sell_shares = sum(t.tr_shares for t in trades if t.tr_type == TradeStatusEnum.SELL.code)
        # 检查卖出是否大于买入
        if current_sell_shares > current_buy_shares:
            raise BizException("交易数据有误：卖出份数大于买入份数")

        if TradeStatusEnum.BUY.code == new_trade.tr_type:
            # 如果之前不是持仓状态，现在买入则变为“持仓中”
            if holding.ho_status != HoldingStatusEnum.HOLDING.code:
                holding.ho_status = HoldingStatusEnum.HOLDING.code
            # 买入不会导致清仓
            new_trade.is_cleared = False
        else:
            # 卖出：检查是否清仓
            after_sell_shares = current_buy_shares - current_sell_shares - new_trade.tr_shares
            if after_sell_shares == 0:  # 清仓
                new_trade.is_cleared = True
                holding.ho_status = HoldingStatusEnum.CLEARED.code
            else:
                new_trade.is_cleared = False  # 部分清仓
                if holding.ho_status != HoldingStatusEnum.HOLDING.code:
                    holding.ho_status = HoldingStatusEnum.HOLDING.code

        db.session.add(new_trade)
        db.session.add(holding)
        db.session.commit()
        return ''

    @classmethod
    def import_trade(cls, transactions):
        # ho_code取出且去重
        ho_codes = set(tx.ho_code for tx in transactions)

        # 检查ho_code是否存在
        existing_holdings = Holding.query.filter(Holding.ho_code.in_(ho_codes)).all()
        existing_codes = {h.ho_code for h in existing_holdings}
        missing_codes = ho_codes - existing_codes
        if missing_codes:
            raise BizException(
                msg=f"以下基金代码不存在于持仓表中: {', '.join(map(str, missing_codes))}"
            )

        try:
            # 按ho_code分组处理交易
            transactions_by_code = {}
            for tx in transactions:
                if tx.ho_code not in transactions_by_code:
                    transactions_by_code[tx.ho_code] = []
                transactions_by_code[tx.ho_code].append(tx)
            # # 按交易日期排序每个ho_code的交易
            # for code in transactions_by_code:
            #     transactions_by_code[code].sort(key=lambda x: x.tr_date)

            # 处理每个ho_code的交易
            for code in ho_codes:
                # 获取该基金的所有未清仓交易
                existing_trades = cls.list_uncleared_by_ho_code(code)
                import_trades = transactions_by_code[code]
                mixed_trades = set(existing_trades) | set(import_trades)
                mixed_trades_sorted = sorted(
                    mixed_trades,
                    key=lambda t: datetime.strptime(t.tr_date, "%Y-%m-%d")
                )
                # # 分别计算数据库中已有的买入和卖出份额
                # existing_buy_shares = sum(t.tr_shares for t in existing_trades
                #                           if t.tr_type == TradeStatusEnum.BUY.code)
                # existing_sell_shares = sum(t.tr_shares for t in existing_trades
                #                            if t.tr_type == TradeStatusEnum.SELL.code)
                # # 分别计算导入的买入和卖出份额
                # import_trades = transactions_by_code[code]
                # import_buy_shares = sum(t.tr_shares for t in import_trades if t.tr_type == TradeStatusEnum.BUY.code)
                # import_sell_shares = sum(t.tr_shares for t in import_trades if t.tr_type == TradeStatusEnum.SELL.code)
                #
                # # 检查总数据是否有效（数据库+导入）
                # total_buy_shares = existing_buy_shares + import_buy_shares
                # total_sell_shares = existing_sell_shares + import_sell_shares
                # if total_sell_shares > total_buy_shares:
                #     raise BizException(f"基金代码 {code} 交易数据有误：卖出份数大于买入份数")

                # 获取持仓记录
                holding = Holding.query.filter_by(ho_code=code).first()

                # 用来计算是否清仓
                # current_share = existing_buy_shares - existing_sell_shares
                current_share = Decimal('0.00')

                # 处理该基金的批量交易
                for trade in mixed_trades_sorted:
                    trade_shares = Decimal(str(trade.tr_shares)).quantize(
                        Decimal('0.00'),
                        rounding=ROUND_HALF_UP
                    )
                    # 买入
                    if trade.tr_type == TradeStatusEnum.BUY.code:
                        if holding.ho_status != HoldingStatusEnum.HOLDING.code:
                            holding.ho_status = HoldingStatusEnum.HOLDING.code
                        trade.is_cleared = False
                        # 更新当前持仓数量
                        current_share += trade_shares
                    else:
                        # 卖出交易：检查是否超过当前可卖份额
                        if trade_shares > current_share:
                            raise BizException(
                                f"基金代码 {code} 导入失败，请检查模板中交易日期{trade.tr_date}及之前的数据")
                        current_share -= trade_shares
                        # 计算卖出后的持仓
                        if current_share == 0:  # 清仓
                            trade.is_cleared = True
                            holding.ho_status = HoldingStatusEnum.CLEARED.code
                        else:
                            trade.is_cleared = False  # 部分清仓
                            if holding.ho_status != HoldingStatusEnum.HOLDING.code:
                                holding.ho_status = HoldingStatusEnum.HOLDING.code

                    trade.tr_shares = float(trade_shares)

                    if trade.tr_id:
                        db.session.merge(trade)
                    else:
                        db.session.add(trade)

                # 更新持仓状态
                db.session.add(holding)

            # 提交所有更改
            db.session.commit()
            return ''

        except Exception as e:
            db.session.rollback()
            error_message = str(e)
            logger.error(error_message)
            raise BizException(msg=f"导入失败: {error_message}")

    @staticmethod
    def list_uncleared_by_ho_code(ho_code) -> List[Trade]:
        """
        获取自上次清仓后的所有交易记录
        参数:
          ho_code: 持仓代码
        """
        # 按交易日期排序（升序）
        all_trades = Trade.query.filter_by(ho_code=ho_code).order_by(Trade.tr_date).all()
        # 筛选出已清仓的交易
        cleared_trades = [trade for trade in all_trades if trade.is_cleared == 1]
        if cleared_trades:
            # 找出最近的一条已清仓交易
            latest_cleared_trade = max(cleared_trades, key=lambda x: x.tr_date)
            # 获取这条清仓交易及之后的所有交易
            latest_index = all_trades.index(latest_cleared_trade)
            return all_trades[latest_index:]
        else:
            # 没有已清仓的交易，返回所有交易
            return all_trades
