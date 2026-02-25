import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useToast} from '../components/context/ToastContext';
import {usePaginationState} from '../hooks/usePaginationState';
import useCommon from '../hooks/api/useCommon';
import useAsyncTaskLogList from '../hooks/api/useAsyncTaskLogList';
import SearchArea from '../components/search/SearchArea';
import AsyncTaskLogTable from '../components/tables/AsyncTaskLogTable';
import Pagination from '../components/common/pagination/Pagination';
import EmptyState from "../components/common/EmptyState";
import {ArrowPathIcon, TrashIcon} from '@heroicons/react/16/solid';
import TableWrapper from "../components/common/TableWrapper";
import ConfirmationModal from "../components/common/ConfirmationModal";

export default function AsyncTaskLogPage() {
    const {t} = useTranslation();
    const {showErrorToast, showSuccessToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [refreshKey, setRefreshKey] = useState(0);
    // 统一管理所有搜索参数，与 AlertPage 保持一致
    const [searchParams, setSearchParams] = useState({keyword: '', status: [], created_at: null});

    // API Hook 调用更简洁，直接传入 searchParams
    const {data, isLoading, isDebounced, redo_all_snapshot, redo_yesterday_snapshot, deleteLog, batchDeleteLog} = useAsyncTaskLogList({
        page,
        perPage,
        autoLoad: true,
        refreshKey,
        ...searchParams
    });

    // 批量选择状态
    const [selectedIds, setSelectedIds] = useState(new Set());

    // 批量删除确认状态
    const [batchConfirmState, setBatchConfirmState] = useState({
        isOpen: false,
        isLoading: false,
    });

    const {fetchMultipleEnumValues} = useCommon();
    const [taskStatusOptions, setTaskStatusOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [statusOptions] = await fetchMultipleEnumValues(
                    ['TaskStatusEnum']);
                setTaskStatusOptions(statusOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast(t('msg_failed_to_load_enum'));
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

    // [重构 3] 回调函数更精简
    const handleSearch = useCallback((values) => {
        setSearchParams(values);
        handlePageChange(1); // 搜索后重置到第一页
    }, [handlePageChange]);

    const handleReset = useCallback(() => {
        setSearchParams({keyword: '', status: [], created_at: null});
        handlePageChange(1);
    }, [handlePageChange]);

    const handleRefresh = () => {
        setRefreshKey(p => p + 1);
    };

    const handleDelete = useCallback(async (id) => {
        try {
            await deleteLog(id);
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
            console.error('Failed to delete task log:', err);
            showErrorToast();
        }
    }, [deleteLog, showSuccessToast, showErrorToast, t, data, page, handlePageChange]);

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

    // 确认批量删除
    const handleBatchDeleteConfirm = async () => {
        setBatchConfirmState(prev => ({...prev, isLoading: true}));
        try {
            const result = await batchDeleteLog(Array.from(selectedIds));
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

    const searchFields = [
        {
            name: 'keyword',
            type: 'text',
            label: t('search_keyword'),
            className: 'md:col-span-3',
        },
        {
            name: 'created_at',
            type: 'daterange',
            label: t('th_created_at'),
            className: 'md:col-span-3',
        },
        {
            name: 'status',
            type: 'multiselect',
            label: t('th_status'),
            options: taskStatusOptions,
            placeholder: t('select_all'),
            className: 'md:col-span-3',
        },
    ];

    const actionButtons = useMemo(() => (
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
            <button
                onClick={redo_all_snapshot}
                disabled={isDebounced}
                className="btn-secondary text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5"
            >
                <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}/>
                {t('redo_all_snapshots')}
            </button>
        </>
    ), [isLoading, isDebounced, t, selectedIds.size, handleBatchDeleteRequest]);


    return (
        <div className="space-y-6">
            <div
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <SearchArea
                    fields={searchFields}
                    initialValues={searchParams}
                    onSearch={handleSearch}
                    onReset={handleReset}
                    actionButtons={actionButtons}
                    showWrapper={false} // 关键：不渲染 SearchArea 自己的背景
                />
            </div>

            <TableWrapper
                isLoading={isLoading}
                isEmpty={!isLoading && (!data?.items || data.items.length === 0)}
                emptyComponent={<EmptyState message={t('empty_task_logs')} />}
            >
                <AsyncTaskLogTable
                    data={data?.items || []}
                    onDelete={handleDelete}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                />
            </TableWrapper>


            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
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
