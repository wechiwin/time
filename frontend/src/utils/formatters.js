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
