// src/common/withPagination.jsx
import React from 'react';
import usePagination from '../../hooks/usePagination';

/**
 * 分页高阶组件
 * 在 React 中，HOC（Higher-Order Component，高阶组件） 是一种复用组件逻辑的高级技巧。
 * 它本质上是一个函数，接收一个组件作为输入，并返回一个新的组件。
 * @param {React.Component} WrappedComponent 需要包装的组件
 * @param {Object} options 配置选项
 * @param {number} options.defaultPerPage 默认每页数量
 * @param {boolean} options.autoReset 是否在组件卸载时重置分页状态
 */
export default function withPagination(WrappedComponent, options = {}) {
    const {
        defaultPerPage = 10,
        autoReset = true
    } = options;

    return function WithPaginationComponent(props) {
        const pagination = usePagination(defaultPerPage);

        // 如果需要在组件卸载时重置分页状态
        React.useEffect(() => {
            return () => {
                if (autoReset) {
                    // 这里可以添加重置逻辑，如果需要的话
                }
            };
        }, [autoReset]);

        return (
            <WrappedComponent
                {...props}
                pagination={pagination}
            />
        );
    };
}