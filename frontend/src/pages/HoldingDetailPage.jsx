import {useParams, Link} from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {useEffect, useState, useMemo} from 'react';
import useHoldingList from "../hooks/api/useHoldingList";
import useNavHistoryList from "../hooks/api/useNavHistoryList";
import useTradeList from "../hooks/api/useTradeList";
import HoldingSearchSelect from "../components/search/HoldingSearchSelect";
import {motion, AnimatePresence} from 'framer-motion';
import TradeTable from "../components/tables/TradeTable";

export default function HoldingDetailPage() {
    const {ho_code} = useParams();               // 当前主基金
    const [fundInfo, setFundInfo] = useState(null);
    const [baseNav, setBaseNav] = useState([]);   // 主基金净值
    const [trades, setTrades] = useState([]);
    // const [netValues, setNetValues] = useState([]);
    // const [compareFunds, setCompareFunds] = useState([]);
    // const [loading, setLoading] = useState(true);

    /* ---- 对比基金：只存代码 ---- */
    // 对比基金代码数组（只存 code，不存完整对象）
    const [compareCodes, setCompareCodes] = useState([]);
    // 拉回来的净值 Map：{ code: [{date, nav}, ...] }
    const [compareNavMap, setCompareNavMap] = useState({});
    // 加载态
    const [loadingCompare, setLoadingCompare] = useState(false);

    /* 控制抽屉与图表类型 */
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [chartKind, setChartKind] = useState('unit_net_value'); // unit_net_value | accum_net_value

    const {getByCode} = useHoldingList({
        autoLoad: false,
    });
    const {searchList} = useNavHistoryList({
        autoLoad: false,
    });
    const {listByCode} = useTradeList({
        autoLoad: false,
    });

    /* 1. 基本信息 + 主基金净值 + 交易记录 */
    useEffect(() => {
        loadBase(ho_code);
    }, [ho_code]);

    async function loadBase(ho_code) {
        const res = await getByCode(ho_code);
        setFundInfo(res);
        const nav = await searchList(ho_code);
        console.log(nav);
        setBaseNav(nav);
        const records = await listByCode(ho_code);
        // console.log("records" + records);
        setTrades(records);
    }

    /* 2. 监听对比代码数组 → 拉净值 */
    useEffect(() => {
        if (compareCodes.length === 0) {
            setCompareNavMap({});
            return;
        }
        setLoadingCompare(true);
        Promise.all(
            compareCodes.map(async ho_code => {
                const list = await searchList(ho_code);
                return {ho_code, list};
            })
        )
            .then(arr => {
                const map = {};
                arr.forEach(({ho_code, list}) => (map[ho_code] = list));
                setCompareNavMap(map);
            })
            .finally(() => setLoadingCompare(false));
    }, [compareCodes]);

    /* 图表数据 */
    const dates = useMemo(() => baseNav.map(i => i.date), [baseNav]);

    const series = useMemo(() => {
        const s = [
            {
                name: ho_code,
                type: 'line',
                data: baseNav.map(i => i.nav_per_unit),
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2 },
            },
        ];

        // 对比基金曲线
        Object.entries(compareNavMap).forEach(([ho_code, list]) => {
            s.push({
                name: ho_code,
                type: 'line',
                data: list.map(i => i.nav_per_unit),
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 1.5, type: 'dashed' },
            });
        });

        // === 交易点标记 ===
        if (trades.length > 0) {
            const buyPoints = trades
                .filter(t => t.tr_type === '买入')
                .map(t => ({
                    name: '买入',
                    value: [t.tr_date, t.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolSize: 12,
                    itemStyle: { color: '#ef4444' }, // 红色
                }));

            const sellPoints = trades
                .filter(t => t.tr_type === '卖出')
                .map(t => ({
                    name: '卖出',
                    value: [t.tr_date, t.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolRotate: 180,
                    symbolSize: 12,
                    itemStyle: { color: '#3b82f6' }, // 蓝色
                }));

            s.push({
                name: '买入点',
                type: 'scatter',
                data: buyPoints,
                tooltip: {
                    formatter: p =>
                        `买入<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
            s.push({
                name: '卖出点',
                type: 'scatter',
                data: sellPoints,
                tooltip: {
                    formatter: p =>
                        `卖出<br/>日期：${p.value[0]}<br/>净值：${p.value[1]}`,
                },
            });
        }

        return s;
    }, [baseNav, compareNavMap, trades, ho_code]);

    function tTypeLabel(date) {
        const t = trades.find(i => i.tr_date === date);
        return t ? `${t.tr_type} ${t.tr_amount}` : '';
    }

    /* 4. 增 / 删对比 */
    const addCompare = code => {
        if (!code || compareCodes.includes(code)) return;
        setCompareCodes(prev => [...prev, code]);
    };
    const removeCompare = code => {
        setCompareCodes(prev => prev.filter(c => c !== code));
    };

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
                    <div>基金类型：<span className="font-medium">{fundInfo?.ho_type}</span></div>
                    {/* <div>当前持仓：<span className="font-medium">{fundInfo?.holding_amount ?? '—'}</span></div> */}
                </div>
            </div>

            {/* 净值走势 + 对比 */}
            <div className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="w-full max-w-xs">
                        <HoldingSearchSelect
                            placeholder="输入基金代码添加对比"
                            onChange={addCompare}
                        />
                    </div>

                    {/* 切换单位净值 / 累计净值 */}
                    <select
                        className="rounded border px-2 py-1 text-sm"
                        value={chartKind}
                        onChange={e => setChartKind(e.target.value)}
                    >
                        <option value="nav_per_unit">单位净值</option>
                        <option value="accum_net_value">累计净值</option>
                    </select>
                </div>

                {/* 已选标签 */}
                {compareCodes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {compareCodes.map(code => (
                            <span key={code} className="tag">
                                {code}
                                <button className="ml-2" onClick={() => removeCompare(code)}>×</button>
                            </span>
                        ))}
                    </div>
                )}

                <ReactECharts
                    option={{
                        title: {text: '净值走势'},
                        tooltip: {trigger: 'axis'},
                        legend: {
                            data: [ho_code, ...compareCodes, '交易点'],
                            bottom: 0,
                            left: 'center',
                            orient: 'horizontal',
                        },
                        grid: {left: 60, right: 40, bottom: 60, top: 40},
                        xAxis: {type: 'category', data: dates},
                        yAxis: {type: 'value', name: chartKind === 'nav_per_unit' ? '单位净值' : '累计净值'},
                        series,
                    }}
                    style={{height: 420}}
                    showLoading={loadingCompare}
                />
            </div>

            {/* 抽屉中的交易记录 */}
            <AnimatedDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50">
                        <h2 className="text-lg font-semibold">历史交易记录</h2>
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