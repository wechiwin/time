// src/hooks/useTradeList.js
import {useCallback} from 'react';
import useApi from '../useApi';

export default function useTradeList() {
    const { data, loading, error, post, del, get: fetch } = useApi('/api/transactions');

    const search = useCallback(
        (keyword) => fetch(keyword ? `/api/transactions?q=${encodeURIComponent(keyword)}` : '/api/transactions'),
        [fetch]
    );

    const add = useCallback(
        (body) => post('/api/transactions', body),
        [post]
    );

    const remove = useCallback(
        (id) => del(`/api/transactions/${id}`),
        [del]
    );

    return { data, loading, error, add, remove, search };
}