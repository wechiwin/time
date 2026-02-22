# app/services/job_service.py
from datetime import date

from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.models import db, UserSetting, Trade, HoldingAnalyticsSnapshot
from app.service.holding_analytics_snapshot_service import HoldingAnalyticsSnapshotService
from app.service.holding_snapshot_service import HoldingSnapshotService
from app.service.invested_asset_analytics_snapshot_service import InvestedAssetAnalyticsSnapshotService
from app.service.invested_asset_snapshot_service import InvestedAssetSnapshotService


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
