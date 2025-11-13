from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


# 通用时间戳基类
class TimestampMixinSchema(BaseModel):
    created_at: Optional[datetime] = Field(None, description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")

    class Config:
        orm_mode = True


# =======================
#       Holding 模型
# =======================
class HoldingBase(BaseModel):
    ho_name: Optional[str] = Field(None, description="基金名称")
    ho_code: Optional[str] = Field(None, description="基金代码")
    ho_type: Optional[str] = Field(None, description="基金类型")
    ho_establish_date: Optional[date] = Field(None, description="成立日期")
    ho_short_name: Optional[str] = Field(None, description="简称")


class HoldingSchema(HoldingBase, TimestampMixinSchema):
    ho_id: int

    class Config:
        orm_mode = True


# =======================
#       Trade 模型
# =======================
class TradeBase(BaseModel):
    ho_code: Optional[str] = Field(None, description="关联基金代码")
    tr_type: Optional[str] = Field(None, description="交易类型")
    tr_date: Optional[str] = Field(None, description="交易日期")
    tr_nav_per_unit: Optional[float] = Field(None, description="交易净值")
    tr_shares: Optional[float] = Field(None, description="交易份额")
    tr_fee: Optional[float] = Field(None, description="交易费用")
    tr_amount: Optional[float] = Field(None, description="交易金额")


class TradeSchema(TradeBase, TimestampMixinSchema):
    tr_id: int
    # holding: Optional[HoldingSchema] = None  # 关联基金

    class Config:
        orm_mode = True


class TradeResponse(TradeSchema, TimestampMixinSchema):
    tr_id: int
    ho_short_name: Optional[str] = Field(None, description="简称")

    class Config:
        orm_mode = True


# =======================
#     NavHistory 模型
# =======================
class NavHistoryBase(BaseModel):
    ho_code: Optional[str] = Field(None, description="关联基金代码")
    nav_date: Optional[str] = Field(None, description="净值日期")
    nav_per_unit: Optional[float] = Field(None, description="单位净值")
    nav_accumulated_per_unit: Optional[float] = Field(None, description="累计净值")


class NavHistorySchema(NavHistoryBase):
    nav_id: int

    class Config:
        orm_mode = True


# =======================
#     通用分页返回
# =======================
class Pagination(BaseModel):
    page: int
    per_page: int
    total: int
    pages: int


class PaginatedResponse(BaseModel):
    items: list
    pagination: Pagination
