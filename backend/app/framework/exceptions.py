# app/framework/exceptions.py
from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR


class BizException(Exception):
    def __init__(self, code=RESPONSE_CODE_ERROR, msg="business error"):
        self.code = code
        self.msg = msg
