import re
from datetime import datetime, date, time
from decimal import Decimal
from email.policy import default

from flask import current_app as app
from passlib.exc import InvalidHashError
from passlib.hash import pbkdf2_sha256
from sqlalchemy import inspect

from app.constant.biz_enums import HoldingTypeEnum, HoldingStatusEnum, AlertEmailStatusEnum, AlertRuleActionEnum, TradeTypeEnum, FundTradeMarketEnum, TaskStatusEnum
from app.database import db


class BaseModel(db.Model):
    __abstract__ = True

    # 可配置：全局敏感字段名（正则匹配，防漏）
    _REPR_SENSITIVE_FIELDS = {
        r".*password.*",
        r".*secret.*",
        r".*token.*",
        r".*key.*",
        r".*hash.*",
        r".*credential.*",
    }

    def __repr__(self):
        # 1. 获取模型类信息
        cls = self.__class__
        mapper = inspect(cls)
        pk_attrs = [pk.name for pk in mapper.primary_key]
        # 2. 收集所有 column 字段（排除 relationship & deferred）
        columns = [
            col for col in mapper.columns
            if not col.name.startswith("_")  # 跳过私有列（如 _sa_instance_state）
        ]

        # 3. 过滤敏感字段（正则匹配）
        def is_sensitive(name: str) -> bool:
            return any(re.search(pattern, name, re.IGNORECASE) for pattern in self._REPR_SENSITIVE_FIELDS)

        # 4. 构建 key=value 列表
        parts = []
        for col in columns:
            name = col.name
            if is_sensitive(name):
                parts.append(f"{name}=<REDACTED>")
                continue
            value = getattr(self, name)
            # 格式化常见类型（避免 repr(b'...') 或超长 datetime）
            if isinstance(value, (datetime, date, time)):
                value = value.isoformat()
            elif isinstance(value, Decimal):
                value = float(value)  # 或 str(value) 保留精度
            elif isinstance(value, bytes):
                value = f"<{len(value)} bytes>"
            elif value is None:
                value = "None"
            else:
                # 对字符串做截断（防日志爆炸）
                if isinstance(value, str) and len(value) > 60:
                    value = f"{value[:57]}..."
            parts.append(f"{name}={value!r}")
        # 5. 优先显示主键（更符合直觉）
        pk_parts = [p for p in parts if p.split("=", 1)[0] in pk_attrs]
        non_pk_parts = [p for p in parts if p not in pk_parts]
        all_parts = pk_parts + non_pk_parts
        fields_str = ", ".join(all_parts)
        return f"<{cls.__name__}({fields_str})>"


class TimestampMixin:
    """
    混入类：为继承它的所有模型统一增加
    created_at 和 updated_at 两个时间戳字段
    """
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.current_timestamp(),
                           onupdate=db.func.current_timestamp(), nullable=False)


class Holding(TimestampMixin, BaseModel):
    """
    持仓统一信息表
    """
    __tablename__ = 'holding'

    id = db.Column(db.Integer, primary_key=True)
    ho_code = db.Column(db.String(50), nullable=False)  # 交易代码，如 AAPL, 000001
    ho_name = db.Column(db.String(100), nullable=False)  # 名称
    ho_short_name = db.Column(db.String(100))  # 简称
    ho_nickname = db.Column(db.String(100))  # 自定义别称
    ho_type = db.Column(db.String(50), nullable=False)  # 持仓类型枚举(目前只有场外基金) FUND STOCK
    ho_status = db.Column(db.String(50), nullable=False)  # 持仓状态：0,未持仓;1,持仓中；2.已清仓
    # exchange = db.Column(db.String(100))  # 交易所，如 NASDAQ, SZSE。
    currency = db.Column(db.String(50))  # 计价货币枚举，如 USD, CNY。
    establishment_date = db.Column(db.Date)  # 成立日期
    # company = db.Column(db.String(100))
    # industry = db.Column(db.String(100))  # 行业分类 (对股票和行业基金有用)
    # Relationships
    fund_detail = db.relationship('FundDetail', back_populates='holding', uselist=False,
                                  cascade="all, delete-orphan")
    # stock_detail = db.relationship('StockDetail', back_populates='holding', uselist=False,
    #                                cascade="all, delete-orphan")


