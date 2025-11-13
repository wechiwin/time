from app.models import db, NavHistory, Holding
from app.schemas_marshall import NavHistorySchema

class NavHistoryService:

    @staticmethod
    def search_list(ho_code: int) -> dict:
        # 基础查询：左连接 Holding 表
        query = db.session.query(NavHistory, Holding.ho_short_name).outerjoin(
            Holding, NavHistory.ho_code == Holding.ho_code
        )

        # query = NavHistory.query
        if ho_code:
            query = query.filter_by(ho_code=ho_code)

        results = query.order_by(NavHistory.nav_date).all() or []

        data = [{
            'nav_id': nv.nav_id,
            'ho_code': nv.ho_code,
            'ho_short_name': ho_short_name,
            'nav_date': nv.nav_date,
            'nav_per_unit': nv.nav_per_unit,
            'nav_accumulated_per_unit': nv.nav_accumulated_per_unit
        } for nv, ho_short_name in results]
        return data
        # return NavHistorySchema(many=True).dump(results)
