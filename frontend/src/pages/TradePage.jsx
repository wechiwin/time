// src/pages/TradePage.jsx
import TradeForm from '../components/forms/TradeForm';
import TradeTable from '../components/tables/TradeTable';
import useTradeList from '../hooks/api/useTradeList';
import FormModal from "../components/common/FormModal";
import {useCallback, useState} from "react";
import {useToast} from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";
import {useTranslation} from "react-i18next";

export default function TradePage() {
    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();
    const [inputValue, setInputValue] = useState("");
    const [queryKeyword, setQueryKeyword] = useState("");
    const {t} = useTranslation()

    const {
        data,
        add,
        remove,
        search,
        update,
        importData,
        downloadTemplate,
        uploadTradeImg
    } = useTradeList({
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
    const [modalTitle, setModalTitle] = useState("添加新交易");
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

    const openAddModal = () => {
        setModalTitle(t('button_add'));
        setModalSubmit(() => add);
        setInitialValues({});
        setShowModal(true);
    };

    const openEditModal = (fund) => {
        setModalTitle(t('button_edit'));
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
                    <button onClick={openAddModal} className="btn-primary">
                        {t('button_add')}
                    </button>
                    <button onClick={downloadTemplate} className="btn-secondary">
                        {t('button_download_template')}
                    </button>
                    <button onClick={handleImport} className="btn-secondary">
                        {t('button_import_data')}
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
                FormComponent={TradeForm}
                initialValues={initialValues}
            />
        </div>
    );
}