class FundDetail(TimestampMixin, BaseModel):
    """
    基金详情表
    """
    __tablename__ = 'fund_detail'

    id = db.Column(db.Integer, primary_key=True)
    ho_id = db.Column(db.Integer, db.ForeignKey('holding.id'), nullable=False, unique=True)
    fund_type = db.Column(db.String(50))  # 基金类型(股票型/债券型/混合型)
    risk_level = db.Column(db.Integer)  # 风险等级(1-5)
    trade_market = db.Column(db.String(50))  # 交易市场枚举:场内/场外
    manage_exp_rate = db.Column(db.Numeric(8, 4))  # 管理费率%
    trustee_exp_rate = db.Column(db.Numeric(8, 4))  # 托管费率%
    sales_exp_rate = db.Column(db.Numeric(8, 4))  # 销售费率%
    company_id = db.Column(db.String(50))  # 基金公司ID
    company_name = db.Column(db.String(200))  # 基金公司名称
    fund_manager = db.Column(db.String(50))  # 基金经理
    dividend_method = db.Column(db.String(50))  # 分红方式
    index_code = db.Column(db.String(50))  # 跟踪的指数代码
    index_name = db.Column(db.String(200))  # 跟踪的指数名称
    feature = db.Column(db.String(200))  # 特性标签，如 030,031,050

    # Relationships
    holding = db.relationship('Holding', back_populates='fund_detail')


class FundNavHistory(TimestampMixin, BaseModel):
    """
    基金净值历史表
    """
    __tablename__ = 'fund_nav_history'

    id = db.Column(db.Integer, primary_key=True)
    ho_id = db.Column(db.Integer, db.ForeignKey('holding.id'), index=True)
    ho_code = db.Column(db.String(50))
    nav_date = db.Column(db.Date)
    nav_per_unit = db.Column(db.Numeric(20, 4))  # 单位净值
    nav_accumulated_per_unit = db.Column(db.Numeric(20, 4))  # 累计净值=单位净值+分红
    nav_return = db.Column(db.Numeric(20, 4))  # 净值增长率（%）
    dividend_price = db.Column(db.Numeric(20, 6))  # 每份基金分红金额（元）

    __table_args__ = (
        db.UniqueConstraint('ho_id', 'nav_date', name='navh_ho_id_date_uk'),
    )

    holding = db.relationship(
        'Holding',
        backref=db.backref('fund_nav_history_list', lazy='dynamic'),
        foreign_keys=[ho_id]
    )


# class StockDetail(TimestampMixin, BaseModel):
#     """
#     股票详情表
#     """
#     __tablename__ = 'stock_detail'
#
#     id = db.Column(db.Integer, primary_key=True)
#     ho_id = db.Column(db.Integer, db.ForeignKey('holding.id'), nullable=False, unique=True)
#     pe_ratio = db.Column(db.Numeric(12, 4))  # 市盈率（PE）=	股价 / 每股收益，衡量估值
#     pb_ratio = db.Column(db.Numeric(12, 4))  # 市净率（PB）=	股价 / 每股净资产
#     eps = db.Column(db.Numeric(12, 4))  # 每股收益（EPS）	公司每股盈利
#     # Relationships
#     holding = db.relationship('Holding', back_populates='stock_detail')


# class StockPriceHistory(TimestampMixin, BaseModel):
#     __tablename__ = 'stock_price_history'
#     id = db.Column(db.Integer, primary_key=True)
#     stock_id = db.Column(db.Integer, db.ForeignKey('stock_detail.id'), nullable=False, index=True)
#     market_date = db.Column(db.Date)
#
#     open_price = db.Column(db.Numeric(20, 4))  # 开盘价
#     high_price = db.Column(db.Numeric(20, 4))  # 最高价
#     low_price = db.Column(db.Numeric(20, 4))  # 最低价
#     close_price = db.Column(db.Numeric(20, 4))  # 收盘价
#     volume = db.Column(db.BigInteger, nullable=True)  # 成交量
#     amount = db.Column(db.Numeric(20, 2), nullable=True)  # 成交额
#
#     change_amount = db.Column(db.Float, nullable=True)  # 涨跌额
#     change_percentage = db.Column(db.Float, comment='涨跌幅 (%)')
#     turnover_rate = db.Column(db.Float, nullable=True)  # 换手率
#     adj_close_price = db.Column(db.Numeric(20, 4), comment='后复权收盘价')
#     adj_factor = db.Column(db.Float, comment='复权因子')  # 中优先级
#
#     __table_args__ = (db.UniqueConstraint('stock_id', 'market_date', name='uq_stock_date'),)


