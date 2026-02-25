// src/pages/TradePage.jsx
import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import TradeForm from '../components/forms/TradeForm';
import TradeTable from '../components/tables/TradeTable';
import useTradeList from '../hooks/api/useTradeList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/pagination/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import SearchArea from "../components/search/SearchArea";
import {ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentArrowDownIcon, PlusIcon, TrashIcon} from "@heroicons/react/16/solid";
import useCommon from "../hooks/api/useCommon";
import TableWrapper from "../components/common/TableWrapper";
import EmptyState from "../components/common/EmptyState";
import ConfirmationModal from "../components/common/ConfirmationModal";

export default function TradePage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useState({
        tr_type: "",
        dateRange: {startDate: null, endDate: null}
    });

    const {
        data, loading, add, remove, batchRemove, update, importData, exportData, downloadTemplate, search
    } = useTradeList({
        page,
        perPage,
        keyword: queryKeyword,
        autoLoad: true,
        refreshKey,
        tr_type: searchParams.tr_type,
        start_date: searchParams.dateRange.startDate,
        end_date: searchParams.dateRange.endDate
    });

    // 批量选择状态
    const [selectedIds, setSelectedIds] = useState(new Set());

    // 批量删除确认状态
    const [batchConfirmState, setBatchConfirmState] = useState({
        isOpen: false,
        isLoading: false,
    });

    const {fetchEnum} = useCommon();
    const [typeOptions, setTypeOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const options = await fetchEnum('TradeTypeEnum');
                setTypeOptions(options);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast(t('msg_failed_to_load_enum'));
            }
        };
        loadEnumValues();
    }, [fetchEnum, showErrorToast]);

    // 搜索配置
    const searchFields = [
        {
            name: 'keyword',
            type: 'text',
            label: t('label_name_or_code'),
            placeholder: t('msg_search_placeholder'),
            className: 'md:col-span-3',
        },
        {
            name: 'tr_type',
            type: 'select',
            label: t('th_tr_type'),
            options: typeOptions,
            className: 'md:col-span-3',
        },
        {
            name: 'dateRange',
            type: 'daterange',
            label: t('th_tr_date'),
            className: 'md:col-span-3',
        },
    ];

    const handleSearch = useCallback((val) => {
        setQueryKeyword(val.keyword || '');
        setSearchParams(prev => ({
            ...prev,
            tr_type: val.tr_type || "",
            dateRange: val.dateRange || {startDate: null, endDate: null}
        }));
        handlePageChange(1);
        setRefreshKey(p => p + 1);
    }, [handlePageChange]);

    const handleReset = useCallback(() => {
        setQueryKeyword("");
        setSearchParams({
            tr_type: "",
            dateRange: {startDate: null, endDate: null}
        });
        handlePageChange(1);
        setRefreshKey(p => p + 1);
    }, [handlePageChange]);

    const handleDelete = async (id) => {
        try {
            await remove(id);
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

    // 模态框逻辑
    const [modalConfig, setModalConfig] = useState({show: false, title: "", submitAction: null, initialValues: {}});
    const openModal = (type, values = {}) => {
        setModalConfig({
            show: true,
            title: type === 'add' ? t('button_add') : t('button_edit'),
            submitAction: async (data) => {
                try {
                    const action = type === 'add' ? add : update;
                    await action(data);
                    showSuccessToast();
                    setRefreshKey(p => p + 1); // 触发数据刷新
                    return { success: true }; // 返回成功状态
                } catch (err) {
                    showErrorToast(err.message);
                    return { success: false, error: err }; // 返回失败状态及错误
                }
            },
            initialValues: values
        });
    };

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = async (e) => {
            try {
                if (e.target.files?.[0]) {
                    await importData(e.target.files[0]);
                    showSuccessToast();
                    setRefreshKey(p => p + 1);
                }
            } catch (err) {
                showErrorToast(err.message);
            }
        };
        input.click();
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
            const result = await batchRemove(Array.from(selectedIds));
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

    return (
        <div className="space-y-6">
            {/* 搜索区域 */}
            <SearchArea
                fields={searchFields}
                initialValues={{
                    keyword: queryKeyword,
                    tr_type: searchParams.tr_type,
                    dateRange: searchParams.dateRange
                }}
                onSearch={handleSearch}
                onReset={handleReset}
                actionButtons={
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
                        <button onClick={downloadTemplate} className="btn-secondary text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5">
                            <DocumentArrowDownIcon className="h-3.5 w-3.5"/>
                            {t('button_download_template')}
                        </button>
                        <button onClick={handleImport} className="btn-secondary text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5">
                            <ArrowDownTrayIcon className="h-3.5 w-3.5"/>
                            {t('button_import_data')}
                        </button>
                        <button onClick={exportData} className="btn-secondary text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5">
                            <ArrowUpTrayIcon className="h-3.5 w-3.5"/>
                            {t('button_export_data')}
                        </button>
                    </>
                }
            />

            <TableWrapper
                isLoading={loading}
                isEmpty={!loading && (!data?.items || data.items.length === 0)}
                emptyComponent={
                    <EmptyState
                        message={t('empty_trades')}
                        hint={t('empty_trades_hint')}
                    />
                }
            >
                <TradeTable
                    data={data?.items || []}
                    onDelete={handleDelete}
                    onEdit={(item) => openModal('edit', item)}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                />
            </TableWrapper>

            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            <FormModal
                title={modalConfig.title}
                show={modalConfig.show}
                onClose={() => setModalConfig(p => ({...p, show: false}))}
                onSubmit={modalConfig.submitAction}
                FormComponent={TradeForm}
                initialValues={modalConfig.initialValues}
            />

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
