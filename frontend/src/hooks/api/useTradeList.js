// src/hooks/useTradeList.js
import {useCallback} from 'react';
import useApi from '../useApi';

export default function useTradeList() {
    const {data, loading, error, post, del, put, get: fetch} = useApi('/api/transactions');

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

    const update = useCallback(
        ({id, ...body}) => put(`/api/transactions/${id}`, body),
        [put]
    );

    return {data, loading, error, add, remove, update, search};
}