// src/hooks/useFundList.js
import { useCallback } from 'react';
import useApi from './useApi';

export default function useFundList() {
    // 把 /api/holdings 交给 useApi 托管
    const { data, loading, error, post, del, get: fetch } = useApi('/api/holdings');

    // 搜索：带查询参数重新 GET
    const search = useCallback(
        (keyword) => fetch(keyword ? `/api/holdings?q=${encodeURIComponent(keyword)}` : '/api/holdings'),
        [fetch]
    );

    // 新增：POST 后自动刷新（autoRefresh 默认 true）
    const add = useCallback(
        (body) => post('/api/holdings', body),
        [post]
    );

    // 删除：DEL 后自动刷新
    const remove = useCallback(
        (id) => del(`/api/holdings/${id}`),
        [del]
    );

    return { data, loading, error, add, remove, search };
}