class Trade(TimestampMixin, BaseModel):
    __tablename__ = 'trade'

    id = db.Column(db.Integer, primary_key=True)
    ho_id = db.Column(db.Integer, db.ForeignKey('holding.id'), index=True)
    ho_code = db.Column(db.String(50))

    tr_type = db.Column(db.String(50), nullable=False)  # 交易类型(买入/卖出/分红/拆分)
    tr_date = db.Column(db.Date, index=True, nullable=False)  # 交易日期
    tr_nav_per_unit = db.Column(db.Numeric(18, 4))  # 单位净值
    tr_shares = db.Column(db.Numeric(18, 2))  # 交易份额
    tr_net_amount = db.Column(db.Numeric(18, 2))  # 交易净额(不含交易费用)
    tr_fee = db.Column(db.Numeric(18, 2))  # 交易费用
    tr_amount = db.Column(db.Numeric(18, 2))  # 交易总额(含交易费用)
    tr_cycle = db.Column(db.Integer, index=True)  # 轮次
    is_cleared = db.Column(db.Boolean, default=False)  # 是否清仓
    remark = db.Column(db.String(200))

    holding = db.relationship(
        'Holding',
        backref=db.backref('trades', lazy='dynamic'),
        foreign_keys=[ho_id]
    )


class AlertRule(TimestampMixin, BaseModel):
    """
    监控规则表
    """
    __tablename__ = 'alert_rule'
    id = db.Column(db.Integer, primary_key=True)
    ho_id = db.Column(db.Integer, index=True)
    ho_code = db.Column(db.String(50))
    ar_name = db.Column(db.String(200))  # 名称
    action = db.Column(db.Enum(AlertRuleActionEnum), nullable=False)  # 提醒类型：1.买入/2.加仓/0.卖出
    target_navpu = db.Column(db.Numeric(18, 4))  # 目标单位净值
    tracked_date = db.Column(db.Date)  # 已追踪日期
    ar_is_active = db.Column(db.Integer)  # 是否激活:1.是;0.否


class AlertHistory(TimestampMixin, BaseModel):
    """
    监控历史表
    """
    __tablename__ = 'alert_history'
    id = db.Column(db.Integer, primary_key=True)
    ar_id = db.Column(db.Integer, index=True)
    ho_id = db.Column(db.Integer, index=True)
    ho_code = db.Column(db.String(50))
    ar_name = db.Column(db.String(100))  # 提醒名称
    action = db.Column(db.Enum(AlertRuleActionEnum), nullable=False)  # 提醒类型：1.买入/2.加仓/0.卖出
    trigger_navpu = db.Column(db.Float)  # 触发单位净值
    trigger_nav_date = db.Column(db.Date)  # 触发净值日
    target_navpu = db.Column(db.Float)  # 目标单位净值
    send_status = db.Column(db.Enum(AlertEmailStatusEnum), nullable=False)  # 发送状态:0:'pending', 1:'sent', 2:'failed'
    sent_time = db.Column(db.DateTime)  # 发送时间
    remark = db.Column(db.String(2000))  # 备注


class UserSetting(TimestampMixin, BaseModel):
    """
    用户设置表
    """
    __tablename__ = 'user_setting'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(128), unique=True, nullable=False)
    pwd_hash = db.Column(db.String(128))
    default_lang = db.Column(db.String(20))
    email_address = db.Column(db.String(50))

    @staticmethod
    def hash_password(raw_password):
        return pbkdf2_sha256.hash(raw_password)

    @staticmethod
    def verify_password(raw_password, hashed):
        try:
            # 检查哈希值是否有效
            if not hashed or not isinstance(hashed, str):
                app.logger.warning("Empty or invalid hash provided")
                return False

            # 检查哈希格式是否正确
            if not hashed.startswith('$pbkdf2-sha256$'):
                app.logger.warning(f"Unexpected hash format: {hashed}")
                return False

            return pbkdf2_sha256.verify(raw_password, hashed)

        except InvalidHashError:
            app.logger.error(f"Invalid hash format for password verification")
            return False

        except Exception as e:
            app.logger.error(f"Unexpected error in password verification: {str(e)}")
            return False


class TokenBlacklist(TimestampMixin, BaseModel):
    __tablename__ = 'token_blacklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(10), nullable=False)  # 'access' or 'refresh'
    expires_at = db.Column(db.DateTime, nullable=False)  # 过期时间


