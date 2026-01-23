// src/pages/AlertPage.jsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from "react-i18next";
import {PlusIcon} from "@heroicons/react/16/solid";
import AlertRuleTable from '../components/tables/AlertRuleTable';
import AlertHistoryTable from '../components/tables/AlertHistoryTable';
import AlertRuleForm from '../components/forms/AlertRuleForm';
import useAlertList from '../hooks/api/useAlertList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import SearchArea from "../components/search/SearchArea";
import useCommon from "../hooks/api/useCommon";
import EmptyState from "../components/common/EmptyState";

export default function AlertPage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [mode, setMode] = useState('rule');
    const [refreshKey, setRefreshKey] = useState(0);
    // 统一管理所有搜索参数
    const [searchParams, setSearchParams] = useState({});

    const {data, addRule, updateRule, deleteRule} = useAlertList({
        page, perPage, autoLoad: true, mode, refreshKey, ...searchParams
    });

    const {fetchMultipleEnumValues} = useCommon();
    // const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [typeOptions, setTypeOptions] = useState([]);
    const [emailStatusOptions, setEmailStatusOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [
                    typeOptions,
                    emailStatusOptions,
                ] = await fetchMultipleEnumValues([
                    'TradeTypeEnum',
                    'AlertEmailStatusEnum',
                ]);
                setTypeOptions(typeOptions);
                setEmailStatusOptions(emailStatusOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

    // 切换模式时重置搜索条件和分页
    const handleModeChange = (newMode) => {
        if (mode === newMode) return;
        setMode(newMode);
        setSearchParams({});
        handlePageChange(1);
    };

    // 为 SearchArea 定义搜索和重置回调
    const handleSearch = useCallback((values) => {
        setSearchParams(values);
        handlePageChange(1);
        setRefreshKey(p => p + 1);
    }, [handlePageChange]);

    const handleReset = useCallback(() => {
        setSearchParams({});
        handlePageChange(1);
        setRefreshKey(p => p + 1);
    }, [handlePageChange]);

    // 使用 useMemo 根据 mode 动态生成搜索字段配置
    const searchFields = useMemo(() => {
        const keywordField = {
            name: 'keyword',
            type: 'text',
            label: t('label_fund_name_or_code'),
            placeholder: t('msg_search_placeholder'),
            className: 'md:col-span-3',
        };

        if (mode === 'rule') {
            return [
                keywordField,
                {
                    name: 'ar_is_active',
                    type: 'select', // 使用 'select' 类型对应 SearchArea 的单选
                    label: t('alert_status'),
                    options: [
                        {value: '1', label: t('status_active', '激活')},
                        {value: '0', label: t('status_inactive', '禁用')},
                    ],
                    className: 'md:col-span-3',
                },
                {
                    name: 'ar_type',
                    type: 'select',
                    label: t('th_tr_type'),
                    options: typeOptions,
                    className: 'md:col-span-3',
                },
            ];
        }
        // mode === 'history'
        return [
            keywordField,
            {
                name: 'ah_status',
                type: 'select',
                label: t('alert_status'),
                options: emailStatusOptions,
                className: 'md:col-span-4',
            },
        ];
    }, [mode, t]);

    // 使用 useMemo 根据 mode 动态生成操作按钮
    const actionButtons = useMemo(() => {
        if (mode === 'rule') {
            return (
                <button onClick={() => openModal('add')} className="btn-primary inline-flex items-center gap-2">
                    <PlusIcon className="h-4 w-4"/>
                    {t('button_add')}
                </button>
            );
        }
        return null;
    }, [mode, t]);

    const handleDelete = async (id) => {
        try {
            await deleteRule(id);
            showSuccessToast();

            // 检查当前页数据情况，决定是否需要调整分页
            if (data?.items?.length === 1 && page > 1) {
                // 如果删除的是当前页的最后一条数据且不在第一页，则跳转到前一页
                handlePageChange(page - 1);
            } else {
                // 否则保持当前页并刷新数据
                setRefreshKey(p => p + 1);
            }
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    const [modalConfig, setModalConfig] = useState({
        show: false,
        title: "",
        submitAction: () => {
        }, // 初始化为空函数而不是 null
        initialValues: {}
    });

    const openModal = (type, values = {}) => {
        setModalConfig({
            show: true,
            title: type === 'add' ? t('button_add') : t('button_edit'),
            submitAction: type === 'add' ? addRule : updateRule,
            initialValues: type === 'add' ? {ar_type: 'BUY', ar_is_active: 1} : values
        });
    };

    return (
        <div className="space-y-6">
            {/* 统一的控制面板 */}
            <div
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                {/* Tab 切换器 */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button
                        onClick={() => handleModeChange('rule')}
                        className={`px-5 py-3 text-sm font-medium relative transition-all duration-300 ease-in-out ${
                            mode === 'rule'
                                ? 'text-blue-600 dark:text-blue-400 after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-1 after:bg-blue-500 after:rounded-t-md'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {t('alert_rule_management')}
                    </button>
                    <button
                        onClick={() => handleModeChange('history')}
                        className={`px-5 py-3 text-sm font-medium relative transition-all duration-300 ease-in-out ${
                            mode === 'history'
                                ? 'text-blue-600 dark:text-blue-400 after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-1 after:bg-blue-500 after:rounded-t-md'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {t('alert_history_management')}
                    </button>
                </div>


                {/* 搜索区域 (无独立背景) */}
                <SearchArea
                    key={mode}
                    fields={searchFields}
                    initialValues={searchParams}
                    onSearch={handleSearch}
                    onReset={handleReset}
                    actionButtons={actionButtons}
                    showWrapper={false} // <-- 关键：告诉 SearchArea 不要渲染自己的背景
                />
            </div>

            {/* 表格内容 */}
            {mode === 'rule' ? (
                data?.items?.length > 0 ? (
                    <AlertRuleTable data={data.items} onDelete={handleDelete}
                                    onEdit={(item) => openModal('edit', item)}/>
                ) : (
                    <EmptyState message={t('msg_no_records')}/>
                )
            ) : (
                data?.items?.length > 0 ? (
                    <AlertHistoryTable data={data.items}/>
                ) : (
                    <EmptyState message={t('msg_no_records')}/>
                )
            )}


            {/* 分页 */}
            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            {/* 弹窗 */}
            {mode === 'rule' && (
                <FormModal
                    title={modalConfig.title}
                    show={modalConfig.show}
                    onClose={() => setModalConfig(p => ({...p, show: false}))}
                    onSubmit={modalConfig.submitAction}
                    FormComponent={AlertRuleForm}
                    initialValues={modalConfig.initialValues}
                />
            )}
        </div>
    );
}
