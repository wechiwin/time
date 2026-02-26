import React, {createContext, useContext, useEffect, useState, useCallback, useMemo} from 'react';
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Cache fetchMultipleEnumValues to prevent recreation
    const stableFetchMultipleEnumValues = useMemo(() => fetchMultipleEnumValues, []);

    // Fetch all enum values with error handling and retry logic
    const fetchEnumValues = useCallback(async (isRetry = false) => {
        if (loading) return; // Prevent concurrent requests

        try {
            setLoading(true);
            setError(null);

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

            const allEnums = await stableFetchMultipleEnumValues(enumNames);

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
            setError(err.message || 'Failed to fetch enum values');

            // Retry once on first failure
            if (!isRetry) {
                console.log('Retrying enum fetch...');
                setTimeout(() => fetchEnumValues(true), 1000);
            }
        } finally {
            setLoading(false);
        }
    }, [stableFetchMultipleEnumValues]);

    // Initial fetch
    useEffect(() => {
        console.log('[EnumProvider] Initial fetch triggered');
        fetchEnumValues();
    }, []);

    // Refetch on language change with debounce
    useEffect(() => {
        console.log('[EnumProvider] Language changed, scheduling refetch');
        const timeoutId = setTimeout(() => {
            console.log('[EnumProvider] Executing refetch due to language change');
            fetchEnumValues();
        }, 300); // Debounce language change

        return () => {
            console.log('[EnumProvider] Clearing timeout');
            clearTimeout(timeoutId);
        };
    }, [i18n.language]);

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

    const value = {translateEnum, getEnumOptions, enumMap, loading, error};

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
