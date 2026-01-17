// src/sub/NavHistoryChart.jsx
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from "dayjs";
import {useTranslation} from "react-i18next";
import useHoldingList from "../../hooks/api/useHoldingList";
import useNavHistoryList from "../../hooks/api/useNavHistoryList";
import {useToast} from "../../components/context/ToastContext";
import HoldingSearchSelect from "../../components/search/HoldingSearchSelect";
import {useDarkModeContext} from "../../components/context/DarkModeContext";
import {Switch} from "@headlessui/react";
import useChartData from "../../hooks/useChartData";

// 新增 props: onRangeChange, isLoadingMore
export default function NavHistoryChart({navHistory, snapshots, trades, fundInfo, onRangeChange, isLoadingMore}) {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {isDarkMode} = useDarkModeContext();
    const chartRef = useRef(null);
    // 内部状态主要管理 UI 交互和对比数据
    const [compareCodes, setCompareCodes] = useState([]);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [compareDataMap, setCompareDataMap] = useState({});
    const [chartKind, setChartKind] = useState('nav_per_unit');
    const [timeRange, setTimeRange] = useState('3y');
    const [dateParams, setDateParams] = useState({start_date: '', end_date: ''});
    const [showCostLine, setShowCostLine] = useState(true); // 成本线开关状态
    // 仅用于获取对比基金的数据 Hooks
    const {getByCode} = useHoldingList({autoLoad: false});
    const {searchList} = useNavHistoryList({autoLoad: false});

    // 处理时间切换的函数
    const handleTimeRangeClick = (range) => {
        setTimeRange(range);
        // 通知父组件，父组件判断是否需要加载更多数据
        if (onRangeChange) {
            onRangeChange(range);
        }
    };

    useEffect(() => {
        const end = dayjs();
        let start = null;

        switch (timeRange) {
            case '1y':
                start = end.subtract(1, 'year');
                break;
            case '3y':
                start = end.subtract(3, 'year');
                break;
            case '5y':
                start = end.subtract(5, 'year');
                break;
            case 'all':
                start = null;
                break;
            default:
                start = end.subtract(3, 'year');
        }

        const params = {
            end_date: end.format('YYYY-MM-DD'),
            start_date: start ? start.format('YYYY-MM-DD') : undefined
        };
        setDateParams(params);
    }, [timeRange]);

    // 当时间变化时，刷新对比数据
    useEffect(() => {
        if (dateParams.end_date && compareCodes.length > 0) {
            reloadCompareData(compareCodes);
        }
    }, [dateParams, compareCodes]);

    // 对比基金
    const fetchCompareItem = useCallback(async (targetId) => {
        try {
            const [info, list] = await Promise.all([
                getByCode(targetId),
                searchList(targetId, dateParams.start_date, dateParams.end_date)
            ]);
            return {code: targetId, info, list};
        } catch (error) {
            console.error(`加载对比基金 ${targetId} 失败`, error);
            return {info: {ho_short_name: '未知'}, list: []};
        }
    }, [dateParams.start_date, dateParams.end_date, getByCode, searchList]);

    const reloadCompareData = useCallback(async (codes) => {
        setLoadingCompare(true);
        try {
            const results = await Promise.all(codes.map(c => fetchCompareItem(c)));
            const newMap = {};
            results.forEach(({code: c, info, list}) => {
                newMap[c] = {info, list};
            });
            setCompareDataMap(newMap);
        } catch (err) {
            console.error("重载对比数据错误", err);
        } finally {
            setLoadingCompare(false);
        }
    }, [fetchCompareItem]);

    const addCompare = async (ho) => {
        if (!ho || !ho.ho_code || compareCodes.includes(ho.ho_code)) return;
        const targetCode = ho.ho_code;
        // TODO 多语言
        if (compareCodes.length > 5) return showErrorToast('最多只能选择 5 个对比基金');

        setLoadingCompare(true);
        try {
            const {info, list} = await fetchCompareItem(targetCode);
            setCompareDataMap(prev => ({
                ...prev,
                [targetCode]: {info, list}
            }));
            setCompareCodes(prev => [...prev, targetCode]);
        } finally {
            setLoadingCompare(false);
        }
    };

    const removeCompare = (targetCode) => {
        setCompareCodes(prev => prev.filter(c => c !== targetCode));
        setCompareDataMap(prev => {
            const next = {...prev};
            delete next[targetCode];
            return next;
        });
    };

    const filteredData = useMemo(() => {
        if (timeRange === 'all' || !dateParams.start_date) {
            // 如果是 'all'，则返回全部数据
            return {
                filteredNavHistory: navHistory,
                filteredSnapshots: snapshots,
                filteredTrades: trades,
            };
        }
        const start = dayjs(dateParams.start_date);
        const end = dayjs(dateParams.end_date);

        // 增加空值检查
        const safeNavHistory = navHistory || [];

        const filteredNavHistory = safeNavHistory.filter(s => {
            const current = dayjs(s.nav_date);
            return current.isAfter(start) && current.isBefore(end);
        });
        const filteredSnapshots = (snapshots || []).filter(s => {
            const current = dayjs(s.snapshot_date);
            return current.isAfter(start) && current.isBefore(end);
        });
        const filteredTrades = (trades || []).filter(t => {
            const current = dayjs(t.tr_date);
            return current.isAfter(start) && current.isBefore(end);
        });
        return {filteredNavHistory, filteredSnapshots, filteredTrades};
    }, [navHistory, snapshots, trades, dateParams, timeRange]); // 依赖项加入 timeRange

    // 图表数据准备
    const mainFundName = useMemo(() => {
        return fundInfo ? `${fundInfo.ho_code} ${fundInfo.ho_short_name}` : '';
    }, [fundInfo]);

    const {xAxisData, series, legendData, legendSelected} = useChartData({
        navHistory: filteredData.filteredNavHistory,
        snapshots: filteredData.filteredSnapshots,
        trades: filteredData.filteredTrades,
        compareDataMap,
        chartKind,
        showCostLine,
        mainFundName
    });

    // 获取暗黑模式下的图表主题配置
    const getChartOptions = useCallback(() => {
        const baseOptions = {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    snap: true,
                    lineStyle: {type: 'dashed'}
                },
                formatter: function (params) {
                    let res = params[0].axisValueLabel + '<br/>';
                    params.forEach(item => {
                        if (item.value !== null && item.value !== undefined) {
                            res += `${item.marker} ${item.seriesName}: ${item.value}<br/>`;
                        }
                    });
                    return res;
                },
                backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                borderColor: isDarkMode ? '#374151' : '#d1d5db',
                textStyle: {
                    color: isDarkMode ? '#e5e7eb' : '#374151'
                }
            },
            legend: {
                data: legendData,
                selected: legendSelected,
                bottom: 0,
                left: 'center',
                padding: [15, 0, 0, 0],
                textStyle: {
                    color: isDarkMode ? '#e5e7eb' : '#374151'
                }
            },
            grid: {
                left: 50,
                right: 30,
                bottom: 40,
                top: 30,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: xAxisData,
                axisLine: {
                    lineStyle: {
                        color: isDarkMode ? '#4b5563' : '#d1d5db'
                    }
                },
                axisLabel: {
                    color: isDarkMode ? '#9ca3af' : '#6b7280'
                }
            },
            yAxis: {
                type: 'value',
                scale: true,
                axisLine: {
                    lineStyle: {
                        color: isDarkMode ? '#4b5563' : '#d1d5db'
                    }
                },
                axisLabel: {
                    color: isDarkMode ? '#9ca3af' : '#6b7280'
                },
                splitLine: {
                    lineStyle: {
                        color: isDarkMode ? '#374151' : '#e5e7eb',
                        type: 'dashed'
                    }
                }
            },
            series,
            backgroundColor: isDarkMode ? '#111827' : '#ffffff'
        };
        return baseOptions;
    }, [legendData, legendSelected, xAxisData, series, isDarkMode]);

    // 在 return 语句前添加调试输出
    // console.log('Chart Data Debug:', {
    //     navHistoryLength: navHistory?.length,
    //     filteredNavHistoryLength: filteredData.filteredNavHistory?.length,
    //     snapshotsLength: snapshots?.length,
    //     tradesLength: trades?.length,
    //     xAxisDataLength: xAxisData?.length,
    //     seriesCount: series?.length,
    //     xAxisDataSample: xAxisData?.slice(0, 5),
    //     seriesSample: series?.map(s => ({
    //         name: s.name,
    //         dataLength: s.data?.length,
    //         dataSample: s.data?.slice(0, 3)
    //     }))
    // });


    return (
        <div className="space-y-4">
            {/* 净值走势图表 */}
            <div
                className="card p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
                    <div className="w-full max-w-xs">
                        <HoldingSearchSelect
                            placeholder={t('msg_search_placeholder', '搜索对比基金...')}
                            onChange={addCompare}
                        />
                    </div>

                    {/* 切换单位净值 / 累计净值 */}
                    <select
                        className="rounded border-gray-300 dark:border-gray-600 border px-2 py-1 text-sm
                        focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-400 dark:focus:border-indigo-400
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        value={chartKind}
                        onChange={e => setChartKind(e.target.value)}
                    >
                        <option value="nav_per_unit">{t('th_nav_per_unit', '单位净值')}</option>
                        <option value="nav_accumulated_per_unit">{t('th_nav_accumulated_per_unit', '累计净值')}</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={showCostLine}
                            onChange={setShowCostLine}
                            className={`${showCostLine ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}
                              relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${showCostLine ? 'translate-x-6' : 'translate-x-1'}
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </Switch>
                        <span
                            className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chart_show_cost_line', '显示成本线')}</span>
                    </div>
                </div>

                {/* 时间范围按钮组 - 修改 onClick 事件 */}
                <div className="mb-4 flex items-center">
                    <div className="inline-flex rounded-md shadow-sm" role="group">
                        {['1y', '3y', '5y', 'all'].map((range) => {
                            const labels = {
                                '1y': t('button_one_year', '近1年'),
                                '3y': t('button_three_year', '近3年'),
                                '5y': t('button_five_year', '近5年'),
                                'all': t('button_from_establish', '成立来'),
                            };
                            const active = timeRange === range;
                            return (
                                <button
                                    key={range}
                                    type="button"
                                    // 修改这里：调用 handleTimeRangeClick
                                    onClick={() => handleTimeRangeClick(range)}
                                    className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg transition-colors
                                        ${active
                                        ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {labels[range]}
                                </button>
                            );
                        })}
                    </div>
                    {/* 显示加载状态 */}
                    {(isLoadingMore || loadingCompare) && (
                        <div className="ml-4 text-sm text-gray-500 flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('msg_loading_data', '加载数据中...')}
                        </div>
                    )}
                </div>

                {/* 已选对比标签 */}
                {compareCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {compareCodes.map(c => {
                            const info = compareDataMap[c]?.info;
                            return (
                                <span key={c}
                                      className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/30
                                      px-3 py-1 text-sm text-indigo-700 dark:text-indigo-300
                                      border border-indigo-100 dark:border-indigo-700">
                                    {c} {info?.ho_short_name}
                                    <button
                                        className="ml-2 text-indigo-400 dark:text-indigo-500 hover:text-indigo-900 dark:hover:text-indigo-200 font-bold"
                                        onClick={() => removeCompare(c)}>×</button>
                                </span>
                            )
                        })}
                    </div>
                )}

                <ReactECharts
                    ref={chartRef}
                    option={getChartOptions()}
                    style={{height: 450}}
                    // 合并 loading 状态
                    showLoading={isLoadingMore || loadingCompare}
                    notMerge={true}
                    lazyUpdate={false}
                />
            </div>
        </div>
    );
}