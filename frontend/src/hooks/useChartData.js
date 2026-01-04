// src/hooks/useChartData.js
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';

/**
 * 将原始数据转换为 ECharts 所需的格式
 * @param {Array} snapshots - 主标的的持仓快照
 * @param {Array} trades - 主标的的交易记录
 * @param {Object} compareDataMap - 对比标的数据 { code: { info, list } }
 * @param {string} chartKind - 'market_price' 或 'accum_market_price'
 * @param {boolean} showCostLine - 是否显示成本线
 * @param {string} mainFundName - 主标的名称
 * @returns {{xAxisData: Array, series: Array, legendData: Array, legendSelected: Object}}
 */
export default function useChartData({
                                         navHistory = [],
                                         snapshots = [],
                                         trades = [],
                                         compareDataMap = {},
                                         chartKind = 'nav_per_unit',
                                         showCostLine = false,
                                         mainFundName = ''
                                     }) {
    const {t} = useTranslation();

    return useMemo(() => {
        // 1. 收集所有日期并创建统一的 X 轴
        const dateSet = new Set();
        // 主标的净值历史
        navHistory.forEach(i => dateSet.add(i.nav_date));
        // 对比标的净值历史
        Object.values(compareDataMap).forEach(item => {
            (item.list || []).forEach(i => dateSet.add(i.nav_date));
        });

        const xAxisData = Array.from(dateSet).sort();

        // 2. 辅助函数：将数据列表映射到统一的 X 轴
        const mapDataToAxis = (list, dateKey, valueKey) => {
            if (!list || list.length === 0) return [];
            const dataMap = new Map(list.map(item => [item[dateKey], item[valueKey]]));
            return xAxisData.map(date => dataMap.get(date) || null);
        };
        // 3. 构建 Series
        const series = [];

        // 3.1 主标的市值线
        series.push({
            name: mainFundName,
            type: 'line',
            data: mapDataToAxis(navHistory, 'nav_date', chartKind),
            smooth: true,
            showSymbol: false,
            lineStyle: {width: 2},
            connectNulls: true,
        });

        // 3.2 主标的成本线
        if (showCostLine) {
            series.push({
                name: t('chart_cost_line', '成本线'),
                type: 'line',
                data: mapDataToAxis(snapshots, 'snapshot_date', 'hos_cost_price'),
                smooth: true,
                showSymbol: false,
                lineStyle: {width: 1.5, type: 'dotted', color: '#f97316'}, // 橙色虚线
                connectNulls: true, // 必须为 true，因为成本数据是不连续的
            });
        }

        // 3.3 对比标的线
        Object.entries(compareDataMap).forEach(([code, item]) => {
            const compareName = `${code} ${item.info?.ho_short_name || ''}`;
            const dataKey = chartKind === 'nav_per_unit' ? 'nav_per_unit' : 'nav_accumulated_per_unit';
            series.push({
                name: compareName,
                type: 'line',
                data: mapDataToAxis(item.list, dataKey),
                smooth: true,
                showSymbol: false,
                lineStyle: {width: 1.5, type: 'dashed'},
                connectNulls: true,
            });
        });

        // 3.4 交易点标记
        if (trades.length > 0) {
            const buyPoints = trades
                .filter(tr => ['BUY', 1, '1'].includes(tr.tr_type))
                .map(tr => ({
                    name: t('tr_type_buy', '买入'),
                    value: [tr.tr_date, tr.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolSize: 12,
                    itemStyle: {color: '#ef4444'}, // red-500
                }));

            const sellPoints = trades
                .filter(tr => ['SELL', 0, '0'].includes(tr.tr_type))
                .map(tr => ({
                    name: t('tr_type_sell', '卖出'),
                    value: [tr.tr_date, tr.tr_nav_per_unit],
                    symbol: 'triangle',
                    symbolRotate: 180,
                    symbolSize: 12,
                    itemStyle: {color: '#22c55e'}, // green-500
                }));

            series.push({
                name: t('tr_type_buy', '买入'),
                type: 'scatter',
                data: buyPoints,
                zlevel: 10, // 确保在最上层
                tooltip: {
                    formatter: p => `${t('tr_type_buy', '买入')}<br/>${t('th_nav_date', '日期')}: ${p.value[0]}<br/>${t('th_tr_nav_per_unit', '净值')}: ${p.value[1]}`,
                },
            });
            series.push({
                name: t('tr_type_sell', '卖出'),
                type: 'scatter',
                data: sellPoints,
                zlevel: 10,
                tooltip: {
                    formatter: p => `${t('tr_type_sell', '卖出')}<br/>${t('th_nav_date', '日期')}: ${p.value[0]}<br/>${t('th_tr_nav_per_unit', '净值')}: ${p.value[1]}`,
                },
            });
        }

        // 4. 构建图例 (Legend)
        const legendData = series
            .filter(s => s.type === 'line') // 只显示线的图例
            .map(s => s.name);

        const legendSelected = {};
        legendData.forEach(name => legendSelected[name] = true);

        return {xAxisData, series, legendData, legendSelected};

    }, [navHistory, snapshots, trades, compareDataMap, chartKind, showCostLine, mainFundName, t]);
}
