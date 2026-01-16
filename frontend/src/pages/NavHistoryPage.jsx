// src/pages/NavHistoryPage.jsx
import NavHistoryForm from '../components/forms/NavHistoryForm';
import NavHistoryTable from '../components/tables/NavHistoryTable';
import useNavHistoryList from '../hooks/api/useNavHistoryList';
import FormModal from "../components/common/FormModal";
import {useCallback, useState} from "react";
import Pagination from "../components/common/Pagination";
import CrawlNetValueForm from "../components/forms/CrawlNetValueForm";
import {usePaginationState} from "../hooks/usePaginationState";
import {useToast} from "../components/context/ToastContext";
import {useTranslation} from "react-i18next";
import SearchBar from "../components/search/SearchBar";
import DateRangePicker from "../components/common/DateRangePicker";

export default function NavHistoryPage() {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { page, perPage, handlePageChange, handlePerPageChange } = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });

    const { data, remove, update, crawl, crawl_all } = useNavHistoryList({
        page, perPage, keyword: queryKeyword, autoLoad: true, refreshKey,
        start_date: dateRange.startDate, end_date: dateRange.endDate
    });

    const handleSearch = useCallback((val) => { setQueryKeyword(val); handlePageChange(1); }, [handlePageChange]);
    const handleDateChange = (val) => { setDateRange(val); handlePageChange(1); };

    const handleDelete = async (id) => {
        if (!window.confirm(t('msg_confirm_delete'))) return;
        try { await remove(id); showSuccessToast(); setRefreshKey(p => p + 1); } catch (err) { showErrorToast(err.message); }
    };

    const [editModal, setEditModal] = useState({ show: false, initialValues: {} });
    const [crawlModal, setCrawlModal] = useState(false);
    const openEditModal = (item) => setEditModal({ show: true, initialValues: item });

    const handleCrawlSubmit = async (crawlData) => {
        await crawl(crawlData); setCrawlModal(false); showSuccessToast(); setRefreshKey(p => p + 1);
    };
    const handleCrawlAll = async () => {
        try { await crawl_all(); showSuccessToast(t('msg_task_started') || "任务已后台启动"); } catch (err) { showErrorToast(err.message); }
    };

    return (
        <div className="space-y-6">
            {/* 自由布局：左右对齐 */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">

                    {/* 左侧：搜索 + 日期 */}
                    <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                        <div className="w-full md:w-auto min-w-[240px]">
                            <SearchBar key={refreshKey} placeholder={t('msg_search_placeholder')} onSearch={handleSearch} />
                        </div>
                        <DateRangePicker value={dateRange} onChange={handleDateChange} />
                    </div>

                    {/* 右侧：按钮 */}
                    <div className="flex gap-2 self-end xl:self-auto">
                        <button onClick={handleCrawlAll} className="btn-secondary">{t('button_crawl_all')}</button>
                        <button onClick={() => setCrawlModal(true)} className="btn-secondary">{t('button_crawl_info')}</button>
                    </div>
                </div>
            </div>

            <NavHistoryTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal} />

            {data?.pagination && (
                <Pagination
                    pagination={{ page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages }}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            <FormModal
                title={t('button_edit')} show={editModal.show} onClose={() => setEditModal(p => ({ ...p, show: false }))}
                onSubmit={update} FormComponent={NavHistoryForm} initialValues={editModal.initialValues}
            />
            <FormModal
                title={t('button_crawl_info')} show={crawlModal} onClose={() => setCrawlModal(false)}
                onSubmit={handleCrawlSubmit} FormComponent={CrawlNetValueForm} initialValues={{}}
            />
        </div>
    );
}
