import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from "react-i18next";
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/pagination/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import {ArrowDownTrayIcon, DocumentArrowDownIcon, PlusIcon, TrashIcon} from "@heroicons/react/16/solid";
import SearchArea from "../components/search/SearchArea";
import {useIsMobile} from "../hooks/useIsMobile";
import HoldingFormMobile from "../components/forms/HoldingFormMobile";
import ConfirmationModal from "../components/common/ConfirmationModal";
import {useEnumTranslation} from "../contexts/EnumContext";
import TableWrapper from "../components/common/TableWrapper";
import EmptyState from "../components/common/EmptyState";

export default function HoldingPage() {
    const isMobile = useIsMobile();
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {getEnumOptions, enumMap} = useEnumTranslation();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useState({ho_status: [], ho_type: []});

    const {
        data,
        loading,
        add,
        remove,
        batchRemove,
        update,
        importData,
        downloadTemplate,
        crawlFundInfo
    } = useHoldingList({
        page,
        perPage,
        keyword: queryKeyword,
        autoLoad: true,
        refreshKey,
        ho_status: searchParams.ho_status,
        ho_type: searchParams.ho_type,
        nav_date: searchParams.nav_date
    });

    // 批量选择状态
    const [selectedIds, setSelectedIds] = useState(new Set());

    // 批量删除确认状态
    const [batchConfirmState, setBatchConfirmState] = useState({
        isOpen: false,
        isLoading: false,
    });

    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        holdingId: null,
        holdingName: '',
        isLoading: false,
    });

    // 枚举选项 - 依赖 enumMap 确保数据加载后更新
    const hoTypeOptions = useMemo(() => getEnumOptions('HoldingTypeEnum'), [getEnumOptions, enumMap]);
    const hoStatusOptions = useMemo(() => getEnumOptions('HoldingStatusEnum'), [getEnumOptions, enumMap]);

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
            name: 'ho_type',
            type: 'multiselect',
            label: t('th_ho_type'),
            options: hoTypeOptions,
            placeholder: t('select_all'),
            className: 'md:col-span-3',
        },
        {
            name: 'ho_status',
            type: 'multiselect',
            label: t('info_hold_status'),
            options: hoStatusOptions,
            placeholder: t('select_all'),
            className: 'md:col-span-3',
        },
    ];

    const handleSearch = useCallback((val) => {
        console.log('=== HoldingPage handleSearch called ===');
        console.log('Received values:', val);
        console.log('ho_type received:', val.ho_type, 'Type:', typeof val.ho_type);
        console.log('ho_status received:', val.ho_status, 'Type:', typeof val.ho_status);

        setQueryKeyword(val.keyword || '');
        // 确保正确处理数组值
        const newHoType = Array.isArray(val.ho_type) ? val.ho_type : [];
        const newHoStatus = Array.isArray(val.ho_status) ? val.ho_status : [];

        setSearchParams(prev => ({
            ...prev,
            ho_type: newHoType,
            ho_status: newHoStatus,
            nav_date: val.nav_date || null
        }));

        handlePageChange(1);
    }, [handlePageChange]);

    // 处理重置
    const handleReset = useCallback(() => {
        setSearchParams({ho_status: [], ho_type: []});
        setQueryKeyword('');
        handlePageChange(1);
    }, [handlePageChange]);

    // ========== 单个删除处理函数 ==========

    // 1. 用户点击删除按钮时，直接显示确认框
    const handleDeleteRequest = useCallback((holding) => {
        setConfirmState({
            isOpen: true,
            holdingId: holding.id,
            holdingName: `${holding.ho_code} - ${holding.ho_short_name}`,
            isLoading: false,
        });
    }, []);

    // 2. 用户在模态框中点击”确认”时，执行删除
    const handleConfirmDelete = async () => {
        if (!confirmState.holdingId) return;
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
            await remove(confirmState.holdingId);
            showSuccessToast(t('msg_remove_from_list_success'));
            // 刷新逻辑
            if (data?.items?.length === 1 && page > 1) {
                handlePageChange(page - 1);
            } else {
                setRefreshKey(p => p + 1);
            }
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            setConfirmState({ isOpen: false, holdingId: null, holdingName: '', isLoading: false });
        }
    };

    // 3. 关闭模态框
    const handleCancelDelete = () => {
        setConfirmState({ isOpen: false, holdingId: null, holdingName: '', isLoading: false });
    };

    // 简化确认框描述
    const confirmationDescription = useMemo(() => {
        return t('msg_remove_from_list_confirm', { name: confirmState.holdingName });
    }, [confirmState.holdingName, t]);

    const [modalConfig, setModalConfig] = useState({show: false, title: "", submitAction: null, initialValues: {}});
    const openModal = (type, values = {}) => {
        setModalConfig({
            show: true, title: type === 'add' ? t('button_add') : t('button_edit'),
            submitAction: type === 'add' ? add : update, initialValues: values
        });
    };

    const handleCrawl = useCallback(async (code, setFormPatch) => {
        try {
            const info = await crawlFundInfo(code);
            setFormPatch(info);
            showSuccessToast();
        } catch (e) {
            showErrorToast(e.message);
        }
    }, [crawlFundInfo, showSuccessToast, showErrorToast]);

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

    // 批量删除请求（直接显示确认框）
    const handleBatchDeleteRequest = useCallback(() => {
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
                showErrorToast(t('msg_batch_remove_partial', {success: deletedCount, failed: errorCount}));
            } else {
                showSuccessToast(t('msg_batch_remove_success', {count: deletedCount}));
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
        const count = selectedIds.size;
        return t('msg_batch_remove_confirm', {count});
    }, [selectedIds.size, t]);

    return (
        <div className="space-y-6">
            {/* 搜索区域 */}
            <SearchArea
                fields={searchFields}
                initialValues={{
                    keyword: queryKeyword,
                    ho_type: Array.isArray(searchParams.ho_type) ? searchParams.ho_type : [],
                    ho_status: Array.isArray(searchParams.ho_status) ? searchParams.ho_status : [],
                    nav_date: searchParams.nav_date || null
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
                    </>
                }
            />

            <TableWrapper
                isLoading={loading}
                isEmpty={!loading && (!data?.items || data.items.length === 0)}
                emptyComponent={
                    <EmptyState
                        message={t('empty_holdings')}
                        hint={t('empty_holdings_hint')}
                    />
                }
            >
                <HoldingTable
                    data={data?.items || []}
                    onDelete={handleDeleteRequest}
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
                onSubmit={modalConfig.submitAction || (() => {
                })} // 双重保险
                FormComponent={isMobile ? HoldingFormMobile : HoldingForm}
                initialValues={modalConfig.initialValues}
                modalProps={{onCrawl: handleCrawl}}
            />

            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title={t('title_delete_confirmation')}
                description={confirmationDescription}
                isLoading={confirmState.isLoading}
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
