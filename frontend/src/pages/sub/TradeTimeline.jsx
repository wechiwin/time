// src/components/sub/TradeTimeline.jsx
import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import {
    ArrowDownIcon,
    ArrowPathIcon,
    ArrowUpIcon,
    BanknotesIcon,
    ChartBarIcon,
    ClockIcon,
    CurrencyYenIcon,
    PresentationChartLineIcon
} from '@heroicons/react/24/outline';
import {formatCurrency, formatPercent, formatNumber} from '../../utils/numberFormatters';
import NavChart from './NavChart';
import {useColorContext} from "../../components/context/ColorContext";
import {useEnumTranslation} from "../../contexts/EnumContext";

export default function TradeTimeline({rounds = [], loading = false}) {
    const {t} = useTranslation();
    const {translateEnum} = useEnumTranslation();
    const {getProfitColor, invertColors} = useColorContext();
    const [sortOrder, setSortOrder] = useState('desc');

    const sortedRounds = useMemo(() => {
        const sorted = [...rounds];
        return sortOrder === 'asc' ? sorted : sorted.reverse();
    }, [rounds, sortOrder]);

    // 前端计算持仓天数
    const calculateHoldDays = (startDate, endDate, isClear) => {
        if (!startDate) return 0;
        const end = isClear && endDate ? dayjs(endDate) : dayjs();
        return Math.max(1, Math.ceil(end.diff(dayjs(startDate), 'day', true)));
    };

    const getTypeStyle = (type) => {
        const isBuy = type === 'BUY';
        // Chinese: red=buy, blue/green=sell; International: green=buy, red=sell
        if (invertColors) {
            // Chinese convention
            return isBuy
                ? {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    text: 'text-red-700 dark:text-red-300',
                    border: 'border-red-200 dark:border-red-700',
                    dot: 'bg-red-500'
                }
                : {
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    text: 'text-green-700 dark:text-green-300',
                    border: 'border-green-200 dark:border-green-700',
                    dot: 'bg-green-500'
                };
        } else {
            // International convention
            return isBuy
                ? {
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    text: 'text-green-700 dark:text-green-300',
                    border: 'border-green-200 dark:border-green-700',
                    dot: 'bg-green-500'
                }
                : {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    text: 'text-red-700 dark:text-red-300',
                    border: 'border-red-200 dark:border-red-700',
                    dot: 'bg-red-500'
                };
        }
    };

    return (
        <div className="space-y-4">
            {/* 工具栏 */}
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {loading ? '' : `${t('tl_total')} ${rounds.length} ${t('tl_round')}`}
                </div>
                <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    disabled={loading}
                    className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                        loading
                            ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                            : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20'
                    }`}
                >
                    {sortOrder === 'asc' ? <ArrowUpIcon className="w-4 h-4"/> : <ArrowDownIcon className="w-4 h-4"/>}
                    {sortOrder === 'asc' ? t('tl_sort_asc') : t('tl_sort_desc')}
                </button>
            </div>

            {/* 内容区域 */}
            <div className="space-y-6 min-h-[200px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500 dark:text-indigo-400"/>
                    </div>
                ) : (
                    <>
                        {sortedRounds.map((round, idx) => {
                            const holdDays = calculateHoldDays(round.startDate, round.endDate, round.isClear);
                            const hasProfit = round.stats.totalProfit != null;
                            const hasReturnRate = round.stats.returnRate != null;
                            const profitColor = hasProfit ? getProfitColor(round.stats.totalProfit) : 'text-gray-500 dark:text-gray-400';
                            const returnRateColor = hasReturnRate ? getProfitColor(round.stats.returnRate * 100) : 'text-gray-500 dark:text-gray-400';

                            return (
                                <div key={idx}
                                     className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                                    {/* 波段头部总结 */}
                                    <div
                                        className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${round.isClear ? 'bg-gray-50 dark:bg-gray-900/30' : 'bg-indigo-50/50 dark:bg-indigo-900/10'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                    round.isClear
                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                                        : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600'
                                                }`}>
                                                    {round.isClear ? t('info_status_cleared') : t('info_status_holding')}
                                                </span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                                    {round.startDate} ~ {round.isClear ? round.endDate : t('now', '现在')}
                                                </span>
                                            </div>
                                            <div className={`text-right font-mono font-bold text-lg ${profitColor}`}>
                                                {hasProfit ? formatCurrency(round.stats.totalProfit) : '--'}
                                                <span className={`text-xs ml-1 font-normal ${returnRateColor}`}>
                                                    ({hasReturnRate ? formatPercent(round.stats.returnRate * 100) : '--'})
                                                </span>
                                            </div>
                                        </div>

                                        {/* 统计指标 */}
                                        <div
                                            className="grid grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-300 mt-2">
                                            <div className="flex flex-col">
                                                <span
                                                    className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                    <ClockIcon className="w-3 h-3"/> {t('info_hold_days')}
                                                </span>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">
                                                    {holdDays} {t('info_hold_day_unit')}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span
                                                    className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                    <CurrencyYenIcon className="w-3 h-3"/> {t('tl_avg_cost')}
                                                </span>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">
                                                    {formatCurrency(round.stats.avgCost)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span
                                                    className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                    <ChartBarIcon className="w-3 h-3"/> {t('tl_max_shares')}
                                                </span>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">
                                                    {formatNumber(round.stats.maxShares)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                {round.isClear ? (
                                                    <>
                                                        <span
                                                            className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                            <BanknotesIcon className="w-3 h-3"/> {t('tl_total_profit')}
                                                        </span>
                                                        <span className={`font-medium ${profitColor}`}>
                                                            {hasProfit ? formatCurrency(round.stats.totalProfit) : '--'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span
                                                            className="text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                                            <PresentationChartLineIcon
                                                                className="w-3 h-3"/> {t('tl_current_shares')}
                                                        </span>
                                                        <span
                                                            className="font-medium text-indigo-600 dark:text-indigo-400">
                                                            {formatNumber(round.stats.currentShares)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 左右分栏：交易流水 + 净值走势 */}
                                    <div className="flex flex-col md:flex-row">
                                        {/* 左侧：交易流水 - 固定高度可滚动 */}
                                        <div className="flex-1 p-4 bg-white dark:bg-gray-800 max-h-96 overflow-y-auto
                                            scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent
                                            [&::-webkit-scrollbar]:w-1.5
                                            [&::-webkit-scrollbar-track]:bg-transparent
                                            [&::-webkit-scrollbar-thumb]:bg-gray-300
                                            [&::-webkit-scrollbar-thumb]:rounded-full
                                            dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                                            <div
                                                className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-6">
                                                {(sortOrder === 'asc' ? round.trades : [...round.trades].reverse()).map((trade) => {
                                                    const style = getTypeStyle(trade.tr_type);
                                                    const amountColor = getProfitColor(trade.cash_amount);

                                                    return (
                                                        <div key={trade.id} className="relative">
                                                            <div
                                                                className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${style.dot} shadow-sm`}></div>
                                                            <div className="flex justify-between items-start group">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span
                                                                            className="text-sm font-bold text-gray-700 dark:text-gray-200 font-mono">
                                                                            {trade.tr_date}
                                                                        </span>
                                                                        <span
                                                                            className={`text-xs px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                                                                            {translateEnum('TradeTypeEnum', trade.tr_type)}
                                                                        </span>
                                                                    </div>
                                                                    <div
                                                                        className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 space-y-0.5">
                                                                        {/* <div>{t('th_tr_nav_per_unit')}: {trade.tr_nav_per_unit}</div> */}
                                                                        {/* <div>{t('th_tr_shares')}: {trade.tr_shares}</div> */}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right min-w-[120px]">
                                                                    {/* 实际收付 - 大字 */}
                                                                    <div
                                                                        className={`font-bold text-base ${amountColor}`}>
                                                                        {formatCurrency(trade.cash_amount)}
                                                                    </div>
                                                                    {/* 交易费用和交易金额 - 小字 */}
                                                                    {/* <div */}
                                                                    {/*     className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 space-y-0.5"> */}
                                                                    {/*     <div>{t('th_tr_fee')}: {formatCurrency(trade.tr_fee)}</div> */}
                                                                    {/*     <div>{t('th_tr_amount')}: {formatCurrency(trade.tr_amount)}</div> */}
                                                                    {/* </div> */}
                                                                </div>
                                                            </div>
                                                            {/* --- 使用 Grid 布局优化 4 个字段的显示 --- */}
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-xs bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 mt-1">
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 scale-90 origin-left mb-0.5">{t('th_price_per_unit')}</span>
                                                                    <span className="font-mono text-gray-700 dark:text-gray-300">{formatNumber(trade.tr_nav_per_unit, 4)}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 scale-90 origin-left mb-0.5">{t('th_tr_shares')}</span>
                                                                    <span className="font-mono text-gray-700 dark:text-gray-300">{formatNumber(trade.tr_shares, 2)}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 scale-90 origin-left mb-0.5">{t('th_tr_amount')}</span>
                                                                    <span className="font-mono text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(trade.tr_amount)}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-gray-400 scale-90 origin-left mb-0.5">{t('th_tr_fee')}</span>
                                                                    <span className="font-mono text-gray-600 dark:text-gray-400">{formatCurrency(trade.tr_fee)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 右侧：净值走势图 */}
                                        <div
                                            className="flex-1 p-4 bg-white dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700"
                                        >
                                            <NavChart
                                                hoId={round.trades[0]?.ho_id}
                                                startDate={round.startDate}
                                                endDate={round.isClear ? round.endDate : dayjs().format('YYYY-MM-DD')}
                                                trades={round.trades}
                                                className="h-80"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {rounds.length === 0 && (
                            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                                {t('tl_no_records')}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
