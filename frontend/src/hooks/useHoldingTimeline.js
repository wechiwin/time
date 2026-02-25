// src/hooks/useHoldingTimeline.js
import {useMemo} from 'react';
import dayjs from 'dayjs';

/**
 * 从 trades 计算全局统计数据（兜底计算）
 * @param {Array} trades - 所有交易记录
 * @returns {Object} 计算出的统计数据
 */
function calculateStatsFromTrades(trades) {
    // 边界情况：没有交易记录
    if (!trades || trades.length === 0) {
        return {
            totalProfit: null,
            cumulativeReturnRate: null,
            isHolding: false,
            currentCost: 0,
            currentShares: 0,
            totalHoldingDays: 0,
            marketValue: null,
            totalBuyAmount: 0,
            totalSellAmount: 0,
            totalDividend: 0,
        };
    }

    let totalBuyAmount = 0;      // 累计买入金额
    let totalSellAmount = 0;     // 累计卖出金额
    let totalDividend = 0;       // 累计现金分红
    let currentShares = 0;       // 当前份额
    let totalBuyShares = 0;      // 累计买入份额（用于计算平均成本）
    let totalSellShares = 0;     // 累计卖出份额
    let totalHoldingDays = 0;

    const firstTradeDate = trades[0]?.tr_date ? dayjs(trades[0].tr_date) : null;
    if (firstTradeDate && firstTradeDate.isValid()) {
        totalHoldingDays = dayjs().diff(firstTradeDate, 'day');
    }

    trades.forEach(t => {
        const shares = parseFloat(t.tr_shares) || 0;
        const cashAmount = parseFloat(t.cash_amount) || 0;
        const trType = t.tr_type?.toUpperCase();

        if (trType === 'BUY') {
            currentShares += shares;
            totalBuyAmount += cashAmount;
            totalBuyShares += shares;
        } else if (trType === 'SELL') {
            currentShares -= shares;
            totalSellAmount += cashAmount;
            totalSellShares += shares;
        } else if (trType === 'DIVIDEND') {
            // 现金分红：计入收益
            totalDividend += cashAmount;
            // 注意：分红再投资(REINVEST)应该作为单独的 BUY 记录，或者有单独的类型
            // 如果 dividend_type 字段区分了 CASH 和 REINVEST，这里只处理 CASH
            if (t.dividend_type === 'REINVEST' && shares > 0) {
                // 分红再投资：增加份额
                currentShares += shares;
            }
        }
    });

    // 计算加权平均成本（只有买入时才有意义）
    const avgCost = totalBuyShares > 0 ? totalBuyAmount / totalBuyShares : 0;

    // 判断是否持仓中（还有份额）
    const isHolding = currentShares > 0.01;

    // 计算累计收益
    let totalProfit = null;
    let cumulativeReturnRate = null;

    if (totalBuyAmount === 0 && totalSellAmount === 0) {
        // 没有任何买卖交易（可能只有分红记录），无法计算收益
        totalProfit = null;
        cumulativeReturnRate = null;
    } else if (!isHolding && totalSellShares > 0) {
        // 已清仓（有卖出且份额为0）：可以计算已实现盈亏 + 分红
        totalProfit = totalSellAmount - totalBuyAmount + totalDividend;
        // 收益率分母用总投入（买入金额）
        cumulativeReturnRate = totalBuyAmount > 0 ? totalProfit / totalBuyAmount : 0;
    } else if (isHolding && totalSellShares > 0) {
        // 持仓中但有部分卖出：可以计算已实现收益（卖出部分）+ 分红
        // 注意：这只是已实现部分，不包括未实现盈亏
        const realizedProfit = totalSellAmount - (totalBuyAmount * totalSellShares / totalBuyShares) + totalDividend;
        totalProfit = realizedProfit;
        // 收益率 = 已实现收益 / 总投入
        cumulativeReturnRate = totalBuyAmount > 0 ? realizedProfit / totalBuyAmount : 0;
    }
    // 持仓中且没有卖出：无法计算收益（需要最新净值），保持 null

    return {
        totalProfit,
        cumulativeReturnRate,
        isHolding,
        currentCost: avgCost,
        currentShares,
        totalHoldingDays,
        marketValue: null,
        totalBuyAmount,
        totalSellAmount,
        totalDividend,
    };
}

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
            return {rounds: [], globalStats: null};
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

                // 使用数据库字段判断清仓
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

                // 计算该波段的统计数据
                let cash_buy = 0;
                let cash_sell = 0;
                let shares_buy = 0;
                let shares_sell = 0;
                let dividend = 0;
                let currentShares = 0;

                roundTrades.forEach(t => {
                    const shares = parseFloat(t.tr_shares) || 0;
                    const cash = parseFloat(t.cash_amount) || 0;
                    const trType = t.tr_type?.toUpperCase();

                    if (trType === 'BUY') {
                        currentShares += shares;
                        cash_buy += cash;
                        shares_buy += shares;
                    } else if (trType === 'SELL') {
                        currentShares -= shares;
                        cash_sell += cash;
                        shares_sell += shares;
                    } else if (trType === 'DIVIDEND') {
                        dividend += cash;
                        // 分红再投资
                        if (t.dividend_type === 'REINVEST' && shares > 0) {
                            currentShares += shares;
                        }
                    }
                });

                // 该波段的盈亏计算
                let calculatedProfit = null;
                let calculatedReturnRate = null;

                if (isCleared && shares_sell > 0) {
                    // 已清仓：计算已实现盈亏 + 分红
                    calculatedProfit = cash_sell - cash_buy + dividend;
                    calculatedReturnRate = cash_buy > 0 ? calculatedProfit / cash_buy : 0;
                } else if (!isCleared && shares_sell > 0) {
                    // 持仓中但有部分卖出：只计算已实现收益
                    const costOfSold = shares_buy > 0 ? (cash_buy * shares_sell / shares_buy) : 0;
                    calculatedProfit = cash_sell - costOfSold + dividend;
                    calculatedReturnRate = cash_buy > 0 ? calculatedProfit / cash_buy : 0;
                }
                // 持仓中且没有卖出：无法计算盈亏，保持 null

                // 该波段的平均成本
                const calculatedAvgCost = shares_buy > 0 ? cash_buy / shares_buy : 0;

                return {
                    id: cycleId,
                    isClear: isCleared,
                    startDate,
                    endDate,
                    holdingDays,
                    stats: {
                        // 优先用快照，没有则用计算值
                        totalProfit: lastSnapshot?.hos_total_pnl ?? calculatedProfit,
                        returnRate: lastSnapshot?.hos_total_pnl_ratio ?? calculatedReturnRate,
                        avgCost: lastSnapshot?.avg_cost ?? calculatedAvgCost,
                        maxShares: Math.max(...roundTrades.map(t => parseFloat(t.tr_shares || 0))),
                        currentShares: isCleared ? 0 : currentShares
                    },
                    trades: roundTrades
                };
            });

        // 4. 生成全局统计 - 优先使用 snapshot，兜底使用 trades 计算
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

        // 计算累计持仓天数（与 TradeTimeline 口径一致）
        const calculateHoldDays = (startDate) => {
            if (!startDate) return 0;
            return Math.max(1, Math.ceil(dayjs().diff(dayjs(startDate), 'day', true)));
        };

        // 先从 trades 计算兜底数据（用于累计收益等全局指标）
        const calculatedStats = calculateStatsFromTrades(trades);

        // 辅助函数：优先从 snapshot 获取值，没有则用计算值
        const getVal = (snapshotKey, calculatedValue) => {
            if (latestSnapshot && latestSnapshot[snapshotKey] !== undefined && latestSnapshot[snapshotKey] !== null) {
                return parseFloat(latestSnapshot[snapshotKey]);
            }
            return calculatedValue;
        };

        const globalStats = {
            totalRounds: rounds.length,

            // 累计收益：优先 snapshot，兜底计算（持仓中可能为 null）
            totalProfit: getVal('hos_total_pnl', calculatedStats.totalProfit),

            // 累计收益率：优先 snapshot，兜底计算（持仓中可能为 null）
            cumulativeReturnRate: getVal('hos_total_pnl_ratio', calculatedStats.cumulativeReturnRate),

            // 是否持仓：优先 snapshot，兜底用当前周期判断
            isHolding: latestSnapshot?.holding_shares
                ? parseFloat(latestSnapshot.holding_shares) > 0.01
                : calculatedStats.isHolding,

            // 持仓成本：优先 snapshot，兜底用 trades 计算的平均成本
            currentCost: getVal('avg_cost', calculatedStats.currentCost),

            // 当前份额：优先 snapshot，兜底用 trades 计算的份额
            currentShares: getVal('holding_shares', calculatedStats.currentShares),

            // 累计持仓天数（与 TradeTimeline 口径一致）
            totalHoldingDays: calculateHoldDays(trades[0]?.tr_date),

            // 市值：只有 snapshot 有，trades 无法计算
            marketValue: latestSnapshot?.hos_market_value ? parseFloat(latestSnapshot.hos_market_value) : null,
        };

        return {rounds, globalStats};

    }, [trades, snapshots, fundInfo]);
}
