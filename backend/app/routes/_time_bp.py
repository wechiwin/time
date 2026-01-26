from flask import Blueprint

# 主 API 蓝图，负责 /time 前缀
time_bp = Blueprint('time', __name__, url_prefix='/time')

# 在这里导入并注册所有子蓝图
from .alert_bp import alert_bp
from .benchmark_bp import benchmark_bp
from .common_bp import common_bp
from .dashboard_bp import dashboard_bp
from .holding_analytics_snapshot_bp import holding_analytics_snapshot_bp
from .holding_bp import holding_bp
from .holding_snapshot_bp import holding_snapshot_bp
from .invested_asset_analytics_snapshot_bp import invested_asset_analytics_snapshot_bp
from .invested_asset_snapshot_bp import invested_asset_snapshot_bp
from .nav_history_bp import nav_history_bp
from .task_bp import task_log_bp
from .trade_bp import trade_bp
from .user_bp import user_setting_bp

time_bp.register_blueprint(user_setting_bp)
time_bp.register_blueprint(dashboard_bp)
time_bp.register_blueprint(holding_bp)
time_bp.register_blueprint(trade_bp)
time_bp.register_blueprint(nav_history_bp)
time_bp.register_blueprint(alert_bp)
time_bp.register_blueprint(holding_snapshot_bp)
time_bp.register_blueprint(common_bp)
time_bp.register_blueprint(holding_analytics_snapshot_bp)
time_bp.register_blueprint(invested_asset_snapshot_bp)
time_bp.register_blueprint(invested_asset_analytics_snapshot_bp)
time_bp.register_blueprint(benchmark_bp)
time_bp.register_blueprint(task_log_bp)
