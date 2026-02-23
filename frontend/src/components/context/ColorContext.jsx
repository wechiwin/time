import {createContext, useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';

const ColorContext = createContext();

// Tailwind classes for profit/loss
const PROFIT_TAILWIND_ZH = 'text-red-500 dark:text-red-400';
const LOSS_TAILWIND_ZH = 'text-green-500 dark:text-green-400';
const PROFIT_TAILWIND_INTL = 'text-green-500 dark:text-green-400';
const LOSS_TAILWIND_INTL = 'text-red-500 dark:text-red-400';

// Hex colors for ECharts
const PROFIT_HEX_ZH = '#ef4444';    // red-500
const LOSS_HEX_ZH = '#22c55e';      // green-500
const PROFIT_HEX_INTL = '#22c55e';  // green-500
const LOSS_HEX_INTL = '#ef4444';    // red-500

// Buy/Sell colors - Chinese markets: red=buy, green=sell; International: green=buy, red=sell
const BUY_HEX_ZH = '#ef4444';       // red-500
const SELL_HEX_ZH = '#22c55e';      // green-500
const BUY_HEX_INTL = '#22c55e';     // green-500
const SELL_HEX_INTL = '#ef4444';    // red-500

// Buy/Sell tailwind classes
const BUY_TAILWIND_ZH = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
const SELL_TAILWIND_ZH = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
const BUY_TAILWIND_INTL = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
const SELL_TAILWIND_INTL = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

export function ColorProvider({children}) {
    const {i18n} = useTranslation();

    // Chinese convention (zh): invertColors = true (red=profit, green=loss)
    // International (en, it): invertColors = false (green=profit, red=loss)
    const invertColors = i18n.language === 'zh';

    const value = useMemo(() => ({
        invertColors,

        // Get Tailwind class for profit/loss value
        getProfitColor: (val) => {
            if (val === null || val === undefined || isNaN(Number(val))) {
                return 'text-gray-500 dark:text-gray-400';
            }
            const numVal = Number(val);
            if (numVal > 0) {
                return invertColors ? PROFIT_TAILWIND_ZH : PROFIT_TAILWIND_INTL;
            }
            if (numVal < 0) {
                return invertColors ? LOSS_TAILWIND_ZH : LOSS_TAILWIND_INTL;
            }
            return 'text-gray-500 dark:text-gray-400';
        },

        // Get hex color for profit/loss value (for ECharts)
        getProfitHex: (val) => {
            if (val === null || val === undefined || isNaN(Number(val))) {
                return '#6b7280'; // gray-500
            }
            const numVal = Number(val);
            if (numVal >= 0) {
                return invertColors ? PROFIT_HEX_ZH : PROFIT_HEX_INTL;
            }
            return invertColors ? LOSS_HEX_ZH : LOSS_HEX_INTL;
        },

        // Get Tailwind class for BUY/SELL
        getTradeColor: (type) => {
            const upper = (type || '').toString().toUpperCase();
            if (upper === 'BUY') {
                return invertColors ? BUY_TAILWIND_ZH : BUY_TAILWIND_INTL;
            }
            if (upper === 'SELL') {
                return invertColors ? SELL_TAILWIND_ZH : SELL_TAILWIND_INTL;
            }
            return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        },

        // Get hex color for BUY/SELL (for ECharts)
        getTradeHex: (type) => {
            const upper = (type || '').toString().toUpperCase();
            if (upper === 'BUY') {
                return invertColors ? BUY_HEX_ZH : BUY_HEX_INTL;
            }
            if (upper === 'SELL') {
                return invertColors ? SELL_HEX_ZH : SELL_HEX_INTL;
            }
            return '#6b7280'; // gray-500
        },

        // Direct access to colors for special cases
        colors: {
            profit: {
                tailwind: invertColors ? PROFIT_TAILWIND_ZH : PROFIT_TAILWIND_INTL,
                hex: invertColors ? PROFIT_HEX_ZH : PROFIT_HEX_INTL
            },
            loss: {
                tailwind: invertColors ? LOSS_TAILWIND_ZH : LOSS_TAILWIND_INTL,
                hex: invertColors ? LOSS_HEX_ZH : LOSS_HEX_INTL
            },
            buy: {
                tailwind: invertColors ? BUY_TAILWIND_ZH : BUY_TAILWIND_INTL,
                hex: invertColors ? BUY_HEX_ZH : BUY_HEX_INTL
            },
            sell: {
                tailwind: invertColors ? SELL_TAILWIND_ZH : SELL_TAILWIND_INTL,
                hex: invertColors ? SELL_HEX_ZH : SELL_HEX_INTL
            }
        }
    }), [invertColors]);

    return (
        <ColorContext.Provider value={value}>
            {children}
        </ColorContext.Provider>
    );
}

export function useColorContext() {
    const context = useContext(ColorContext);
    if (!context) {
        throw new Error('useColorContext must be used within a ColorProvider');
    }
    return context;
}

// Export color constants for direct use when context is not available
export const COLOR_CONSTANTS = {
    PROFIT_HEX_ZH,
    LOSS_HEX_ZH,
    PROFIT_HEX_INTL,
    LOSS_HEX_INTL,
    BUY_HEX_ZH,
    SELL_HEX_ZH,
    BUY_HEX_INTL,
    SELL_HEX_INTL,
    PROFIT_TAILWIND_ZH,
    LOSS_TAILWIND_ZH,
    PROFIT_TAILWIND_INTL,
    LOSS_TAILWIND_INTL,
    BUY_TAILWIND_ZH,
    SELL_TAILWIND_ZH,
    BUY_TAILWIND_INTL,
    SELL_TAILWIND_INTL
};
