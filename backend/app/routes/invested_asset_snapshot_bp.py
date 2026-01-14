import logging
from flask import Blueprint, jsonify, request
from app.framework.res import Res
from app.service.invested_asset_snapshot_service import InvestedAssetSnapshotService

logger = logging.getLogger(__name__)

invested_asset_snapshot_bp = Blueprint('invested_asset_snapshot', __name__, url_prefix='/api/invested_asset_snapshot')


@invested_asset_snapshot_bp.route('/remake_all', methods=['GET'])
def remake_all():
    data = InvestedAssetSnapshotService.regenerate_all()
    return Res.success(data)
