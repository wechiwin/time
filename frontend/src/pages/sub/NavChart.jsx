// src/components/sub/NavChart.jsx
import { useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import useNavHistoryList from "../../hooks/api/useNavHistoryList";
import { formatCurrency, formatNumber } from '../../utils/numberFormatters'; // 假设你有这些工具函数

export default function NavChart({ hoId, startDate, endDate, trades = [], className = '' }) {
    const { t } = useTranslation();
    const { list_history } = useNavHistoryList({ autoLoad: false });
    const [navData, setNavData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!hoId || !startDate) {
                setLoading(false);
                return;
            }

            try {
                const end = endDate || dayjs().format('YYYY-MM-DD');
                const data = await list_history(hoId, startDate, end);
                setNavData(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error('加载净值数据失败:', error);
                setNavData([]);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [hoId, startDate, endDate, list_history]);

    // 1. 预处理交易点数据，将完整交易信息存入 data
    const tradePoints = useMemo(() => {
        return trades.map(trade => ({
            name: trade.tr_date,
            value: [
                trade.tr_date,
                parseFloat(trade.tr_nav_per_unit)
            ],
            // 将完整交易对象存入 extra 字段，供 tooltip 使用
            extra: trade,
            symbol: trade.tr_type === 'BUY' ? 'triangle' : 'diamond', // 卖出用菱形区分
            symbolRotate: trade.tr_type === 'BUY' ? 0 : 180, // 卖出倒置
            symbolSize: 12,
            itemStyle: {
                color: trade.tr_type === 'BUY' ? '#ef4444' : '#3b82f6',
                borderColor: '#fff',
                borderWidth: 1
            },
            label: {
                show: false // 图表上不直接显示文字，避免遮挡，依靠 Tooltip
            }
        }));
    }, [trades]);

    const chartOption = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e5e7eb',
            textStyle: { color: '#374151', fontSize: 12 },
            // 2. 自定义 Tooltip：同时展示净值和交易详情
            formatter: (params) => {
                if (!params || params.length === 0) return '';

                const date = params[0].axisValue;
                let html = `<div class="font-bold mb-1 border-b pb-1">${date}</div>`;

                // 遍历所有系列（净值线 + 交易点）
                params.forEach(param => {
                    if (param.seriesName === '净值') {
                        html += `
                            <div class="flex justify-between items-center gap-4">
                                <span style="color:${param.color}">● ${t('th_tr_nav_per_unit')}</span>
                                <span class="font-mono font-bold">${param.value}</span>
                            </div>
                        `;
                    } else if (param.seriesName === '交易点') {
                        // 从 data.extra 中获取我们在 useMemo 中存入的交易对象
                        const trade = param.data.extra;
                        const typeColor = trade.tr_type === 'BUY' ? 'text-red-500' : 'text-blue-500';
                        const typeName = trade.tr_type === 'BUY' ? '买入' : '卖出'; // 建议使用 i18n: t('buy')

                        html += `
                            <div class="mt-2 pt-1 border-t border-dashed border-gray-200 text-xs">
                                <div class="flex justify-between font-bold ${typeColor}">
                                    <span>${typeName}</span>
                                    <span>${formatCurrency(trade.tr_amount)}</span>
                                </div>
                                <div class="flex justify-between text-gray-500">
                                    <span>${t('th_tr_shares')}</span>
                                    <span>${formatNumber(trade.tr_shares)}</span>
                                </div>
                            </div>
                        `;
                    }
                });
                return html;
            }
        },
        xAxis: {
            type: 'category',
            data: navData.map(item => item.nav_date),
            axisLabel: {
                rotate: 0, // 不旋转，看起来更整洁
                fontSize: 10,
                interval: 'auto', // 自动计算间隔
                hideOverlap: true // 关键：自动隐藏重叠的日期
            },
            axisTick: { alignWithLabel: true },
            axisLine: { lineStyle: { color: '#9ca3af' } }
        },
        yAxis: {
            type: 'value',
            scale: true, // 不从0开始，更能看清波动
            splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
            axisLabel: { color: '#6b7280', fontSize: 10 }
        },
        series: [
            {
                name: '净值',
                data: navData.map(item => parseFloat(item.nav_per_unit)),
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                lineStyle: { width: 2, color: '#6366f1' },
                itemStyle: { color: '#6366f1' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
                            { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
                        ]
                    }
                }
            },
            {
                name: '交易点',
                type: 'scatter',
                coordinateSystem: 'cartesian2d',
                data: tradePoints,
                zlevel: 2
            }
        ],
        grid: { left: '2%', right: '4%', bottom: '5%', top: '10%', containLabel: true },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }]
    };

    if (loading) {
        return (
            <div className={`flex items-center justify-center ${className}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (!navData.length) {
        return (
            <div className={`flex items-center justify-center text-gray-400 ${className}`}>
                {t('no_nav_data', '暂无净值数据')}
            </div>
        );
    }

    return <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} className={className} />;
}
