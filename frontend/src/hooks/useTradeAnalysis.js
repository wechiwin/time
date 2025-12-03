import {useMemo} from 'react';
import dayjs from 'dayjs';

/**
 * 核心交易分析逻辑
 * @param {Array} trades - 交易记录列表
 * @param {Object} fundInfo - 基金基本信息
 * @param {Array} baseNav - 净值历史（用于计算持仓市值）
 */
export default function useTradeAnalysis(trades, fundInfo, baseNav) {
    return useMemo(() => {
        if (!trades || trades.length === 0) return {rounds: [], globalStats: null};

        // 按日期正序排列
        const sortedTrades = [...trades].sort((a, b) => dayjs(a.tr_date).valueOf() - dayjs(b.tr_date).valueOf());

        const rounds = [];
        let currentTrades = [];
        let currentShares = 0;
        let buyAmountAccum = 0;
        let buySharesAccum = 0;
        let sellAmountAccum = 0;
        let totalFeeAccum = 0;
        let maxShares = 0;

        let totalProfitGlobal = 0;
        let totalHoldingDaysGlobal = 0;

        sortedTrades.forEach((trade, index) => {
            const isBuy = trade.tr_type === 1 || trade.tr_type === '1';
            const amount = parseFloat(trade.tr_amount || 0);
            const shares = parseFloat(trade.tr_shares || 0);
            const fee = parseFloat(trade.tr_fee || 0);

            currentTrades.push(trade);

            if (isBuy) {
                currentShares += shares;
                buyAmountAccum += amount;
                buySharesAccum += shares;
            } else {
                currentShares -= shares;
                sellAmountAccum += amount;
            }
            totalFeeAccum += fee;

            if (currentShares > maxShares) maxShares = currentShares;

            const isCleared = currentShares < 0.01;

            if (isCleared || index === sortedTrades.length - 1) {
                const startDate = currentTrades[0].tr_date;
                const endDate = isCleared ? trade.tr_date : null;
                const days = (endDate ? dayjs(endDate) : dayjs()).diff(dayjs(startDate), 'day');

                let roundStats = {};

                if (isCleared) {
                    const profit = sellAmountAccum - buyAmountAccum;
                    roundStats = {
                        totalProfit: profit,
                        returnRate: buyAmountAccum > 0 ? (profit / buyAmountAccum) : 0,
                        days: days,
                        avgCost: buySharesAccum > 0 ? (buyAmountAccum / buySharesAccum) : 0,
                        maxShares: maxShares,
                        currentShares: 0
                    };
                    totalProfitGlobal += profit;
                    totalHoldingDaysGlobal += days;

                    rounds.push({
                        isClear: true,
                        startDate,
                        endDate,
                        stats: roundStats,
                        trades: [...currentTrades]
                    });

                    // 重置
                    currentTrades = [];
                    currentShares = 0;
                    buyAmountAccum = 0;
                    buySharesAccum = 0;
                    sellAmountAccum = 0;
                    totalFeeAccum = 0;
                    maxShares = 0;
                } else {
                    let currentNav = 1;
                    if (fundInfo?.nav_per_unit) currentNav = fundInfo.nav_per_unit;
                    else if (baseNav && baseNav.length > 0) currentNav = baseNav[baseNav.length - 1].nav_per_unit;

                    const marketValue = currentShares * currentNav;
                    const profit = marketValue + sellAmountAccum - buyAmountAccum;

                    roundStats = {
                        totalProfit: profit,
                        returnRate: buyAmountAccum > 0 ? (profit / buyAmountAccum) : 0,
                        days: days,
                        avgCost: buySharesAccum > 0 ? ((buyAmountAccum - sellAmountAccum) / currentShares) : 0,
                        maxShares: maxShares,
                        currentShares: currentShares
                    };
                    totalProfitGlobal += profit;
                    totalHoldingDaysGlobal += days;

                    rounds.push({
                        isClear: false,
                        startDate,
                        endDate: null,
                        stats: roundStats,
                        trades: [...currentTrades]
                    });
                }
            }
        });

        const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
        const isHoldingNow = lastRound && !lastRound.isClear;

        const globalStats = {
            totalRounds: rounds.length,
            totalProfit: totalProfitGlobal,
            totalHoldingDays: totalHoldingDaysGlobal,
            isHolding: isHoldingNow,
            currentCost: isHoldingNow ? lastRound.stats.avgCost : 0,
            currentShares: isHoldingNow ? lastRound.stats.currentShares : 0,
            currentDays: isHoldingNow ? lastRound.stats.days : 0,
            cumulativeReturnRate: totalProfitGlobal / (sortedTrades.filter(t => t.tr_type === 1).reduce((acc, t) => acc + parseFloat(t.tr_amount), 0) || 1)
        };

        return {rounds, globalStats};
    }, [trades, baseNav, fundInfo]);
}