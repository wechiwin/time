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

/**
 * 根据买卖动作返回对应的 Tailwind 颜色类
 * @param {'BUY'|'SELL'|string} value
 * @returns {string}  可直接塞进 className
 */
export function getBadgeStyle(value) {
    const upper = (value || '').toString().toUpperCase();
    switch (upper) {
        case 'BUY':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
        case 'SELL':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-red-300';
        default:
            // 兜底：灰色
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
}
