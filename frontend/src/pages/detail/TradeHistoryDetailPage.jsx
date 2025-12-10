import {useEffect, useState} from 'react';
import useTradeList from "../../hooks/api/useTradeList";
import useHoldingList from "../../hooks/api/useHoldingList";
import useNavHistoryList from "../../hooks/api/useNavHistoryList";
import TradeTimeline from "../sub/TradeTimeline";
import {useTranslation} from "react-i18next";
import useTradeAnalysis from "../../hooks/useTradeAnalysis";
import {useParams} from "react-router-dom";
import HoldingInfoCard from "../sub/HoldingInfoCard";

export default function TradeHistoryDetailPage({code}) {
    const {ho_code} = useParams();
    const currentCode = code || ho_code;
    const {t} = useTranslation();
    const [trades, setTrades] = useState([]);
    const [fundInfo, setFundInfo] = useState(null);
    const [latestNav, setLatestNav] = useState([]);

    const {listByCode} = useTradeList({autoLoad: false});
    const {getByCode} = useHoldingList({autoLoad: false});
    const {getLatestNav} = useNavHistoryList({autoLoad: false});

    const [loading, setLoading] = useState(false);
    const {rounds, globalStats} = useTradeAnalysis(trades, fundInfo, latestNav);

    // 获取数据
    useEffect(() => {
        if (!currentCode) return;
        const loadData = async () => {
            setLoading(true); // 开始加载
            try {
                const [tr, info, nav] = await Promise.all([
                    listByCode(currentCode),
                    getByCode(currentCode),
                    // 获取最近净值用于计算浮动盈亏，这里简化取最近1年，或者根据你的逻辑取
                    getLatestNav(currentCode)
                ]);
                setTrades(tr || []);
                setFundInfo(info);
                setLatestNav(nav || []);
            } catch (e) {
                console.log(e)
            } finally {
                setLoading(false)
            }
        };
        loadData();
    }, [currentCode]);


    return (
        <div className="flex h-full flex-col bg-gray-50">
            <HoldingInfoCard
                code={ho_code}
                fundInfo={fundInfo}
                globalStats={globalStats}
            />

            <div className="flex-1 overflow-auto p-2 md:p-4">
                <TradeTimeline rounds={rounds} loading={loading}/>
            </div>
        </div>
    );
}