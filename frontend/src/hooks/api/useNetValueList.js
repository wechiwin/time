// src/hooks/useNetValueList.js
import {useCallback} from 'react';
import useApi from '../useApi';

export default function useNetValueList() {
    const {data, loading, error, post, put, del, get: fetch} = useApi('/api/net_values');

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

    const update = useCallback(
        ({id, ...body}) => put(`/api/net_values/${id}`, body),
        [put]
    );

    return {data, loading, error, add, remove, update, search};
}