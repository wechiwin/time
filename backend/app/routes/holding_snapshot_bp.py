# app/blueprints/holding_snapshot_bp.py
from datetime import date
from flask import Blueprint, request, g

from app.calendars.trade_calendar import trade_calendar
from app.framework.auth import auth_required
from app.framework.res import Res
from app.models import db, HoldingSnapshot, Holding, Trade
from app.schemas_marshall import HoldingSnapshotSchema
from app.service.holding_snapshot_service import HoldingSnapshotService

holding_snapshot_bp = Blueprint('holding_snapshot', __name__, url_prefix='/holding_snapshot')
schema = HoldingSnapshotSchema()


@holding_snapshot_bp.route('', methods=['GET'])
@auth_required
def get_snapshots():
    ho_id = request.args.get('ho_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    query = db.session.query(HoldingSnapshot, Holding.ho_name.label('ho_short_name')) \
        .join(Holding, HoldingSnapshot.ho_id == Holding.id, isouter=True)

    if ho_id:
        query = query.filter(HoldingSnapshot.ho_id == ho_id)
    if start_date:
        query = query.filter(HoldingSnapshot.snapshot_date >= start_date)
    if end_date:
        query = query.filter(HoldingSnapshot.snapshot_date <= end_date)

    pagination = query.order_by(HoldingSnapshot.snapshot_date.desc()) \
        .paginate(page=page, per_page=per_page, error_out=False)

    items = [{
        **hs.__dict__,
        'ho_short_name': ho_short_name,
        '_sa_instance_state': None  # 清理 SQLAlchemy 属性
    } for hs, ho_short_name in pagination.items]

    return Res.success({
        'items': items,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': pagination.total,
            'pages': pagination.pages
        }
    })


@holding_snapshot_bp.route('/list_hos', methods=['POST'])
@auth_required
def list_hos():
    data = request.get_json()
    ho_id = data.get('ho_id')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    query = db.session.query(HoldingSnapshot)

    if ho_id:
        query = query.filter(HoldingSnapshot.ho_id == ho_id)
    if start_date:
        query = query.filter(HoldingSnapshot.snapshot_date >= start_date)
    if end_date:
        query = query.filter(HoldingSnapshot.snapshot_date <= end_date)

    results = query.order_by(HoldingSnapshot.snapshot_date.asc()).all()

    return Res.success(HoldingSnapshotSchema(many=True).dump(results))


@holding_snapshot_bp.route('/generate_all_snapshots', methods=['GET'])
@auth_required
def generate_all_snapshots():
    # 计算日期范围：从最早的持仓快照日期到昨天
    earliest = db.session.query(db.func.min(HoldingSnapshot.snapshot_date)).filter(
        HoldingSnapshot.user_id == g.user.id
    ).scalar()

    if earliest:
        start_date = earliest
    else:
        # 如果没有历史快照，从最早的交易日期开始
        earliest_trade = Trade.query.filter(Trade.user_id == g.user.id).order_by(Trade.tr_date).first()
        start_date = earliest_trade.tr_date if earliest_trade else date.today()

    end_date = trade_calendar.prev_trade_day(date.today())

    data = HoldingSnapshotService.generate_snapshots(
        user_id=g.user.id,
        start_date=start_date,
        end_date=end_date
    )
    return Res.success(data)


@holding_snapshot_bp.route('/remake_by_ho_id', methods=['POST'])
@auth_required
def remake_by_ho_id():
    data = request.get_json()
    ho_id = data.get('ho_id')

    # 获取该持仓的最早交易日期
    earliest_trade = Trade.query.filter(Trade.ho_id == ho_id).order_by(Trade.tr_date).first()
    if earliest_trade:
        start_date = earliest_trade.tr_date
    else:
        start_date = date.today()

    end_date = trade_calendar.prev_trade_day(date.today())

    data = HoldingSnapshotService.generate_snapshots(
        user_id=g.user.id,
        start_date=start_date,
        end_date=end_date,
        ids=[ho_id]
    )
    return Res.success(data)
