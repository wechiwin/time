from flask import Blueprint, g

from app.framework.auth import auth_required
from app.framework.res import Res
from app.service.invested_asset_analytics_snapshot_service import InvestedAssetAnalyticsSnapshotService

invested_asset_analytics_snapshot_bp = Blueprint('invested_asset_analytics_snapshot', __name__, url_prefix='/invested_asset_analytics_snapshot')


@invested_asset_analytics_snapshot_bp.route('/remake_all', methods=['GET'])
@auth_required
def remake_all():
    data = InvestedAssetAnalyticsSnapshotService.regenerate_for_user(g.user.id)
    return Res.success(data)
