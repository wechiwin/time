# app/blueprints/holding_snapshot_bp.py
from flask import Blueprint, request

from app.framework.auth import auth_required
from app.framework.res import Res
from app.models import db, HoldingSnapshot, Holding
from app.schemas_marshall import HoldingSnapshotSchema
from app.service.holding_snapshot_service import HoldingSnapshotService

holding_snapshot_bp = Blueprint('holding_snapshot', __name__, url_prefix='/api/holding_snapshot')
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
def generate_all_snapshots():
    data = HoldingSnapshotService.generate_all_holding_snapshots()
    return Res.success(data)
