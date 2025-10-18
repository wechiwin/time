// src/pages/HoldingPage.jsx
import HoldingSearchBox from '../components/search/HoldingSearchBox';
import HoldingForm from '../components/forms/HoldingForm';
import HoldingTable from '../components/tables/HoldingTable';
import useHoldingList from '../hooks/api/useHoldingList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import {useCallback, useEffect, useState} from 'react';
import FormModal from "../components/common/FormModal";
import {useToast} from "../components/toast/ToastContext";
import withPagination from '../components/common/withPagination';
import Pagination from "../components/common/Pagination";

function HoldingPage({pagination}) {
    // 使用参数驱动的数据获取
    const {data, loading, error, add, remove, search, update, importData, downloadTemplate} = useHoldingList({
        keyword: pagination.searchKeyword,
        page: pagination.currentPage,
        perPage: pagination.perPage,
        autoLoad: true
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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">基金管理</h1>
            <HoldingSearchBox onSearch={handleSearch}/>
            {/* 添加按钮 */}
            <div className="text-left">
                <button
                    onClick={openAddModal}
                    className="btn-primary"
                >
                    添加基金
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
            <HoldingTable data={data?.items || []} onDelete={handleDelete} onEdit={openEditModal}/>
            {/* 分页 */}
            {data?.pagination && (
                <Pagination
                    pagination={data.pagination}
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

export default withPagination(HoldingPage, {defaultPerPage: 10});