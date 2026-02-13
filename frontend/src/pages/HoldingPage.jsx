import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from "react-i18next";
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/pagination/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import {ArrowDownTrayIcon, DocumentArrowDownIcon, PlusIcon} from "@heroicons/react/16/solid";
import SearchArea from "../components/search/SearchArea";
import {useIsMobile} from "../hooks/useIsMobile";
import HoldingFormMobile from "../components/forms/HoldingFormMobile";
import ConfirmationModal from "../components/common/ConfirmationModal";
import {useEnumTranslation} from "../contexts/EnumContext";

export default function HoldingPage() {
    const isMobile = useIsMobile();
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {getEnumOptions} = useEnumTranslation();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useState({ho_status: [], ho_type: []});

    const {
        data,
        add,
        remove,
        checkCascadeDelete,
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

    const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [hoStatusOptions, setHoStatusOptions] = useState([]);
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        holdingId: null,
        holdingName: '',
        cascadeInfo: null, // 存储级联信息
        isLoading: false,
    });

    // Load enum options for search filters (automatically updates on language change)
    useEffect(() => {
        setHoTypeOptions(getEnumOptions('HoldingTypeEnum'));
        setHoStatusOptions(getEnumOptions('HoldingStatusEnum'));
    }, [getEnumOptions]);

    // 搜索配置
    const searchFields = [
        {
            name: 'keyword',
            type: 'text',
            label: t('label_name_or_code'),
            placeholder: t('msg_search_placeholder'),
            className: 'md:col-span-3',
        },
        // {
        //     name: 'nav_date',
        //     type: 'daterange',
        //     label: t('th_market_date'),
        //     className: 'md:col-span-3',
        // },
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

    // 1. 用户点击删除按钮时，触发此函数
    const handleDeleteRequest = useCallback(async (holding) => {
        setConfirmState({
            isOpen: true,
            holdingId: holding.id,
            holdingName: `${holding.ho_code} - ${holding.ho_short_name}`,
            cascadeInfo: null,
            isLoading: true,
        });
        try {
            const cascadeData = await checkCascadeDelete(holding.id);
            setConfirmState(prev => ({ ...prev, cascadeInfo: cascadeData, isLoading: false }));
        } catch (err) {
            showErrorToast(err.message);
            setConfirmState({ isOpen: false, holdingId: null, holdingName: '', cascadeInfo: null, isLoading: false });
        }
    }, [checkCascadeDelete, showErrorToast]);
    // 2. 用户在模态框中点击“确认”时，触发此函数
    const handleConfirmDelete = async () => {
        if (!confirmState.holdingId) return;
        setConfirmState(prev => ({ ...prev, isLoading: true }));
        try {
            await remove(confirmState.holdingId);
            showSuccessToast(t('msg_delete_success'));
            // 刷新逻辑
            if (data?.items?.length === 1 && page > 1) {
                handlePageChange(page - 1);
            } else {
                setRefreshKey(p => p + 1);
            }
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            // 关闭并重置模态框状态
            setConfirmState({ isOpen: false, holdingId: null, holdingName: '', cascadeInfo: null, isLoading: false });
        }
    };
    // 3. 关闭模态框
    const handleCancelDelete = () => {
        setConfirmState({ isOpen: false, holdingId: null, holdingName: '', cascadeInfo: null, isLoading: false });
    };
    // 动态生成模态框的描述信息
    const confirmationDescription = useMemo(() => {
        if (!confirmState.cascadeInfo) {
            return t('msg_delete_confirmation_simple', { name: confirmState.holdingName });
        }
        const details = Object.entries(confirmState.cascadeInfo)
            .map(([key, value]) => `${value} ${t(`cascade_item_${key}`)}`) // e.g., "5 trade records"
            .join(', ');
        if (!details) {
            return t('msg_delete_confirmation_simple', { name: confirmState.holdingName });
        }
        return t('msg_delete_confirmation_cascade', { name: confirmState.holdingName, details });
    }, [confirmState.cascadeInfo, confirmState.holdingName, t]);

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
                        <button onClick={() => openModal('add')} className="btn-primary inline-flex items-center gap-2">
                            <PlusIcon className="h-4 w-4"/>
                            {t('button_add')}
                        </button>
                        <button onClick={downloadTemplate} className="btn-secondary inline-flex items-center gap-2">
                            <DocumentArrowDownIcon className="h-4 w-4"/>
                            {t('button_download_template')}
                        </button>
                        <button onClick={handleImport} className="btn-secondary inline-flex items-center gap-2">
                            <ArrowDownTrayIcon className="h-4 w-4"/>
                            {t('button_import_data')}
                        </button>
                    </>
                }
            />

            <HoldingTable
                data={data?.items || []}
                onDelete={handleDeleteRequest}
                onEdit={(item) => openModal('edit', item)}
            />

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
        </div>
    );
}
