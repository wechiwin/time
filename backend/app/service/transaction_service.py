from app.models import db, NetValue, Holding, Transaction


class TransactionService:

    @staticmethod
    def list_transaction(fund_code: int) -> dict:
        query = Transaction.query
        if fund_code:
            query = query.filter_by(fund_code=fund_code)

        # results = query.order_by(Transaction.date).all() or []
        results = query.all() or []

        data = [{
            'id': t.id,
            'fund_code': t.fund_code,
            'transaction_type': t.transaction_type,
            'transaction_date': t.transaction_date,
            'transaction_net_value': t.transaction_net_value,
            'transaction_shares': t.transaction_shares,
            'transaction_fee': t.transaction_fee,
            'transaction_amount': t.transaction_amount
        } for t in results]
        return data