class HoldingSnapshot(TimestampMixin, BaseModel):
    __tablename__ = 'holding_snapshot'

    id = db.Column(db.Integer, primary_key=True)

    ho_id = db.Column(db.Integer)
    snapshot_date = db.Column(db.Date, nullable=False, index=True)
    # -------- Position --------
    holding_shares = db.Column(db.Numeric(18, 4))  # 持仓份额
    cost_price = db.Column(db.Numeric(18, 4))  # 当前持仓成本单价:加权平均成本=holding_cost/holding_shares
    holding_cost = db.Column(db.Numeric(18, 4))  # 当前持仓成本 = 成本单价 * 持仓份额

    # -------- Price / Value --------
    market_price = db.Column(db.Numeric(18, 4))  # 单位净值
    hos_market_value = db.Column(db.Numeric(18, 4))  # 总市值 = 持仓份额 * 单位净值

    # -------- Cash / Cost --------
    hos_total_cost = db.Column(db.Numeric(18, 4))  # 历史累计投入总成本 = Σ(买入金额)
    hos_total_sell_cash = db.Column(db.Numeric(18, 4))  # 累计卖出回款
    hos_net_cash_flow = db.Column(db.Numeric(18, 2))  # 当日净现金流：买入为负，卖出/分红为正

    # -------- PnL --------
    hos_realized_pnl = db.Column(db.Numeric(18, 4))  # 已实现盈亏 = （卖出单位净值 - 成本单价） * 卖出份额
    hos_unrealized_pnl = db.Column(db.Numeric(18, 4))  # 未实现盈亏 = hos_market_value - holding_cost
    hos_total_pnl = db.Column(db.Numeric(18, 4))  # 累计盈亏 = 已实现盈亏 + 未实现盈亏

    # -------- Return --------
    hos_daily_pnl = db.Column(db.Numeric(18, 4))  # 当日盈亏 = 当日市值 - 昨日市值 - 当日净现金流
    hos_daily_pnl_ratio = db.Column(db.Numeric(18, 4))  # 当日盈亏率 = (hos_daily_pnl / 昨日市值) × 100%
    hos_total_pnl_ratio = db.Column(db.Numeric(18, 4))  # 累计盈亏率 = (hos_total_pnl / 总成本) × 100%

    # -------- Other --------
    dividend_amount = db.Column(db.Numeric(18, 4))  # 分红收益

    __table_args__ = (
        db.Index('holding_snapshot_ho_id_snapshot_date_index', 'ho_id', 'snapshot_date'),
    )


class HoldingAnalyticsSnapshot(TimestampMixin, BaseModel):
    """
    分析 / 展示 / 研究专用 Snapshot
    不参与账务与PnL强一致计算
    """

    __tablename__ = 'holding_analytics_snapshot'

    id = db.Column(db.Integer, primary_key=True)

    ho_id = db.Column(db.Integer, index=True)
    snapshot_date = db.Column(db.Date, nullable=False, index=True)

    # ---------- Path-dependent Metrics ----------
    # has_holding_days = db.Column(db.Integer)
    has_peak_market_value = db.Column(db.Numeric(18, 4))
    has_trough_market_value = db.Column(db.Numeric(18, 4))

    # ---------- Drawdown / Run-up ----------
    has_max_drawdown = db.Column(db.Numeric(18, 4))
    has_max_drawdown_days = db.Column(db.Integer)

    has_max_profit_ratio = db.Column(db.Numeric(18, 4))  # 最大盈利比例 = (历史最高市值 - 当前市值) / 历史最高市值
    has_max_profit_value = db.Column(db.Numeric(18, 4))

    # ---------- Volatility / Return ----------
    has_daily_return = db.Column(db.Numeric(18, 6))
    has_return_volatility = db.Column(db.Numeric(18, 6))

    # ---------- Allocation / Exposure ----------
    has_position_ratio = db.Column(db.Numeric(18, 4))  # 持仓比例 = 某一持仓市值 / 组合总市值
    has_portfolio_contribution = db.Column(db.Numeric(18, 4))

    # ---------- Corporate Action ----------
    has_total_dividend = db.Column(db.Numeric(18, 4))

    # ---------- Meta ----------
    has_calc_version = db.Column(db.String(20))
    has_calc_comment = db.Column(db.String(255))


