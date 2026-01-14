// src/utils/formatters.js

export const formatCurrency = (val) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY'
    }).format(val);
};

export const formatPercent = (val) => {
    if (val === undefined || val === null) return '-';
    return `${val.toFixed(2)}%`;
};

export const getColor = (val) => {
    if (val === undefined || val === null) return 'text-gray-500 dark:text-gray-400';
    if (val > 0) return 'text-red-500 dark:text-red-400';
    if (val < 0) return 'text-green-500 dark:text-green-400';
    return 'text-gray-500 dark:text-gray-400';
};
