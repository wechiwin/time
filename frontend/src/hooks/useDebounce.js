// src/hooks/useDebounce.js
import {useEffect, useState} from 'react'; // 添加缺失的导入
import {DEBOUNCE_TIME} from '../constants/common';

export const useDebounce = (value, delay = DEBOUNCE_TIME) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
};