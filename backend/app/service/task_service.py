# app/services/job_service.py
from datetime import date

from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.constant.biz_enums import TaskStatusEnum
from app.models import db, UserSetting, Trade, HoldingAnalyticsSnapshot, AsyncTaskLog
from app.service.holding_analytics_snapshot_service import HoldingAnalyticsSnapshotService
from app.service.holding_snapshot_service import HoldingSnapshotService
from app.service.invested_asset_analytics_snapshot_service import InvestedAssetAnalyticsSnapshotService
from app.service.invested_asset_snapshot_service import InvestedAssetSnapshotService
from app.service.benchmark_service import BenchmarkService


class TaskService:

    @classmethod
    def redo_all_snapshot(cls, user_id: int):
        """
        重新执行所有的快照任务
        """
        if user_id:
            user_list = UserSetting.query.filter(UserSetting.id == user_id).all()
        else:
            user_list = UserSetting.query.all()

        try:
            for user in user_list:
                # 计算日期范围：从最早的交易日期到今天
                earliest_trade = Trade.query.filter(Trade.user_id == user.id).order_by(Trade.tr_date).first()
                if earliest_trade:
                    start_date = earliest_trade.tr_date
                else:
                    start_date = date.today()

                end_date = trade_calendar.prev_trade_day(date.today())

                # Holding Snapshot
                HoldingSnapshotService.generate_snapshots(
                    user_id=user.id,
                    start_date=start_date,
                    end_date=end_date
                )

                # Holding Analytics
                snapshots = HoldingAnalyticsSnapshotService.generate_analytics(
                    user_id=user.id,
                    start_date=start_date,
                    end_date=end_date
                )
                if snapshots:
                    # 删除旧数据
                    db.session.query(HoldingAnalyticsSnapshot).filter(
                        HoldingAnalyticsSnapshot.user_id == user.id
                    ).delete(synchronize_session=False)
                    db.session.bulk_save_objects(snapshots)
                    db.session.commit()

                # Invested Asset Snapshot
                InvestedAssetSnapshotService.generate_snapshots(
                    user_id=user.id,
                    start_date=start_date,
                    end_date=end_date
                )

                # Invested Asset Analytics
                InvestedAssetAnalyticsSnapshotService.generate_analytics(
                    user_id=user.id,
                    start_date=start_date,
                    end_date=end_date
                )

                # Update position ratios
                HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(
                    user_id=user.id,
                    start_date=start_date,
                    end_date=end_date
                )

        except Exception as e:
            db.session.rollback()
            logger.exception(f"执行快照任务失败: {str(e)}")

    @classmethod
    def generate_yesterday_snapshot(cls, user_id: int):
        """
        增量执行快照任务
        """
        prev_date = trade_calendar.prev_trade_day()
        try:
            # Holding Snapshot
            HoldingSnapshotService.generate_snapshots(
                user_id=user_id,
                start_date=prev_date,
                end_date=prev_date
            )

            # Holding Analytics
            snapshots = HoldingAnalyticsSnapshotService.generate_analytics(
                user_id=user_id,
                start_date=prev_date,
                end_date=prev_date
            )
            if snapshots:
                from app.models import HoldingAnalyticsSnapshot
                db.session.query(HoldingAnalyticsSnapshot).filter(
                    HoldingAnalyticsSnapshot.user_id == user_id,
                    HoldingAnalyticsSnapshot.snapshot_date == prev_date
                ).delete(synchronize_session=False)
                db.session.bulk_save_objects(snapshots)
                db.session.commit()

            # Invested Asset Snapshot
            InvestedAssetSnapshotService.generate_snapshots(
                user_id=user_id,
                start_date=prev_date,
                end_date=prev_date
            )

            # Invested Asset Analytics
            InvestedAssetAnalyticsSnapshotService.generate_analytics(
                user_id=user_id,
                start_date=prev_date,
                end_date=prev_date
            )

            # Update position ratios
            HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(
                user_id=user_id,
                start_date=prev_date,
                end_date=prev_date
            )

        except Exception as e:
            db.session.rollback()
            logger.exception(f"执行快照任务失败: {str(e)}")

    @classmethod
    def calculate_all(cls, user_id: int, start_date: date = None, end_date: date = None) -> int:
        """
        Execute all calculation tasks in sequence:
        1. redo_all_snapshot - regenerate all snapshots
        2. sync_benchmark_data - sync benchmark historical data
        3. batch_update_benchmark_metrics - update benchmark-related metrics

        Args:
            user_id: User ID
            start_date: Start date for calculations (optional, defaults to earliest trade date)
            end_date: End date for calculations (optional, defaults to previous trade day)

        Returns:
            task_id: The ID of the created AsyncTaskLog record
        """
        # Calculate default dates if not provided
        # if not start_date or not end_date:
        #     earliest_trade = Trade.query.filter(Trade.user_id == user_id).order_by(Trade.tr_date).first()
        #     if earliest_trade:
        #         default_start = earliest_trade.tr_date
        #     else:
        #         default_start = date.today()
        #     default_end = trade_calendar.prev_trade_day(date.today())
        #
        #     start_date = start_date or default_start
        #     end_date = end_date or default_end

        # Create task log record
        task_log = AsyncTaskLog(
            user_id=user_id,
            task_name="Calculate all",
            status=TaskStatusEnum.RUNNING.value,
            params='',
            max_retries=1,
            retry_count=0,
            business_key=f"calculate_all:user_{user_id}"
        )
        db.session.add(task_log)
        db.session.commit()
        task_id = task_log.id

        try:
            logger.info(f"Starting calculate_all")

            # Step 1: Redo all snapshots
            cls.redo_all_snapshot(user_id)
            logger.info(f"Completed redo_all_snapshot")

            # Step 2: Sync benchmark data
            BenchmarkService.sync_benchmark_data()
            logger.info("Completed sync_benchmark_data")

            # Step 3: Batch update benchmark metrics
            BenchmarkService.batch_update_benchmark_metrics()
            logger.info(f"Completed batch_update_benchmark_metrics")

            # Update task log to SUCCESS
            task_log.status = TaskStatusEnum.SUCCESS.value
            task_log.result_summary = f"Successfully completed: snapshots regenerated, benchmark data synced)"
            db.session.commit()

            logger.info(f"calculate_all completed successfully")

            return task_id

        except Exception as e:
            db.session.rollback()
            logger.exception(f"calculate_all failed: {str(e)}")

            # Update task log to FAILED
            task_log = AsyncTaskLog.query.get(task_id)
            if task_log:
                task_log.status = TaskStatusEnum.FAILED.value
                task_log.error_message = str(e)
                db.session.commit()

            raise
