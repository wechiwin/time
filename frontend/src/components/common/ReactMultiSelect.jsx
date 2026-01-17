// src/components/common/ReactMultiSelect.jsx
import React, {useMemo} from 'react';
import Select from 'react-select';
import {XMarkIcon} from '@heroicons/react/20/solid';

/**
 * 基于 react-select 的多选下拉组件
 * @param {Array} value - 当前选中的值数组，例如 ['FUND', 'STOCK']
 * @param {Function} onChange - 回调函数
 * @param {Array} options - 选项列表 [{value, label}]
 * @param {String} placeholder - 占位符文本
 * @param {String} className - 自定义类名
 * @param {Boolean} isClearable - 是否显示清空按钮（内部已实现）
 * @param {Boolean} isSearchable - 是否可搜索
 */
const ReactMultiSelect = ({
                              value = [],
                              onChange,
                              options = [],
                              placeholder = "请选择",
                              className = "",
                              isClearable = true,
                              isSearchable = true,
                          }) => {
    // 转换选项格式给 react-select
    const selectOptions = useMemo(() =>
            options.map(opt => ({
                value: opt.value,
                label: opt.label,
            })),
        [options]
    );

    // 转换当前值格式给 react-select
    const selectedValues = useMemo(() => {
        if (!Array.isArray(value)) return [];

        return selectOptions.filter(opt =>
            value.includes(opt.value)
        );
    }, [value, selectOptions]);

    // 处理变化
    const handleChange = (selected) => {
        if (onChange) {
            const newValues = selected ? selected.map(item => item.value) : [];
            onChange(newValues);
        }
    };

    // 自定义清空按钮
    const ClearIndicator = (props) => {
        const {children = <XMarkIcon className="h-4 w-4"/>, getStyles, innerProps} = props;
        return (
            <div
                {...innerProps}
                style={getStyles('clearIndicator', props)}
                className="p-1 hover:text-red-500 cursor-pointer"
                title="清空"
            >
                {children}
            </div>
        );
    };

    return (
        <div className={`relative ${className}`}>
            <Select
                isMulti
                value={selectedValues}
                onChange={handleChange}
                options={selectOptions}
                placeholder={placeholder}
                isClearable={isClearable}
                isSearchable={isSearchable}
                noOptionsMessage={() => "暂无选项"}
                className="react-multi-select"
                classNamePrefix="select"
                components={{ClearIndicator}}
                styles={{
                    control: (base, state) => ({
                        ...base,
                        minHeight: '42px',
                        maxHeight: '42px', // 固定高度
                        overflow: 'hidden', // 隐藏超出部分
                        borderColor: state.isFocused ? '#3b82f6' : '#d1d5db',
                        '&:hover': {
                            borderColor: '#3b82f6'
                        },
                        boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
                        backgroundColor: 'white',
                        transition: 'all 0.2s',
                    }),
                    valueContainer: (base) => ({
                        ...base,
                        overflow: 'hidden', // 确保内容不溢出
                        flexWrap: 'nowrap', // 禁止换行
                    }),
                    menu: (base) => ({
                        ...base,
                        zIndex: 9999,
                        marginTop: '2px',
                    }),
                    multiValue: (base) => ({
                        ...base,
                        backgroundColor: '#e0f2fe',
                        borderRadius: '4px',
                        maxWidth: '150px', // 限制每个标签的最大宽度
                        flexShrink: 0, // 防止标签被压缩
                    }),
                    multiValueLabel: (base) => ({
                        ...base,
                        color: '#0369a1',
                        fontWeight: '500',
                    }),
                    multiValueRemove: (base) => ({
                        ...base,
                        color: '#0369a1',
                        '&:hover': {
                            backgroundColor: '#bae6fd',
                            color: '#dc2626',
                        },
                    }),
                }}
            />
        </div>
    );
};

export default ReactMultiSelect;
