import logging

from flask import Blueprint, g

from app.framework.auth import auth_required
from app.framework.res import Res
from app.service.invested_asset_snapshot_service import InvestedAssetSnapshotService

logger = logging.getLogger(__name__)

invested_asset_snapshot_bp = Blueprint('invested_asset_snapshot', __name__, url_prefix='/api/invested_asset_snapshot')


@invested_asset_snapshot_bp.route('/remake_all', methods=['GET'])
@auth_required
def remake_all():
    data = InvestedAssetSnapshotService.regenerate_all(g.user.id)
    return Res.success(data)
