from marshmallow_sqlalchemy import SQLAlchemyAutoSchema
from marshmallow import fields
from app.models import Holding, Trade, NavHistory
from app.database import db


class HoldingSchema(SQLAlchemyAutoSchema):
    # # 重命名、加校验、格式化
    # ho_code = fields.Str(data_key='code', validate=validate.Length(6))
    # created_at = fields.DateTime(format='%Y-%m-%d %H:%M')
    class Meta:
        model = Holding  # 对应 ORM 模型
        sqla_session = db.session  # 用于懒加载查询
        # 只吐出这些字段
        # fields = ('id', 'ho_name', 'ho_code', 'ho_type', 'created_at')
        load_instance = True  # 反序列化时可直接得到模型实例（可选）

    ho_establish_date = fields.Date(format="%Y-%m-%d")


class TradeSchema(SQLAlchemyAutoSchema):
    class Meta:
        model = Trade
        sqla_session = db.session
        load_instance = True


class NavHistorySchema(SQLAlchemyAutoSchema):
    class Meta:
        model = NavHistory
        sqla_session = db.session
        load_instance = True


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
