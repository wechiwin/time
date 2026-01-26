import logging
from flask import Blueprint, jsonify, request, g

from app.framework.auth import auth_required
from app.framework.res import Res
from app.service.invested_asset_analytics_snapshot_service import InvestedAssetAnalyticsSnapshotService

logger = logging.getLogger(__name__)

invested_asset_analytics_snapshot_bp = Blueprint('invested_asset_analytics_snapshot', __name__, url_prefix='/invested_asset_analytics_snapshot')


@invested_asset_analytics_snapshot_bp.route('/remake_all', methods=['GET'])
@auth_required
def remake_all():
    data = InvestedAssetAnalyticsSnapshotService.regenerate_all(g.user.id)
    return Res.success(data)
