import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import useDashboard from '../hooks/api/useDashboard';
import ReactECharts from 'echarts-for-react';
import {
    ArrowPathIcon,
    ChartPieIcon,
    ClockIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    PresentationChartLineIcon,
    ScaleIcon
} from '@heroicons/react/24/outline';
import useDarkMode from "../hooks/useDarkMode";
import {formatCurrency, formatPercent, formatPercentNeutral, formatRatioAsPercent, getColor} from '../utils/formatters';
import {getLineOption, getPieOption} from '../utils/chartOptions';

// 窗口名称映射表
const WINDOW_NAME_MAP = {
    'ALL': '投资以来',
    'CUR': '本轮持仓',
    'R21': '近一月',
    'R63': '近三月',
    'R126': '近半年',
    'R252': '近一年'
};

export default function Dashboard() {
    const {t} = useTranslation();
    const [timeRange, setTimeRange] = useState('1y');
    const isDarkMode = useDarkMode();
    const [highlightedIndex, setHighlightedIndex] = useState(null);
    const chartRef = useRef(null);
    // 获取账户整体状况
    const {
        summaryData,
        overviewData,
        isInitialLoading,
        isRefreshing,
        error,
        refetch
    } = useDashboard({
        autoLoad: true,
        defaultDays: 365,
        defaultWindow: 'R252'
    });

    // 性能数据简写，使用可选链和空值合并
    const performance = summaryData?.performance ?? {};
    const trend = summaryData?.trend ?? [];
    const allocation = summaryData?.allocation ?? [];
    const alerts = summaryData?.alerts ?? [];

    // Memoized chart options
    const lineOption = useMemo(() =>
            getLineOption(trend, isDarkMode),
        [trend, isDarkMode]
    );
    const pieOption = useMemo(() =>
            getPieOption(allocation, isDarkMode, highlightedIndex),
        [allocation, isDarkMode, highlightedIndex]
    );

    // 联动高亮效果
    useEffect(() => {
        const chartInstance = chartRef.current?.getEchartsInstance();
        if (chartInstance && allocation.length > 0) {
            if (highlightedIndex !== null) {
                // 高亮指定扇区
                chartInstance.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    dataIndex: highlightedIndex,
                });
                // 显示 tooltip
                chartInstance.dispatchAction({
                    type: 'showTip',
                    seriesIndex: 0,
                    dataIndex: highlightedIndex,
                });
            } else {
                // 取消所有高亮
                chartInstance.dispatchAction({
                    type: 'downplay',
                    seriesIndex: 0,
                });
            }
        }
    }, [highlightedIndex, allocation]);
    const handleChartEvents = {
        mouseover: (params) => {
            setHighlightedIndex(params.dataIndex);
        },
        mouseout: () => {
            setHighlightedIndex(null);
        },
    };

    const handleRangeChange = (e) => {
        const val = e.target.value;
        setTimeRange(val);

        const rangeMap = {
            '1m': {win: 'R21', days: 30},
            '3m': {win: 'R63', days: 90},
            '6m': {win: 'R126', days: 180},
            '1y': {win: 'R252', days: 365},
            'all': {win: 'ALL', days: 3650}
        };

        const {win, days} = rangeMap[val] || {win: 'R252', days: 365};
        // 添加调试日志
        // console.log(`切换窗口: ${val}, win: ${win}, days: ${days}`);

        refetch(days, win);
    };

    const handleRefresh = () => {
        refetch(); // 使用统一的 refetch
    };


    // 窗口名称
    const windowName = useMemo(() => {
        const rangeMap = {
            '1m': '近一月',
            '3m': '近三月',
            '6m': '近半年',
            '1y': '近一年',
            'all': '投资以来'
        };
        return rangeMap[timeRange] || '近一年';
    }, [timeRange]);

    // 1. 初始加载时，显示骨架屏
    if (isInitialLoading) {
        return (
            <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <KpiCardSkeleton key={i}/>)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <ChartSkeleton/>
                    <ChartSkeleton/>
                </div>
            </div>
        );
    }

    // 2. 发生错误时，显示错误提示（但保留页面结构）
    if (error) {
        return (
            <div className="p-2 md:p-4 max-w-7xl mx-auto">
                <div
                    className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                    <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-2"/>
                    <p className="text-red-700 dark:text-red-300">数据加载失败: {error.message || '未知错误'}</p>
                    <button onClick={handleRefresh} disabled={isRefreshing}
                            className="mt-4 text-blue-500 underline disabled:opacity-50">
                        {isRefreshing ? '重试中...' : '重试'}
                    </button>
                </div>
            </div>
        );
    }

    // 3. 正常渲染（即使数据为空）
    return (
        <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-3">
            {/* 第一部分：账户整体概览 (来自 /overview 接口) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                    title="总资产"
                    value={formatCurrency(overviewData?.total_mv)}
                    subValue={overviewData?.holding_cost ? `持仓成本 ${formatCurrency(overviewData?.holding_cost)}` : null}
                    icon={<CurrencyDollarIcon className="w-5 h-5 text-blue-500"/>}
                />
                <KpiCard
                    title="累计盈亏"
                    value={formatCurrency(overviewData?.total_pnl)}
                    valueColor={getColor(overviewData?.total_pnl)}
                    subValue={overviewData?.total_pnl_ratio ? `${formatPercent(overviewData?.total_pnl_ratio)}` : '0.00%'}
                    subValueColor={getColor(overviewData?.total_pnl_ratio)}
                    icon={<ScaleIcon className="w-5 h-5 text-purple-500"/>}
                />
                <KpiCard
                    title="累计 TWRR"
                    value={formatPercent(overviewData?.twrr_cum)}
                    valueColor={getColor(overviewData?.twrr_cum)}
                    subValue={`年化 IRR: ${formatPercent(overviewData?.irr_ann)}`}
                    subValueColor={getColor(overviewData?.total_pnl_ratio)}
                    icon={<PresentationChartLineIcon className="w-5 h-5 text-orange-500"/>}
                    tooltip="时间加权收益率：反映策略自成立以来的累计表现，剔除资金进出影响。"
                />
                <KpiCard
                    title="历史最大回撤"
                    value={formatPercent(overviewData?.max_drawdown)}
                    valueColor={getColor(overviewData?.max_drawdown)}
                    icon={<ClockIcon className="w-5 h-5 text-green-500"/>}
                    tooltip="内部收益率：反映实际资金的年化回报，包含加减仓时机的影响。"
                />
            </div>
            {/* 分隔线与控制栏 */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>以下数据更新于: {overviewData?.update_date || '-'}</span>
                    {overviewData?.total_mv === 0 && <span className="text-orange-500">(空仓)</span>}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                        value={timeRange}
                        onChange={handleRangeChange}
                        className="flex-1 sm:flex-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 dark:text-white outline-none shadow-sm"
                    >
                        <option value="1m">近1月</option>
                        <option value="3m">近3月</option>
                        <option value="6m">近半年</option>
                        <option value="1y">近1年</option>
                        <option value="all">投资以来</option>
                    </select>
                    {/* <button */}
                    {/*     onClick={handleRefresh} */}
                    {/*     className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm" */}
                    {/*     title="刷新数据" */}
                    {/* > */}
                    {/*     <ArrowPathIcon className={`w-4 h-4 text-gray-500 ${isInitialLoading ? 'animate-spin' : ''}`}/> */}
                    {/* </button> */}
                </div>
            </div>

            {/* 第二部分：区间分析 (来自 /summary 接口) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title={`区间盈亏 (${windowName})`}
                    value={formatCurrency(performance?.period_pnl)}
                    valueColor={getColor(performance?.period_pnl)}
                    subValue={formatPercent(performance?.period_pnl_ratio)}
                    subValueColor={getColor(performance?.period_pnl_ratio)}
                    icon={<ScaleIcon className="w-6 h-6 text-purple-500"/>}
                />
                <KpiCard
                    title="TWRR"
                    value={formatPercent(performance?.twrr_cumulative)}
                    valueColor={getColor(performance?.twrr_cumulative)}
                    subValue={performance?.irr_annualized === 0
                        ? '年化 IRR: -'
                        : `年化 IRR: ${formatPercent(performance?.irr_annualized)}`}
                    icon={<PresentationChartLineIcon className="w-6 h-6 text-orange-500"/>}
                    tooltip="TWRR衡量策略表现(剔除资金进出影响)，IRR衡量实际到手回报"
                />
                {/* 卡片 3: 超额收益 (Alpha) - 替换原来的波动率 */}
                <KpiCard
                    title="超额收益 (Alpha)"
                    value={formatPercent(performance?.alpha)}
                    valueColor={getColor(performance?.alpha)}
                    // Beta 衡量对市场的敏感度，与 Alpha 成对出现最合适
                    subValue={`Beta: ${performance?.beta ? formatPercent(performance.beta) : '-'}`}
                    subValueColor="text-gray-500"
                    icon={<CurrencyDollarIcon className="w-6 h-6 text-orange-500"/>}
                    tooltip="Alpha: 跑赢基准的超额收益；Beta: 相对基准的波动敏感度 (>1 表示比基准波动大)"
                />
                {/* 卡片 4: 基准表现*/}
                <KpiCard
                    title="同期基准收益"
                    value={formatPercent(performance?.benchmark_cumulative_return)}
                    valueColor={getColor(performance?.benchmark_cumulative_return)}
                    // 显示具体的基准名称，让用户知道在和谁比
                    subValue={performance?.benchmark_name || '沪深300'}
                    icon={<ChartPieIcon className="w-6 h-6 text-gray-500"/>}
                    tooltip="同一时间区间内，对标指数（如沪深300）的涨跌幅"
                />
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 资产走势 */}
                <div
                    className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        资产走势 <span className="text-sm font-normal text-gray-500">({windowName})</span>
                    </h3>
                    <div className="h-80">
                        <ReactECharts
                            option={lineOption}
                            style={{height: '100%', width: '100%'}}
                            theme={isDarkMode ? 'dark' : 'light'}
                            notMerge={true}
                        />
                    </div>
                </div>

                {/* 资产配置 */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">持仓分布</h3>

                    {allocation && allocation.length > 0 ? (
                        <>
                            {/* ECharts 图表容器 */}
                            <div className="flex-1 min-h-[180px] md:min-h-[200px] -mt-4 -mb-2">
                                <ReactECharts
                                    ref={chartRef}
                                    option={pieOption}
                                    style={{height: '100%', width: '100%'}}
                                    theme={isDarkMode ? 'dark' : 'light'}
                                    notMerge={true}
                                    onEvents={handleChartEvents}
                                />
                            </div>

                            {/* 列表容器 */}
                            <div className="mt-4 flex flex-col">
                                {/* 列表项 */}
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar mt-2">
                                    {allocation.map((item, index) => (
                                        <div
                                            key={item.ho_code}
                                            className={`flex justify-between items-center text-sm p-2 rounded-md transition-colors duration-200 ${
                                                highlightedIndex === index ? 'bg-gray-100 dark:bg-gray-700/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                            }`}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            onMouseLeave={() => setHighlightedIndex(null)}
                                        >
                                            {/* 左栏: 占比 */}
                                            <div
                                                className="w-14 text-left text-gray-800 dark:text-gray-200">
                                                {/* 使用不带符号的百分比格式化 */}
                                                {formatPercentNeutral(item.has_position_ratio)}
                                            </div>

                                            {/* 中栏: 名称/代码 */}
                                            <div className="flex-1 min-w-0 mx-2">
                                                <p className="text-gray-800 dark:text-gray-200 font-medium truncate"
                                                   title={item.ho_short_name}>
                                                    {item.ho_short_name}
                                                </p>
                                                <p className="text-xs text-gray-400">{item.ho_code}</p>
                                            </div>

                                            {/* 右栏: 盈亏/贡献 */}
                                            <div className="w-24 text-right flex-shrink-0">
                                                <div
                                                    className={`font-semibold font-mono ${getColor(item.has_cumulative_pnl)}`}>
                                                    {formatCurrency(item.has_cumulative_pnl)}
                                                </div>
                                                <div
                                                    className={`text-xs font-mono ${getColor(item.has_portfolio_contribution)}`}>
                                                    {/* 贡献度是带符号的百分比 */}
                                                    {formatRatioAsPercent(item.has_portfolio_contribution)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        // 空状态展示
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 min-h-[240px]">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full mb-3">
                                <ChartPieIcon className="w-8 h-8 text-gray-300 dark:text-gray-500"/>
                            </div>
                            <p className="text-sm">当前无持仓数据</p>
                            <p className="text-xs text-gray-400 mt-1">请添加交易记录或等待数据更新</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 风险与预警 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 风险指标 */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        风险分析 <span className="text-sm font-normal text-gray-500">({windowName})</span>
                    </h3>
                    {performance ? (
                        <div className="grid grid-cols-2 gap-4">
                            <RiskMetric label="夏普比率" value={performance.sharpe_ratio?.toFixed(2)}
                                        desc=">1 为佳"/>
                            <RiskMetric label="最大回撤" value={formatPercent(performance.max_drawdown)}
                                        color={getColor(performance.max_drawdown)} desc="越小越好"/>
                            <RiskMetric label="年化波动率" value={formatPercent(performance.volatility)}
                                        desc="风险程度"/>
                            <RiskMetric label="胜率" value={formatPercent(performance.win_rate)}
                                        desc="盈利天数占比"/>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">暂无风险分析数据</div>
                    )}
                </div>

                {/* 预警列表 */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">近期信号</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-3 py-2 rounded-l-lg">标的</th>
                                <th className="px-3 py-2">类型</th>
                                <th className="px-3 py-2">触发价</th>
                                <th className="px-3 py-2 rounded-r-lg">日期</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {alerts && alerts.length > 0 ? alerts.map(alert => (
                                <tr key={alert.id}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">{alert.name}</td>
                                    <td className="px-3 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                alert.type === 'BUY'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            }`}>
                                                {alert.type_text}
                                            </span>
                                    </td>
                                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{alert.current_nav}</td>
                                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{alert.date}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-gray-500">暂无预警消息</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 子组件 ---

function KpiCard({
                     title,
                     value,
                     subValue,
                     icon,
                     valueColor = "text-gray-900 dark:text-white",
                     subValueColor = "text-gray-500",
                     tooltip,
                     loading = false
                 }) {
    return (
        <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 relative group transition-all hover:shadow-md">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                    <h3 className={`text-2xl font-bold mt-1 ${valueColor}`}>
                        {loading ?
                            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div> : value}
                    </h3>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    {icon}
                </div>
            </div>
            {subValue && (
                <div className={`mt-2 text-xs font-medium ${subValueColor}`}>
                    {loading ?
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div> : subValue}
                </div>
            )}
            {tooltip && (
                <div
                    className="absolute hidden group-hover:block top-full left-0 mt-2 p-2 bg-gray-900 text-white text-xs rounded z-10 w-48 shadow-lg">
                    {tooltip}
                </div>
            )}
        </div>
    );
}

function RiskMetric({label, value, desc, color = "text-gray-900 dark:text-white"}) {
    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value || '-'}</div>
            <div className="text-xs text-gray-400 mt-1">{desc}</div>
        </div>
    );
}

const KpiCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-start">
            <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-2 animate-pulse"></div>
            </div>
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                <div className="w-5 h-5"></div>
            </div>
        </div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mt-3 animate-pulse"></div>
    </div>
);

const ChartSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4 animate-pulse"></div>
        <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
    </div>
);