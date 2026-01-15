// src/hooks/useHoldingTimeline.js
import { useMemo } from 'react';
import dayjs from 'dayjs';

/**
 * 整合交易记录、持仓快照和实时持仓信息
 *
 * @param {Array} trades - 交易记录 (按日期排序)
 * @param {Array} snapshots - 快照记录
 * @param {Object} fundInfo - 实时持仓信息 (来自 holding 表)
 */
export default function useHoldingTimeline(trades = [], snapshots = [], fundInfo = null) {
    return useMemo(() => {
        if (!trades || trades.length === 0) {
            return { rounds: [], globalStats: null };
        }

        // 1. 建立快照索引 (日期 -> 快照)
        const snapshotMap = new Map(snapshots.map(s => [s.snapshot_date, s]));

        // 2. 按 tr_cycle 分组
        const roundsMap = new Map();
        trades.forEach(trade => {
            // 确保 cycle 存在，如果没有则归为 'unknown' 或 0
            const cycleId = trade.tr_cycle !== undefined && trade.tr_cycle !== null ? trade.tr_cycle : 'latest';

            if (!roundsMap.has(cycleId)) {
                roundsMap.set(cycleId, []);
            }
            roundsMap.get(cycleId).push(trade);
        });

        // 3. 处理每一轮波段
        const rounds = Array.from(roundsMap.entries())
            // 按周期ID排序 (假设ID越大越新，或者根据第一笔交易日期排序)
            .sort((a, b) => {
                const dateA = a[1][0]?.tr_date || '';
                const dateB = b[1][0]?.tr_date || '';
                return dateA.localeCompare(dateB);
            })
            .map(([cycleId, roundTrades]) => {
                const firstTrade = roundTrades[0];
                const lastTrade = roundTrades[roundTrades.length - 1];

                // --- 修复点 2: 使用数据库字段判断清仓 ---
                // 注意：后端返回的 is_cleared 可能是 boolean true/false 或 数字 1/0
                const isCleared = lastTrade.is_cleared === true || lastTrade.is_cleared === 1;

                const startDate = firstTrade.tr_date;
                // 如果已清仓，结束日期是最后一笔交易日；如果未清仓，结束日期为空（代表至今）
                const endDate = isCleared ? lastTrade.tr_date : null;

                // 计算持仓天数
                const start = dayjs(startDate);
                const end = isCleared ? dayjs(endDate) : dayjs();
                const holdingDays = Math.max(1, end.diff(start, 'day'));

                // 统计数据：优先取该波段最后一天的快照，如果没有快照，则聚合交易数据
                const lastSnapshot = snapshotMap.get(lastTrade.tr_date);

                // 计算该波段的累计盈亏 (简单累加 net_amount，卖出为正，买入为负，加上当前市值)
                // 注意：这里仅做简单估算，准确数据应由后端计算好放在 snapshot 或 holding 中
                let calculatedProfit = 0;
                let currentShares = 0;

                roundTrades.forEach(t => {
                    if (t.tr_type === 'BUY') {
                        currentShares += parseFloat(t.tr_shares);
                        calculatedProfit -= parseFloat(t.tr_net_amount); // 花钱
                    } else {
                        currentShares -= parseFloat(t.tr_shares);
                        calculatedProfit += parseFloat(t.tr_net_amount); // 收钱
                    }
                });

                // 如果没清仓，加上当前市值 (需要最新净值，这里简化处理，优先用快照数据)
                if (!isCleared && lastSnapshot) {
                    calculatedProfit = lastSnapshot.hos_total_pnl; // 优先信赖快照的盈亏
                }

                return {
                    id: cycleId,
                    isClear: isCleared,
                    startDate,
                    endDate,
                    holdingDays,
                    stats: {
                        // 如果有快照用快照，没有则用计算值
                        totalProfit: lastSnapshot ? lastSnapshot.hos_total_pnl : calculatedProfit,
                        returnRate: lastSnapshot ? lastSnapshot.hos_total_pnl_ratio : 0,
                        avgCost: lastSnapshot ? lastSnapshot.hos_cost_price : 0,
                        maxShares: Math.max(...roundTrades.map(t => parseFloat(t.tr_shares || 0))),
                        currentShares: isCleared ? 0 : currentShares
                    },
                    trades: roundTrades
                };
            });

        // 4. 生成全局统计 (修复点 1: 优先使用 holding 表数据)
        // fundInfo 来自 holding 表，代表"当前状态"
        // latestSnapshot 来自 holding_snapshot 表，代表"昨日/历史状态"
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : {};

        // 辅助函数：优先取 fundInfo，不存在则取 snapshot
        const getVal = (key1, key2) => {
            if (fundInfo && fundInfo[key1] !== undefined && fundInfo[key1] !== null) return fundInfo[key1];
            if (latestSnapshot && latestSnapshot[key2] !== undefined) return latestSnapshot[key2];
            return 0;
        };

        const globalStats = {
            totalRounds: rounds.length,
            // 优先使用 holding 表的字段 (假设字段名为 ho_total_profit, ho_share 等，请根据你实际数据库字段调整)
            totalProfit: getVal('ho_total_profit', 'hos_total_pnl'),
            cumulativeReturnRate: getVal('ho_return_rate', 'hos_total_pnl_ratio'),

            // 判断当前是否持仓：看 holding 表的份额
            isHolding: parseFloat(getVal('ho_share', 'hos_shares')) > 0.01,

            currentCost: getVal('ho_cost_price', 'hos_cost_price'),
            currentShares: getVal('ho_share', 'hos_shares'),

            // 累计持仓天数通常在 holding 表里也有，或者通过最早一笔交易计算
            totalHoldingDays: getVal('ho_holding_days', 'hos_holding_days'),

            marketValue: getVal('ho_market_value', 'hos_market_value'),
        };

        return { rounds, globalStats };

    }, [trades, snapshots, fundInfo]);
}
