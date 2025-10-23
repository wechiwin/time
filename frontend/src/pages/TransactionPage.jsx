// src/pages/TransactionPage.jsx
import TransactionSearchBox from '../components/search/TransactionSearchBox';
import TransactionForm from '../components/forms/TransactionForm';
import TradeTable from '../components/tables/TradeTable';
import useTransactionList from '../hooks/api/useTransactionList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useCallback, useState} from "react";
import {useToast} from "../components/toast/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";

export default function TransactionPage() {
    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();

    const [keyword, setKeyword] = useState("");

    const {data, loading, error, add, remove, search, update, importData, downloadTemplate} = useTransactionList({
        page,
        perPage,
        keyword,
        autoLoad: true,
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
        setKeyword(keyword);
        handlePageChange(1); // 搜索时重置到第一页
    }, [handlePageChange]);

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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(keyword);
        }
    };

    return (
        <div className="space-y-6">
            <div className="search-bar">
                <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="请输入名称或代码"
                    className="search-input"
                />
                <button
                    onClick={() => handleSearch(keyword)}
                    className="btn-primary"
                >
                    查询
                </button>
                {/* 右侧按钮组 */}
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={openAddModal} className="btn-primary">
                        添加交易
                    </button>
                    <button onClick={downloadTemplate} className="btn-secondary">
                        下载模板
                    </button>
                    <button onClick={handleImport} className="btn-secondary">
                        导入数据
                    </button>
                </div>
            </div>

            {/* 数据表格 */}
            <TradeTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>
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