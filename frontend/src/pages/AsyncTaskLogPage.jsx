import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useToast} from '../components/context/ToastContext';
import {usePaginationState} from '../hooks/usePaginationState';
import useCommon from '../hooks/api/useCommon';
import useAsyncTaskLogList from '../hooks/api/useAsyncTaskLogList';
import SearchArea from '../components/search/SearchArea';
import AsyncTaskLogTable from '../components/tables/AsyncTaskLogTable';
import Pagination from '../components/common/Pagination';
import EmptyState from "../components/common/EmptyState";
import {ArrowPathIcon} from '@heroicons/react/16/solid';

export default function AsyncTaskLogPage() {
    const {t} = useTranslation();
    const {showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [refreshKey, setRefreshKey] = useState(0);
    // 统一管理所有搜索参数，与 AlertPage 保持一致
    const [searchParams, setSearchParams] = useState({keyword: '', status: [], created_at: null});

    // API Hook 调用更简洁，直接传入 searchParams
    const {data, isLoading, redo_hs, redo_has, redo_ias, redo_iaas, update_ratios} = useAsyncTaskLogList({
        page,
        perPage,
        autoLoad: true,
        refreshKey,
        ...searchParams
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
                showErrorToast('加载状态选项失败');
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

    const searchFields = useMemo(() => [
        {
            name: 'keyword',
            type: 'text',
            label: t('label_keyword'),
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
    ], [t, taskStatusOptions]);

    const actionButtons = useMemo(() => (
        <>
            {/* <button onClick={handleRefresh} className="btn-secondary inline-flex items-center gap-2"> */}
            {/*     <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/> */}
            {/*     {t('button_refresh')} */}
            {/* </button> */}
            <button onClick={redo_hs} className="btn-secondary inline-flex items-center gap-2">
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                redo hs
            </button>
            <button onClick={redo_has} className="btn-secondary inline-flex items-center gap-2">
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                redo has
            </button>
            <button onClick={redo_ias} className="btn-secondary inline-flex items-center gap-2">
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                redo ias
            </button>
            <button onClick={redo_iaas} className="btn-secondary inline-flex items-center gap-2">
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                redo iaas
            </button>
            <button onClick={update_ratios} className="btn-secondary inline-flex items-center gap-2">
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                update_ratios
            </button>
        </>
    ), [isLoading, t]);


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

            {data?.items?.length > 0 ? (
                <AsyncTaskLogTable data={data.items}/>
            ) : (
                <EmptyState message={t('msg_no_records')}/>
            )}


            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                />
            )}
        </div>
    );
}
