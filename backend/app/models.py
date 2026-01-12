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
    gross_amount = db.Column(db.Numeric(18, 2))  # 交易本金(不计交易费用损益)
    tr_fee = db.Column(db.Numeric(18, 2))  # 交易费用
    tr_net_amount = db.Column(db.Numeric(18, 2))  # 交易净额(计交易费用损益)
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
    """
    单只持仓每日快照表
    记录该持仓在 当天 or 周期tr_cycle内 的状态、盈亏和资金变动。
    """
    __tablename__ = 'holding_snapshot'

    id = db.Column(db.Integer, primary_key=True)

    ho_id = db.Column(db.Integer)
    snapshot_date = db.Column(db.Date, nullable=False, index=True)

    # -------- Position --------
    holding_shares = db.Column(db.Numeric(18, 4))  # 持仓份额
    hos_holding_cost = db.Column(db.Numeric(18, 4))
    """
    当前持仓成本 = 上一日成本 + 今日买入金额 - 今日卖出结转成本
    """
    avg_cost = db.Column(db.Numeric(18, 4))  # 当前持仓成本单价:加权平均成本=hos_holding_cost/holding_shares

    # -------- Price / Value --------
    market_price = db.Column(db.Numeric(18, 4))  # 单位净值
    hos_market_value = db.Column(db.Numeric(18, 4))  # 总市值 = 持仓份额 * 单位净值

    # -------- Cash / Cost --------
    hos_total_buy_amount = db.Column(db.Numeric(18, 4))
    """
    累计投入总成本 = Σ(买入金额)
    """
    hos_total_sell_amount = db.Column(db.Numeric(18, 4))
    """
    累计卖出总额
    """
    hos_net_external_cash_flow = db.Column(db.Numeric(18, 2))
    """
    当日外部现金流：买入为负(现金->证券)，卖出为正(证券->现金)（不含分红）
    """
    # -------- PnL --------
    hos_realized_pnl = db.Column(db.Numeric(18, 4))
    """
    已实现盈亏 = （卖出单位净值 - 成本单价） * 卖出份额
    """
    hos_unrealized_pnl = db.Column(db.Numeric(18, 4))
    """
    未实现盈亏 = 当日市值 - 当前持仓成本
    """
    hos_daily_pnl = db.Column(db.Numeric(18, 4))
    """
    反映剔除现金流后的纯市场损益
    当日盈亏 = 当日市值 - 昨日市值 + 当日外部现金流(买负卖正)
    """
    hos_daily_pnl_ratio = db.Column(db.Numeric(18, 4))
    """
    当日盈亏率 = (当日盈亏 / 昨日市值) + 当日现金分红
    """
    hos_total_pnl = db.Column(db.Numeric(18, 4))
    """
    累计盈亏 = 累计已实现盈亏 + 累计未实现盈亏 + 累计现金分红
    """
    hos_total_pnl_ratio = db.Column(db.Numeric(18, 4))
    """
    累计盈亏率 = (累计盈亏 / 总成本)
    """

    hos_daily_cash_dividend = db.Column(db.Numeric(18, 4))
    """
    当日收到的现金分红
    """
    hos_total_cash_dividend = db.Column(db.Numeric(18, 4))
    """
    累计收到的现金分红
    """
    hos_total_dividend = db.Column(db.Numeric(18, 4))
    """
    累计收到的分红总额，包含现金分红和分红再投资
    """

    # -------- Other --------
    tr_cycle = db.Column(db.Integer)
    """
    持仓周期，每次清仓加一，从1开始
    """
    is_cleared = db.Column(db.Boolean, default=False)
    """
    是否清仓日
    """

    __table_args__ = (
        db.Index('holding_snapshot_ho_id_snapshot_date_index', 'ho_id', 'snapshot_date'),
    )


class AnalyticsWindow(BaseModel):
    __tablename__ = 'analytics_window'

    id = db.Column(db.Integer, primary_key=True)
    window_key = db.Column(db.String(32), unique=True, nullable=False)
    """
    示例: 'ALL', 'CUR', 'R21', 'R63', 'R126'，'R252'（交易日）
    """
    window_type = db.Column(db.String(20), nullable=False)
    """
    'expanding' | 'rolling'
    """
    window_days = db.Column(db.Integer)
    """
    expanding 时可为 NULL
    """
    annualization_factor = db.Column(db.Integer, default=252)
    """
    年化因子
    """
    description = db.Column(db.String(255))


