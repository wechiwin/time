// src/utils/echartsConfig.js
import * as echarts from 'echarts';

// 暗黑模式主题配置
export const darkTheme = {
    backgroundColor: 'transparent',
    textStyle: {
        color: '#e5e7eb'
    },
    title: {
        textStyle: {
            color: '#f9fafb'
        }
    },
    legend: {
        textStyle: {
            color: '#d1d5db'
        }
    },
    tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        borderColor: '#4b5563',
        textStyle: {
            color: '#f3f4f6'
        }
    },
    axisLine: {
        lineStyle: {
            color: '#4b5563'
        }
    },
    axisLabel: {
        color: '#9ca3af'
    },
    splitLine: {
        lineStyle: {
            color: '#374151'
        }
    }
};

// 亮色模式主题配置
export const lightTheme = {
    backgroundColor: 'transparent',
    textStyle: {
        color: '#374151'
    },
    title: {
        textStyle: {
            color: '#111827'
        }
    },
    legend: {
        textStyle: {
            color: '#4b5563'
        }
    },
    tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        textStyle: {
            color: '#374151'
        }
    },
    axisLine: {
        lineStyle: {
            color: '#d1d5db'
        }
    },
    axisLabel: {
        color: '#6b7280'
    },
    splitLine: {
        lineStyle: {
            color: '#e5e7eb'
        }
    }
};

// 获取当前主题
export const getTheme = (isDarkMode) => isDarkMode ? darkTheme : lightTheme;

// 资产配置饼图配置
export const getPieChartOption = (data, isDarkMode) => {
    const theme = getTheme(isDarkMode);

    return {
        ...theme,
        tooltip: {
            ...theme.tooltip,
            formatter: function(params) {
                return `
          <div style="font-weight: bold; margin-bottom: 4px">${params.name}</div>
          <div>占比: ${params.percent}%</div>
          <div>市值: ¥${params.value.toLocaleString()}</div>
        `;
            }
        },
        legend: {
            ...theme.legend,
            type: 'scroll',
            orient: 'vertical',
            right: 10,
            top: 'middle',
            height: '80%'
        },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 8,
                borderColor: isDarkMode ? '#1f2937' : '#ffffff',
                borderWidth: 2
            },
            label: {
                show: false
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 14,
                    fontWeight: 'bold'
                }
            },
            labelLine: {
                show: false
            },
            data: data.map((item, index) => ({
                name: item.name,
                value: item.value,
                percent: item.percentage,
                itemStyle: {
                    color: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ][index % 8]
                }
            }))
        }]
    };
};

// 收益趋势图配置
export const getLineChartOption = (data, isDarkMode) => {
    const theme = getTheme(isDarkMode);

    return {
        ...theme,
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            top: '10%',
            containLabel: true
        },
        tooltip: {
            ...theme.tooltip,
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                label: {
                    backgroundColor: isDarkMode ? '#374151' : '#f3f4f6'
                }
            },
            formatter: function(params) {
                const date = params[0].axisValue;
                const value = params[0].value;
                const color = value >= 0 ? '#10b981' : '#ef4444';

                return `
          <div style="font-weight: bold; margin-bottom: 4px">${date}</div>
          <div>
            <span style="color: ${color}; font-weight: bold">
              ¥${value.toLocaleString()}
            </span>
          </div>
        `;
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.map(item => item.date)
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                formatter: '¥{value}'
            }
        },
        series: [{
            name: '收益',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
                width: 3
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    {
                        offset: 0,
                        color: isDarkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.3)'
                    },
                    {
                        offset: 1,
                        color: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'
                    }
                ])
            },
            itemStyle: {
                color: '#3b82f6'
            },
            data: data.map(item => item.profit)
        }]
    };
};

// 波动性指标仪表盘配置
export const getGaugeOption = (volatility, beta, isDarkMode) => {
    const theme = getTheme(isDarkMode);

    return {
        ...theme,
        series: [
            {
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '90%',
                min: 0,
                max: 50,
                splitNumber: 5,
                axisLine: {
                    lineStyle: {
                        width: 10,
                        color: [
                            [0.2, '#10b981'],
                            [0.4, '#3b82f6'],
                            [0.6, '#f59e0b'],
                            [0.8, '#ef4444'],
                            [1, '#dc2626']
                        ]
                    }
                },
                pointer: {
                    itemStyle: {
                        color: isDarkMode ? '#f3f4f6' : '#111827'
                    }
                },
                axisTick: {
                    distance: -12,
                    length: 8,
                    lineStyle: {
                        color: isDarkMode ? '#4b5563' : '#d1d5db',
                        width: 2
                    }
                },
                splitLine: {
                    distance: -12,
                    length: 20,
                    lineStyle: {
                        color: isDarkMode ? '#4b5563' : '#d1d5db',
                        width: 3
                    }
                },
                axisLabel: {
                    distance: -20,
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    fontSize: 12
                },
                title: {
                    offsetCenter: [0, '30%'],
                    fontSize: 14,
                    color: isDarkMode ? '#d1d5db' : '#4b5563'
                },
                detail: {
                    offsetCenter: [0, '45%'],
                    valueAnimation: true,
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#f9fafb' : '#111827',
                    formatter: '{value}%'
                },
                data: [{
                    value: volatility,
                    name: '波动率'
                }]
            },
            {
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '70%',
                min: 0,
                max: 2,
                splitNumber: 4,
                axisLine: {
                    lineStyle: {
                        width: 8,
                        color: [
                            [0.5, '#10b981'],
                            [1, '#3b82f6'],
                            [1.5, '#f59e0b'],
                            [2, '#ef4444']
                        ]
                    }
                },
                pointer: {
                    itemStyle: {
                        color: isDarkMode ? '#f3f4f6' : '#111827'
                    }
                },
                axisTick: {
                    show: false
                },
                splitLine: {
                    show: false
                },
                axisLabel: {
                    show: false
                },
                title: {
                    offsetCenter: [0, '-10%'],
                    fontSize: 12,
                    color: isDarkMode ? '#d1d5db' : '#4b5563'
                },
                detail: {
                    offsetCenter: [0, '15%'],
                    valueAnimation: true,
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: isDarkMode ? '#f9fafb' : '#111827'
                },
                data: [{
                    value: beta,
                    name: 'Beta值'
                }]
            }
        ]
    };
};
