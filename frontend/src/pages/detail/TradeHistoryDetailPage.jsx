import {useEffect, useState} from 'react';
import useTradeList from "../../hooks/api/useTradeList";
import useHoldingList from "../../hooks/api/useHoldingList";
import TradeTimeline from "../sub/TradeTimeline";
import {useTranslation} from "react-i18next";
import {useParams} from "react-router-dom";
import HoldingInfoCard from "../sub/HoldingInfoCard";
import useHoldingSnapshot from "../../hooks/api/useHoldingSnapshot";
import useHoldingTimeline from "../../hooks/useHoldingTimeline";
import { CenteredSpinner } from "../../components/ui/Spinner";
import EmptyState from "../../components/common/EmptyState";

export default function TradeHistoryDetailPage() {
    const {ho_id} = useParams();
    const currentHoId = ho_id;
    const {t} = useTranslation();

    const [trades, setTrades] = useState([]);
    const [fundInfo, setFundInfo] = useState(null);
    const [snapshots, setSnapshots] = useState([]);

    const {listByHoId: fetchTrades} = useTradeList({autoLoad: false});
    const {getById: fetchHoldingInfo} = useHoldingList({autoLoad: false});
    const {list_hos: fetchSnapshots} = useHoldingSnapshot({autoLoad: false});

    const [loading, setLoading] = useState(false);

    // 获取数据
    useEffect(() => {
        if (!currentHoId) {
            setLoading(false); // 如果没有 ID，停止加载
            return;
        }

        if (!currentHoId) return;
        const loadData = async () => {
            setLoading(true); // 开始加载
            try {
                const [tradeData,
                    infoData,
                    snapshotData] = await Promise.all([
                    fetchTrades(currentHoId),
                    fetchHoldingInfo(currentHoId),
                    fetchSnapshots(currentHoId),
                ]);
                // console.log("tradeData" + tradeData)
                // console.log("infoData" + infoData)
                // console.log("snapshotData" + snapshotData)
                setTrades(tradeData);
                setFundInfo(infoData);
                setSnapshots(snapshotData);
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        };
        loadData();
    }, [currentHoId, fetchTrades, fetchHoldingInfo, fetchSnapshots]);

    // 计算最终展示数据
    const {rounds, globalStats} = useHoldingTimeline(trades, snapshots, fundInfo);

    // FIX: 添加加载状态处理
    if (loading) {
        return <CenteredSpinner className="h-full" />;
    }
    // FIX: 添加数据不存在时的处理
    if (!fundInfo) {
        return (
            <div className="h-full flex items-center justify-center">
                <EmptyState
                    message={t('holding_not_found')}
                    size="lg"
                />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-800">
            <div className="overflow-auto p-2 md:p-4 flex-1 flex flex-col">
                <div className="max-w-6xl mx-auto w-full">
                    <HoldingInfoCard
                        fundInfo={fundInfo}
                        globalStats={globalStats}
                    />

                    <div className="mt-4">
                        <TradeTimeline rounds={rounds} loading={loading}/>
                    </div>
                </div>
            </div>
        </div>
    );
}