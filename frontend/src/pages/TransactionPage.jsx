// src/pages/TransactionPage.jsx
import TransactionSearchBox from '../components/search/TransactionSearchBox';
import TransactionForm from '../components/forms/TransactionForm';
import TradeTable from '../components/tables/TradeTable';
import useTransactionList from '../hooks/api/useTransactionList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useCallback, useEffect, useState} from "react";
import {useToast} from "../components/toast/ToastContext";
import withPagination from '../components/common/withPagination';
import Pagination from "../components/common/Pagination";
import useHoldingList from "../hooks/api/useHoldingList";

function TransactionPage({pagination}) {
    const {data, loading, error, add, remove, search, update, importData, downloadTemplate} = useTransactionList({
        keyword: pagination.searchKeyword,
        page: pagination.currentPage,
        perPage: pagination.perPage,
        autoLoad: true
    });

    const handleDelete = useDeleteWithToast(remove);
    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加新交易");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});
    const {showSuccessToast, showErrorToast} = useToast();

    // 搜索处理
    const handleSearch = useCallback((keyword) => {
        pagination.handleSearch(keyword);
    }, [pagination]);

    // 处理页码变化
    const handlePageChange = useCallback((newPage) => {
        pagination.handlePageChange(newPage);
    }, [pagination]);

    // 处理每页数量变化
    const handlePerPageChange = useCallback((newPerPage) => {
        pagination.handlePerPageChange(newPerPage);
    }, [pagination]);

    const openAddModal = () => {
        setModalTitle("添加新交易");
        setModalSubmit(() => add);
        setInitialValues({});
        setShowModal(true);
    };

    const openEditModal = (fund) => {
        setModalTitle("修改交易");
        setModalSubmit(() => update);
        setInitialValues(fund);
        setShowModal(true);
    };

    // 导入数据
    const handleImport = async () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                await importData(file);
                showSuccessToast();
            };
            input.click();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">交易管理</h1>
            <TransactionSearchBox onSearch={handleSearch}/>
            <div className="text-left">
                <button
                    onClick={openAddModal}
                    className="btn-primary"
                >
                    添加交易
                </button>
                <button
                    onClick={downloadTemplate}
                    className="btn-secondary ml-2"
                >
                    下载模板
                </button>
                <button
                    onClick={handleImport}
                    className="btn-secondary ml-2"
                >
                    导入数据
                </button>
            </div>
            {/* 数据表格 */}
            <TradeTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>
            {/* 分页 */}
            {data?.pagination && (
                <Pagination
                    pagination={data.pagination}
                    onPageChange={handlePageChange}
                    onPerPageChange={handlePerPageChange}
                />
            )}
            <FormModal
                title={modalTitle}
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={modalSubmit}
                FormComponent={TransactionForm}
                initialValues={initialValues}
            />
        </div>
    );
}

export default withPagination(TransactionPage, {defaultPerPage: 10});