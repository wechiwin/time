import {useParams} from 'react-router-dom';
import {useEffect, useState} from 'react';
import NavHistoryChart from "../sub/NavHistoryChart";
import HoldingInfoCard from "../sub/HoldingInfoCard";
import useTradeList from "../../hooks/api/useTradeList";
import useHoldingList from "../../hooks/api/useHoldingList";
import useHoldingTimeline from "../../hooks/useHoldingTimeline";
import useHoldingSnapshot from "../../hooks/api/useHoldingSnapshot";
import useNavHistoryList from "../../hooks/api/useNavHistoryList"; // 假设你有的通用抽屉组件

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
    // 统一管理页面所需的所有数据状态
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
                const [tradeData,
                    infoData,
                    snapshotData,
                    navHistoryData] = await Promise.all([
                    fetchTrades(ho_id),
                    fetchHoldingInfo(ho_id),
                    fetchSnapshots(ho_id),
                    fetchNavHistory(ho_id),
                ]);
                // console.log("tradeData" + tradeData)
                // console.log("infoData" + infoData)
                // console.log("snapshotData" + snapshotData)
                setTrades(tradeData);
                setFundInfo(infoData);
                setSnapshots(snapshotData);
                setNavHistory(navHistoryData)
            } catch (e) {
                console.log(e)
            } finally {
                setLoading(false)
            }
        };
        loadData();
    }, [ho_id, fetchTrades, fetchHoldingInfo, fetchSnapshots, fetchNavHistory]);

    const {rounds, globalStats} = useHoldingTimeline(trades, snapshots, fundInfo);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
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
            />
        </div>
    );
}

