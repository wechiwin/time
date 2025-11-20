import {Link, useParams} from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import useHoldingList from "../hooks/api/useHoldingList";
import useNavHistoryList from "../hooks/api/useNavHistoryList";
import useTradeList from "../hooks/api/useTradeList";
import HoldingSearchSelect from "../components/search/HoldingSearchSelect";
import {AnimatePresence, motion} from 'framer-motion';
import TradeTable from "../components/tables/TradeTable";
import dayjs from "dayjs";
import {useToast} from "../components/toast/ToastContext";
import {useTranslation} from "react-i18next";

export default function HoldingDetailPage() {
    const {ho_code} = useParams();               // 当前主基金
    const [fundInfo, setFundInfo] = useState(null);
    const [baseNav, setBaseNav] = useState([]);   // 主基金净值
    const [trades, setTrades] = useState([]);

    /* ---- 对比基金：只存代码 ---- */
    // 对比基金代码数组（只存 code，不存完整对象）
    const [compareCodes, setCompareCodes] = useState([]);
    // 加载态
    const [loadingCompare, setLoadingCompare] = useState(false);
    // 对比基金数据结构：{ '007028': { list: [], info: { ho_short_name: '...', ... } } }
    const [compareDataMap, setCompareDataMap] = useState({});

    /* 控制抽屉与图表类型 */
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [chartKind, setChartKind] = useState('nav_per_unit');
    // 时间范围控制
    const [timeRange, setTimeRange] = useState('3y'); // 默认近3年
    const [dateParams, setDateParams] = useState({start_date: '', end_date: ''});
    // ECharts 实例的引用，用于事件处理
    const chartRef = useRef(null);

    const {getByCode} = useHoldingList({autoLoad: false,});
    const {searchList} = useNavHistoryList({autoLoad: false,});
    const {listByCode} = useTradeList({autoLoad: false,});

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()

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
                break; // 自成立不传 start_date
            default:
                start = end.subtract(3, 'year');
        }

        const params = {
            end_date: end.format('YYYY-MM-DD'),
            start_date: start ? start.format('YYYY-MM-DD') : undefined
        };
        setDateParams(params);
    }, [timeRange]);

    /* 基本信息 + 主基金净值 + 交易记录 */
    useEffect(() => {
        // if (endDate) {
        if (dateParams.end_date) {
            loadBase();
        }
    }, [ho_code, dateParams]);

    // 专门负责刷新对比基金，当时间变化时，或者，当前有对比基金，需要用新时间重新拉取它们的数据
    useEffect(() => {
        if (dateParams.end_date && compareCodes.length > 0) {
            reloadCompareData(compareCodes);
        }
    }, [dateParams]);

    async function loadBase() {
        // 并行请求：详情、净值、交易记录
        const [infoRes, navRes, tradeRes] = await Promise.all([
            getByCode(ho_code),
            searchList(ho_code, dateParams.start_date, dateParams.end_date),
            listByCode(ho_code) // 交易记录通常拿全部，或者也传时间
        ]);
        setFundInfo(infoRes);
        setBaseNav(navRes || []);
        setTrades(tradeRes || []);
    }

    // 加载单个对比基金的详情和净值
    const fetchCompareItem = async (code) => {
        try {
            const [info, list] = await Promise.all([
                getByCode(code),
                searchList(code, dateParams.start_date, dateParams.end_date)
            ]);
            // console.log('info' + JSON.stringify(info))
            // console.log('list' + JSON.stringify(list))
            return {code, info, list};
        } catch (error) {
            console.error(`加载对比基金 ${code} 失败`, error);
            return {info: {ho_short_name: '未知'}, list: []};
        }
    };

    const mainFundName = useMemo(() => {
        return fundInfo ? `${ho_code} ${fundInfo.ho_short_name}` : ho_code;
    }, [fundInfo, ho_code]);

    // 时间切换时，重载所有已存在的对比基金
    const reloadCompareData = async (codes) => {
        setLoadingCompare(true);
        try {
            const results = await Promise.all(codes.map(code => fetchCompareItem(code)));
            const newMap = {};
            results.forEach(({code, info, list}) => {
                newMap[code] = {info, list};
            });
            console.log('newMap' + JSON.stringify(newMap))
            setCompareDataMap(newMap);
        } catch (err) {
            console.error("重载对比数据严重错误", err);
        } finally {
            setLoadingCompare(false);
        }
    };

    const chartData = useMemo(() => {
        // 1. 收集所有出现的日期
        const dateSet = new Set();
        baseNav.forEach(i => dateSet.add(i.nav_date));
        Object.values(compareDataMap).forEach(item => {
            item.list.forEach(i => dateSet.add(i.nav_date));
        });

        // 2. 排序生成统一 X 轴
        const unifiedDates = Array.from(dateSet).sort();

        // 3. 数据映射函数：将数据对齐到统一 X 轴，无数据填 null
        const getDataKey = (item) => {
            return (chartKind === 'nav_per_unit') ? item.nav_per_unit : item.nav_accumulated_per_unit;
        };

        const mapDataToAxis = (list) => {
            if (!list) return [];
            // 转成 Map 加速查找
            const dataMap = new Map(list.map(i => [i.nav_date, getDataKey(i)]));
            return unifiedDates.map(date => dataMap.get(date) || null); // null 在 echarts 表现为断点
        };
        // console.log('compareDataMap' + JSON.stringify(compareDataMap))
        // console.log('baseNav' + JSON.stringify(baseNav))


        return {
            dates: unifiedDates,
            baseSeriesData: mapDataToAxis(baseNav),
            compareSeriesData: Object.entries(compareDataMap).map(([code, data]) => ({
                code,
                // name: `${data.info?.ho_code || ''} ${data.info?.ho_short_name || ''}`, // 拼接名字
                name: `${code} ${data.info?.ho_short_name || ''}`, // 拼接名字
                data: mapDataToAxis(data.list)
            }))
        };
    }, [baseNav, compareDataMap, chartKind]);

    const series = useMemo(() => {
        const s = [
            // 主基金曲线
            {
                name: mainFundName,
                type: 'line',
                data: chartData.baseSeriesData,
                smooth: true,
                showSymbol: false,
                lineStyle: {width: 2},
            },
        ];

        // 对比基金曲线
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
        console.log('trades' + JSON.stringify(trades))

        // === 交易点标记 ===
        // TODO 多语言配置 买入和卖出数据库存储方式修改
        if (trades.length > 0 && chartKind === 'nav_per_unit') {
            const buyPoints = trades
                .filter(t => t.tr_type === '买入')
                .map(t => ({
                    name: '买入',
                    value: [t.tr_date, t.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolSize: 12,
                    itemStyle: {color: '#ef4444'}, // 红色
                }));

            const sellPoints = trades
                .filter(t => t.tr_type === '卖出')
                .map(t => ({
                    name: '卖出',
                    value: [t.tr_date, t.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolRotate: 180,
                    symbolSize: 12,
                    itemStyle: {color: '#3b82f6'}, // 蓝色
                }));

            s.push({
                name: '买入点',
                type: 'scatter',
                data: buyPoints,
                // **关键**：设置 seriesIndex: 0，使其默认和主基金（第一个系列）使用同一坐标系
                // 同时也允许后续通过事件控制它的显隐
                seriesIndex: 0,
                tooltip: {
                    formatter: p =>
                        `买入<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
            s.push({
                name: '卖出点',
                type: 'scatter',
                data: sellPoints,
                seriesIndex: 0, // 关键
                tooltip: {
                    formatter: p =>
                        `卖出<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
        }

        return s;
    }, [chartData, trades, mainFundName, chartKind]);

    /* 4. 增 / 删对比 */
    const addCompare = async (code) => {
        if (!code || compareCodes.includes(code)) return;
        if (compareCodes.length > 5) return showErrorToast('最多只能选择 5 个对比基金');

        setLoadingCompare(true);
        try {
            const {info, list} = await fetchCompareItem(code);
            setCompareDataMap(prev => ({
                ...prev,
                [code]: {info, list}
            }));
            setCompareCodes(prev => [...prev, code]);
        } finally {
            setLoadingCompare(false);
        }
    };
    const removeCompare = (code) => {
        setCompareCodes(prev => prev.filter(c => c !== code));
        setCompareDataMap(prev => {
            const next = {...prev};
            delete next[code];
            return next;
        });
    };

    /**
     * 交易点随主基金曲线的出现/消失而出现/消失
     * 监听图例状态改变事件
     */
    const onChartLegendSelectChanged = params => {
        const chartInstance = chartRef.current.getEchartsInstance();

        // 只有当主基金图例的状态发生变化时才处理
        if (params.name === mainFundName) {
            const selected = params.selected[mainFundName];

            // 获取所有系列的配置，找到 "买入点" 和 "卖出点" 的索引
            const option = chartInstance.getOption();
            const seriesNames = option.series.map(s => s.name);
            const buyIndex = seriesNames.indexOf('买入点');
            const sellIndex = seriesNames.indexOf('卖出点');

            // 切换 "买入点" 和 "卖出点" 的显示状态
            if (buyIndex !== -1 && sellIndex !== -1) {
                // ECharts 的 dispatchAction 方法用于触发行为
                chartInstance.dispatchAction({
                    type: selected ? 'legendSelect' : 'legendUnSelect',
                    name: '买入点',
                });
                chartInstance.dispatchAction({
                    type: selected ? 'legendSelect' : 'legendUnSelect',
                    name: '卖出点',
                });
            }
        }
    };

    // ECharts 事件映射
    const onEvents = {
        legendselectchanged: onChartLegendSelectChanged,
    };

    // 所有曲线的名称，用于 legend.data
    const legendData = [mainFundName, ...chartData.compareSeriesData.map(i => i.name)];

    // 用于初始化 ECharts 选中状态，确保交易点默认与主基金图例状态一致
    const legendSelected = useMemo(() => {
        const selectedMap = {};
        legendData.forEach(name => {
            selectedMap[name] = true;
        });
        // 默认将交易点设置为选中状态，因为它们没有在 legend.data 中，所以不会显示图例，
        // 但 chart.dispatchAction 可以控制它们的显隐。
        if (trades.length > 0) {
            selectedMap['买入点'] = true;
            selectedMap['卖出点'] = true;
        }
        return selectedMap;
    }, [legendData, trades]);

    return (
        <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between mb-2">
                <Link to="/holding" className="text-blue-600 hover:underline">
                    &lt; 返回列表
                </Link>

                <button
                    onClick={() => setDrawerOpen(true)}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                >
                    查看交易记录
                </button>
            </div>

            {/* 基金基本信息 */}
            <div className="card flex items-center justify-between flex-wrap gap-4 p-4">
                <div className="flex flex-col">
                    <span className="font-semibold text-lg">{fundInfo?.ho_name}</span>
                    <span className="text-sm text-gray-600">{fundInfo?.ho_code}</span>
                </div>
                <div className="flex gap-6 text-sm text-gray-700">
                    <div>{t('th_ho_type')}：<span className="font-medium">{fundInfo?.ho_type}</span></div>
                    {/* <div>当前持仓：<span className="font-medium">{fundInfo?.holding_amount ?? '—'}</span></div> */}
                </div>
            </div>

            {/* 净值走势 + 对比 */}
            <div className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="w-full max-w-xs">
                        <HoldingSearchSelect
                            placeholder={t('msg_search_placeholder')}
                            onChange={addCompare}
                        />
                    </div>

                    {/* 切换单位净值 / 累计净值 */}
                    <select
                        className="rounded border px-2 py-1 text-sm"
                        value={chartKind}
                        onChange={e => setChartKind(e.target.value)}
                    >
                        <option value="nav_per_unit">{t('th_nav_per_unit')}</option>
                        <option value="nav_accumulated_per_unit">{t('th_nav_accumulated_per_unit')}</option>
                    </select>
                </div>

                {/* 时间范围按钮组 */}
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    {['1y', '3y', '5y', 'all'].map((range) => {
                        const labels = {
                            '1y': t('button_one_year'),
                            '3y': t('button_three_year'),
                            '5y': t('button_five_year'),
                            'all': t('button_from_establish'),
                        };
                        const active = timeRange === range;
                        return (
                            <button
                                key={range}
                                type="button"
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-2 text-sm font-medium border first:rounded-l-lg last:rounded-r-lg 
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

                {/* 已选标签 */}
                {compareCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {compareCodes.map(code => {
                            const info = compareDataMap[code]?.info;
                            return (
                                <span key={code}
                                      className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 border border-indigo-100">
                                    {code} {info?.ho_short_name}
                                    <button className="ml-2 text-indigo-400 hover:text-indigo-900"
                                            onClick={() => removeCompare(code)}>×</button>
                                </span>
                            )
                        })}
                    </div>
                )}

                <ReactECharts
                    ref={chartRef} // 引用 ECharts 实例
                    option={{
                        title: {text: '净值走势', left: 'center'},
                        tooltip: {
                            trigger: 'axis',
                            axisPointer: {
                                type: 'cross',     // 横 + 竖虚线
                                snap: true,
                                lineStyle: {
                                    type: 'dashed'
                                }
                            },
                            formatter: function (params) {
                                let res = params[0].axisValueLabel + '<br/>';
                                params.forEach(item => {
                                    if (item.value !== null && item.value !== undefined) {
                                        // 处理 marker 颜色
                                        res += `${item.marker} ${item.seriesName}: ${item.value}<br/>`;
                                    }
                                });
                                return res;
                            },
                        },
                        legend: {
                            data: legendData,
                            selected: legendSelected, // 默认选中状态
                            bottom: 0,
                            left: 'center',
                            orient: 'horizontal',
                        },
                        grid: {left: 60, right: 40, bottom: 60, top: 40},
                        xAxis: {
                            type: 'category',
                            boundaryGap: false,
                            data: chartData.dates
                        },
                        yAxis: {
                            type: 'value',
                            scale: true, // 让 Y 轴不从 0 开始，聚焦波动
                            name: chartKind === 'nav_per_unit' ? t('th_nav_per_unit') : t('th_nav_accumulated_per_unit')
                        },
                        series,
                    }}
                    style={{height: 450}}
                    showLoading={loadingCompare || baseNav.length === 0}
                    notMerge={true} // 必须开启，防止旧数据残留
                    onEvents={onEvents}
                />
            </div>

            {/* 抽屉中的交易记录 */}
            <AnimatedDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50">
                        <h2 className="text-lg font-semibold">{t('button_trade_history')}</h2>
                        <button className="text-xl" onClick={() => setDrawerOpen(false)}>×</button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 bg-white">
                        <TradeTable data={trades}/>
                    </div>
                </div>
            </AnimatedDrawer>
        </div>
    );
}

function AnimatedDrawer({open, onClose, children}) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* 遮罩：淡入淡出 */}
                    <motion.div
                        key="mask"
                        className="fixed inset-0 z-20 bg-black/40"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        onClick={onClose}
                    />

                    {/* 抽屉：从右滑入 */}
                    <motion.div
                        key="drawer"
                        className="fixed right-0 top-0 z-30 h-full w-[800px] bg-white shadow-2xl"
                        initial={{x: '100%'}}
                        animate={{x: 0}}
                        exit={{x: '100%'}}
                        transition={{type: 'tween', duration: 0.3}}
                    >
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}