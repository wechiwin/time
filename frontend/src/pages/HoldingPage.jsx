import React, {useCallback, useEffect, useState} from 'react';
import {useTranslation} from "react-i18next";
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import useCommon from "../hooks/api/useCommon";
import {ArrowDownTrayIcon, DocumentArrowDownIcon, PlusIcon} from "@heroicons/react/16/solid";
import SearchArea from "../components/search/SearchArea";

export default function HoldingPage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useState({ho_status: [], ho_type: []});

    const {data, add, remove, update, importData, downloadTemplate, crawlFundInfo} = useHoldingList({
        page,
        perPage,
        keyword: queryKeyword,
        autoLoad: true,
        refreshKey,
        ho_status: searchParams.ho_status,
        ho_type: searchParams.ho_type,
        nav_date: searchParams.nav_date
    });

    const {fetchMultipleEnumValues} = useCommon();

    const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [hoStatusOptions, setHoStatusOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [hoTypeOptions,
                    hoStatusOptions,
                ] = await fetchMultipleEnumValues([
                    'HoldingTypeEnum',
                    'HoldingStatusEnum',
                ]);
                setHoTypeOptions(hoTypeOptions);
                setHoStatusOptions(hoStatusOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

    // 搜索配置
    const searchFields = [
        {
            name: 'keyword',
            type: 'text',
            label: t('label_fund_name_or_code'),
            placeholder: t('msg_search_placeholder'),
            className: 'md:col-span-3',
        },
        // {
        //     name: 'nav_date',
        //     type: 'daterange',
        //     label: t('th_nav_date'),
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

    const handleDelete = async (id) => {
        if (!window.confirm(t('msg_confirm_delete'))) return;
        try {
            await remove(id);
            showSuccessToast();
            setRefreshKey(p => p + 1);
        } catch (err) {
            showErrorToast(err.message);
        }
    };

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
            showSuccessToast('基金信息爬取成功');
        } catch (e) {
            showErrorToast(e.message);
        }
    }, [crawlFundInfo, showSuccessToast, showErrorToast]);

    const handleImport = async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.onchange = async (e) => {
                if (e.target.files?.[0]) {
                    await importData(e.target.files[0]);
                    showSuccessToast();
                    setRefreshKey(p => p + 1);
                }
            };
            input.click();
        } catch (err) {
            showErrorToast(err.message);
        }
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

            <HoldingTable data={data?.items || []} onDelete={handleDelete} onEdit={(item) => openModal('edit', item)}/>

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
                FormComponent={HoldingForm}
                initialValues={modalConfig.initialValues}
                modalProps={{onCrawl: handleCrawl}}
            />
        </div>
    );
}
