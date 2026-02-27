// src/pages/AlertPage.jsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from "react-i18next";
import {PlusIcon, TrashIcon} from "@heroicons/react/16/solid";
import AlertRuleTable from '../components/tables/AlertRuleTable';
import AlertHistoryTable from '../components/tables/AlertHistoryTable';
import AlertRuleForm from '../components/forms/AlertRuleForm';
import useAlertList from '../hooks/api/useAlertList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/pagination/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import SearchArea from "../components/search/SearchArea";
import {useEnumTranslation} from "../contexts/EnumContext";
import EmptyState from "../components/common/EmptyState";
import TableWrapper from "../components/common/TableWrapper";
import ConfirmationModal from "../components/common/ConfirmationModal";

export default function AlertPage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [mode, setMode] = useState('rule');
    const [refreshKey, setRefreshKey] = useState(0);
    // 统一管理所有搜索参数
    const [searchParams, setSearchParams] = useState({});

    const {data, loading, addRule, updateRule, deleteRule, batchDeleteRule} = useAlertList({
        page, perPage, autoLoad: true, mode, refreshKey, ...searchParams
    });

    // 批量选择状态
    const [selectedIds, setSelectedIds] = useState(new Set());

    // 批量删除确认状态
    const [batchConfirmState, setBatchConfirmState] = useState({
        isOpen: false,
        isLoading: false,
    });

    const {getEnumOptions, enumMap} = useEnumTranslation();
    // 枚举选项 - 依赖 enumMap 确保数据加载后更新
    const typeOptions = useMemo(() => getEnumOptions('TradeTypeEnum'), [getEnumOptions, enumMap]);
    const emailStatusOptions = useMemo(() => getEnumOptions('AlertEmailStatusEnum'), [getEnumOptions, enumMap]);

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
            label: t('label_name_or_code'),
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
    }, [mode, t, typeOptions, emailStatusOptions]);

    // ========== 批量删除处理函数 ==========

    // 批量删除请求（显示确认框）
    const handleBatchDeleteRequest = useCallback(async () => {
        if (selectedIds.size === 0) {
            showErrorToast(t('msg_no_selection'));
            return;
        }

        setBatchConfirmState({
            isOpen: true,
            isLoading: false,
        });
    }, [selectedIds.size, showErrorToast, t]);

    // 使用 useMemo 根据 mode 动态生成操作按钮
    const actionButtons = useMemo(() => {
        if (mode === 'rule') {
            return (
                <>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBatchDeleteRequest}
                            className="btn-danger text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5"
                        >
                            <TrashIcon className="h-3.5 w-3.5"/>
                            {t('button_batch_delete')} ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={() => openModal('add')} className="btn-primary text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5">
                        <PlusIcon className="h-3.5 w-3.5"/>
                        {t('button_add')}
                    </button>
                </>
            );
        }
        return null;
    }, [mode, t, selectedIds.size, handleBatchDeleteRequest]);

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

    // ========== 批量选择处理函数 ==========

    // 单项选择
    const handleSelectionChange = useCallback((id, isSelected) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    }, []);

    // 确认批量删除
    const handleBatchDeleteConfirm = async () => {
        setBatchConfirmState(prev => ({...prev, isLoading: true}));
        try {
            const result = await batchDeleteRule(Array.from(selectedIds));
            const deletedCount = result?.deleted_count || 0;
            const errorCount = result?.errors?.length || 0;

            if (errorCount > 0) {
                showErrorToast(t('msg_batch_delete_partial', {success: deletedCount, failed: errorCount}));
            } else {
                showSuccessToast(t('msg_batch_delete_success', {count: deletedCount}));
            }

            // 清空选择
            setSelectedIds(new Set());

            // 刷新逻辑
            if (deletedCount >= (data?.items?.length || 0) && page > 1) {
                handlePageChange(page - 1);
            } else {
                setRefreshKey(p => p + 1);
            }
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            setBatchConfirmState({
                isOpen: false,
                isLoading: false,
            });
        }
    };

    // 取消批量删除
    const handleBatchDeleteCancel = () => {
        setBatchConfirmState({
            isOpen: false,
            isLoading: false,
        });
    };

    // 批量删除确认框描述
    const batchConfirmationDescription = useMemo(() => {
        return t('msg_batch_delete_confirm', {count: selectedIds.size});
    }, [selectedIds.size, t]);

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
                <TableWrapper
                    isLoading={loading}
                    isEmpty={!loading && (!data?.items || data.items.length === 0)}
                    emptyComponent={<EmptyState message={t('empty_alerts')} />}
                >
                    <AlertRuleTable
                        data={data?.items || []}
                        onDelete={handleDelete}
                        onEdit={(item) => openModal('edit', item)}
                        selectedIds={selectedIds}
                        onSelectionChange={handleSelectionChange}
                    />
                </TableWrapper>
            ) : (
                <TableWrapper
                    isLoading={loading}
                    isEmpty={!loading && (!data?.items || data.items.length === 0)}
                    emptyComponent={<EmptyState />}
                >
                    <AlertHistoryTable data={data?.items || []}/>
                </TableWrapper>
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

            {/* 批量删除确认框 */}
            <ConfirmationModal
                isOpen={batchConfirmState.isOpen}
                onClose={handleBatchDeleteCancel}
                onConfirm={handleBatchDeleteConfirm}
                title={t('title_delete_confirmation')}
                description={batchConfirmationDescription}
                isLoading={batchConfirmState.isLoading}
            />
        </div>
    );
}
