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

export default function NavHistoryPage() {
    const {t} = useTranslation()

    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();
    const [inputValue, setInputValue] = useState("");
    const [queryKeyword, setQueryKeyword] = useState("");
    const [keyword, setKeyword] = useState("");

    // 数据操作
    const {data, add, remove, update, crawl, crawl_all} = useNavHistoryList({
        page,
        perPage,
        keyword: queryKeyword,
        autoLoad: true,
    });

    const handleDelete = async (ho_id) => {
        try {
            await remove(ho_id);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [showCrawlModal, setShowCrawlModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加净值");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

    const {showSuccessToast, showErrorToast} = useToast();

// 搜索处理
    const handleSearch = useCallback(() => {
        console.log("执行搜索:", inputValue);
        setQueryKeyword(inputValue); // 同步输入值到查询状态
        handlePageChange(1); // 重置回第一页
    }, [inputValue, handlePageChange]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    // const openAddModal = () => {
    //     setModalTitle("添加净值");
    //     setModalSubmit(() => add);
    //     setInitialValues({});
    //     setShowModal(true);
    // };

    const openEditModal = (fund) => {
        setModalTitle(t('button_edit'));
        setModalSubmit(() => update);
        setInitialValues(fund);
        setShowModal(true);
    };

    const openCrawlModal = () => setShowCrawlModal(true);

    const handleCrawlSubmit = async (crawlData) => {
        await crawl(crawlData);
        setShowCrawlModal(false);
    };

    const handleCrawlAll = async () => {
        try {
            await crawl_all();
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* 搜索 */}
            <div className="search-bar">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('msg_search_placeholder')}
                    className="search-input"
                />
                <button
                    onClick={handleSearch}
                    className="btn-primary"
                >
                    {t('button_search')}
                </button>
                {/* 右侧按钮组 */}
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={handleCrawlAll} className="btn-secondary">
                        {t('button_crawl_all')}
                    </button>
                    <button onClick={openCrawlModal} className="btn-secondary">
                        {t('button_crawl_info')}
                    </button>
                </div>
            </div>

            <NavHistoryTable
                data={data?.items || []}
                onDelete={handleDelete}
                onEdit={openEditModal}
            />
            {/* 分页 */}
            {data?.pagination && (
                <Pagination
                    pagination={{
                        page,
                        per_page: perPage,
                        total: data.pagination.total,
                        pages: data.pagination.pages,
                    }}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                />
            )}
            {/* 模态框 */}
            <FormModal
                title={modalTitle}
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={modalSubmit}
                FormComponent={NavHistoryForm}
                initialValues={initialValues}
            />
            {/* 爬取净值模态框 */}
            <FormModal
                title={t('button_crawl_info')}
                show={showCrawlModal}
                onClose={() => setShowCrawlModal(false)}
                onSubmit={handleCrawlSubmit}
                FormComponent={CrawlNetValueForm}
                initialValues={{}}
            />
        </div>
    );
}