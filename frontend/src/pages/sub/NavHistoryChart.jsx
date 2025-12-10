import {useEffect, useMemo, useRef, useState} from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from "dayjs";
import {useTranslation} from "react-i18next";
import useHoldingList from "../../hooks/api/useHoldingList";
import useNavHistoryList from "../../hooks/api/useNavHistoryList";
import useTradeList from "../../hooks/api/useTradeList";
import {useToast} from "../../components/toast/ToastContext";
import HoldingSearchSelect from "../../components/search/HoldingSearchSelect";

export default function NavHistoryChart({code}) {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();

    const [fundInfo, setFundInfo] = useState(null);
    const [navList, setNavList] = useState([]);
    const [trades, setTrades] = useState([]);

    const [compareCodes, setCompareCodes] = useState([]);
    const [loadingCompare, setLoadingCompare] = useState(false);
    // 结构: { '007028': { list: [], info: { } } }
    const [compareDataMap, setCompareDataMap] = useState({});

    const [chartKind, setChartKind] = useState('nav_per_unit'); // 'nav_per_unit' | 'nav_accumulated_per_unit'
    const [timeRange, setTimeRange] = useState('3y');
    const [dateParams, setDateParams] = useState({start_date: '', end_date: ''});

    const chartRef = useRef(null);

    const {getByCode} = useHoldingList({autoLoad: false});
    const {searchList} = useNavHistoryList({autoLoad: false});
    const {listByCode} = useTradeList({autoLoad: false});

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

    // 当时间变化时，加载主数据
    useEffect(() => {
        if (code && dateParams.end_date) {
            loadBase(code);
        }
    }, [code, dateParams]);

    // 当时间变化时，刷新对比数据
    useEffect(() => {
        if (dateParams.end_date && compareCodes.length > 0) {
            reloadCompareData(compareCodes);
        }
    }, [dateParams]);

    async function loadBase(targetCode) {
        // 并行请求：详情、净值、交易记录
        const [infoRes, navRes, tradeRes] = await Promise.all([
            getByCode(targetCode),
            searchList(targetCode, dateParams.start_date, dateParams.end_date),
            listByCode(targetCode) // 交易记录数量不多，拿全部，用于标记图表买卖点
        ]);
        setFundInfo(infoRes);
        setNavList(navRes || []);
        setTrades(tradeRes || []);
    }

    // 对比基金
    const fetchCompareItem = async (targetCode) => {
        try {
            const [info, list] = await Promise.all([
                getByCode(targetCode),
                searchList(targetCode, dateParams.start_date, dateParams.end_date)
            ]);
            return {code: targetCode, info, list};
        } catch (error) {
            console.error(`加载对比基金 ${targetCode} 失败`, error);
            return {info: {ho_short_name: '未知'}, list: []};
        }
    };

    const reloadCompareData = async (codes) => {
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
    };

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

    // 图表数据准备
    const mainFundName = useMemo(() => {
        return fundInfo ? `${code} ${fundInfo.ho_short_name}` : code;
    }, [fundInfo, code]);

    const chartData = useMemo(() => {
        // 收集所有日期
        const dateSet = new Set();
        navList.forEach(i => dateSet.add(i.nav_date));
        Object.values(compareDataMap).forEach(item => {
            item.list.forEach(i => dateSet.add(i.nav_date));
        });

        // 排序生成 X 轴
        const unifiedDates = Array.from(dateSet).sort();

        // 数据对齐
        const getDataKey = (item) => {
            return (chartKind === 'nav_per_unit') ? item.nav_per_unit : item.nav_accumulated_per_unit;
        };

        const mapDataToAxis = (list) => {
            if (!list) return [];
            const dataMap = new Map(list.map(i => [i.nav_date, getDataKey(i)]));
            return unifiedDates.map(date => dataMap.get(date) || null);
        };

        return {
            dates: unifiedDates,
            baseSeriesData: mapDataToAxis(navList),
            compareSeriesData: Object.entries(compareDataMap).map(([c, data]) => ({
                code: c,
                name: `${c} ${data.info?.ho_short_name || ''}`,
                data: mapDataToAxis(data.list)
            }))
        };
    }, [navList, compareDataMap, chartKind]);

    const series = useMemo(() => {
        const s = [
            {
                name: mainFundName,
                type: 'line',
                data: chartData.baseSeriesData,
                smooth: true,
                showSymbol: false,
                lineStyle: {width: 2},
            },
        ];

        chartData.compareSeriesData.forEach(item => {
            s.push({
                name: item.name,
                type: 'line',
                data: item.data,
                smooth: true,
                showSymbol: false,
                lineStyle: {width: 1.5, type: 'dashed'},
                connectNulls: true,
            });
        });

        // === 交易点标记 (仅在显示单位净值时) ===
        if (trades.length > 0 && chartKind === 'nav_per_unit') {
            const buyPoints = trades
                .filter(tr => tr.tr_type === 1 || tr.tr_type === '1')
                .map(tr => ({
                    name: t('tr_type_buy', '买入'),
                    value: [tr.tr_date, tr.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolSize: 12,
                    itemStyle: {color: '#ef4444'},
                }));

            const sellPoints = trades
                .filter(tr => tr.tr_type === 0 || tr.tr_type === '0')
                .map(tr => ({
                    name: t('tr_type_sell', '卖出'),
                    value: [tr.tr_date, tr.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolRotate: 180,
                    symbolSize: 12,
                    itemStyle: {color: '#3b82f6'},
                }));

            s.push({
                name: t('tr_type_buy', '买入'),
                type: 'scatter',
                data: buyPoints,
                seriesIndex: 0, // 关键：绑定到主轴
                tooltip: {
                    formatter: p => `买入<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
            s.push({
                name: t('tr_type_sell', '卖出'),
                type: 'scatter',
                data: sellPoints,
                seriesIndex: 0,
                tooltip: {
                    formatter: p => `卖出<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
        }
        return s;
    }, [chartData, trades, mainFundName, chartKind, t]);

    // ECharts 事件: 控制买卖点随主曲线显隐
    const onChartLegendSelectChanged = params => {
        const chartInstance = chartRef.current.getEchartsInstance();
        if (params.name === mainFundName) {
            const selected = params.selected[mainFundName];
            // 切换买卖点显隐
            chartInstance.dispatchAction({
                type: selected ? 'legendSelect' : 'legendUnSelect',
                name: t('tr_type_buy', '买入'),
            });
            chartInstance.dispatchAction({
                type: selected ? 'legendSelect' : 'legendUnSelect',
                name: t('tr_type_sell', '卖出'),
            });
        }
    };

    // 默认图例选中状态
    const legendData = [mainFundName, ...chartData.compareSeriesData.map(i => i.name)];
    const legendSelected = useMemo(() => {
        const selectedMap = {};
        legendData.forEach(name => selectedMap[name] = true);
        if (trades.length > 0) {
            // 默认选中隐藏的 Scatter series
            selectedMap[t('tr_type_buy', '买入')] = true;
            selectedMap[t('tr_type_sell', '卖出')] = true;
        }
        return selectedMap;
    }, [legendData, trades, t]);

    const fmtNum = (val, dec = 2) => val ? Number(val).toFixed(dec) : '-';

    if (!code) return <div className="p-6 text-center text-gray-400">请选择一个标的以查看详情</div>;

    return (
        <div className="space-y-4">
            {/* 净值走势图表 */}
            <div className="card p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
                    <div className="w-full max-w-xs">
                        <HoldingSearchSelect
                            placeholder={t('msg_search_placeholder', '搜索对比基金...')}
                            onChange={addCompare}
                        />
                    </div>

                    {/* 切换单位净值 / 累计净值 */}
                    <select
                        className="rounded border-gray-300 border px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        value={chartKind}
                        onChange={e => setChartKind(e.target.value)}
                    >
                        <option value="nav_per_unit">{t('th_nav_per_unit', '单位净值')}</option>
                        <option value="nav_accumulated_per_unit">{t('th_nav_accumulated_per_unit', '累计净值')}</option>
                    </select>
                </div>

                {/* 时间范围按钮组 */}
                <div className="mb-4">
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
                                    onClick={() => setTimeRange(range)}
                                    className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg transition-colors
${active
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {labels[range]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 已选对比标签 */}
                {compareCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {compareCodes.map(c => {
                            const info = compareDataMap[c]?.info;
                            return (
                                <span key={c}
                                      className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 border border-indigo-100">
                                    {c} {info?.ho_short_name}
                                    <button className="ml-2 text-indigo-400 hover:text-indigo-900 font-bold"
                                            onClick={() => removeCompare(c)}>×</button>
                                </span>
                            )
                        })}
                    </div>
                )}

                <ReactECharts
                    ref={chartRef}
                    option={{
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
                        },
                        legend: {
                            data: legendData,
                            selected: legendSelected,
                            bottom: 0,
                            left: 'center',
                            padding: [15, 0, 0, 0]
                        },
                        grid: {left: 50, right: 30, bottom: 40, top: 30, containLabel: true},
                        xAxis: {
                            type: 'category',
                            boundaryGap: false,
                            data: chartData.dates
                        },
                        yAxis: {
                            type: 'value',
                            scale: true,
                        },
                        series,
                    }}
                    style={{height: 450}}
                    showLoading={loadingCompare || navList.length === 0}
                    notMerge={true}
                    onEvents={{legendselectchanged: onChartLegendSelectChanged}}
                />
            </div>
        </div>
    );
}