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
 * @param {Boolean} isSingleSelect - 是否为单选模式，默认为 false（多选）
 */
const ReactMultiSelect = ({
                              value = [],
                              onChange,
                              options = [],
                              placeholder = "请选择",
                              className = "",
                              isClearable = true,
                              isSearchable = true,
                              isSingleSelect = false, // 新增属性：是否单选
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
        if (isSingleSelect) {
            // 单选模式：value 应该是字符串或单个值
            if (value === null || value === undefined || value === '') {
                return null;
            }
            return selectOptions.find(opt => opt.value === value) || null;
        } else {
            // 多选模式：value 应该是数组
            if (!Array.isArray(value)) return [];
            return selectOptions.filter(opt =>
                value.includes(opt.value)
            );
        }
    }, [value, selectOptions, isSingleSelect]);

    // 处理变化
    const handleChange = (selected) => {
        if (onChange) {
            if (isSingleSelect) {
                // 单选模式：返回选中项的值（字符串）或 null
                const newValue = selected ? selected.value : null;
                onChange(newValue);
            } else {
                // 多选模式：返回选中项值的数组
                const newValues = selected ? selected.map(item => item.value) : [];
                onChange(newValues);
            }
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
                isMulti={!isSingleSelect} // 根据 isSingleSelect 决定是否多选
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
