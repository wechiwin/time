// usePositionEngine.js
import dayjs from 'dayjs';

export default class PositionEngine {
    /**
     * @param {'FIFO' | 'LIFO' | 'MOVING_AVERAGE'} costMethod 成本核算方法
     */
    constructor(costMethod = 'MOVING_AVERAGE') {
        this.method = costMethod;
        this.positions = []; // [{ shares, cost, date }]
        this.totalShares = 0;
        this.totalCost = 0;
        this.realizedPnL = 0; // 已实现盈亏
    }

    /**
     * 买入操作：增加持仓
     */
    buy(shares, amount, fee = 0, date) {
        const netAmount = amount + fee; // 手续费计入成本
        const timestamp = dayjs(date).valueOf();

        this.positions.push({
            shares,
            cost: netAmount,
            date: timestamp
        });

        this.totalShares += shares;
        this.totalCost += netAmount;
    }

    /**
     * 卖出操作：减少持仓，更新已实现收益
     * @returns {number} 当前累计 realizedPnL
     */
    sell(sellShares, sellAmount, fee = 0, nav, date) {
        if (sellShares <= 0 || this.totalShares <= 0 || this.totalShares < sellShares - 0.001) {
            console.warn('卖出份额超过持有数量', {sellShares, available: this.totalShares});
            return this.realizedPnL;
        }

        const sellProceeds = sellAmount - fee; // 实际到账金额
        let costBasis = 0; // 本次卖出对应的成本基础

        if (this.method === 'MOVING_AVERAGE') {
            // 移动加权平均法（中国公募基金常用）
            const avgPricePerShare = this.totalCost / this.totalShares;
            costBasis = avgPricePerShare * sellShares;

            this.totalShares -= sellShares;
            this.totalCost -= costBasis;
            this.realizedPnL += sellProceeds - costBasis;

        } else {
            // FIFO / LIFO：按时间排序处理
            const sorted = this.method === 'LIFO'
                ? [...this.positions].sort((a, b) => b.date - a.date)
                : [...this.positions].sort((a, b) => a.date - b.date);

            const newPositions = [];
            let remaining = sellShares;

            for (const pos of sorted) {
                if (remaining <= 0) {
                    newPositions.push(pos);
                    continue;
                }

                if (pos.shares <= remaining) {
                    // 全部卖出该批次
                    costBasis += pos.cost;
                    remaining -= pos.shares;
                } else {
                    // 部分卖出
                    const ratio = remaining / pos.shares;
                    const soldCost = pos.cost * ratio;
                    costBasis += soldCost;

                    // 保留剩余部分
                    newPositions.push({
                        shares: pos.shares - remaining,
                        cost: pos.cost - soldCost,
                        date: pos.date
                    });
                    remaining = 0;
                }
            }

            this.realizedPnL += sellProceeds - costBasis;
            this.totalShares -= sellShares;
            this.totalCost -= costBasis;
            this.positions = newPositions; // 更新持仓列表
        }

        return this.realizedPnL;
    }

    /**
     * 获取当前持仓摘要
     */
    getHolding() {
        const avgCostPerShare = this.totalShares > 0 ? this.totalCost / this.totalShares : 0;
        return {
            totalShares: this.totalShares,
            totalCost: this.totalCost,
            avgCostPerShare
        };
    }

    /**
     * 计算未实现盈亏（浮动盈亏）
     */
    getUnrealizedPnL(currentNav) {
        const marketValue = this.totalShares * currentNav;
        const unrealized = marketValue - this.totalCost;
        const returnRate = this.totalCost > 0 ? unrealized / this.totalCost : 0;
        return {marketValue, unrealized, returnRate};
    }

    /**
     * 获取已实现盈亏
     */
    getRealizedPnL() {
        return this.realizedPnL;
    }
}
