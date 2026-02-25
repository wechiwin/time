# app/scheduler/sync_benchmark_data.py
from loguru import logger

from app.framework.system_task_wrapper import with_task_logging
from app.models import Benchmark
from app.service.benchmark_service import BenchmarkService


@with_task_logging("sync_benchmark_data")
def sync_all_benchmark_data():
    """
    Sync benchmark history data for all benchmarks.
    This job runs daily to fetch the latest benchmark prices.
    """
    logger.info('[sync_benchmark_data] Job started')

    benchmarks = Benchmark.query.all()
    if not benchmarks:
        logger.info('[sync_benchmark_data] No benchmarks found')
        return {'synced': 0, 'errors': []}

    errors = []
    synced = 0

    for bm in benchmarks:
        try:
            BenchmarkService.sync_benchmark_data(bm_code=bm.bm_code)
            synced += 1
            logger.info(f'[sync_benchmark_data] Synced {bm.bm_code} successfully')
        except Exception as e:
            error_msg = f'{bm.bm_code}: {str(e)}'
            errors.append(error_msg)
            logger.error(f'[sync_benchmark_data] Failed to sync {bm.bm_code}: {e}')

    result = {'synced': synced, 'total': len(benchmarks), 'errors': errors}
    logger.info(f'[sync_benchmark_data] Job completed: {result}')
    return result
