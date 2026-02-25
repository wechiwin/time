from flask import Blueprint

from app.framework.res import Res
from app.models import Benchmark
from app.service.benchmark_service import BenchmarkService

benchmark_bp = Blueprint('benchmark', __name__, url_prefix='/benchmark')


@benchmark_bp.route('/list_benchmark', methods=['GET'])
def list_benchmark():
    """
    Get all available benchmarks for user selection.

    Returns:
        List of benchmarks with id, bm_code, and bm_name.
    """
    benchmarks = Benchmark.query.order_by(Benchmark.id).all()
    return Res.success([{
        'id': b.id,
        'bm_code': b.bm_code,
        'bm_name': b.bm_name
    } for b in benchmarks])


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
