// src/components/search/SearchArea.jsx
import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {MagnifyingGlassIcon} from '@heroicons/react/20/solid';
import DateRangePicker from "../common/DateRangePicker";
import MyDate from "../common/MyDate";
import ReactMultiSelect from "../common/ReactMultiSelect";

/**
 * 高级搜索区域组件
 * @param {Object} props
 * @param {Array} props.fields - 字段配置数组
 * @param {Object} props.initialValues - 初始值
 * @param {Function} props.onSearch - 搜索回调 (values) => void
 * @param {Function} props.onReset - 重置回调
 * @param {React.ReactNode} props.actionButtons - 右侧操作按钮
 * @param {Boolean} props.collapsible - 是否支持折叠
 * @param {Boolean} props.showWrapper - 是否显示默认的卡片式包裹容器
 */
export default function SearchArea({
                                       fields = [],
                                       initialValues = {},
                                       onSearch,
                                       onReset,
                                       actionButtons,
                                       collapsible = false,
                                       showWrapper = true,
                                   }) {
    const {t} = useTranslation();
    const [collapsed, setCollapsed] = useState(false);
    const [values, setValues] = useState(() => {
        // 初始化状态
        const state = {};
        fields.forEach(field => {
            const initialValue = initialValues[field.name] ?? field.defaultValue ?? '';
            state[field.name] = initialValue;
        });
        return state;
    });

    // 处理字段值变化
    const handleChange = useCallback((name, value) => {
        setValues(prev => {
            const newState = {...prev, [name]: value};
            return newState;
        });
    }, []);

    // 执行搜索
    const handleSearch = useCallback(() => {

        // 过滤空值
        const filteredValues = Object.entries(values).reduce((acc, [key, val]) => {
            if (val !== '' && val !== null && val !== undefined) {
                // 数组类型处理
                if (Array.isArray(val) && val.length === 0) {
                    return acc;
                }
                acc[key] = val;
            }
            return acc;
        }, {});

        onSearch?.(filteredValues);
    }, [values, onSearch]);

    // 重置表单
    const handleReset = useCallback(() => {
        const resetState = {};
        fields.forEach(field => {
            resetState[field.name] = field.defaultValue ?? '';
        });
        setValues(resetState);
        onReset?.();
    }, [fields, onReset]);

    // 渲染单个字段
    const renderField = (field) => {
        const commonProps = {
            className: "w-full",
            placeholder: field.placeholder || '',
        };

        const label = field.labelKey ? t(field.labelKey) : (field.label || field.name);

        switch (field.type) {
            case 'select':
                return (
                    <div className="flex flex-col gap-1" key={field.name}>
                        <label className="search-area-label">{label}</label>
                        <ReactMultiSelect
                            value={values[field.name] || ''}
                            onChange={(val) => handleChange(field.name, val)}
                            options={field.options || []}
                            placeholder={field.placeholder || t('select_all')}
                            className="w-full"
                            isSearchable={field.isSearchable ?? false}
                            isSingleSelect={true} // 单选模式
                        />
                    </div>
                );


            case 'multiselect':
                return (
                    <div className="flex flex-col gap-1" key={field.name}>
                        <label className="search-area-label">{label}</label>
                        <ReactMultiSelect
                            value={values[field.name] || []}
                            onChange={(val) => handleChange(field.name, val)}
                            options={field.options || []}
                            placeholder={field.placeholder || t('all') || '全部'}
                            className="w-full"
                            isSearchable={false} // 如果不需搜索可以设为 false
                        />
                    </div>
                );
            case 'date':
                return (
                    <div className="flex flex-col gap-1">
                        <label className="search-area-label">{label}</label>
                        <MyDate
                            value={values[field.name] || ''}
                            onChange={(val) => handleChange(field.name, val)}
                            placeholder={field.placeholder || t('msg_mydate_select_date')}
                        />
                    </div>
                );

            case 'daterange':
                return (
                    <div className="flex flex-col gap-1">
                        <label className="search-area-label">{label}</label>
                        <DateRangePicker
                            value={values[field.name] || {startDate: null, endDate: null}}
                            onChange={(val) => handleChange(field.name, val)}
                            placeholder={field.placeholder || t('msg_select_date_range')}
                        />
                    </div>
                );

            case 'text':
            default:
                return (
                    <div className="flex flex-col gap-1" key={field.name}>
                        <label className="search-area-label">{t(label)}</label>
                        <input
                            key={field.name}
                            {...commonProps}
                            type="text"
                            value={values[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="input-field h-[42px]"
                        />
                    </div>
                );
        }
    };

    const SearchContent = (
        <>
            {/* 头部：标题和折叠按钮 */}
            {collapsible && (
                <div className="flex justify-between items-center mb-3">
                    {/* ... */}
                </div>
            )}
            {!collapsed && (
                <>
                    {/* 搜索字段区域 */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        {fields.map((field) => (
                            <div key={field.name} className={field.className || 'md:col-span-3'}>
                                {renderField(field)}
                            </div>
                        ))}
                    </div>
                    {/* 操作按钮区域 */}
                    <div
                        className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        {/* 左侧：搜索和重置 */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSearch}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <MagnifyingGlassIcon className="h-4 w-4"/>
                                {t('button_search')}
                            </button>
                            <button
                                onClick={handleReset}
                                className="btn-secondary h-[42px]"
                            >
                                {t('button_reset')}
                            </button>
                        </div>
                        {/* 右侧：自定义操作按钮 */}
                        <div className="flex flex-wrap gap-2">
                            {actionButtons}
                        </div>
                    </div>
                </>
            )}
        </>
    );
    // 根据 showWrapper 条件渲染
    if (!showWrapper) {
        return SearchContent;
    }
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {SearchContent}
        </div>
    );
}
