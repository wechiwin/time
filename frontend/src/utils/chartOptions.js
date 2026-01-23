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
/**
 * 生成从深到浅的协调蓝色调色板
 * @param {number} count - 颜色数量，默认10
 * @param {number} hue - 色相值，默认210（蓝色）
 * @param {Object} options - 可选配置
 * @param {number} options.minLightness - 最浅色的明度，默认85%
 * @param {number} options.maxLightness - 最深色的明度，默认15%
 * @param {number} options.minSaturation - 最浅色的饱和度，默认30%
 * @param {number} options.maxSaturation - 最深色的饱和度，默认100%
 * @returns {string[]} HEX颜色数组
 */
const generateBluePalette = (
    count = 10,
    hue = 210,
    options = {}
) => {
    const {
        minLightness = 85,   // 最浅色（最小数据块）
        maxLightness = 35,   // 最深色（最大数据块）
        minSaturation = 30,  // 最浅色饱和度
        maxSaturation = 100  // 最深色饱和度
    } = options;

    const colors = [];

    for (let i = 0; i < count; i++) {
        // 从深到浅：索引0最深，索引count-1最浅
        const progress = i / (count - 1);

        // 明度：从深（低明度）到浅（高明度）
        const lightness = maxLightness + (minLightness - maxLightness) * progress;

        // 饱和度：深色饱和度高，浅色饱和度低（更自然）
        const saturation = maxSaturation + (minSaturation - maxSaturation) * progress;

        // 转换为HEX格式
        colors.push(hslToHex(hue, saturation, lightness));
    }

    return colors;
};

/**
 * HSL转HEX辅助函数
 */
const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;

    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};
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
        // color: PIE_CHART_COLORS, // 应用专业调色盘
        color: generateBluePalette(data.length),
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
            radius: ['75%', '90%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 1,
                // 使用背景色作为边框色，从而制造出 "间距" 的效果
                // borderColor: isDark ? '#1f2937' : '#fff',
                // 增加边框宽度，使间距更明显
                borderWidth: 1
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
            },
            data: chartData
        }]
    };
};