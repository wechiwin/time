// src/hooks/useHoldingTimeline.js
import { useMemo } from 'react';
import dayjs from 'dayjs';

/**
 * 整合交易记录和持仓快照，生成用于时间线展示的数据
 *
 * @param {Array} trades - 交易记录列表，已按日期正序排列
 * @param {Array} snapshots - 持仓快照列表，已按日期正序排列
 * @param {Object} fundInfo - 基金基本信息
 * @returns {{ rounds: Array, globalStats: Object }}
 */
export default function useHoldingTimeline(trades = [], snapshots = [], fundInfo = null) {
    return useMemo(() => {
        if (trades.length === 0) {
            return { rounds: [], globalStats: null };
        }

        // 1. 创建快照的快速查找 Map (O(1) 访问)
        const snapshotMap = new Map(snapshots.map(s => [s.snapshot_date, s]));

        // 2. 按 tr_round 字段对交易进行分组
        const roundsMap = new Map();
        trades.forEach(trade => {
            const roundKey = trade.tr_round || 0; // 如果没有轮次信息，归为第0轮
            if (!roundsMap.has(roundKey)) {
                roundsMap.set(roundKey, []);
            }
            roundsMap.get(roundKey).push(trade);
        });

        // 3. 处理每一轮交易，生成展示数据
        const rounds = Array.from(roundsMap.entries())
            .sort(([keyA], [keyB]) => keyA - keyB) // 确保轮次有序
            .map(([roundKey, roundTrades]) => {
                const firstTrade = roundTrades[0];
                const lastTrade = roundTrades[roundTrades.length - 1];

                // 找到本轮最后一次交易日对应的快照
                const lastSnapshot = snapshotMap.get(lastTrade.tr_date);

                // 判断是否清仓：最后一笔交易后，份额接近于0
                const isCleared = lastSnapshot ? parseFloat(lastSnapshot.hos_shares) < 0.01 : false;

                const startDate = firstTrade.tr_date;
                const endDate = isCleared ? lastTrade.tr_date : null;

                // 统计数据直接从快照获取，大大简化
                const stats = {
                    days: lastSnapshot ? lastSnapshot.hos_holding_days : 0,
                    avgCost: lastSnapshot ? lastSnapshot.hos_cost_price : 0,
                    maxShares: Math.max(...roundTrades.map(t => parseFloat(t.tr_shares || 0)), 0), // 最大交易份额仍需计算
                    currentShares: lastSnapshot ? lastSnapshot.hos_shares : 0,
                    // 关键：总收益直接取快照的累计盈亏
                    totalProfit: lastSnapshot ? lastSnapshot.hos_total_pnl : 0,
                    returnRate: lastSnapshot ? lastSnapshot.hos_total_pnl_ratio : 0,
                };

                return {
                    isClear: isCleared,
                    startDate,
                    endDate,
                    stats,
                    trades: roundTrades,
                };
            });

        // 4. 生成全局统计数据 (直接从最新的快照获取)
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const globalStats = latestSnapshot ? {
            totalRounds: rounds.length,
            totalProfit: latestSnapshot.hos_total_pnl,
            totalRealizedPnL: null, // 快照数据通常不区分已实现/未实现，若需要需后端提供
            totalUnrealizedPnL: null,
            isHolding: parseFloat(latestSnapshot.hos_shares) > 0.01,
            currentCost: latestSnapshot.hos_cost_price,
            currentShares: latestSnapshot.hos_shares,
            currentDays: latestSnapshot.hos_holding_days,
            cumulativeReturnRate: latestSnapshot.hos_total_pnl_ratio,
            totalInvestment: latestSnapshot.hos_total_cost, // 总成本作为累计投资额
            marketValue: latestSnapshot.hos_market_value,
            dailyPnl: latestSnapshot.hos_daily_pnl,
        } : null;

        return { rounds, globalStats };

    }, [trades, snapshots, fundInfo]);
}
