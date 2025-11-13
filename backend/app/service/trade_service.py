from app.models import db, Holding, Trade


class TradeService:

    @staticmethod
    def list_trade(ho_code: int) -> dict:
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
