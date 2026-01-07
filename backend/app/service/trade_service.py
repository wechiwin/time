import json
import os
import tempfile
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

import requests
from sqlalchemy import desc

from app.constant.biz_enums import HoldingStatusEnum, TradeTypeEnum
from app.framework.exceptions import BizException
from app.models import db, Holding, Trade, FundNavHistory
from paddleocr import PaddleOCR
import logging
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from app.tools.date_tool import str_to_date

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
                    data['ho_id'] = h.id
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
            'tr_id': t.id,
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
        try:
            ho_id = new_trade.ho_id
            # 更新持仓状态
            holding = Holding.query.filter_by(id=ho_id).first()
            if not holding:
                raise BizException("持仓不存在")

            trades, tr_cycle = cls.list_uncleared(holding)
            # 判空
            if trades:
                if TradeTypeEnum.SELL == new_trade.tr_type:  # 卖出
                    # 分别计算目前持有的买入和卖出份额
                    buy_shares = sum(t.tr_shares for t in trades if t.tr_type == TradeTypeEnum.BUY)
                    sell_shares = sum(t.tr_shares for t in trades if t.tr_type == TradeTypeEnum.SELL)

                    current_sell_shares = buy_shares - sell_shares - new_trade.tr_shares
                    if current_sell_shares < 0:
                        raise BizException("卖出份额大于买入份额")
                    elif current_sell_shares == 0:  # 清仓
                        new_trade.is_cleared = True
                        holding.ho_status = HoldingStatusEnum.CLOSED
                    else:  # 部分卖出
                        holding.ho_status = HoldingStatusEnum.HOLDING
                else:  # 买入
                    holding.ho_status = HoldingStatusEnum.HOLDING
            else:  # 超卖
                if TradeTypeEnum.SELL == new_trade.tr_type:
                    raise BizException("卖出份额大于买入份额")
                holding.ho_status = HoldingStatusEnum.HOLDING

            new_trade.ho_code = holding.ho_code
            new_trade.tr_cycle = tr_cycle
            db.session.add(new_trade)
            db.session.add(holding)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            logger.error(e, exc_info=True)
            return False

    @classmethod
    def import_trade(cls, transactions):
        """
        批量导入交易记录
        """
        if not transactions:
            return True
        # 1. 按 ho_code 分组并按交易日期排序
        transactions_by_code = defaultdict(list)
        for tx in transactions:
            transactions_by_code[tx.ho_code].append(tx)

        for code in transactions_by_code:
            transactions_by_code[code].sort(key=lambda x: x.tr_date)

        ho_codes = list(transactions_by_code.keys())

        # 2. 一次性查询所有相关的持仓记录
        holdings = Holding.query.filter(Holding.ho_code.in_(ho_codes)).all()
        holding_map = {h.ho_code: h for h in holdings}

        # 3. 检查是否存在未创建的持仓
        missing_codes = set(ho_codes) - set(holding_map.keys())
        if missing_codes:
            raise BizException(f"以下基金代码不存在于持仓表中，请先添加: {', '.join(map(str, missing_codes))}")

        try:
            # 4. 循环处理每个基金的交易列表
            for ho_code, new_trades in transactions_by_code.items():
                holding = holding_map[ho_code]

                # 获取该基金在导入前数据库中的状态
                uncleared_trades_db, initial_tr_cycle = cls.list_uncleared(holding)

                # 计算当前数据库中未清算的份额（作为内存中计算的起点）
                buy_shares_db = sum((Decimal(str(t.tr_shares)) for t in uncleared_trades_db if
                                     t.tr_type == TradeTypeEnum.BUY.value), start=Decimal('0'))
                sell_shares_db = sum((Decimal(str(t.tr_shares)) for t in uncleared_trades_db if
                                      t.tr_type == TradeTypeEnum.SELL.value), start=Decimal('0'))
                # 初始化内存中的状态变量
                current_shares = buy_shares_db - sell_shares_db
                current_tr_cycle = initial_tr_cycle

                # 5. 按时间顺序处理该基金的每一笔新交易
                for trade in new_trades:
                    trade_shares = Decimal(str(trade.tr_shares))
                    if isinstance(trade.tr_date, str):
                        trade.tr_date = str_to_date(trade.tr_date)

                    if current_shares.is_zero() and trade.tr_type == TradeTypeEnum.SELL.value:
                        raise BizException(
                            f"基金 {ho_code} 导入失败: 交易日 {trade.tr_date} 尝试从一个空仓中卖出份额。"
                        )

                    # 为当前交易分配正确的轮次
                    trade.tr_cycle = current_tr_cycle

                    if trade.tr_type == TradeTypeEnum.SELL.value:
                        if trade_shares > current_shares:
                            raise BizException(
                                f"基金 {ho_code} 导入失败: 交易日 {trade.tr_date} 尝试卖出 {trade_shares} 份, "
                                f"但当时仅持有 {current_shares} 份。"
                            )
                        current_shares -= trade_shares

                        # 检测是否清仓
                        if current_shares < Decimal('0.0001'):
                            trade.is_cleared = True
                            current_shares = Decimal('0')  # 修正精度
                            current_tr_cycle += 1  # 轮次+1
                    else:  # 买入
                        current_shares += trade_shares

                    # 设置交易的关联属性并添加到会话
                    trade.ho_id = holding.id
                    trade.ho_code = holding.ho_code
                    db.session.add(trade)

                # 6. 处理完一个基金的所有新交易后，根据最终份额更新持仓状态
                # 使用一个小的阈值来判断是否为零，避免浮点精度问题
                if current_shares < Decimal('0.0001'):
                    holding.ho_status = HoldingStatusEnum.CLOSED.value
                else:
                    holding.ho_status = HoldingStatusEnum.HOLDING.value

                db.session.add(holding)  # 添加到会话以更新状态

            # 7. 所有基金都处理完毕后，统一提交事务
            db.session.commit()
            return True

        except Exception as e:
            db.session.rollback()
            logger.error(e, exc_info=True)
            if isinstance(e, BizException):
                raise e
            raise BizException("导入过程中发生未知错误")

    @staticmethod
    def list_uncleared(holding) -> Tuple[List[Trade], int]:
        """
        参数:
          holding: 持仓对象
        返回：
            一个元组 (trades, tr_cycle)，其中:
            - trades: 未清仓的所有交易记录列表 (List[Trade])
            - tr_cycle: 新建交易记录应使用的 tr_cycle (int)
        """
        # 获取最新一条记录
        latest_trade = Trade.query.filter_by(ho_id=holding.id).order_by(desc(Trade.id)).first()

        if not latest_trade:
            # 如果没有任何交易记录，则为第一轮
            return [], 1

        if HoldingStatusEnum.HOLDING == holding.ho_status:
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
                total_cost += trade.tr_amount  # 总成本包含交易费用
            elif trade.tr_type == 0:  # 卖出交易
                # 使用移动平均法计算卖出成本 TODO 之后增加选项FIFO给用户
                if total_shares > 0:
                    avg_cost = total_cost / total_shares
                    sell_cost = trade.tr_shares * avg_cost
                    total_shares -= trade.tr_shares
                    total_cost -= sell_cost

        return total_shares, total_cost

    @classmethod
    def calculate_cumulative_profit(cls):
        """
        计算累计收益
        累计收益 = 卖出总金额 + 当前持仓市值 - 买入总金额
        其中：
          - 买入总金额 = 所有买入交易的 tr_amount（含费用）之和
          - 卖出总金额 = 所有卖出交易的 tr_amount（含费用）之和
          - 当前持仓市值 = 所有未清仓持仓的份额 × 最新单位净值
        """
        # 1. 获取所有交易记录
        trades = Trade.query.all() or []

        # 2. 计算买入和卖出总额（含交易费用）
        total_buy_amount = sum(trade.tr_amount for trade in trades if trade.tr_type == 1)
        total_sell_amount = sum(trade.tr_amount for trade in trades if trade.tr_type == 0)

        # 3. 获取所有未清仓的持仓（is_cleared == 0）
        unclosed_holding_codes = set()
        holding_shares = {}  # ho_code -> total shares

        for trade in trades:
            if trade.is_cleared == 0 and trade.tr_type == 1:  # 未清仓且是买入
                holding_shares[trade.ho_code] = holding_shares.get(trade.ho_code, 0) + trade.tr_shares
            elif trade.is_cleared == 0 and trade.tr_type == 0:  # 未清仓且是卖出
                # 卖出会减少持仓
                holding_shares[trade.ho_code] = holding_shares.get(trade.ho_code, 0) - trade.tr_shares
                if holding_shares[trade.ho_code] <= 0:
                    holding_shares[trade.ho_code] = 0  # 防止负数

        # 4. 获取每个基金的最新单位净值（nav_per_unit）
        # 使用 NavHistory 表，按 ho_code 和 nav_date 降序取最新一条
        latest_navs = {}
        for ho_code in holding_shares.keys():
            if not ho_code:
                continue
            latest_nav = FundNavHistory.query.filter_by(ho_code=ho_code) \
                .order_by(FundNavHistory.nav_date.desc()) \
                .first()
            if latest_nav:
                latest_navs[ho_code] = latest_nav.market_price

        # 5. 计算当前持仓市值
        current_market_value = 0.0
        for ho_code, shares in holding_shares.items():
            if shares > 0 and ho_code in latest_navs:
                current_market_value += shares * latest_navs[ho_code]

        # 6. 计算累计收益
        cumulative_profit = total_sell_amount + current_market_value - total_buy_amount

        return cumulative_profit
