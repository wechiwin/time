from datetime import date
from flask import Blueprint, g

from app.calendars.trade_calendar import trade_calendar
from app.framework.auth import auth_required
from app.framework.res import Res
from app.models import db, HoldingSnapshot, Trade
from app.service.invested_asset_snapshot_service import InvestedAssetSnapshotService

invested_asset_snapshot_bp = Blueprint('invested_asset_snapshot', __name__, url_prefix='/invested_asset_snapshot')


@invested_asset_snapshot_bp.route('/remake_all', methods=['GET'])
@auth_required
def remake_all():
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

    data = InvestedAssetSnapshotService.generate_snapshots(
        user_id=g.user.id,
        start_date=start_date,
        end_date=end_date
    )
    return Res.success(data)
