import {useTranslation} from "react-i18next";
import {BanknotesIcon, ChartPieIcon, ScaleIcon} from '@heroicons/react/24/outline';

/**
 * 基金持仓概览卡片
 * @param {Object} fundInfo - 基金基本信息 (ho_name, ho_type)
 * @param {Object} globalStats - 统计数据 (totalProfit, isHolding, currentCost, etc.)
 * @param {Function} [onOpenTradeHistory] - 点击"交易记录"按钮的回调 (可选)
 */
export default function HoldingInfoCard({
                                            fundInfo,
                                            globalStats
                                        }) {
    const {t} = useTranslation();

    // 内部使用的格式化小助手
    const fmtNum = (val, dec = 2) => (val !== undefined && val !== null) ? Number(val).toFixed(dec) : '-';
    // 格式化百分比
    const fmtPct = (val) => (val !== undefined && val !== null) ? (val * 100).toFixed(2) + '%' : '-'; // <-- NEW
    // 辅助判断：是否有有效的统计数据
    const hasStats = !!globalStats;

    return (
        <div
            className="card p-5 bg-white dark:bg-gray-700 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600">
            {/* 头部：名称、代码、按钮、总收益 */}
            <div
                className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-4 border-gray-100 dark:border-gray-600">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {fundInfo?.ho_code} {fundInfo?.ho_short_name}
                    </h1>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3">
                        {/* <span */}
                        {/*     className="bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-mono">{code}</span> */}
                        {/* <span className="text-gray-600 dark:text-gray-300">{fundInfo?.ho_type}</span> */}
                    </div>
                </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                {/* 持仓状态 */}
                <div className="space-y-1">
                    <div
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <ScaleIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/>
                        {t('info_hold_status', '持仓状态')}
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-200">
                        {hasStats ? (
                            <>
                                {globalStats.isHolding ? (
                                    <span
                                        className="text-indigo-600 dark:text-indigo-400">{t('info_status_holding', '持仓中')}</span>
                                ) : (
                                    <span
                                        className="text-gray-400 dark:text-gray-500">{t('info_status_cleared', '已清仓')}</span>
                                )}
                                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-2">
                                    ({globalStats.totalRounds} {t('info_rounds', '次')})
                                </span>
                            </>
                        ) : '-'}
                    </div>
                </div>

                {/* /!* 持仓成本 *!/ */}
                {/* <div className="space-y-1"> */}
                {/*     <div */}
                {/*         className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"> */}
                {/*         <BanknotesIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/> */}
                {/*         {t('info_hold_cost', '持仓成本')} */}
                {/*     </div> */}
                {/*     <div className="font-semibold text-gray-900 dark:text-gray-200"> */}
                {/*         {hasStats && globalStats.isHolding ? fmtNum(globalStats.currentCost, 4) : '-'} */}
                {/*     </div> */}
                {/* </div> */}

                {/* /!* 持仓天数 *!/ */}
                {/* <div className="space-y-1"> */}
                {/*     <div */}
                {/*         className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"> */}
                {/*         <ClockIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/> */}
                {/*         {t('info_cumulative_hold_days', '累计持仓天数')} */}
                {/*     </div> */}
                {/*     <div className="font-semibold text-gray-900 dark:text-gray-200"> */}
                {/*         {hasStats ? ( */}
                {/*             <> */}
                {/*                 {globalStats.totalHoldingDays} */}
                {/*                 <span */}
                {/*                     className="text-xs ml-0.5 text-gray-600 dark:text-gray-400">{t('info_hold_day_unit', '天')}</span> */}
                {/*             </> */}
                {/*         ) : '-'} */}
                {/*     </div> */}
                {/* </div> */}

                {/* /!* 当前份额 *!/ */}
                {/* <div className="space-y-1"> */}
                {/*     <div */}
                {/*         className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider"> */}
                {/*         <PresentationChartLineIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/> */}
                {/*         {t('info_holding_shares', '当前份额')} */}
                {/*     </div> */}
                {/*     <div className="font-semibold text-gray-900 dark:text-gray-200"> */}
                {/*         {hasStats && globalStats.isHolding ? fmtNum(globalStats.currentShares, 2) : (hasStats ? '0.00' : '-')} */}
                {/*     </div> */}
                {/* </div> */}

                {/* 累计收益 */}
                <div className="space-y-1">
                    <div
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <BanknotesIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/>
                        {t('info_cumulative_returns', '累计收益')}
                    </div>
                    <div
                        className={`font-semibold ${hasStats ? (globalStats.totalProfit >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-900 dark:text-gray-200'}`}>
                        {hasStats ? (
                            <>
                                {globalStats.totalProfit > 0 ? '+' : ''}
                                {fmtNum(globalStats.totalProfit)}
                            </>
                        ) : '-'}
                    </div>
                </div>

                <div className="space-y-1">
                    <div
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <ChartPieIcon className="w-3 h-3 text-gray-400 dark:text-gray-500"/>
                        {t('info_cumulative_return_rate', '累计收益率')}
                    </div>
                    <div
                        className={`font-semibold ${hasStats ? (globalStats.cumulativeReturnRate >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400') : 'text-gray-900 dark:text-gray-200'}`}>
                        {hasStats ? (
                            <>
                                {globalStats.cumulativeReturnRate > 0 ? '+' : ''}
                                {fmtPct(globalStats.cumulativeReturnRate)}
                            </>
                        ) : '-'}
                    </div>
                </div>

            </div>
        </div>
    );
}
