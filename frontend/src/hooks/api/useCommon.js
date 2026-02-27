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
            // 调用API获取枚举值，添加5秒超时
            const enumData = await Promise.race([
                post(`${urlPrefix}/get_enum`,{enum_name}),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Enum fetch timeout')), 5000)
                )
            ]);

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
    const fetchMultipleEnumValues = useCallback(async (enumRequests, maxRetries = 2) => {
        const retryFetch = async (request, retryCount = 0) => {
            try {
                if (typeof request === 'string') {
                    return await fetchEnum(request);
                } else if (typeof request === 'object') {
                    return await fetchEnum(request.enumName);
                }
                return Promise.resolve([]);
            } catch (err) {
                if (retryCount < maxRetries) {
                    console.warn(`[useCommon] Retrying fetch for ${request} (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return retryFetch(request, retryCount + 1);
                }
                throw err;
            }
        };

        try {
            // 准备Promise数组，带重试机制
            const promises = enumRequests.map(request => retryFetch(request));
            // 并行获取所有枚举
            return await Promise.all(promises);
        } catch (err) {
            console.error('[useCommon] fetchMultipleEnumValues failed after retries:', err);
            throw err;
        }
    }, [fetchEnum]);

    /**
     * Fetch all enums in a single batch request.
     * More efficient than multiple individual requests.
     * @returns {Promise<Object>} Object mapping enum names to their options arrays
     */
    const fetchAllEnums = useCallback(async (maxRetries = 2) => {
        const doFetch = async (retryCount = 0) => {
            try {
                const result = await post(`${urlPrefix}/get_all_enums`);
                if (!result || typeof result !== 'object') {
                    throw new Error('Invalid response format');
                }
                return result;
            } catch (err) {
                if (retryCount < maxRetries) {
                    console.warn(`[useCommon] Retrying fetchAllEnums (attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return doFetch(retryCount + 1);
                }
                console.error('[useCommon] fetchAllEnums failed after retries:', err);
                throw err;
            }
        };
        return doFetch();
    }, [post]);


    return {
        data,
        loading,
        error,
        fetchEnum,
        fetchMultipleEnumValues,
        fetchAllEnums,
        setData
    };
}
