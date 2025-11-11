from app.models import db, NetValue, Holding


class NetValueService:

    @staticmethod
    def search_list(fund_code: int) -> dict:
        # 基础查询：左连接 Holding 表
        query = db.session.query(NetValue, Holding.fund_name).outerjoin(
            Holding, NetValue.fund_code == Holding.fund_code
        )

        # query = NetValue.query
        if fund_code:
            query = query.filter_by(fund_code=fund_code)

        results = query.order_by(NetValue.date).all() or []

        data = [{
            'id': nv.id,
            'fund_code': nv.fund_code,
            'fund_name': fund_name,
            'date': nv.date,
            'unit_net_value': nv.unit_net_value,
            'accumulated_net_value': nv.accumulated_net_value
        } for nv, fund_name in results]
        return data
