// src/pages/NavHistoryDetailPage.jsx
import {useParams} from 'react-router-dom';
import {useEffect, useState, useCallback} from 'react';
import NavHistoryChart from "../sub/NavHistoryChart";
import HoldingInfoCard from "../sub/HoldingInfoCard";
import useTradeList from "../../hooks/api/useTradeList";
import useHoldingList from "../../hooks/api/useHoldingList";
import useHoldingTimeline from "../../hooks/useHoldingTimeline";
import useHoldingSnapshot from "../../hooks/api/useHoldingSnapshot";
import useNavHistoryList from "../../hooks/api/useNavHistoryList";
import dayjs from "dayjs";

export default function NavHistoryDetailPage() {
    const {ho_id} = useParams();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
    // 统一管理页面所需的所有数据状态
    const [loading, setLoading] = useState(false);
    const [trades, setTrades] = useState([]);
    const [fundInfo, setFundInfo] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [navHistory, setNavHistory] = useState([]);

    // 标记是否已经加载了全部历史数据
    const [isFullHistoryLoaded, setIsFullHistoryLoaded] = useState(false);

    // API Hooks
    const {listByHoId: fetchTrades} = useTradeList({autoLoad: false});
    const {getById: fetchHoldingInfo} = useHoldingList({autoLoad: false});
    const {list_hos: fetchSnapshots} = useHoldingSnapshot({autoLoad: false});
    const {list_history: fetchNavHistory} = useNavHistoryList({autoLoad: false});

    // 获取数据
    useEffect(() => {
        if (!ho_id) {
            setLoading(false); // 如果没有 ID，停止加载
            return;
        }

        const loadData = async () => {
            setLoading(true); // 开始加载
            try {
                // 计算3年前的日期
                const threeYearsAgo = dayjs().subtract(3, 'year').format('YYYY-MM-DD');

                const [tradeData, infoData, snapshotData, navHistoryData] = await Promise.all([
                    fetchTrades(ho_id),
                    fetchHoldingInfo(ho_id),
                    fetchSnapshots(ho_id),
                    // 传入 start_date 限制数据量
                    fetchNavHistory(ho_id, threeYearsAgo),
                ]);
                // console.log("tradeData" + tradeData)
                // console.log("infoData" + infoData)
                // console.log("snapshotData" + snapshotData)
                setTrades(tradeData);
                setFundInfo(infoData);
                setSnapshots(snapshotData);
                setNavHistory(navHistoryData)
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false)
            }
        };
        loadData();
    }, [ho_id, fetchTrades, fetchHoldingInfo, fetchSnapshots, fetchNavHistory]);

    // 处理时间范围变更：如果用户需要更多数据，则加载全部
    const handleRangeChange = useCallback(async (range) => {
        // 如果已经加载了全部数据，或者用户只看 1y/3y (且当前已有数据)，则不需要请求
        if (isFullHistoryLoaded) return;
        if (range === '1y' || range === '3y') return;

        // 如果用户点击了 '5y' 或 'all'，且尚未加载全部数据 -> 发起请求
        setLoading(true);
        try {
            // 不传 start_date 即获取全部历史
            const allHistory = await fetchNavHistory(ho_id);
            setNavHistory(allHistory);
            setIsFullHistoryLoaded(true); // 标记为已加载全部
        } catch (e) {
            console.error("Failed to load full history", e);
        } finally {
            setLoading(false);
        }
    }, [ho_id, isFullHistoryLoaded, fetchNavHistory]);

    const {rounds, globalStats} = useHoldingTimeline(trades, snapshots, fundInfo);

    return (
        <div className="space-y-4">
            <HoldingInfoCard
                fundInfo={fundInfo}
                globalStats={globalStats}
                loading={loading}
            />
            <NavHistoryChart
                navHistory={navHistory}
                snapshots={snapshots}
                trades={trades}
                fundInfo={fundInfo}
                // 将回调传递给子组件
                onRangeChange={handleRangeChange}
                // 可以传递 loading 状态给图表显示加载动画
                isLoadingMore={loading}
            />
        </div>
    );
}

