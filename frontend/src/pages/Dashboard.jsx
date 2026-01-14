// src/pages/Dashboard.jsx
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useToast} from '../components/context/ToastContext';
import useDashboard from '../hooks/api/useDashboard';
import ReactECharts from 'echarts-for-react';
import {getGaugeOption, getLineChartOption, getPieChartOption} from '../utils/echartsConfig';

// 导入图标组件 (使用 heroicons/react)
import {
    ArrowPathIcon,
    ArrowTrendingDownIcon,
    ArrowTrendingUpIcon,
    CalendarIcon,
    ChartBarIcon,
    ChartPieIcon,
    ChevronRightIcon,
    ClockIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    CircleStackIcon
} from '@heroicons/react/24/outline';

export default function Dashboard() {
    const {t} = useTranslation();
    const {showErrorToast} = useToast();
    const [timeRange, setTimeRange] = useState('30d');
    const [isDarkMode, setIsDarkMode] = useState(false);

    // 检测暗黑模式
    useEffect(() => {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(darkModeMediaQuery.matches);

        const handleChange = (e) => setIsDarkMode(e.matches);
        darkModeMediaQuery.addEventListener('change', handleChange);

        return () => darkModeMediaQuery.removeEventListener('change', handleChange);
    }, []);

    const {
        data,
        loading,
        error,
        fetchDashboardData
    } = useDashboard({
        autoLoad: true,
        days: parseInt(timeRange.replace('d', ''))
    });

    // 图表引用
    const pieChartRef = useRef(null);
    const lineChartRef = useRef(null);
    const gaugeChartRef = useRef(null);

    // 处理时间范围变化
    const handleTimeRangeChange = (range) => {
        setTimeRange(range);
        const days = parseInt(range.replace('d', ''));
        fetchDashboardData(days);
    };

    // 刷新数据
    const handleRefresh = () => {
        fetchDashboardData(parseInt(timeRange.replace('d', '')));
    };

    // 格式化货币
    const formatCurrency = (value) => {
        if (value === undefined || value === null) return '¥0.00';
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    // 格式化百分比
    const formatPercent = (value) => {
        if (value === undefined || value === null) return '0.00%';
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    // 获取颜色基于数值
    const getColorForValue = (value) => {
        if (value > 0) return 'text-green-600 dark:text-green-400';
        if (value < 0) return 'text-red-600 dark:text-red-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    // 获取背景颜色基于数值
    const getBgColorForValue = (value) => {
        if (value > 0) return 'bg-green-100 dark:bg-green-900/30';
        if (value < 0) return 'bg-red-100 dark:bg-red-900/30';
        return 'bg-gray-100 dark:bg-gray-800';
    };

    // 模拟收益趋势数据（实际项目中应从API获取）
    const getProfitTrendData = () => {
        const days = parseInt(timeRange.replace('d', ''));
        const data = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            // 模拟数据
            const profit = Math.random() * 5000 - 1000;
            data.push({
                date: date.toLocaleDateString('zh-CN', {month: 'short', day: 'numeric'}),
                profit: Math.round(profit)
            });
        }

        return data;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        {t('dashboard.loading')}
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4"/>
                <div className="text-red-600 dark:text-red-400 mb-4">
                    {t('dashboard.loadError')}
                </div>
                <button
                    onClick={handleRefresh}
                    className="btn-primary"
                >
                    {t('button_retry')}
                </button>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const {
        holdings_summary,
        trade_statistics,
        recent_alerts,
        portfolio_volatility,
        asset_allocation
    } = data;

    // 准备图表数据
    const pieChartData = asset_allocation || [];
    const lineChartData = getProfitTrendData();
    const gaugeData = {
        volatility: portfolio_volatility?.volatility || 0,
        beta: portfolio_volatility?.beta || 1
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* 头部区域 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                        {t('dashboard.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {t('dashboard.subtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* 时间范围选择器 */}
                    <div className="relative">
                        <select
                            value={timeRange}
                            onChange={(e) => handleTimeRangeChange(e.target.value)}
                            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="7d">最近7天</option>
                            <option value="30d">最近30天</option>
                            <option value="90d">最近90天</option>
                            <option value="1y">最近1年</option>
                        </select>
                        <CalendarIcon
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                    </div>

                    {/* 刷新按钮 */}
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowPathIcon className="w-4 h-4"/>
                        <span className="text-sm">{t('button_refresh')}</span>
                    </button>
                </div>
            </div>

            {/* KPI卡片网格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 总资产 */}
                <div className="card p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.totalAssets')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(holdings_summary?.total_value)}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('dashboard.cost')}:
                </span>
                                <span className="text-xs font-medium">
                  {formatCurrency(holdings_summary?.total_cost)}
                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <CurrencyDollarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400"/>
                        </div>
                    </div>
                </div>

                {/* 持仓收益 */}
                <div className="card p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.holdingProfit')}
                            </p>
                            <p className={`text-2xl font-bold ${getColorForValue(holdings_summary?.total_profit)}`}>
                                {formatCurrency(holdings_summary?.total_profit)}
                            </p>
                            <div
                                className={`flex items-center gap-1 mt-2 ${getColorForValue(holdings_summary?.total_profit_rate)}`}>
                                {holdings_summary?.total_profit_rate >= 0 ? (
                                    <ArrowTrendingUpIcon className="w-4 h-4"/>
                                ) : (
                                    <ArrowTrendingDownIcon className="w-4 h-4"/>
                                )}
                                <span className="text-sm font-medium">
                  {formatPercent(holdings_summary?.total_profit_rate)}
                </span>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${getBgColorForValue(holdings_summary?.total_profit)}`}>
                            <ChartBarIcon
                                className={`w-6 h-6 ${getColorForValue(holdings_summary?.total_profit).replace('text-', '')}`}/>
                        </div>
                    </div>
                </div>

                {/* 今日收益 */}
                <div className="card p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.todayProfit')}
                            </p>
                            <p className={`text-2xl font-bold ${getColorForValue(holdings_summary?.today_profit)}`}>
                                {formatCurrency(holdings_summary?.today_profit)}
                            </p>
                            <div
                                className={`flex items-center gap-1 mt-2 ${getColorForValue(holdings_summary?.today_profit_rate)}`}>
                                {holdings_summary?.today_profit_rate >= 0 ? (
                                    <ArrowTrendingUpIcon className="w-4 h-4"/>
                                ) : (
                                    <ArrowTrendingDownIcon className="w-4 h-4"/>
                                )}
                                <span className="text-sm font-medium">
                  {formatPercent(holdings_summary?.today_profit_rate)}
                </span>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${getBgColorForValue(holdings_summary?.today_profit)}`}>
                            <CircleStackIcon
                                className={`w-6 h-6 ${getColorForValue(holdings_summary?.today_profit).replace('text-', '')}`}/>
                        </div>
                    </div>
                </div>

                {/* 累计收益 */}
                <div className="card p-5">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.cumulativeProfit')}
                            </p>
                            <p className={`text-2xl font-bold ${getColorForValue(holdings_summary?.cumulative_profit)}`}>
                                {formatCurrency(holdings_summary?.cumulative_profit)}
                            </p>
                            <div
                                className={`flex items-center gap-1 mt-2 ${getColorForValue(holdings_summary?.cumulative_profit_rate)}`}>
                                {holdings_summary?.cumulative_profit_rate >= 0 ? (
                                    <ArrowTrendingUpIcon className="w-4 h-4"/>
                                ) : (
                                    <ArrowTrendingDownIcon className="w-4 h-4"/>
                                )}
                                <span className="text-sm font-medium">
                  {formatPercent(holdings_summary?.cumulative_profit_rate)}
                </span>
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg ${getBgColorForValue(holdings_summary?.cumulative_profit)}`}>
                            <ShieldCheckIcon
                                className={`w-6 h-6 ${getColorForValue(holdings_summary?.cumulative_profit).replace('text-', '')}`}/>
                        </div>
                    </div>
                </div>
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 资产配置饼图 */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('dashboard.assetAllocation')}
                        </h2>
                        <ChartPieIcon className="w-5 h-5 text-gray-400"/>
                    </div>
                    <div className="h-64 md:h-80">
                        {pieChartData.length > 0 ? (
                            <ReactECharts
                                ref={pieChartRef}
                                option={getPieChartOption(pieChartData, isDarkMode)}
                                style={{height: '100%', width: '100%'}}
                                theme={isDarkMode ? 'dark' : 'light'}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                {t('dashboard.noAllocationData')}
                            </div>
                        )}
                    </div>
                    {pieChartData.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {pieChartData.slice(0, 4).map((item, index) => (
                                <div key={index}
                                     className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded"
                                            style={{
                                                backgroundColor: [
                                                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444'
                                                ][index % 4]
                                            }}
                                        />
                                        <span className="text-sm truncate" title={item.name}>
                      {item.name}
                    </span>
                                    </div>
                                    <span className="text-sm font-medium">
                    {item.percentage}%
                  </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 收益趋势图 */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {t('dashboard.profitTrend')}
                        </h2>
                        <ArrowTrendingUpIcon className="w-5 h-5 text-gray-400"/>
                    </div>
                    <div className="h-64 md:h-80">
                        <ReactECharts
                            ref={lineChartRef}
                            option={getLineChartOption(lineChartData, isDarkMode)}
                            style={{height: '100%', width: '100%'}}
                            theme={isDarkMode ? 'dark' : 'light'}
                        />
                    </div>
                </div>
            </div>

            {/* 交易统计和波动性 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 交易统计 */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('dashboard.tradeStatistics')}
                    </h2>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.totalTrades')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {trade_statistics?.total_trades || 0}
                            </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {t('dashboard.winRate')}
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {trade_statistics?.win_rate || 0}%
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClockIcon className="w-4 h-4 text-gray-400"/>
                                <span className="text-gray-600 dark:text-gray-300">
                  {t('dashboard.avgHoldingPeriod')}
                </span>
                            </div>
                            <span className="font-medium">
                {trade_statistics?.avg_holding_period || 0} {t('dashboard.days')}
              </span>
                        </div>

                        <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {t('dashboard.avgProfit')}
              </span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                {formatCurrency(trade_statistics?.avg_profit || 0)}
              </span>
                        </div>

                        <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {t('dashboard.avgLoss')}
              </span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                {formatCurrency(trade_statistics?.avg_loss || 0)}
              </span>
                        </div>

                        <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {t('dashboard.profitLossRatio')}
              </span>
                            <span className="font-medium">
                {trade_statistics?.profit_loss_ratio || 0}
              </span>
                        </div>
                    </div>
                </div>

                {/* 波动性分析 */}
                <div className="card p-5">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {t('dashboard.portfolioVolatility')}
                    </h2>

                    <div className="h-48 md:h-56 mb-6">
                        <ReactECharts
                            ref={gaugeChartRef}
                            option={getGaugeOption(gaugeData.volatility, gaugeData.beta, isDarkMode)}
                            style={{height: '100%', width: '100%'}}
                            theme={isDarkMode ? 'dark' : 'light'}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {t('dashboard.sharpeRatio')}
              </span>
                            <span className={`font-medium ${
                                portfolio_volatility?.sharpe_ratio > 1 ? 'text-green-600 dark:text-green-400' :
                                    portfolio_volatility?.sharpe_ratio > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-red-600 dark:text-red-400'
                            }`}>
                {portfolio_volatility?.sharpe_ratio || 0}
              </span>
                        </div>

                        <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {t('dashboard.maxDrawdown')}
              </span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                {portfolio_volatility?.max_drawdown || 0}%
              </span>
                        </div>

                        <div className={`mt-4 p-3 rounded-lg ${
                            portfolio_volatility?.beta > 1.2 ? 'bg-red-100 dark:bg-red-900/30' :
                                portfolio_volatility?.beta > 0.8 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                    'bg-green-100 dark:bg-green-900/30'
                        }`}>
                            <p className={`text-sm ${
                                portfolio_volatility?.beta > 1.2 ? 'text-red-700 dark:text-red-300' :
                                    portfolio_volatility?.beta > 0.8 ? 'text-yellow-700 dark:text-yellow-300' :
                                        'text-green-700 dark:text-green-300'
                            }`}>
                                {portfolio_volatility?.beta > 1.2 ? t('dashboard.highRiskPortfolio') :
                                    portfolio_volatility?.beta > 0.8 ? t('dashboard.moderateRiskPortfolio') :
                                        t('dashboard.lowRiskPortfolio')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 近期预警 */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('dashboard.recentAlerts')}
                    </h2>
                    <ExclamationTriangleIcon className="w-5 h-5 text-gray-400"/>
                </div>

                {(!recent_alerts || recent_alerts.length === 0) ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {t('dashboard.noAlerts')}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead>
                            <tr>
                                <th className="table-header">{t('dashboard.fund')}</th>
                                <th className="table-header">{t('dashboard.type')}</th>
                                <th className="table-header">{t('dashboard.currentNav')}</th>
                                <th className="table-header">{t('dashboard.targetNav')}</th>
                                <th className="table-header">{t('dashboard.triggerDate')}</th>
                                <th className="table-header">{t('dashboard.status')}</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {recent_alerts.slice(0, 5).map((alert) => (
                                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="table-cell">
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {alert.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {alert.code}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.type === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              alert.type === 2 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {alert.type_text}
                      </span>
                                    </td>
                                    <td className="table-cell font-medium">
                                        {alert.current_nav}
                                    </td>
                                    <td className="table-cell">
                                        {alert.target_nav}
                                    </td>
                                    <td className="table-cell">
                                        {alert.trigger_date}
                                    </td>
                                    <td className="table-cell">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.status === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              alert.status === 2 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {alert.status_text}
                      </span>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>

                        {recent_alerts.length > 5 && (
                            <div className="mt-4 text-center">
                                <button
                                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                                    {t('dashboard.viewAllAlerts')} ({recent_alerts.length})
                                    <ChevronRightIcon className="inline-block w-4 h-4 ml-1"/>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 持仓概览 */}
            <div className="card p-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('dashboard.holdingsOverview')}
                </h2>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                        <tr>
                            <th className="table-header">{t('dashboard.fund')}</th>
                            <th className="table-header">{t('dashboard.shares')}</th>
                            <th className="table-header">{t('dashboard.currentValue')}</th>
                            <th className="table-header">{t('dashboard.profitLoss')}</th>
                            <th className="table-header">{t('dashboard.weight')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {holdings_summary?.holdings?.slice(0, 5).map((holding) => (
                            <tr key={holding.code} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="table-cell">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {holding.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {holding.code}
                                        </div>
                                    </div>
                                </td>
                                <td className="table-cell">
                                    {holding.shares.toLocaleString()}
                                </td>
                                <td className="table-cell font-medium">
                                    {formatCurrency(holding.current_value)}
                                </td>
                                <td className="table-cell">
                                    <div className={`font-medium ${getColorForValue(holding.profit)}`}>
                                        {formatCurrency(holding.profit)}
                                    </div>
                                    <div className={`text-xs ${getColorForValue(holding.profit_rate)}`}>
                                        {formatPercent(holding.profit_rate)}
                                    </div>
                                </td>
                                <td className="table-cell">
                                    <div className="flex items-center gap-2">
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{width: `${holding.weight}%`}}
                                            />
                                        </div>
                                        <span className="text-sm font-medium min-w-[40px]">
                        {holding.weight}%
                      </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {holdings_summary?.holdings?.length > 5 && (
                    <div className="mt-4 text-center">
                        <button
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                            {t('dashboard.viewAllHoldings')} ({holdings_summary.holdings.length})
                            <ChevronRightIcon className="inline-block w-4 h-4 ml-1"/>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
