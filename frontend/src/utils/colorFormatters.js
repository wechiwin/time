// Color constants
export const COLOR_CONSTANTS = {
    // Tailwind classes for profit/loss (Chinese convention)
    PROFIT_TAILWIND_ZH: 'text-red-500 dark:text-red-400',
    LOSS_TAILWIND_ZH: 'text-green-500 dark:text-green-400',
    // Tailwind classes for profit/loss (International convention)
    PROFIT_TAILWIND_INTL: 'text-green-500 dark:text-green-400',
    LOSS_TAILWIND_INTL: 'text-red-500 dark:text-red-400',

    // Hex colors for ECharts (Chinese convention)
    PROFIT_HEX_ZH: '#ef4444',    // red-500
    LOSS_HEX_ZH: '#22c55e',      // green-500
    // Hex colors for ECharts (International convention)
    PROFIT_HEX_INTL: '#22c55e',  // green-500
    LOSS_HEX_INTL: '#ef4444',    // red-500
};

/**
 * Get Tailwind color class based on value
 * @param {number} val - The numeric value
 * @param {Object} options - Options
 * @param {boolean} options.invert - Whether to invert colors (Chinese convention)
 * @param {string} options.zeroColor - Color for zero/null values
 * @returns {string} Tailwind color class
 */
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
 * Get hex color based on value (for ECharts)
 * @param {number} val - The numeric value
 * @param {boolean} invertColors - Whether to use Chinese convention (true = red for profit)
 * @returns {string} Hex color code
 */
export const getProfitHex = (val, invertColors = false) => {
    if (val === null || val === undefined || isNaN(Number(val))) {
        return '#6b7280'; // gray-500
    }
    const numVal = Number(val);
    if (numVal >= 0) {
        return invertColors ? COLOR_CONSTANTS.PROFIT_HEX_ZH : COLOR_CONSTANTS.PROFIT_HEX_INTL;
    }
    return invertColors ? COLOR_CONSTANTS.LOSS_HEX_ZH : COLOR_CONSTANTS.LOSS_HEX_INTL;
};

/**
 * Get Tailwind class for BUY/SELL badge
 * @param {'BUY'|'SELL'|string} value - Trade type
 * @param {boolean} invertColors - Whether to use Chinese convention (true = red for buy)
 * @returns {string} Tailwind classes for badge
 */
export function getBadgeStyle(value, invertColors = false) {
    const upper = (value || '').toString().toUpperCase();
    if (upper === 'BUY') {
        return invertColors
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    }
    if (upper === 'SELL') {
        return invertColors
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

/**
 * Get hex color for BUY/SELL (for ECharts)
 * @param {'BUY'|'SELL'|string} type - Trade type
 * @param {boolean} invertColors - Whether to use Chinese convention (true = red for buy)
 * @returns {string} Hex color code
 */
export function getTradeHex(type, invertColors = false) {
    const upper = (type || '').toString().toUpperCase();
    if (upper === 'BUY') {
        return invertColors ? COLOR_CONSTANTS.PROFIT_HEX_ZH : COLOR_CONSTANTS.PROFIT_HEX_INTL;
    }
    if (upper === 'SELL') {
        return invertColors ? COLOR_CONSTANTS.LOSS_HEX_ZH : COLOR_CONSTANTS.LOSS_HEX_INTL;
    }
    return '#6b7280'; // gray-500
}