class HoldingAnalyticsSnapshot(TimestampMixin, BaseModel):
    """
    分析 / 展示 / 研究专用 Snapshot
    基于 analytics_window 计算的聚合指标
    核心逻辑：所有 Performance 指标基于【收益率 (Return)】而非【市值 (Market Value)】
    """
    __tablename__ = 'holding_analytics_snapshot'
    __table_args__ = (
        # 联合唯一索引，确保同一个持仓、同一天、同一个窗口只有一条记录
        db.UniqueConstraint('ho_id', 'snapshot_date', 'window_key', name='uq_ho_date_window'),
        db.Index('idx_ho_window_date', 'ho_id', 'window_key', 'snapshot_date'),
    )
    id = db.Column(db.Integer, primary_key=True)
    ho_id = db.Column(db.Integer, nullable=False)
    snapshot_date = db.Column(db.Date, nullable=False)
    window_key = db.Column(db.String(32), nullable=False)  # ALL, CUR, R20, R252...

    # --------- 1. Return Metrics (收益指标) ---------
    twrr_cumulative = db.Column(db.Numeric(18, 6))
    """
    窗口内的时间加权收益率 (Time-Weighted Return)
    含义：假设一开始买入并持有不动，该标的的涨幅。比如 R20：过去20个交易日的累计涨幅
    用途：衡量这只基金/股票本身的质量，不包含用户的择时(操作)因素。
    大白话：只和market_price相关，和持仓份额无关
    """
    twrr_annualized = db.Column(db.Numeric(18, 6))
    """
    年化twrr
    """
    irr_cumulative = db.Column(db.Numeric(18, 6))
    """
    资金加权年化收益率 (Internal Rate of Return)
    含义：考虑了用户的加减仓行为后的实际年化回报率。
    用途：衡量用户在该标的上的实际操作结果。
    大白话：不仅和market_price相关，而且和持仓份额有关
    """
    irr_annualized = db.Column(db.Numeric(18, 6))
    """
    年化irr
    """
    has_cumulative_pnl = db.Column(db.Numeric(18, 4))
    """
    窗口期内的累计盈亏金额 (Absolute PnL)
    """
    has_total_dividend = db.Column(db.Numeric(18, 4))
    """
    窗口期内收到的分红总额
    """
    # --------- 2. Risk / Volatility (风险指标) ---------
    has_return_volatility = db.Column(db.Numeric(18, 6))
    """
    年化波动率 (Standard Deviation of Daily Returns * sqrt(252))
    """
    has_downside_risk = db.Column(db.Numeric(18, 6))
    """
    下行风险波动率 (Downside Deviation, 只计算收益率为负的日子)
    """
    has_sharpe_ratio = db.Column(db.Numeric(18, 4))
    """
    夏普比率 (Return - Rf) / Volatility
    Sharpe Ratio ( (Rp - Rf) / Sigma )
    """
    has_sortino_ratio = db.Column(db.Numeric(18, 4))
    """
    索提诺比率 (Return - Rf) / Downside Deviation
    Sortino Ratio ( (Rp - Rf) / Downside Sigma )
    """
    has_calmar_ratio = db.Column(db.Numeric(18, 4))
    """
    卡玛比率 Annualized Return / Max Drawdown
    Calmar Ratio ( Annualized Return / Max Drawdown )
    """
    has_win_rate = db.Column(db.Numeric(18, 4))
    """
    胜率：窗口期内 (日收益率 > 0 的天数) / 总交易日
    """
    # --------- 3. Drawdown (回撤 - 基于累计收益率曲线) ---------
    has_max_drawdown = db.Column(db.Numeric(18, 6))
    """
    窗口内最大回撤幅度 (始终 <= 0，例如 -0.15 表示 -15%)
    """
    has_max_drawdown_start_date = db.Column(db.Date)
    """
    最大回撤发生的起止日期 - 见顶日期
    """
    has_max_drawdown_end_date = db.Column(db.Date)
    """
    最大回撤发生的起止日期 - 见底日期
    """
    has_max_drawdown_recovery_date = db.Column(db.Date)
    """
    最大回撤恢复日期 (从低点回到原高点的日期，如果没有恢复则为 NULL)
    """
    has_max_drawdown_days = db.Column(db.Integer)
    """
    最大回撤持续交易日天数 (Peak to Trough)
    """
    # --------- 4. Run-up (上涨/反弹) ---------
    has_max_runup = db.Column(db.Numeric(18, 6))
    """
    窗口内最大上涨幅度 (从最低点到随后的最高点)
    """
    # --------- 5. Benchmark & Alpha (相对表现) ---------
    # 同期基准收益率
    has_benchmark_return = db.Column(db.Numeric(18, 6))

    # Alpha (超额收益，简单减法或回归 Alpha)
    has_alpha = db.Column(db.Numeric(18, 6))

    # Beta (相对于基准的敏感度)
    has_beta = db.Column(db.Numeric(18, 6))

    # 跟踪误差 (Tracking Error)
    has_tracking_error = db.Column(db.Numeric(18, 6))

    # 信息比率 (Information Ratio = Alpha / Tracking Error)
    has_information_ratio = db.Column(db.Numeric(18, 4))

    # --------- 6. Contribution (贡献) ---------
    has_portfolio_contribution = db.Column(db.Numeric(18, 6))
    """
    组合贡献度
    该持仓在窗口期内对组合总收益的贡献点数 (例如 0.02 表示贡献了 2%)
    公式：(该持仓当日收益额 / 整个组合昨日总市值) 的累加
    或者近似：该持仓平均权重 * 该持仓收益率
    注意：计算此字段需要读取 InvestedAssetSnapshot 的数据。
    """


