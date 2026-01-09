import logging

from flask import Blueprint

from app.framework.res import Res
from app.service.holding_analytics_snapshot_service import HoldingAnalyticsSnapshotService

logger = logging.getLogger(__name__)

holding_analytics_snapshot_bp = Blueprint('holding_analytics_snapshot', __name__, url_prefix='/api/holding_analytics_snapshot')


@holding_analytics_snapshot_bp.route('/generate_analysis', methods=['GET'])
def remake_all():
    flag1 = HoldingAnalyticsSnapshotService.generate_all_snapshots()
    return Res.success() if flag1 else Res.fail()
