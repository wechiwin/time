import React, {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import TradeForm from '../components/forms/TradeForm';
import TradeTable from '../components/tables/TradeTable';
import useTradeList from '../hooks/api/useTradeList';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import SearchBar from "../components/search/SearchBar";
import DateRangePicker from "../components/common/DateRangePicker";

export default function TradePage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const initialFilters = {
        tr_type: "",
        dateRange: {startDate: null, endDate: null}
    };
    const [filters, setFilters] = useState(initialFilters);

    const {
        data, add, remove, update, importData, downloadTemplate,
    } = useTradeList({
        page, perPage, keyword: queryKeyword, autoLoad: true, refreshKey,
        tr_type: filters.tr_type,
        start_date: filters.dateRange.startDate,
        end_date: filters.dateRange.endDate
    });

    const handleSearch = useCallback((val) => {
        setQueryKeyword(val);
        handlePageChange(1);
    }, [handlePageChange]);
    const handleFilterChange = (e) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value}));
        handlePageChange(1);
    };
    const handleDateChange = (val) => {
        setFilters(prev => ({...prev, dateRange: val}));
        handlePageChange(1);
    };
    const handleReset = () => {
        setQueryKeyword("");
        setFilters(initialFilters);
        handlePageChange(1);
        setRefreshKey(p => p + 1);
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

    // 模态框逻辑
    const [modalConfig, setModalConfig] = useState({show: false, title: "", submitAction: null, initialValues: {}});
    const openModal = (type, values = {}) => {
        setModalConfig({
            show: true,
            title: type === 'add' ? t('button_add') : t('button_edit'),
            submitAction: type === 'add' ? add : update,
            initialValues: values
        });
    };

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
            {/* 自定义布局容器 */}
            <div
                className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col gap-4">
                    {/* 第一行：搜索 + 筛选 + 重置 */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-full md:w-auto min-w-[240px]">
                            <SearchBar key={refreshKey} placeholder={t('msg_search_placeholder')}
                                       onSearch={handleSearch}/>
                        </div>
                        <select name="tr_type" value={filters.tr_type} onChange={handleFilterChange}
                                className="input-field w-full md:w-40">
                            <option value="">{t('all_types') || "所有类型"}</option>
                            <option value="BUY">{t('TR_BUY')}</option>
                            <option value="SELL">{t('TR_SELL')}</option>
                            <option value="DIVIDEND">{t('TR_DIVIDEND')}</option>
                        </select>
                        <DateRangePicker value={filters.dateRange} onChange={handleDateChange}/>
                        <button onClick={handleReset}
                                className="text-sm text-gray-500 hover:text-blue-600 underline px-2">
                            {t('button_reset') || "重置"}
                        </button>
                    </div>

                    {/* 分割线 */}
                    <div className="border-t border-gray-100 dark:border-gray-700"></div>

                    {/* 第二行：操作按钮 (右对齐) */}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => openModal('add')} className="btn-primary">{t('button_add')}</button>
                        <button onClick={downloadTemplate}
                                className="btn-secondary">{t('button_download_template')}</button>
                        <button onClick={handleImport} className="btn-secondary">{t('button_import_data')}</button>
                    </div>
                </div>
            </div>

            <TradeTable data={data?.items || []} onDelete={handleDelete} onEdit={(item) => openModal('edit', item)}/>

            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            <FormModal
                title={modalConfig.title} show={modalConfig.show}
                onClose={() => setModalConfig(p => ({...p, show: false}))}
                onSubmit={modalConfig.submitAction} FormComponent={TradeForm} initialValues={modalConfig.initialValues}
            />
        </div>
    );
}
