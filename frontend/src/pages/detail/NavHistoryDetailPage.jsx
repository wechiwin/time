import {useParams} from 'react-router-dom';
import {useEffect, useState} from 'react';
import NavHistoryChart from "../sub/NavHistoryChart";
import HoldingInfoCard from "../sub/HoldingInfoCard";
import useTradeAnalysis from "../../hooks/useTradeAnalysis";
import useTradeList from "../../hooks/api/useTradeList";
import useHoldingList from "../../hooks/api/useHoldingList";
import useNavHistoryList from "../../hooks/api/useNavHistoryList"; // 假设你有的通用抽屉组件

export default function NavHistoryDetailPage() {
    const {ho_code} = useParams();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);

    const [trades, setTrades] = useState([]);
    const [fundInfo, setFundInfo] = useState(null);
    const [latestNavpu, setLatestNavpu] = useState([]);

    const {listByCode} = useTradeList({autoLoad: false});
    const {getByCode} = useHoldingList({autoLoad: false});
    const {getLatestNav} = useNavHistoryList({autoLoad: false});

    const {globalStats} = useTradeAnalysis(trades, fundInfo, latestNavpu);

    // 获取数据
    useEffect(() => {
        if (!ho_code) return;
        const loadData = async () => {
            // setLoading(true); // 开始加载
            try {
                const [tr, info, nav] = await Promise.all([
                    listByCode(ho_code),
                    getByCode(ho_code),
                    getLatestNav(ho_code)
                ]);
                setTrades(tr || []);
                setFundInfo(info);
                setLatestNavpu(nav || {});
            } catch (e) {
                console.log(e)
            } finally {
                // setLoading(false)
            }
        };
        loadData();
    }, [ho_code]);

    return (
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
            <HoldingInfoCard
                code={ho_code}
                fundInfo={fundInfo}
                globalStats={globalStats}
            />
            <NavHistoryChart code={ho_code}/>
        </div>
    );
}

