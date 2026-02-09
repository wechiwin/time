// src/pages/NavHistoryPage.jsx
import NavHistoryForm from '../components/forms/NavHistoryForm';
import NavHistoryTable from '../components/tables/NavHistoryTable';
import useNavHistoryList from '../hooks/api/useNavHistoryList';
import FormModal from "../components/common/FormModal";
import {useCallback, useState} from "react";
import Pagination from "../components/common/pagination/Pagination";
import CrawlNetValueForm from "../components/forms/CrawlNetValueForm";
import {usePaginationState} from "../hooks/usePaginationState";
import {useToast} from "../components/context/ToastContext";
import {useTranslation} from "react-i18next";
import SearchArea from "../components/search/SearchArea";
import {ArrowDownTrayIcon, DocumentArrowDownIcon} from "@heroicons/react/16/solid";

export default function NavHistoryPage() {
    const {t} = useTranslation();
    const {showSuccessToast, showErrorToast} = useToast();
    const {page, perPage, handlePageChange, handlePerPageChange} = usePaginationState();

    const [queryKeyword, setQueryKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useState({
        dateRange: { startDate: null, endDate: null }
    });

    const { data, remove, update, crawl, crawl_all } = useNavHistoryList({
        page,
        perPage,
        keyword: queryKeyword,
        autoLoad: true,
        refreshKey,
        start_date: searchParams.dateRange.startDate,
        end_date: searchParams.dateRange.endDate
    });

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
            name: 'dateRange',
            type: 'daterange',
            label: t('th_market_date'),
            className: 'md:col-span-3',
        },
    ];

    const handleSearch = useCallback((val) => {
        setQueryKeyword(val.keyword || '');
        setSearchParams(prev => ({
            ...prev,
            dateRange: val.dateRange || {startDate: null, endDate: null}
        }));
        handlePageChange(1);
        setRefreshKey(p => p + 1);
    }, [handlePageChange]);

    const handleReset = useCallback(() => {
        setQueryKeyword("");
        setSearchParams({
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

    const [editModal, setEditModal] = useState({show: false, initialValues: {}});
    const [crawlModal, setCrawlModal] = useState(false);
    const openEditModal = (item) => setEditModal({show: true, initialValues: item});

    const handleCrawlSubmit = async (crawlData) => {
        await crawl(crawlData);
        setCrawlModal(false);
        showSuccessToast();
        setRefreshKey(p => p + 1);
    };
    const handleCrawlAll = async () => {
        try {
            await crawl_all();
            showSuccessToast(t('msg_task_started') || "任务已后台启动");
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
                    dateRange: searchParams.dateRange
                }}
                onSearch={handleSearch}
                onReset={handleReset}
                actionButtons={
                    <>
                        <button onClick={handleCrawlAll} className="btn-secondary inline-flex items-center gap-2">
                            <DocumentArrowDownIcon className="h-4 w-4"/>
                            {t('button_crawl_all')}
                        </button>
                        <button onClick={() => setCrawlModal(true)} className="btn-secondary inline-flex items-center gap-2">
                            <ArrowDownTrayIcon className="h-4 w-4"/>
                            {t('button_crawl_info')}
                        </button>
                    </>
                }
            />

            <NavHistoryTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>

            {data?.pagination && (
                <Pagination
                    pagination={{page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages}}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            <FormModal
                title={t('button_edit')}
                show={editModal.show}
                onClose={() => setEditModal(p => ({ ...p, show: false }))}
                onSubmit={update}
                FormComponent={NavHistoryForm}
                initialValues={editModal.initialValues}
            />
            <FormModal
                title={t('button_crawl_info')}
                show={crawlModal}
                onClose={() => setCrawlModal(false)}
                onSubmit={handleCrawlSubmit}
                FormComponent={CrawlNetValueForm}
                initialValues={{}}
            />
        </div>
    );
}
