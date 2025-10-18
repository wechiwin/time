// src/pages/NetValuePage.jsx
import NetValueSearchBox from '../components/search/NetValueSearchBox';
import NetValueForm from '../components/forms/NetValueForm';
import NetValueTable from '../components/tables/NetValueTable';
import useNetValueList from '../hooks/api/useNetValueList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useCallback, useEffect, useState} from "react";
import Pagination from "../components/common/Pagination";
import withPagination from '../components/common/withPagination';
import useTransactionList from "../hooks/api/useTransactionList";

function NetValuePage({pagination}) {
    const {data, loading, add, remove, update, search} = useNetValueList({
        keyword: pagination.searchKeyword,
        page: pagination.currentPage,
        perPage: pagination.perPage,
        autoLoad: true
    });
    const handleDelete = useDeleteWithToast(remove);

    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加净值");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

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

    // const handleFormSubmit = async (formData) => {
    //     await modalSubmit(formData);
    //     setShowModal(false);
    //     // 重新加载当前页数据
    //     const queryString = pagination.buildQueryString();
    //     await search(queryString);
    // };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">净值历史</h1>
            <NetValueSearchBox onSearch={handleSearch}/>
            <div className="text-left">
                <button
                    onClick={openAddModal}
                    className="btn-primary"
                >
                    添加净值
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
                FormComponent={NetValueForm}
                initialValues={initialValues}
            />
        </div>
    );
}

// 使用高阶组件包装，设置默认每页显示10条
export default withPagination(NetValuePage, {defaultPerPage: 10});