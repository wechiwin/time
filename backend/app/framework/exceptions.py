# app/framework/exceptions.py
from app.framework.sys_constant import RESPONSE_CODE_OK, RESPONSE_CODE_ERROR
from app.models import AsyncTaskLog


class BizException(Exception):
    def __init__(self, msg="business error", code=RESPONSE_CODE_ERROR, ):
        self.code = code
        self.msg = msg


class AsyncTaskException(Exception):
    def __init__(self, async_task_log: AsyncTaskLog = None):
        self.async_task_log = async_task_log
