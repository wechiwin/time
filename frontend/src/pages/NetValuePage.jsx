// src/pages/NetValuePage.jsx
import NetValueSearchBox from '../components/search/NetValueSearchBox';
import NetValueForm from '../components/forms/NetValueForm';
import NetValueTable from '../components/tables/NetValueTable';
import useNetValueList from '../hooks/api/useNetValueList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useCallback, useState} from "react";
import Pagination from "../components/common/Pagination";
import CrawlNetValueForm from "../components/forms/CrawlNetValueForm";
import {usePaginationState} from "../hooks/usePaginationState";

export default function NetValuePage() {
    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();

    const [keyword, setKeyword] = useState("");

    // 数据操作
    const {data, add, remove, update, crawl} = useNetValueList({
        page,
        perPage,
        keyword,
        autoLoad: true,
    });
    const handleDelete = useDeleteWithToast(remove);

    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [showCrawlModal, setShowCrawlModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加净值");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

    // 搜索处理
    const handleSearch = useCallback((kw) => {
        setKeyword(kw);
        handlePageChange(1); // 搜索时重置到第一页
    }, [handlePageChange]);

    const openAddModal = () => {
        setModalTitle("添加净值");
        setModalSubmit(() => add);
        setInitialValues({});
        setShowModal(true);
    };

    const openEditModal = (fund) => {
        setModalTitle("修改净值");
        setModalSubmit(() => update);
        setInitialValues(fund);
        setShowModal(true);
    };

    const openCrawlModal = () => setShowCrawlModal(true);

    const handleCrawlSubmit = async (crawlData) => {
        await crawl(crawlData);
        setShowCrawlModal(false);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">净值历史</h1>
            {/* 搜索 */}
            <NetValueSearchBox onSearch={handleSearch}/>

            {/* 操作按钮 */}
            <div className="text-left">
                {/* <button */}
                {/*     onClick={openAddModal} */}
                {/*     className="btn-primary" */}
                {/* > */}
                {/*     添加净值 */}
                {/* </button> */}
                <button
                    onClick={openCrawlModal}
                    className="btn-primary"
                >
                    爬取净值
                </button>
            </div>
            {/* <NetValueForm onSubmit={add}/> */}
            <NetValueTable
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
                FormComponent={NetValueForm}
                initialValues={initialValues}
            />
            {/* 爬取净值模态框 */}
            <FormModal
                title="爬取净值数据"
                show={showCrawlModal}
                onClose={() => setShowCrawlModal(false)}
                onSubmit={handleCrawlSubmit}
                FormComponent={CrawlNetValueForm}
                initialValues={{}}
            />
        </div>
    );
}