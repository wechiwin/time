# app/scheduler/batch_update_benchmark_metrics.py
from datetime import date, timedelta
from loguru import logger

from app.framework.system_task_wrapper import with_task_logging
from app.service.benchmark_service import BenchmarkService


@with_task_logging("batch_update_benchmark_metrics")
def batch_update_all_benchmark_metrics():
    """
    Batch update benchmark metrics for InvestedAssetAnalyticsSnapshot.
    This job runs daily after benchmark data sync to update alpha/beta/excess_return.
    """
    logger.info('[batch_update_benchmark_metrics] Job started')

    # Calculate metrics for the past year (rolling window)
    end_date = date.today()
    start_date = end_date - timedelta(days=365)

    try:
        result = BenchmarkService.batch_update_benchmark_metrics(
            start_date=start_date,
            end_date=end_date
        )

        logger.info(f'[batch_update_benchmark_metrics] Job completed: {result}')
        return result

    except Exception as e:
        logger.error(f'[batch_update_benchmark_metrics] Job failed: {e}')
        raise
