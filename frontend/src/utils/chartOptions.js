// src/utils/chartOptions.js

// 空数据处理配置
const getEmptyOption = (isDark, text = '该时间段暂无数据') => ({
    backgroundColor: 'transparent',
    title: {
        text,
        left: 'center',
        top: 'center',
        textStyle: {color: isDark ? '#6b7280' : '#9ca3af', fontSize: 14}
    }
});

// 折线图配置
export const getLineOption = (data, isDark) => {
    if (!Array.isArray(data) || data.length === 0) {
        return getEmptyOption(isDark, '该时间段暂无资产走势数据');
    }

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            textStyle: {color: isDark ? '#f3f4f6' : '#1f2937', fontSize: 12},
            padding: 8,
            formatter: function (params) {
                const date = params[0].name;
                let html = `<div class="font-bold mb-2 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} pb-1">${date}</div>`;
                params.forEach(item => {
                    const val = item.value;
                    const valStr = typeof val === 'number' ? val.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }) : val;
                    html += `<div class="flex justify-between items-center gap-6 mb-1">
                      <span class="flex items-center gap-1"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${item.color}"></span>${item.seriesName}</span> 
                      <span class="font-mono font-medium">${valStr}</span>
                   </div>`;
                });
                return html;
            }
        },
        legend: {
            data: ['总资产', '总成本'],
            textStyle: {color: isDark ? '#9ca3af' : '#4b5563', fontSize: 11},
            itemWidth: 12, itemHeight: 8, bottom: 0
        },
        grid: {left: '1%', right: '3%', bottom: '8%', top: '8%', containLabel: true},
        xAxis: {
            type: 'category',
            data: data.map(i => i.date),
            axisLine: {lineStyle: {color: isDark ? '#4b5563' : '#e5e7eb'}},
            axisLabel: {color: isDark ? '#9ca3af' : '#6b7280', fontSize: 11}
        },
        yAxis: {
            type: 'value',
            scale: true,
            splitLine: {lineStyle: {color: isDark ? '#374151' : '#f3f4f6'}},
            axisLabel: {color: isDark ? '#9ca3af' : '#6b7280', fontSize: 11}
        },
        series: [
            {
                name: '总资产',
                type: 'line',
                data: data.map(i => i.value),
                smooth: true,
                showSymbol: false,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            {offset: 0, color: 'rgba(59, 130, 246, 0.4)'},
                            {offset: 1, color: 'rgba(59, 130, 246, 0.0)'}
                        ]
                    }
                },
                itemStyle: {color: '#3b82f6'},
                z: 2
            },
            {
                name: '总成本',
                type: 'line',
                data: data.map(i => i.cost),
                smooth: true,
                showSymbol: false,
                lineStyle: {type: 'dashed', width: 2},
                itemStyle: {color: '#9ca3af'},
                z: 1
            }
        ]
    };
};
// [新增] 定义一套更专业的调色盘
const PIE_CHART_COLORS = [
    '#66B2FF', // 浅蓝 (接近 Tailwind blue-400)
    '#3399FF', // 中蓝 (接近 Tailwind blue-500)
    '#0066CC', // 深蓝 (接近 Tailwind blue-700)
    '#00CCFF', // 青色 (接近 Tailwind cyan-400)
    '#0099CC', // 深青 (接近 Tailwind cyan-600)
    '#99CCFF', // 更浅的蓝
    '#3366FF', // 另一种中蓝
    '#003399', // 更深的蓝
    '#66FFFF'  // 极浅青
];
// 饼图配置
export const getPieOption = (data, isDark, highlightedIndex = null) => {
    if (!Array.isArray(data) || data.length === 0) {
        return getEmptyOption(isDark, '当前无持仓数据');
    }
    const chartData = data.map(item => ({
        value: item.has_position_ratio,
        name: item.ho_short_name,
        // 将原始 item 数据附加到 ECharts 数据项上，方便 tooltip 使用
        rawData: item
    }));
    return {
        backgroundColor: 'transparent',
        color: PIE_CHART_COLORS, // 应用专业调色盘
        tooltip: {
            trigger: 'item',
            // [优化] 使用 formatter 函数提供更丰富的信息
            formatter: (params) => {
                const { name, value, data, color } = params;
                const { rawData } = data;
                if (!rawData) return `${name}: ${(value * 100).toFixed(2)}%`;

                const pnlColor = rawData.has_cumulative_pnl >= 0 ? '#ef4444' : '#22c55e';
                const contributionColor = rawData.has_portfolio_contribution >= 0 ? '#ef4444' : '#22c55e';

                return `
                    <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid ${isDark ? '#374151' : '#e5e7eb'}; display: flex; align-items: center;">
                        <span style="display:inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; margin-right: 8px;"></span>
                        ${name}
                    </div>
                    <div style="font-size: 12px; display: grid; grid-template-columns: auto auto; gap: 4px 16px;">
                        <span>持仓占比:</span><span style="font-weight: 600; text-align: right;">${(value * 100).toFixed(2)}%</span>
                        <span>累计盈亏:</span><span style="font-weight: 600; color: ${pnlColor}; text-align: right;">${rawData.has_cumulative_pnl.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span>组合贡献:</span><span style="font-weight: 600; color: ${contributionColor}; text-align: right;">${(rawData.has_portfolio_contribution * 100).toFixed(2)}%</span>
                    </div>
                `;
            },
            backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            textStyle: { color: isDark ? '#f3f4f6' : '#1f2937' },
            padding: 12,
            confine: true, // 防止 tooltip 溢出图表区域
        },
        legend: {
            show: false
        },
        series: [{
            name: '持仓分布',
            type: 'pie',
            radius: ['70%', '90%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 10,
                // 使用背景色作为边框色，从而制造出 "间距" 的效果
                // borderColor: isDark ? '#1f2937' : '#fff',
                // 增加边框宽度，使间距更明显
                borderWidth: 4
            },
            // [优化] 标签用于在中心显示高亮项信息
            label: {
                show: false,
                position: 'center',
                formatter: [
                    '{a|{b}}',
                    '{b|{d}%}'
                ].join('\n'),
                rich: {
                    a: {
                        color: isDark ? '#d1d5db' : '#4b5563',
                        fontSize: 14,
                        lineHeight: 20,
                        padding: [0, 4, 0, 4]
                    },
                    b: {
                        color: isDark ? '#f9fafb' : '#111827',
                        fontSize: 20,
                        fontWeight: 'bold',
                        lineHeight: 28
                    }
                }
            },
            emphasis: {
                // 启用放大效果
                scale: true,
                scaleSize: 8, // 放大尺寸
                // 高亮时显示中心标签
                // label: {
                //     show: true,
                //     // [核心] 使用 rich text 格式化中心文本
                //     formatter: [
                //         '{a|{d}%}', // 第一行：百分比
                //         '{b|{b}}'  // 第二行：名称
                //     ].join('\n'),
                //     rich: {
                //         a: {
                //             color: isDark ? '#f9fafb' : '#111827',
                //             fontSize: 24,
                //             fontWeight: 'bold',
                //             lineHeight: 32
                //         },
                //         b: {
                //             color: isDark ? '#9ca3af' : '#6b7280',
                //             fontSize: 14,
                //             lineHeight: 20,
                //             padding: [4, 0, 0, 0] // 给第二行增加一点上边距
                //         }
                //     }
                // }
            },
            data: chartData
        }]
    };
};