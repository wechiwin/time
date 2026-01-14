import logging

from flask import Blueprint

from app.framework.res import Res
from app.service.benchmark_service import BenchmarkService

logger = logging.getLogger(__name__)

benchmark_bp = Blueprint('benchmark', __name__, url_prefix='/api/benchmark')


@benchmark_bp.route('/sync', methods=['GET'])
def sync_benchmark():
    try:
        BenchmarkService.sync_benchmark_data()
        return Res.success()
    except Exception as e:
        return Res.fail(str(e))


@benchmark_bp.route('/update_iaas', methods=['GET'])
def update_iaas():
    try:
        BenchmarkService.batch_update_benchmark_metrics()
        return Res.success()
    except Exception as e:
        return Res.fail(str(e))
