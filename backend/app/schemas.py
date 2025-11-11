from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from app.models import Holding, Transaction, NetValue
from app.database import db

class HoldingSchema(SQLAlchemyAutoSchema):
    # # 重命名、加校验、格式化
    # fund_code = fields.Str(data_key='code', validate=validate.Length(6))
    # created_at = fields.DateTime(format='%Y-%m-%d %H:%M')
    class Meta:
        model      = Holding          # 对应 ORM 模型
        sqla_session = db.session     # 用于懒加载查询
        # 只吐出这些字段
        # fields = ('id', 'fund_name', 'fund_code', 'fund_type', 'created_at')
        load_instance = True          # 反序列化时可直接得到模型实例（可选）

class TransactionSchema(SQLAlchemyAutoSchema):
    class Meta:
        model      = Transaction
        sqla_session = db.session
        load_instance = True

class NetValueSchema(SQLAlchemyAutoSchema):
    class Meta:
        model      = NetValue
        sqla_session = db.session
        load_instance = True

#
# from pydantic import BaseModel, Field, ConfigDict
# from datetime import datetime
# from typing import List, Optional
#
# # --------------- 基础字段 ---------------
# class FundBase(BaseModel):
#     id: int
#     fund_name: str = Field(..., min_length=1, max_length=100)
#     fund_code: str = Field(..., min_length=4, max_length=50)
#     fund_type: str = Field(..., max_length=50)
#     created_at: datetime
#     updated_at: datetime
#     model_config = ConfigDict(from_attributes=True)

# # --------------- 请求/创建 ---------------
# class FundCreate(FundBase):
#     """新增/修改入参"""
#     pass
#
# # --------------- 响应 ---------------
# class FundOut(FundBase):
#     """返回给前端的格式"""
#     id: int
#     created_at: datetime
#     updated_at: datetime
#
#     class Config:
#         orm_mode = True        # 关键：允许直接解析 SQLAlchemy 模型