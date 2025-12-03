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
    const [baseNav, setBaseNav] = useState([]);

    const {listByCode} = useTradeList({autoLoad: false});
    const {getByCode} = useHoldingList({autoLoad: false});
    const {searchList} = useNavHistoryList({autoLoad: false});

    const {globalStats} = useTradeAnalysis(trades, fundInfo, baseNav);

    // 获取数据
    useEffect(() => {
        if (!ho_code) return;
        const loadData = async () => {
            // setLoading(true); // 开始加载
            try {
                const [tr, info, nav] = await Promise.all([
                    listByCode(ho_code),
                    getByCode(ho_code),
                    // 获取最近净值用于计算浮动盈亏，这里简化取最近1年，或者根据你的逻辑取
                    searchList(ho_code)
                ]);
                setTrades(tr || []);
                setFundInfo(info);
                setBaseNav(nav || []);
            } catch (e) {
                console.log(e)
            } finally {
                // setLoading(false)
            }
        };
        loadData();
    }, [ho_code]);

    return (
        <div className="bg-gray-50 min-h-screen">
            <HoldingInfoCard
                code={ho_code}
                fundInfo={fundInfo}
                globalStats={globalStats}
                drawerType="trade"
            />
            <NavHistoryChart code={ho_code}/>
        </div>
    );
}

