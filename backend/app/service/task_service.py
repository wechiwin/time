# app/services/job_service.py
from loguru import logger

from app.calendars.trade_calendar import trade_calendar
from app.models import db, UserSetting
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
        # 查询用户
        if user_id:
            user_list = UserSetting.query.filter(UserSetting.id == user_id).all()
        else:
            user_list = UserSetting.query.all()

        try:
            for user in user_list:
                HoldingSnapshotService.generate_all_holding_snapshots(user_id=user.id)

                HoldingAnalyticsSnapshotService.generate_all_holding_snapshot_analytics(user_id=user.id)
                HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(user_id=user.id)

                InvestedAssetSnapshotService.regenerate_all(user_id)

                InvestedAssetAnalyticsSnapshotService.regenerate_for_user(user_id)

        except Exception as e:
            db.session.rollback()
            logger.exception(f"执行快照任务失败: {str(e)}", exc_info=True)

    @classmethod
    def generate_yesterday_snapshot(cls, user_id: int):
        """
        增量执行快照任务
        """
        trade_calendar.prev_trade_day()
        try:
            HoldingSnapshotService.generate_yesterday_snapshots(user_id=user_id)
            HoldingAnalyticsSnapshotService.generate_yesterday_analytics(user_id=user_id)
            HoldingAnalyticsSnapshotService.update_position_ratios_and_contributions(user_id=user_id)
            InvestedAssetSnapshotService.generate_by_day(user_id=user_id)
            InvestedAssetAnalyticsSnapshotService.generate_by_day(user_id=user_id)
        except Exception as e:
            db.session.rollback()
            logger.exception(f"执行快照任务失败: {str(e)}", exc_info=True)
