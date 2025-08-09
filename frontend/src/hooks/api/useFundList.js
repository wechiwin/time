// src/hooks/useFundList.js
import {useCallback} from 'react';
import useApi from '../useApi';

export default function useFundList() {
    // 把 /api/holdings 交给 useApi 托管
    const {data, loading, error, post, del, put, get: fetch} = useApi('/api/holdings');

    const getByParam = useCallback(
        ({fund_name, fund_code, fund_type}) => {
            const params = new URLSearchParams(
                Object.fromEntries(
                    Object.entries({fund_name, fund_code, fund_type}).filter(([, v]) => v)
                )
            ).toString();
            return fetch(`/api/holdings?${params}`);
        },
        [fetch]
    );

    // 搜索：带查询参数重新 GET
    const search = useCallback(
        (keyword) => fetch(`/api/holdings/search?keyword=${encodeURIComponent(keyword)}`),
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

    // 更新
    const update = useCallback(
        ({ id, ...body }) => put(`/api/holdings/${id}`, body),
        [put]
    );

    return {data, loading, error, add, remove, search, update, getByParam};
}