// src/hooks/useNetValueList.js
import { useCallback } from 'react';
import useApi from './useApi';

export default function useNetValueList() {
    const { data, loading, error, post, del, get: fetch } = useApi('/api/net_values');

    const search = useCallback(
        (keyword) => fetch(keyword ? `/api/net_values?q=${encodeURIComponent(keyword)}` : '/api/net_values'),
        [fetch]
    );

    const add = useCallback(
        (body) => post('/api/net_values', body),
        [post]
    );

    const remove = useCallback(
        (id) => del(`/api/net_values/${id}`),
        [del]
    );

    return { data, loading, error, add, remove, search };
}