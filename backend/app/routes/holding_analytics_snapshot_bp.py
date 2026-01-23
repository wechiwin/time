import logging

from flask import Blueprint

from app.framework.auth import auth_required
from app.framework.res import Res
from app.service.holding_analytics_snapshot_service import HoldingAnalyticsSnapshotService

logger = logging.getLogger(__name__)

holding_analytics_snapshot_bp = Blueprint('holding_analytics_snapshot', __name__, url_prefix='/api/holding_analytics_snapshot')


@holding_analytics_snapshot_bp.route('/generate_analysis', methods=['GET'])
@auth_required
def remake_all():
    data = HoldingAnalyticsSnapshotService.generate_all_analytics()
    return Res.success(data)


@holding_analytics_snapshot_bp.route('/update_ratios', methods=['GET'])
@auth_required
def update_ratios():
    data = HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions()
    return Res.success(data)