class InvestedAssetSnapshot(TimestampMixin, BaseModel):
    """
    投资资产整体快照
    """

    __tablename__ = 'invested_asset_snapshot'

    id = db.Column(db.Integer, primary_key=True)
    snapshot_date = db.Column(db.Date, nullable=False, index=True)  # 快照日期，YYYY-MM-DD 格式。
    # -------- Point-in-Time (时点状态) --------
    ias_market_value = db.Column(db.Numeric(20, 4), nullable=False)
    """
    当日收盘时的总市值
    """
    ias_holding_cost = db.Column(db.Numeric(20, 4), nullable=False)
    """
    当前持仓的成本
    """
    ias_unrealized_pnl = db.Column(db.Numeric(20, 4), nullable=False)
    """
    浮动盈亏 = 市值 - 持仓成本
    """
    # -------- Daily Flow (当日流量 - 用于计算日收益率) --------
    ias_net_external_cash_flow = db.Column(db.Numeric(20, 4))
    """
    当日外部现金流：买入为负(现金->证券)，卖出为正(证券->现金)（不含分红）
    """
    ias_daily_dividend = db.Column(db.Numeric(20, 4))  # 当日分红
    ias_daily_pnl = db.Column(db.Numeric(20, 4))
    """
    当日盈亏金额
    公式: Today_MV - Yesterday_MV - Net_Inflow + Daily_Dividend
    """
    ias_daily_pnl_ratio = db.Column(db.Numeric(18, 6))
    """
    ias_daily_pnl_ratio = daily_pnl / 昨日市值
    当日收益率 (Simple Return)
    公式 (Modified Dietz 简化版): 
    ias_daily_pnl / (Yesterday_MV + (ias_net_inflow / 2))
    如果当日没有大额进出，近似等于 ias_daily_pnl / Yesterday_MV
    """
    # -------- Cumulative (历史累计) --------
    ias_total_buy_amount = db.Column(db.Numeric(20, 4))  # 历史累计买入总额
    ias_total_sell_amount = db.Column(db.Numeric(20, 4))  # 历史累计卖出总额 包含收益
    """
    净投入本金 = total_buy - total_sell (如果卖出包含收益，这里逻辑要小心)
    """
    ias_realized_pnl = db.Column(db.Numeric(20, 4), nullable=False)  # 历史已实现盈亏
    ias_dividend_income = db.Column(db.Numeric(20, 4), nullable=False)  # 历史分红总额

    ias_total_pnl = db.Column(db.Numeric(20, 4), nullable=False)  # 总盈亏 = 浮盈 + 已实现 + 分红
    """
    ias_total_pnl = total_realized_pnl + total_unrealized_pnl + total_dividend_income
    """
    ias_total_pnl_ratio = db.Column(db.Numeric(18, 6))
    """
    累计收益率 (Simple Return = Total PnL / Net Invested Capital)
    ias_total_pnl_ratio = ias_total_pnl / ias_total_buy_amount
    """

    __table_args__ = (
        db.UniqueConstraint(
            'snapshot_date',
            name='uq_invested_asset_snapshot_date'
        ),
    )


