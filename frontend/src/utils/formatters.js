// src/utils/formatters.js

export const formatCurrency = (val, currency = 'CNY') => {
    // 增加更严格的检查
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    // 确保转换为数字
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(val));
};

export const formatPercent = (val, decimals = 2) => {
    // 增加更严格的检查
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    const numVal = Number(val);
    const sign = numVal > 0 ? '+' : '';
    return `${sign}${numVal.toFixed(decimals)}%`;
};

export const formatNumber = (val, decimals = 2) => {
    // 增加更严格的检查
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return Number(val).toFixed(decimals);
};

/**
 * 将比例值格式化为百分比字符串
 * @param {number | null | undefined} ratio - 小数值，例如 0.251
 * @param {number} decimals - 保留的小数位数
 * @returns {string} - 格式化后的字符串，例如 "+25.10%"
 */
export const formatRatioAsPercent = (ratio, decimals = 2) => {
    if (ratio === null || ratio === undefined || isNaN(Number(ratio))) return '-';
    const percentage = Number(ratio) * 100;
    return formatPercent(percentage, decimals);
};
/**
 * 格式化数字为不带正号的百分比字符串
 * e.g., 0.123 -> '12.30%'
 */
export const formatPercentNeutral = (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0.00%';
    }
    return `${(value * 100).toFixed(2)}%`;
};

export const getColor = (val, options = {}) => {
    const {
        invert = false,  // 是否反转红绿（如A股）
        zeroColor = 'text-gray-500 dark:text-gray-400'
    } = options;

    if (val === null || val === undefined || isNaN(Number(val))) return zeroColor;

    const numVal = Number(val);
    const isPositive = invert ? numVal < 0 : numVal > 0;
    const isNegative = invert ? numVal > 0 : numVal < 0;

    if (isPositive) return 'text-red-500 dark:text-red-400';
    if (isNegative) return 'text-green-500 dark:text-green-400';
    return zeroColor;
};

// 专门用于数学计算的四舍五入函数
export const roundNumber = (num, precision = 2) => {
    if (!num && num !== 0) return 0;
    const val = Number(num);
    if (isNaN(val)) return 0;

    // 解决浮点数精度问题 (例如 1.005.toFixed(2) 可能是 1.00 的问题)
    const m = Number((Math.abs(val) * Math.pow(10, precision)).toPrecision(15));
    return (Math.round(m) / Math.pow(10, precision)) * Math.sign(val);
};