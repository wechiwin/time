// src/utils/chartOptions.js

// 空数据处理配置
const getEmptyOption = (isDark, text = '该时间段暂无数据') => ({
    title: {
        text,
        left: 'center',
        top: 'center',
        textStyle: { color: isDark ? '#6b7280' : '#9ca3af', fontSize: 14 }
    }
});

// 折线图配置
export const getLineOption = (data, isDark) => {
    if (!data || data.length === 0) return getEmptyOption(isDark);

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? '#374151' : '#e5e7eb',
            textStyle: { color: isDark ? '#f3f4f6' : '#1f2937', fontSize: 12 },
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
            textStyle: { color: isDark ? '#9ca3af' : '#4b5563', fontSize: 11 },
            itemWidth: 12, itemHeight: 8, bottom: 0
        },
        grid: { left: '1%', right: '3%', bottom: '8%', top: '8%', containLabel: true },
        xAxis: {
            type: 'category',
            data: data.map(i => i.date),
            axisLine: { lineStyle: { color: isDark ? '#4b5563' : '#e5e7eb' } },
            axisLabel: { color: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }
        },
        yAxis: {
            type: 'value',
            scale: true,
            splitLine: { lineStyle: { color: isDark ? '#374151' : '#f3f4f6' } },
            axisLabel: { color: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }
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
                            { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
                        ]
                    }
                },
                itemStyle: { color: '#3b82f6' },
                z: 2
            },
            {
                name: '总成本',
                type: 'line',
                data: data.map(i => i.cost),
                smooth: true,
                showSymbol: false,
                lineStyle: { type: 'dashed', width: 2 },
                itemStyle: { color: '#9ca3af' },
                z: 1
            }
        ]
    };
};

// 饼图配置
export const getPieOption = (data, isDark) => {
    if (!data || data.length === 0) return getEmptyOption(isDark, '当前无持仓数据');

    return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', textStyle: { fontSize: 12 } },
        legend: {
            type: 'scroll',
            bottom: '0%',
            textStyle: { color: isDark ? '#d1d5db' : '#374151', fontSize: 11 },
            itemWidth: 10, itemHeight: 10
        },
        series: [{
            name: '资产配置',
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '45%'],
            itemStyle: {
                borderRadius: 4,
                borderColor: isDark ? '#1f2937' : '#fff',
                borderWidth: 1
            },
            label: { show: false },
            data: data.map(item => ({ value: item.value, name: item.name }))
        }]
    };
};