class InvestedAssetAnalyticsSnapshot(TimestampMixin, BaseModel):
    """
    投资资产表现分析快照
    基于已投入资产，不包含现金
    """

    __tablename__ = 'invested_asset_analytics_snapshot'

    id = db.Column(db.Integer, primary_key=True)

    snapshot_date = db.Column(db.Date, nullable=False)
    window_key = db.Column(db.String(32), nullable=False)

    # -------- Return Metrics --------
    twrr_cumulative = db.Column(db.Numeric(18, 6))
    """
    时间加权收益率 (Time-Weighted Return Rate) 基金净值法收益率，衡量策略好坏，不受资金进出影响
    计算方式：Link daily returns. (1+r1)*(1+r2)... - 1
    最能体现投资组合的策略表现，剔除了用户加减仓时机的影响。
    """
    twrr_annualized = db.Column(db.Numeric(18, 6))  # 仅当 window_days > 365 时计算

    # MWRR / IRR (Money-Weighted): 资金加权收益率，衡量口袋里真赚了多少比例
    irr_annualized = db.Column(db.Numeric(18, 6))
    """
    内部收益率 (XIRR / MWRR)
    体现用户实际到手的年化回报率，受加减仓时机影响大。
    """
    period_pnl = db.Column(db.Numeric(18, 4))
    """
    Absolute PnL in this window (这个窗口期内赚了多少钱)
    """
    # -------- Risk Metrics --------
    volatility = db.Column(db.Numeric(18, 6))  # 波动率
    max_drawdown = db.Column(db.Numeric(18, 6))  # 最大回撤 (e.g. -0.15)
    # 回撤详情，前端绘图非常需要
    max_drawdown_start_date = db.Column(db.Date)  # 峰值日期
    max_drawdown_end_date = db.Column(db.Date)  # 谷值日期
    max_drawdown_recovery_date = db.Column(db.Date)  # 恢复日期 (回到峰值的日期，未恢复则Null

    sharpe_ratio = db.Column(db.Numeric(18, 4))
    sortino_ratio = db.Column(db.Numeric(18, 4))
    calmar_ratio = db.Column(db.Numeric(18, 4))

    # --------  Distribution --------
    win_rate = db.Column(db.Numeric(18, 4))  # 盈利天数占比
    worst_day_return = db.Column(db.Numeric(18, 6))  # 单日最大跌幅
    best_day_return = db.Column(db.Numeric(18, 6))  # 单日最大涨幅

    # -------- Benchmark (Optional) --------
    benchmark_cumulative_return = db.Column(db.Numeric(18, 6))
    excess_return = db.Column(db.Numeric(18, 6))
    beta = db.Column(db.Numeric(18, 6))
    alpha = db.Column(db.Numeric(18, 6))

    __table_args__ = (
        db.UniqueConstraint('snapshot_date', 'window_key', name='uq_invested_asset_analytics'),
        db.Index('idx_iaas_date_window', 'snapshot_date', 'window_key'),
    )


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
    task_name = db.Column(db.String(150), nullable=False, index=True)  # 任务类型
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
    task_fingerprint = db.Column(db.String(64), index=True, comment='任务指纹，用于去重')
    business_key = db.Column(db.String(255), index=True, comment='业务关键字段')
    deduplication_strategy = db.Column(db.String(50), default='exact_match', comment='去重策略')

    __table_args__ = (
        db.Index('idx_task_fingerprint_status', 'task_fingerprint', 'status'),
        db.Index('idx_task_name_business_key', 'task_name', 'business_key'),
        db.Index('idx_task_name_created_at', 'task_name', 'created_at'),
    )
