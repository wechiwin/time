// src/components/charts/FundNetValueChart.jsx
import React, {useMemo} from 'react';
import ReactECharts from 'echarts-for-react';

/**
 * @param {object} baseFund - 基准基金对象，包含 { fund_name, netValues: [{ date, value }] }
 * @param {array} compareFunds - 对比基金数组，每项结构同 baseFund
 */
export default function FundNetValueChart({ baseFund, compareFunds = [] }) {

    const option = useMemo(() => {
        const series = [];

        if (baseFund?.netValues?.length) {
            series.push({
                name: baseFund.fund_name,
                type: 'line',
                smooth: true,
                showSymbol: false,
                data: baseFund.netValues.map(v => [v.date, v.value]),
            });
        }

        if (compareFunds?.length) {
            compareFunds.forEach(f => {
                series.push({
                    name: f.fund_name,
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    data: f.netValues.map(v => [v.date, v.value]),
                });
            });
        }

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
            },
            legend: {
                top: 0,
                data: series.map(s => s.name),
            },
            grid: {
                top: 50,
                left: 50,
                right: 30,
                bottom: 50,
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                axisLabel: { rotate: 45 },
            },
            yAxis: {
                type: 'value',
                name: '单位净值',
                scale: true,
            },
            series,
        };
    }, [baseFund, compareFunds]);

    return (
        <div className="w-full">
            <ReactECharts option={option} style={{ height: 400, width: '100%' }} />
        </div>
    );
}
