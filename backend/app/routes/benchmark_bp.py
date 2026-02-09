from flask import Blueprint

from app.framework.res import Res
from app.service.benchmark_service import BenchmarkService

benchmark_bp = Blueprint('benchmark', __name__, url_prefix='/benchmark')


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
