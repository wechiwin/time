// src/pages/HoldingPage.jsx
import HoldingSearchBox from '../components/search/HoldingSearchBox';
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import {useCallback, useState} from 'react';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/toast/ToastContext";
import Pagination from "../components/common/Pagination";
import {usePaginationState} from "../hooks/usePaginationState";

export default function HoldingPage() {
    // 分页
    const {
        page,
        perPage,
        handlePageChange,
        handlePerPageChange
    } = usePaginationState();

    const [keyword, setKeyword] = useState("");

    // 使用参数驱动的数据获取
    const {data, loading, error, add, remove, search, update, importData, downloadTemplate} = useHoldingList({
        page,
        perPage,
        keyword,
        autoLoad: true,
    });

    // // 添加调试信息
    // console.log('HoldingPage数据:', {
    //     data,
    //     loading,
    //     error,
    //     hasData: !!data,
    //     itemsCount: data?.items?.length,
    //     pagination: data?.pagination
    // });

    const handleDelete = useDeleteWithToast(remove, '基金');
    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加新基金");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});
    const {showSuccessToast, showErrorToast} = useToast();

    const openAddModal = () => {
        setModalTitle("添加新基金");
        setModalSubmit(() => add);
        setInitialValues({});
        setShowModal(true);
    };

    const openEditModal = (fund) => {
        setModalTitle("修改基金");
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

    // 搜索处理
    const handleSearch = useCallback((keyword) => {
        setKeyword(keyword);
        handlePageChange(1);
    }, [handlePageChange]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch(keyword);
        }
    };

    return (
        <div className="space-y-6">
            {/* 搜索 + 按钮行 */}
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
                        添加基金
                    </button>
                    <button onClick={downloadTemplate} className="btn-secondary">
                        下载模板
                    </button>
                    <button onClick={handleImport} className="btn-secondary">
                        导入数据
                    </button>
                </div>
            </div>
            <HoldingTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>
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
                FormComponent={HoldingForm}
                initialValues={initialValues}
            />
        </div>
    );
}