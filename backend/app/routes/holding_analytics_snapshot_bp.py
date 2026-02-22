from datetime import date
from flask import Blueprint, g

from app.calendars.trade_calendar import trade_calendar
from app.framework.auth import auth_required
from app.framework.res import Res
from app.models import db, HoldingSnapshot, Trade, HoldingAnalyticsSnapshot
from app.service.holding_analytics_snapshot_service import HoldingAnalyticsSnapshotService

holding_analytics_snapshot_bp = Blueprint('holding_analytics_snapshot', __name__, url_prefix='/holding_analytics_snapshot')


@holding_analytics_snapshot_bp.route('/generate_analysis', methods=['GET'])
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

    # 生成分析快照
    snapshots = HoldingAnalyticsSnapshotService.generate_analytics(
        user_id=g.user.id,
        start_date=start_date,
        end_date=end_date
    )

    if snapshots:
        # 删除旧数据
        db.session.query(HoldingAnalyticsSnapshot).filter(
            HoldingAnalyticsSnapshot.user_id == g.user.id
        ).delete(synchronize_session=False)
        db.session.bulk_save_objects(snapshots)
        db.session.commit()

    # 更新仓位占比
    HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(
        user_id=g.user.id,
        start_date=start_date,
        end_date=end_date
    )

    return Res.success({"generated": len(snapshots) if snapshots else 0})


@holding_analytics_snapshot_bp.route('/update_ratios', methods=['GET'])
@auth_required
def update_ratios():
    data = HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(user_id=g.user.id)
    return Res.success(data)
