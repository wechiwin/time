import React, {createContext, useContext, useEffect, useState, useCallback, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import useCommon from '../hooks/api/useCommon';

const EnumContext = createContext(null);

// Cache configuration
const CACHE_KEY = 'app_enum_cache';
const CACHE_VERSION = '1.0';

/**
 * Load enum data from localStorage cache.
 * Returns null if cache is invalid or missing.
 */
const loadFromCache = (lang) => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const {version, lang: cachedLang, data} = JSON.parse(cached);
            if (version === CACHE_VERSION && cachedLang === lang) {
                console.log('[EnumProvider] Loaded from cache');
                return data;
            }
        }
    } catch (err) {
        console.warn('[EnumProvider] Failed to load cache:', err);
    }
    return null;
};

/**
 * Save enum data to localStorage cache.
 */
const saveToCache = (data, lang) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            version: CACHE_VERSION,
            lang,
            data,
            timestamp: Date.now()
        }));
        console.log('[EnumProvider] Saved to cache');
    } catch (err) {
        console.warn('[EnumProvider] Failed to save cache:', err);
    }
};

/**
 * Global Enum Translation Context
 *
 * Provides a centralized way to translate enum values across the application.
 * Automatically refetches enum values when language changes.
 * Uses localStorage caching to reduce network requests.
 *
 * Usage:
 *   const {translateEnum, getEnumOptions} = useEnumTranslation();
 *   const translatedValue = translateEnum('HoldingStatusEnum', 'active');
 *   const options = getEnumOptions('TradeTypeEnum');
 */
export function EnumProvider({children}) {
    const {i18n} = useTranslation();
    const {fetchAllEnums} = useCommon();
    const [enumMap, setEnumMap] = useState(() => {
        // Initialize from cache if available
        return loadFromCache(i18n.language) || {};
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Request deduplication: track if a fetch is in progress
    const fetchInProgressRef = useRef(false);
    // Track the current language to detect changes
    const currentLangRef = useRef(i18n.language);

    /**
     * Fetch all enum values using batch API.
     * Includes deduplication to prevent concurrent requests.
     */
    const fetchEnumValues = useCallback(async (forceRefresh = false) => {
        // Deduplication: skip if already fetching
        if (fetchInProgressRef.current) {
            console.log('[EnumProvider] Fetch already in progress, skipping');
            return;
        }

        // Try to load from cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = loadFromCache(i18n.language);
            if (cached && Object.keys(cached).length > 0) {
                setEnumMap(cached);
                return;
            }
        }

        try {
            fetchInProgressRef.current = true;
            setLoading(true);
            setError(null);

            console.log('[EnumProvider] Fetching all enums from API');
            const allEnums = await fetchAllEnums();

            // Convert the API response to our internal format
            // API returns: { "TradeTypeEnum": [{value, label}, ...], ... }
            // We convert to: { "TradeTypeEnum": { "BUY": "Buy", ... }, ... }
            const newEnumMap = {};
            Object.entries(allEnums).forEach(([enumName, options]) => {
                if (Array.isArray(options)) {
                    newEnumMap[enumName] = options.reduce((acc, opt) => {
                        acc[opt.value] = opt.label;
                        return acc;
                    }, {});
                }
            });

            setEnumMap(newEnumMap);
            saveToCache(newEnumMap, i18n.language);
        } catch (err) {
            console.error('[EnumProvider] Failed to fetch enums:', err);
            setError(err.message || 'Failed to fetch enum values');
        } finally {
            setLoading(false);
            fetchInProgressRef.current = false;
        }
    }, [fetchAllEnums, i18n.language]);

    // Initial fetch on mount
    useEffect(() => {
        console.log('[EnumProvider] Initial fetch');
        fetchEnumValues();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Refetch on language change with debounce
    useEffect(() => {
        // Skip if language hasn't actually changed
        if (currentLangRef.current === i18n.language) {
            return;
        }

        currentLangRef.current = i18n.language;
        console.log('[EnumProvider] Language changed to:', i18n.language);

        const timeoutId = setTimeout(() => {
            // Force refresh on language change since we need translated labels
            fetchEnumValues(true);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [i18n.language, fetchEnumValues]);

    /**
     * Translate a single enum value to its display label.
     *
     * @param {string} enumName - The enum class name (e.g., 'TradeTypeEnum')
     * @param {string} value - The enum value (e.g., 'BUY')
     * @param {string} [fallback] - Fallback text if translation not found (defaults to value)
     * @returns {string} The translated label
     */
    const translateEnum = useCallback((enumName, value, fallback = value) => {
        return enumMap[enumName]?.[value] ?? fallback;
    }, [enumMap]);

    /**
     * Get all options for an enum as an array suitable for Select components.
     *
     * @param {string} enumName - The enum class name
     * @returns {Array<{value: string, label: string}>} Array of options
     */
    const getEnumOptions = useCallback((enumName) => {
        const valueLabelMap = enumMap[enumName];
        if (!valueLabelMap) return [];
        return Object.entries(valueLabelMap).map(([value, label]) => ({value, label}));
    }, [enumMap]);

    const value = {
        translateEnum,
        getEnumOptions,
        enumMap,
        loading,
        error,
        // Expose refresh for manual cache invalidation if needed
        refreshEnums: () => fetchEnumValues(true)
    };

    return <EnumContext.Provider value={value}>{children}</EnumContext.Provider>;
}

/**
 * Hook to access enum translation functions.
 *
 * @returns {{
 *   translateEnum: function,
 *   getEnumOptions: function,
 *   enumMap: object,
 *   loading: boolean,
 *   error: string|null,
 *   refreshEnums: function
 * }}
 */
export function useEnumTranslation() {
    const context = useContext(EnumContext);
    if (!context) {
        throw new Error('useEnumTranslation must be used within EnumProvider');
    }
    return context;
}
