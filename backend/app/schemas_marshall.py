from marshmallow import fields, EXCLUDE, post_dump
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from app.constant.biz_enums import *
from app.models import *


class BaseSchema(SQLAlchemyAutoSchema):
    class Meta:
        sqla_session = db.session  # 用于懒加载查询
        load_instance = True  # 反序列化时可直接得到模型实例
        unknown = EXCLUDE  # 忽略未知字段

    id = fields.Int(dump_only=True)

    # 覆盖默认的日期和日期时间字段类型
    TYPE_MAPPING = {
        **SQLAlchemyAutoSchema.TYPE_MAPPING,
        date: fields.Date,
        datetime: fields.DateTime,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 自动格式化所有日期/日期时间字段
        self._format_datetime_fields()

    def _format_datetime_fields(self):
        """自动检测并格式化所有日期/日期时间字段"""
        for field_name, field_obj in self.fields.items():
            if isinstance(field_obj, fields.DateTime):
                field_obj.format = '%Y-%m-%d %H:%M:%S'
            elif isinstance(field_obj, fields.Date):
                field_obj.format = '%Y-%m-%d'

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
                logger.exception(e)

        return data


class UserHoldingSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'ho_status': HoldingStatusEnum,
    }

    class Meta(BaseSchema.Meta):
        model = UserHolding
        include_fk = True


class FundDetailSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'trade_market': FundTradeMarketEnum,
        'dividend_method': FundDividendMethodEnum,
    }

    class Meta(BaseSchema.Meta):
        model = FundDetail


class HoldingSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'ho_type': HoldingTypeEnum,
        'currency': CurrencyEnum,
    }
    fund_detail = fields.Nested(FundDetailSchema, required=False, allow_none=True)

    class Meta(BaseSchema.Meta):
        model = Holding  # 对应 ORM 模型


class TradeSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'tr_type': TradeTypeEnum,
    }
    ho_short_name = fields.String(attribute='holding.ho_short_name', dump_only=True)

    class Meta(BaseSchema.Meta):
        model = Trade
        include_fk = True
        exclude = ("user_id",)

    # tr_date = fields.Date(format='%Y-%m-%d')


class FundNavHistorySchema(BaseSchema):
    ho_code = fields.String(attribute='holding.ho_code', dump_only=True)
    ho_short_name = fields.String(attribute='holding.ho_short_name', dump_only=True)
    exclude = ("user_id",)

    class Meta(BaseSchema.Meta):
        model = FundNavHistory
        include_fk = True


class AlertRuleSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'action': AlertRuleActionEnum,
    }

    class Meta(BaseSchema.Meta):
        model = AlertRule
        include_fk = True
        exclude = ("user_id",)


class AlertHistorySchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'action': AlertRuleActionEnum,
        'send_status': AlertEmailStatusEnum,
    }

    class Meta(BaseSchema.Meta):
        model = AlertHistory
        include_fk = True
        exclude = ("user_id",)


class HoldingSnapshotSchema(BaseSchema):

    class Meta(BaseSchema.Meta):
        model = HoldingSnapshot
        exclude = ("user_id",)


class HoldingAnalyticsSnapshotSchema(BaseSchema):

    class Meta(BaseSchema.Meta):
        model = HoldingAnalyticsSnapshot
        exclude = ("user_id",)


class InvestedAssetSnapshotSchema(BaseSchema):

    class Meta(BaseSchema.Meta):
        model = InvestedAssetSnapshot
        exclude = ("user_id",)


class InvestedAssetAnalyticsSnapshotSchema(BaseSchema):

    class Meta(BaseSchema.Meta):
        model = InvestedAssetAnalyticsSnapshot
        exclude = ("user_id",)


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


class AsyncTaskLogSchema(BaseSchema, EnumViewMixin):
    enum_map = {
        'status': TaskStatusEnum,
    }

    class Meta(BaseSchema.Meta):
        model = AsyncTaskLog
        exclude = ("user_id",)


class TokenBlacklistSchema(BaseSchema):

    class Meta(BaseSchema.Meta):
        model = TokenBlacklist
        exclude = ("user_id",)


class UserSettingSchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = UserSetting
        # 排除 id 和 pwd_hash 字段
        exclude = ('id', 'pwd_hash')
        include_fk = True  # Include foreign key fields like benchmark_id


class LoginHistorySchema(BaseSchema):
    class Meta(BaseSchema.Meta):
        model = LoginHistory
        exclude = ("user_id",)


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
