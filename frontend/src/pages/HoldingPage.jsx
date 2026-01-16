import React, {useCallback, useState} from 'react';
import {useTranslation} from "react-i18next";
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import SearchBar from "../components/search/SearchBar";

export default function HoldingPage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [filters, setFilters] = useState({ho_status: "", ho_type: ""});

    const {data, add, remove, update, importData, downloadTemplate, crawlFundInfo} = useHoldingList({
        page, perPage, keyword: queryKeyword, autoLoad: true, refreshKey, ...filters
    });

    const handleSearch = useCallback((val) => {
        setQueryKeyword(val);
        handlePageChange(1);
    }, [handlePageChange]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value}));
        handlePageChange(1);
    };

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
            {/* 自由布局：左右对齐 */}
            <div
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">

                    {/* 左侧：搜索 + 筛选 */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="w-full md:w-auto min-w-[240px]">
                            <SearchBar key={refreshKey} placeholder={t('msg_search_placeholder')}
                                       onSearch={handleSearch}/>
                        </div>
                        <select name="ho_status" value={filters.ho_status} onChange={handleFilterChange}
                                className="input-field w-full md:w-40">
                            <option value="">{t('all_status') || "所有状态"}</option>
                            <option value="HOLDING">{t('HO_STATUS_HOLDING')}</option>
                            <option value="CLOSED">{t('HO_STATUS_CLEARED')}</option>
                            <option value="NOT_HELD">{t('HO_STATUS_NOT_HOLDING')}</option>
                        </select>
                        <select name="ho_type" value={filters.ho_type} onChange={handleFilterChange}
                                className="input-field w-full md:w-40">
                            <option value="">{t('all_types') || "所有类型"}</option>
                            <option value="FUND">{t('HOLDING_TYPE_FUND')}</option>
                        </select>
                    </div>

                    {/* 右侧：按钮组 */}
                    <div className="flex flex-wrap gap-2 self-end xl:self-auto">
                        <button onClick={() => openModal('add')} className="btn-primary">{t('button_add')}</button>
                        <button onClick={downloadTemplate}
                                className="btn-secondary">{t('button_download_template')}</button>
                        <button onClick={handleImport} className="btn-secondary">{t('button_import_data')}</button>
                    </div>
                </div>
            </div>

            <HoldingTable data={data?.items || []} onDelete={handleDelete} onEdit={(item) => openModal('edit', item)}/>

            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            <FormModal
                title={modalConfig.title} show={modalConfig.show}
                onClose={() => setModalConfig(p => ({...p, show: false}))}
                onSubmit={modalConfig.submitAction} FormComponent={HoldingForm}
                initialValues={modalConfig.initialValues}
                modalProps={{onCrawl: handleCrawl}}
            />
        </div>
    );
}
