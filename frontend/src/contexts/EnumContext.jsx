import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import useCommon from '../hooks/api/useCommon';

const EnumContext = createContext(null);

/**
 * Global Enum Translation Context
 *
 * Provides a centralized way to translate enum values across the application.
 * Automatically refetches enum values when language changes.
 *
 * Usage:
 *   const {translateEnum} = useEnumTranslation();
 *   const translatedValue = translateEnum('HoldingStatusEnum', 'active');
 */
export function EnumProvider({children}) {
    const {i18n} = useTranslation();
    const {fetchMultipleEnumValues} = useCommon();
    const [enumMap, setEnumMap] = useState({});

    // Fetch all enum values
    const fetchEnumValues = useCallback(async () => {
        try {
            const enumNames = [
                'HoldingTypeEnum',
                'HoldingStatusEnum',
                'TradeTypeEnum',
                'FundTradeMarketEnum',
                'FundDividendMethodEnum',
                'CurrencyEnum',
                'AlertRuleActionEnum',
                'AlertEmailStatusEnum',
                'TaskStatusEnum',
            ];
            const allEnums = await fetchMultipleEnumValues(enumNames);

            // Convert to a map for O(1) lookup
            // allEnums is an array of options arrays, need to map each to its enum name
            const newEnumMap = {};
            enumNames.forEach((enumName, index) => {
                const options = allEnums[index];
                if (Array.isArray(options)) {
                    newEnumMap[enumName] = options.reduce((acc, opt) => {
                        acc[opt.value] = opt.label;
                        return acc;
                    }, {});
                }
            });
            setEnumMap(newEnumMap);
        } catch (err) {
            console.error('Failed to fetch enum values:', err);
        }
    }, [fetchMultipleEnumValues]);

    // Initial fetch and refetch on language change
    useEffect(() => {
        fetchEnumValues();
    }, [fetchEnumValues, i18n.language]);

    // Translate an enum value
    const translateEnum = useCallback((enumName, value, fallback = value) => {
        return enumMap[enumName]?.[value] ?? fallback;
    }, [enumMap]);

    // Get all options for an enum
    const getEnumOptions = useCallback((enumName) => {
        // Convert back from value->label map to options array
        const valueLabelMap = enumMap[enumName];
        if (!valueLabelMap) return [];
        return Object.entries(valueLabelMap).map(([value, label]) => ({value, label}));
    }, [enumMap]);

    const value = {translateEnum, getEnumOptions, enumMap};

    return <EnumContext.Provider value={value}>{children}</EnumContext.Provider>;
}

/**
 * Hook to use enum translation
 *
 * @returns {{translateEnum: function, getEnumOptions: function, enumMap: object}}
 */
export function useEnumTranslation() {
    const context = useContext(EnumContext);
    if (!context) {
        throw new Error('useEnumTranslation must be used within EnumProvider');
    }
    return context;
}
