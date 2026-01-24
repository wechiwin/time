// src/hooks/api/useCommon.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useCommon() {
    const [data, setData] = useState(null);
    const {loading, error, post} = useApi();

    const urlPrefix = '/common';

    /**
     * 获取枚举值并转换为选项格式
     * @param {string} enumName 枚举名称
     * @param {string} [options.valueKey='code'] 值字段名
     * @param {string} [options.labelKey='view'] 标签字段名
     * @returns {Promise<Array>} 返回处理后的选项数组
     */
    const fetchEnum = useCallback(async (enum_name) => {
        try {
            // 调用API获取枚举值
            const enumData = await post(`${urlPrefix}/get_enum`,{enum_name});

            if (!enumData || !Array.isArray(enumData)) {
                console.warn(`[useCommon] 枚举 ${enum_name} 返回数据格式不正确`);
                return [];
            }
            return enumData;
        } catch (err) {
            console.error(`[useCommon] fetchEnum ${enum_name} failed:`, err);
            throw err;
        }
    }, [post]);

    /**
     * 批量获取多个枚举值
     * @param {Array} enumRequests 枚举请求数组，每个元素可以是字符串或对象
     * @param {object} options 配置选项
     * @returns {Promise<Array>} 返回处理后的枚举结果数组
     */
    const fetchMultipleEnumValues = useCallback(async (enumRequests) => {
        try {
            // 准备Promise数组
            const promises = enumRequests.map(request => {
                if (typeof request === 'string') {
                    return fetchEnum(request);
                } else if (typeof request === 'object') {
                    return fetchEnum(request.enumName);
                }
                return Promise.resolve([]);
            });
            // 并行获取所有枚举
            return await Promise.all(promises);
        } catch (err) {
            console.error('[useCommon] fetchMultipleEnumValues failed:', err);
            throw err;
        }
    }, [fetchEnum]);


    return {
        data,
        loading,
        error,
        fetchEnum,
        fetchMultipleEnumValues,
        setData
    };
}
