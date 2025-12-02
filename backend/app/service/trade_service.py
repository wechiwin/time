import json
import os
import tempfile

import requests
from app.models import db, Holding, Trade
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='ch')
# TODO 改为在线？
OLLAMA = r"C:\Users\Administrator\AppData\Local\Programs\Ollama\ollama.exe"


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

        return {
            "ocr_text": text,
            "parsed_json": parsed_json
        }

    def generate_json_from_text(self, text: str):
        template = """{
    "tr_date": "YYYY-MM-DD",
    "tr_nav_per_unit": 0.0,
    "tr_shares": 0.0,
    "tr_fee": 0.0,
    "tr_type": 1,
    "tr_amount": 0.0
}"""

        prompt = f"""
    你是一个严格的 JSON 解析器。请从 OCR 文本中提取基金交易信息。
    
    禁止输出任何代码块（如```json）。
    禁止输出任何解释。
    禁止输出除 JSON 以外的内容。
    
    要求：
    1. 一定输出合法 JSON 
    2. 字段包括：tr_type, tr_date, tr_nav_per_unit, tr_shares, tr_fee, tr_amount 
    3. 2中字段的含义分别是：交易类型，交易时间，交易净值，交易份额，手续费，交易金额 
    4. 数字能解析就解析，解析不了设为 null 
    5. tr_type 卖出为 0，买入为 1
    
    按照以下 JSON 格式输出：
    
    {template}
    
    如果字段没有从OCR中识别到，使用 null 填充。
    
    OCR 文本：
    {text}
    
    请只输出 JSON。
    
        """

        result = self.call_local_llm(prompt)

        # 尝试提取 JSON
        try:
            data = json.loads(result)
            return data
        except Exception:
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
            'tr_type': t.transaction_type,
            'tr_date': t.transaction_date,
            'tr_nav_per_unit': t.transaction_net_value,
            'tr_shares': t.transaction_shares,
            'tr_fee': t.transaction_fee,
            'tr_amount': t.transaction_amount
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
