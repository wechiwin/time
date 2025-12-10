import json
import os
import tempfile

import requests
from app.models import db, Holding, Trade
from paddleocr import PaddleOCR
import logging

ocr = PaddleOCR(use_angle_cls=True, lang='ch')
# TODO 改为在线？
OLLAMA = r"C:\Users\Administrator\AppData\Local\Programs\Ollama\ollama.exe"
logger = logging.getLogger(__name__)


class TradeService:
    def __init__(self):
        pass

    def process_trade_image(self, file_bytes):
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
        parsed_json = self.generate_json_from_text(text)
        # logger.info("ocr识别文字：" + text)
        # logger.info("LLM解析json结果：%s", str(parsed_json))
        return {
            "ocr_text": text,
            "parsed_json": parsed_json
        }

    def generate_json_from_text(self, text: str):
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

        result = self.call_local_llm(prompt)

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

    def list_trade(self, ho_code: int):
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

    def call_local_llm(self, prompt: str):

        """
        调用 Ollama 本地模型
        """
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": "qwen2.5:3b", "prompt": prompt, "stream": False},
            timeout=20
        )
        return resp.json()["response"]
