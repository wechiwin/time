import {useMemo} from 'react';
import dayjs from 'dayjs';
import PositionEngine from "./usePositionEngine";

/**
 * 核心交易分析逻辑
 *
 * @param {Array} trades - 交易记录列表
 * @param {Object} fundInfo - 基金基本信息
 * @param {Object} latestNav - 最新净值（用于计算持仓市值）
 *
 * @returns {{ rounds: Array, globalStats: Object }}
 */
export default function useTradeAnalysis(trades, fundInfo, latestNav) {
    return useMemo(() => {
        if (!trades || trades.length === 0) return {rounds: [], globalStats: null};
        // 年化总费率（管理+托管+销售服务费）
        const totalExpenseRate = ((fundInfo?.ho_manage_exp_rate || 0) +
            (fundInfo?.ho_trustee_exp_rate || 0) +
            (fundInfo?.ho_sales_exp_rate || 0)) / 100;

        // 按日期正序排列
        const sortedTrades = [...trades].sort((a, b) => dayjs(a.tr_date).valueOf() - dayjs(b.tr_date).valueOf());

        const rounds = [];
        let engine = new PositionEngine('MOVING_AVERAGE'); // 推荐用于基金
        let currentRoundTrades = [];
        let roundStartIdx = 0;
        let totalRealizedGlobal = 0;
        let totalUnrealizedGlobal = 0;
        let totalInvestmentGlobal = 0;
        let totalExpenseCostGlobal = 0;
        // 获取当前净值
        const currentNav = latestNav?.nav_per_unit ?? 1;
        sortedTrades.forEach((trade, index) => {
            const isBuy = trade.tr_type === 1 || trade.tr_type === '1';
            const amount = parseFloat(trade.tr_amount || 0);
            const shares = parseFloat(trade.tr_shares || 0);
            const fee = parseFloat(trade.tr_fee || 0);

            currentRoundTrades.push(trade);

            if (isBuy) {
                engine.buy(shares, amount, fee, trade.tr_date);
            } else {
                engine.sell(shares, amount, fee, currentNav, trade.tr_date);
            }

            // 判断是否清仓或最后一笔
            const isCleared = engine.totalShares < 0.01;
            const isLast = index === sortedTrades.length - 1;
            // 已清仓
            if (isCleared || isLast) {
                const startDate = currentRoundTrades[0].tr_date;
                const endDate = isCleared ? trade.tr_date : null;
                const days = (endDate ? dayjs(endDate) : dayjs()).diff(dayjs(startDate), 'day');
                const holding = engine.getHolding();
                const {unrealized, returnRate: unrealizedReturnRate, marketValue} =
                    engine.getUnrealizedPnL(currentNav);
                // 费率成本：基于加权平均资本占用（更准）
                const weightedCapital = calculateWeightedCapital(currentRoundTrades);
                const expenseCost =
                    days > 0 ? weightedCapital * totalExpenseRate * days / 365 : 0;
                // 总收益 = 已实现 + 未实现 − 隐性费用
                const totalProfit = engine.getRealizedPnL() + unrealized - expenseCost;
                // 回报率（基于总投入本金）
                const returnRate =
                    holding.totalCost > 0 ? totalProfit / holding.totalCost : 0;

                rounds.push({
                    isClear: isCleared,
                    startDate,
                    endDate,
                    stats: {
                        totalProfit,
                        returnRate,
                        days,
                        avgCost: holding.avgCostPerShare,
                        maxShares: Math.max(...currentRoundTrades.map(t => parseFloat(t.tr_shares || 0)), 0),
                        currentShares: holding.totalShares,
                        realizedPnL: engine.getRealizedPnL(),
                        unrealizedPnL: unrealized,
                        expenseCost
                    },
                    trades: [...currentRoundTrades]
                });

                // 累计全局数据
                totalRealizedGlobal += engine.getRealizedPnL();
                if (isLast && !isCleared) {
                    totalUnrealizedGlobal = unrealized;
                    totalExpenseCostGlobal += expenseCost;
                }
                totalInvestmentGlobal += currentRoundTrades
                    .filter(t => [1, '1'].includes(t.tr_type))
                    .reduce((sum, t) => sum + parseFloat(t.tr_amount || 0), 0);
                // 清仓则重置引擎，开启下一轮
                if (isCleared) {
                    engine = new PositionEngine('MOVING_AVERAGE');
                    currentRoundTrades = [];
                    roundStartIdx = index + 1;
                }


            }
        });

        // 构造全局统计
        const lastRound = rounds[rounds.length - 1];
        const isHoldingNow = lastRound && !lastRound.isClear;
        const globalStats = {
            totalRounds: rounds.length,
            totalProfit: totalRealizedGlobal + totalUnrealizedGlobal - totalExpenseCostGlobal,
            totalRealizedPnL: totalRealizedGlobal,
            totalUnrealizedPnL: totalUnrealizedGlobal,
            isHolding: isHoldingNow,
            currentCost: isHoldingNow ? lastRound.stats.avgCost : 0,
            currentShares: isHoldingNow ? lastRound.stats.currentShares : 0,
            currentDays: isHoldingNow ? lastRound.stats.days : 0,
            cumulativeReturnRate:
                totalInvestmentGlobal > 0
                    ? (totalRealizedGlobal + totalUnrealizedGlobal - totalExpenseCostGlobal) / totalInvestmentGlobal
                    : 0,
            totalExpenseCost: totalExpenseCostGlobal
        };
        return {rounds, globalStats};
    }, [trades, latestNav, fundInfo]);
}

/**
 * 辅助函数：计算本轮的加权平均资金占用（单位：元）
 */
function calculateWeightedCapital(tradesInRound) {
    if (tradesInRound.length === 0) return 0;
    let capital = 0;
    let weightedSum = 0;
    let lastTime = null;
    const sorted = tradesInRound.sort((a, b) => dayjs(a.tr_date).valueOf() - dayjs(b.tr_date).valueOf());
    sorted.forEach((trade, idx) => {
        const d = dayjs(trade.tr_date);
        if (lastTime && capital > 0) {
            const days = d.diff(lastTime, 'day');
            weightedSum += capital * days;
        }
        const amount = parseFloat(trade.tr_amount || 0);
        if ([1, '1'].includes(trade.tr_type)) {
            capital += amount;
        } else {
            const ratio = Math.min(amount / (capital || 1), 1);
            capital *= (1 - ratio);
        }
        lastTime = d;
    });
    const totalDays = dayjs().diff(dayjs(sorted[0].tr_date), 'day');
    return totalDays > 0 ? weightedSum / totalDays : capital;
}