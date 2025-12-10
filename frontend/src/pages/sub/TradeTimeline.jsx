import {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
    ArrowDownIcon,
    ArrowPathIcon,
    ArrowUpIcon,
    ChartBarIcon,
    ClockIcon,
    CurrencyYenIcon
} from '@heroicons/react/24/outline';

export default function TradeTimeline({rounds = [], loading = false}) {
    const {t} = useTranslation();
    const [sortOrder, setSortOrder] = useState('desc');

    const sortedRounds = useMemo(() => {
        const sorted = [...rounds];
        return sortOrder === 'asc' ? sorted : sorted.reverse();
    }, [rounds, sortOrder]);

    const fmtNum = (val, decimals = 2) => {
        if (val === undefined || val === null) return '-';
        return Number(val).toFixed(decimals);
    };

    const getProfitColor = (val) => {
        if (!val) return 'text-gray-900';
        return val > 0 ? 'text-red-600' : val < 0 ? 'text-green-600' : 'text-gray-900';
    };

    const getTypeStyle = (type) => {
        const isBuy = type === 1 || type === '1';
        return isBuy
            ? {bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500'}
            : {bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500'};
    };

    return (
        <div className="space-y-4">
            {/* 工具栏 */}
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="text-sm text-gray-500">
                    {/* 如果在 loading，显示 '加载中...' 或者保持原样 */}
                    {loading
                        ? ''
                        : `${t('tl_total')} ${rounds.length} ${t('tl_round')}`
                    }
                </div>
                <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    disabled={loading} // 加载时禁用排序
                    className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded transition-colors ${
                        loading ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50'
                    }`}
                >
                    {sortOrder === 'asc' ? <ArrowUpIcon className="w-4 h-4"/> : <ArrowDownIcon className="w-4 h-4"/>}
                    {sortOrder === 'asc' ? t('tl_sort_asc', '时间正序') : t('tl_sort_desc', '时间倒序')}
                </button>
            </div>

            {/* 内容区域：Loading / 列表 / 空状态 */}
            <div className="space-y-6 min-h-[200px]"> {/* 给个最小高度防止闪烁 */}

                {loading ? (
                    // Loading 状态
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-500"/>
                    </div>
                ) : (
                    // 数据显示逻辑
                    <>
                        {sortedRounds.map((round, idx) => (
                            <div key={idx}
                                 className="relative border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
                                {/* 波段头部总结 (Summary Header) */}
                                <div
                                    className={`px-4 py-3 border-b border-gray-100 ${round.isClear ? 'bg-gray-50' : 'bg-indigo-50/50'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                    round.isClear
                                                        ? 'bg-gray-100 text-gray-600 border-gray-300'
                                                        : 'bg-green-100 text-green-700 border-green-300'
                                                }`}>
                                                    {round.isClear ? t('info_status_cleared', '已清仓') : t('info_status_holding', '持仓中')}
                                                </span>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {round.startDate} ~ {round.endDate || t('now', '至今')}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className={`text-right font-mono font-bold text-lg ${getProfitColor(round.stats.totalProfit)}`}>
                                            {round.stats.totalProfit > 0 ? '+' : ''}{fmtNum(round.stats.totalProfit)}
                                            <span className="text-xs text-gray-500 ml-1 font-normal">
                                                ({round.stats.returnRate > 0 ? '+' : ''}{fmtNum(round.stats.returnRate * 100)}%)
                                            </span>
                                        </div>
                                    </div>
                                    {/* 统计指标 Grid */}
                                    <div className="grid grid-cols-4 gap-2 text-xs text-gray-600 mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3"/> {t('info_hold_days', '持仓天数')}
                                            </span>
                                            <span
                                                className="font-medium">{round.stats.days} {t('info_hold_day_unit', '天')}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <CurrencyYenIcon className="w-3 h-3"/> {t('tl_avg_cost', '平均成本')}
                                            </span>
                                            <span className="font-medium">{fmtNum(round.stats.avgCost, 4)}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 flex items-center gap-1">
                                                <ChartBarIcon className="w-3 h-3"/> {t('tl_max_shares', '最大持仓')}
                                            </span>
                                            <span className="font-medium">{fmtNum(round.stats.maxShares, 2)}</span>
                                        </div>
                                        {!round.isClear && (
                                            <div className="flex flex-col">
                                                <span
                                                    className="text-gray-400">{t('tl_current_shares', '当前持仓')}</span>
                                                <span
                                                    className="font-medium text-indigo-600">{fmtNum(round.stats.currentShares, 2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* 具体交易记录时间轴 (Timeline) */}
                                <div className="p-4 bg-white">
                                    <div className="relative pl-4 border-l-2 border-gray-100 space-y-6">
                                        {(sortOrder === 'asc' ? round.trades : [...round.trades].reverse()).map((trade) => {
                                            const style = getTypeStyle(trade.tr_type);
                                            return (
                                                <div key={trade.tr_id} className="relative">
                                                    <div
                                                        className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${style.dot} shadow-sm`}></div>
                                                    <div className="flex justify-between items-start group">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span
                                                                    className="text-sm font-bold text-gray-700 font-mono">
                                                                    {trade.tr_date}
                                                                </span>
                                                                <span
                                                                    className={`text-xs px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}>
                                                                    {trade.tr_type === 1 || trade.tr_type === '1' ? t('tr_type_buy', '买入') : t('tr_type_sell', '卖出')}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 space-x-2">
                                                                <span>{t('th_tr_nav_per_unit', '交易净值')}: {trade.tr_nav_per_unit}</span>
                                                                <span>{t('th_tr_shares', '交易份额')}: {trade.tr_shares}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-medium text-gray-900">
                                                                {fmtNum(trade.tr_amount)}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {t('th_tr_fee', '交易费用')}: {trade.tr_fee}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* 空状态，仅当不 loading 且数据为空时显示 */}
                        {rounds.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                {t('tl_no_records', '暂无相关记录')}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}