import logging

from marshmallow import fields, EXCLUDE, post_dump
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from app.constant.biz_enums import *
from app.database import db
from app.models import *

logger = logging.getLogger(__name__)


class BaseSchema(SQLAlchemyAutoSchema):
    # 你可能已经有了一些通用配置
    class Meta:
        sqla_session = db.session  # 用于懒加载查询
        load_instance = True  # 反序列化时可直接得到模型实例
        unknown = EXCLUDE  # 忽略未知字段

    id = fields.Int(dump_only=True)

    @post_dump
    def trim_decimal_zero(self, data, **kwargs):
        """
        全局处理 Decimal 展示：
        - 去掉无意义的尾随 0
        - 避免 scientific notation
        """
        for key, value in data.items():
            if isinstance(value, Decimal):
                normalized = value.normalize()
                data[key] = format(normalized, 'f')
        return data


class EnumViewMixin:
    """
    自动给枚举类添加释义
    """
    enum_map: dict[str, type] = {}

    @post_dump
    def auto_add_enum_views(self, data, **kwargs):
        for field_name, enum_cls in self.enum_map.items():
            value = data.get(field_name)
            if value is None:
                continue

            try:
                enum_member = enum_cls(value)
                if hasattr(enum_member, 'view'):
                    data[f"{field_name}$view"] = str(enum_member.view)
            except Exception as e:
                logger.error(e, exc_info=True)

        return data


class FundDetailSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'trade_market': FundTradeMarketEnum,
        'dividend_method': FundDividendMethodEnum,
    }
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = FundDetail


class HoldingSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'ho_type': HoldingTypeEnum,
        'ho_status': HoldingStatusEnum,
        'currency': CurrencyEnum,
    }
    user_id = fields.Int(dump_only=True)
    ho_type = fields.Enum(HoldingTypeEnum, by_value=True)

    fund_detail = fields.Nested(FundDetailSchema, required=False, allow_none=True)

    class Meta(BaseSchema.Meta):
        model = Holding  # 对应 ORM 模型


class TradeSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'tr_type': TradeTypeEnum,
    }
    user_id = fields.Int(dump_only=True)

    ho_short_name = fields.String(attribute='holding.ho_short_name', dump_only=True)

    class Meta(BaseSchema.Meta):
        model = Trade
        include_fk = True

    # tr_date = fields.Date(format='%Y-%m-%d')


class FundNavHistorySchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    ho_code = fields.String(attribute='holding.ho_code', dump_only=True)
    ho_short_name = fields.String(attribute='holding.ho_short_name', dump_only=True)

    class Meta(BaseSchema.Meta):
        model = FundNavHistory
        include_fk = True


class AlertRuleSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'action': AlertRuleActionEnum,
    }

    user_id = fields.Int(dump_only=True)
    action = fields.Enum(AlertRuleActionEnum, by_value=True)

    class Meta(BaseSchema.Meta):
        model = AlertRule
        include_fk = True


class AlertHistorySchema(BaseSchema):
    enum_map = {
        'action': AlertRuleActionEnum,
        'send_status': AlertEmailStatusEnum,
    }
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = AlertHistory
        include_fk = True


class HoldingSnapshotSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = HoldingSnapshot


class HoldingAnalyticsSnapshotSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = HoldingAnalyticsSnapshot


class InvestedAssetSnapshotSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = InvestedAssetSnapshot


class InvestedAssetAnalyticsSnapshotSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = InvestedAssetAnalyticsSnapshot


class BenchmarkSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = Benchmark
        fields = ('id', 'bm_code', 'bm_name')


class BenchmarkHistorySchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = BenchmarkHistory
        fields = ('id', 'bm_id', 'bmh_date', 'bmh_close_price')

    date = fields.Date(attribute='bmh_date', dump_only=True)
    closePrice = fields.Float(attribute='bmh_close_price', dump_only=True)


class AsyncTaskLogSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = AsyncTaskLog


class TokenBlacklistSchema(BaseSchema):
    user_id = fields.Int(dump_only=True)

    class Meta(BaseSchema.Meta):
        model = TokenBlacklist


class UserSettingSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = UserSetting
        # 排除 id 和 pwd_hash 字段
        exclude = ('id', 'pwd_hash')


class LoginHistorySchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = LoginHistory


def marshal_pagination(pagination, schema_cls):
    """
    把 SQLAlchemy 的 paginate() 结果转成统一结构，
    并使用 Marshmallow Schema 自动序列化 items。

    :param pagination: Flask-SQLAlchemy paginate() 返回的对象
    :param schema_cls: Marshmallow Schema 类（非实例）
    :return: dict
    """
    schema = schema_cls(many=True)
    return {
        'items': schema.dump(pagination.items),
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }
