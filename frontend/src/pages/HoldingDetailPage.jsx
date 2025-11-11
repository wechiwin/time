import {useParams, useSearchParams, Link} from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {useEffect, useState, useMemo} from 'react';
import useHoldingList from "../hooks/api/useHoldingList";
import useNetValueList from "../hooks/api/useNetValueList";
import useTransactionList from "../hooks/api/useTransactionList";
import FundNetValueChart from "../components/charts/FundNetValueChart";
import HoldingSearchSelect from "../components/search/HoldingSearchSelect";
import {motion, AnimatePresence} from 'framer-motion';

export default function HoldingDetailPage() {
    const {fund_code} = useParams();               // 当前主基金
    const [fundInfo, setFundInfo] = useState(null);
    const [baseNav, setBaseNav] = useState([]);   // 主基金净值
    const [trades, setTrades] = useState([]);
    const [netValues, setNetValues] = useState([]);
    const [compareFunds, setCompareFunds] = useState([]);
    const [loading, setLoading] = useState(true);

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
    const {searchList} = useNetValueList({
        autoLoad: false,
    });
    const {listByCode} = useTransactionList({
        autoLoad: false,
    });

    /* 1. 基本信息 + 主基金净值 + 交易记录 */
    useEffect(() => {
        loadBase(fund_code);
    }, [fund_code]);

    async function loadBase(fund_code) {
        const res = await getByCode(fund_code);
        setFundInfo(res);
        const nav = await searchList(fund_code);
        console.log(nav);
        setBaseNav(nav);
        const records = await listByCode(fund_code);
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
            compareCodes.map(async fund_code => {
                const list = await searchList(fund_code);
                return {fund_code, list};
            })
        )
            .then(arr => {
                const map = {};
                arr.forEach(({fund_code, list}) => (map[fund_code] = list));
                setCompareNavMap(map);
            })
            .finally(() => setLoadingCompare(false));
    }, [compareCodes]);


    /* 3. 图表 series */
    const series = useMemo(() => {
        const s = [
            {
                name: fund_code,
                type: 'line',
                data: baseNav.map(i => i.unit_net_value),
                smooth: true,
                showSymbol: false,
            },
        ];
        Object.entries(compareNavMap).forEach(([code, list]) => {
            s.push({
                name: fund_code,
                type: 'line',
                data: list.map(i => i.unit_net_value),
                smooth: true,
                showSymbol: false,
            });
        });
        return s;
    }, [baseNav, compareNavMap]);

    const dates = useMemo(() => baseNav.map(i => i.date), [baseNav]);

    /* 4. 增 / 删对比 */
    const addCompare = code => {
        if (!code || compareCodes.includes(code)) return;
        setCompareCodes(prev => [...prev, code]);
    };
    const removeCompare = code => {
        setCompareCodes(prev => prev.filter(c => c !== code));
    };

    /* 5. 交易表格列 */
    const tradeCols = [
        {key: 'transaction_type', label: '交易类型'},
        {key: 'transaction_date', label: '交易日期'},
        {key: 'transaction_shares', label: '交易份额'},
        {key: 'transaction_net_value', label: '单位净值'},
        {key: 'transaction_fee', label: '交易费用'},
        {key: 'transaction_amount', label: '交易总额'},
    ];

    return (
        <div className="space-y-6 p-4">
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between">
                <Link to="/holding" className="text-blue-600 hover:underline">
                    &lt; 返回列表
                </Link>

                <button
                    onClick={() => setDrawerOpen(true)}
                    className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
                >
                    交易记录
                </button>
            </div>
            {/* 基本信息 */}
            <div className="card">
                {/* <div className="card-header">基金基本信息</div> */}
                <div className="card-body">
                    <p>基金代码：{fundInfo?.fund_code}</p>
                    <p>基金名称：{fundInfo?.fund_name}</p>
                    <p>基金类型：{fundInfo?.fund_type}</p>
                </div>
            </div>

            {/* 净值走势 + 对比 */}
            <div className="card">
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
                        <option value="unit_net_value">单位净值</option>
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
                            data: [fund_code, ...compareCodes],
                            bottom: 0,
                            left: 'center',
                            orient: 'horizontal',
                            itemGap: 20,
                        },
                        grid: {left: 60, right: 40, bottom: 60, top: 40},
                        xAxis: {type: 'category', data: dates},
                        yAxis: {type: 'value', name: chartKind === 'unit_net_value' ? '单位净值' : '累计净值'},
                        series,
                    }}
                    style={{height: 400}}
                    showLoading={loadingCompare}
                />
            </div>

            {/* 抽屉：原生实现 */}
            <AnimatedDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                        <h2 className="text-lg font-semibold">历史交易记录</h2>
                        <button onClick={() => setDrawerOpen(false)}>×</button>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <table className="simple-table w-full">
                            <thead>
                            <tr>
                                {tradeCols.map(c => (
                                    <th key={c.key}>{c.label}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {trades.map(r => (
                                <tr key={r.id}>
                                    {tradeCols.map(c => (
                                        <td key={c.key}>
                                            {c.render ? c.render(r[c.key]) : r[c.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
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
                        className="fixed right-0 top-0 z-30 h-full w-96 bg-white shadow-lg"
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