class PortfolioSnapshot(TimestampMixin, BaseModel):
    """
    投资组合快照表（账户水位表）
    用于记录用户在特定日期的账户总市值和外部现金流，
    是计算总持仓收益率（IRR/TWRR）的核心数据源。
    """
    __tablename__ = 'portfolio_snapshot'

    id = db.Column(db.Integer, primary_key=True)

    snapshot_date = db.Column(db.Date, nullable=False, index=True)  # 快照日期，通常为每日收盘后。YYYY-MM-DD 格式。
    pos_market_value = db.Column(db.Numeric(20, 4), nullable=False)  # 持仓的总市值 = Σ (持仓数量 × 当日收盘价)

    # 当日发生的净外部现金流，计算 IRR 的关键。
    # 买入证券（现金->证券）为负数，卖出证券（证券->现金）为正数。无流动则为0。
    # 例如：用户买入 1000 元，记录为 -1000.00；用户卖出 500 元，记录为 500.00
    pos_net_cash_flow = db.Column(db.Numeric(20, 2), default=0)
    # 收益
    pos_total_cost = db.Column(db.Numeric(18, 4))  # 截止当日的总投入成本
    pos_total_pnl = db.Column(db.Numeric(18, 4))  # 截止当日的累计盈亏
    pos_total_pnl_ratio = db.Column(db.Numeric(18, 4))  # 截止当日的累计盈亏率
    pos_daily_pnl = db.Column(db.Numeric(18, 4))  # 当日盈亏
    pos_daily_pnl_ratio = db.Column(db.Numeric(18, 4))  # 当日盈亏
    # 指标
    pos_twrr = db.Column(db.Numeric(18, 6))  # 时间加权收益率。标准业绩基准。消除了资金流入流出的影响，纯粹衡量投资组合本身的“增长”表现。计算方法是分段计算收益率再复合。基金公司公布的收益率就是TWRR。
    pos_irr = db.Column(db.Numeric(18, 6))  # 内部收益率 / 资金加权收益率。个人投资者的真实回报率。它考虑了资金流入流出的时机和大小。如果你在市场高点投入大笔资金，IRR会很低；反之则高。这是衡量你个人投资决策（何时买卖）能力的最佳指标。
    pos_peak_market_value = db.Column(db.Numeric(18, 4))  # 截至当日的历史市值峰值
    pos_max_drawdown = db.Column(db.Numeric(18, 4))  # 历史最大回撤（截至当天）
    pos_volatility = db.Column(db.Numeric(18, 4))  # 波动率
    pos_sharpe_ratio = db.Column(db.Numeric(18, 4))  # 夏普比率。核心风险调整后收益指标。(组合年化收益率 - 无风险利率) / 组合年化波动率。衡量每承担一单位风险，能获得多少超额回报。越高越好。
    # Benchmark
    excess_return = db.Column(db.Numeric(18, 6))  # 超额收益。组合收益率 - 基准收益率。衡量你跑赢（或跑输）市场基准（如沪深300）的程度。


class Benchmark(TimestampMixin, BaseModel):
    __tablename__ = 'benchmark'
    id = db.Column(db.Integer, primary_key=True)
    bm_code = db.Column(db.String(20), unique=True, nullable=False)  # e.g., '000300.SH'
    bm_name = db.Column(db.String(100), nullable=False)  # e.g., '沪深300'


class BenchmarkHistory(TimestampMixin, BaseModel):
    __tablename__ = 'benchmark_history'
    id = db.Column(db.Integer, primary_key=True)
    bm_id = db.Column(db.Integer, nullable=False)
    bmh_date = db.Column(db.Date, nullable=False)
    bmh_close_price = db.Column(db.Numeric(18, 4), nullable=False)  # 收盘点位
    bmh_return = db.Column(db.Numeric(18, 6))
    benchmark_return_daily = db.Column(db.Numeric(18, 6))


class AsyncTaskLog(TimestampMixin, BaseModel):
    __tablename__ = 'async_task_log'
    id = db.Column(db.Integer, primary_key=True)
    # 任务类型，可以是一个友好的名字，如 'Full Snapshot Generation'
    task_name = db.Column(db.String(150), nullable=False, index=True)
    # params 现在存储用于反射调用的所有信息
    # {
    #   "module_path": "app.service.holding_snapshot_service",
    #   "class_name": "HoldingSnapshotService",
    #   "method_name": "generate_all_holding_snapshots",
    #   "args": [],
    #   "kwargs": {"ids": ["id1", "id2"]}
    # }
    params = db.Column(db.JSON, nullable=False)
    status = db.Column(db.Enum(TaskStatusEnum), nullable=False, default=TaskStatusEnum.PENDING, index=True)
    result_summary = db.Column(db.Text)
    error_message = db.Column(db.Text)
    max_retries = db.Column(db.Integer, default=3, nullable=False)
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    next_retry_at = db.Column(db.DateTime, nullable=True, index=True)
