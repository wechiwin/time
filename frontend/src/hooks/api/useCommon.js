// src/hooks/api/useDashboard.js
import {useCallback, useEffect, useState} from 'react';
import useApi from '../useApi';

export default function useCommon(options = {}) {
    const {
        autoLoad = true,
        days = 30
    } = options;

    const [data, setData] = useState(null);
    const {loading, error, get} = useApi();

    const urlPrefix = '/common';

    // const fetchEnumValues = useCallback(async (enum_name) => {
    //     try {
    //         const params = new URLSearchParams({enum_name});
    //         const url = `${urlPrefix}/get_enum?${params}`;
    //         const result = await get(url, {});
    //         return result;
    //     } catch (err) {
    //         console.error(`Failed to fetch enum ${enum_name}:`, error);
    //         throw err;
    //     }
    // }, [get]);

    /**
     * 获取枚举值并转换为选项格式
     * @param {string} enumName 枚举名称
     * @param {object} options 配置选项
     * @param {function} [options.transformFn] 自定义转换函数
     * @param {string} [options.valueKey='code'] 值字段名
     * @param {string} [options.labelKey='view'] 标签字段名
     * @returns {Promise<Array>} 返回处理后的选项数组
     */
    const fetchEnumValues = useCallback(async (enum_name, options = {}) => {
        const {
            transformFn,
            valueKey = 'code',
            labelKey = 'view'
        } = options;
        try {
            // 调用API获取枚举值
            const params = new URLSearchParams({enum_name});
            const enumData = await get(`${urlPrefix}/get_enum?${params}`);

            if (!enumData || !Array.isArray(enumData)) {
                console.warn(`[useApi] 枚举 ${enum_name} 返回数据格式不正确`);
                return [];
            }
            // 如果有自定义转换函数，使用它
            if (transformFn && typeof transformFn === 'function') {
                return transformFn(enumData);
            }
            // 默认转换逻辑
            return enumData.map(item => ({
                value: item[valueKey],
                label: item[labelKey],
                ...item // 保留原始数据的所有属性
            }));
        } catch (err) {
            console.error(`[useApi] 获取枚举 ${enumName} 失败:`, err);
            throw err;
        }
    }, [get]);

    /**
     * 批量获取多个枚举值
     * @param {Array} enumRequests 枚举请求数组，每个元素可以是字符串或对象
     * @param {object} options 配置选项
     * @returns {Promise<Array>} 返回处理后的枚举结果数组
     */
    const fetchMultipleEnumValues = useCallback(async (enumRequests, options = {}) => {
        try {
            // 准备Promise数组
            const promises = enumRequests.map(request => {
                if (typeof request === 'string') {
                    return fetchEnumValues(request, options);
                } else if (typeof request === 'object') {
                    return fetchEnumValues(request.enumName, {
                        ...options,
                        ...request.options
                    });
                }
                return Promise.resolve([]);
            });
            // 并行获取所有枚举
            return await Promise.all(promises);
        } catch (err) {
            console.error('[useApi] 批量获取枚举失败:', err);
            throw err;
        }
    }, [fetchEnumValues]);


    return {
        data,
        loading,
        error,
        fetchEnumValues,
        fetchMultipleEnumValues,
        setData
    };
}
