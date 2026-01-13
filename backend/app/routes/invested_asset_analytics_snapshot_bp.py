import logging
from flask import Blueprint, jsonify, request
from app.framework.res import Res
from app.service.invested_asset_analytics_snapshot_service import InvestedAssetAnalyticsSnapshotService

logger = logging.getLogger(__name__)

invested_asset_analytics_snapshot_bp = Blueprint('invested_asset_analytics_snapshot', __name__, url_prefix='/api/invested_asset_analytics_snapshot')


@invested_asset_analytics_snapshot_bp.route('/remake_all', methods=['GET'])
def remake_all():
    data = InvestedAssetAnalyticsSnapshotService.regenerate_all()
    return Res.success(data)
