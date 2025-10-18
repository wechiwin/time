// src/pages/NetValuePage.jsx
import NetValueSearchBox from '../components/search/NetValueSearchBox';
import NetValueForm from '../components/forms/NetValueForm';
import NetValueTable from '../components/tables/NetValueTable';
import useNetValueList from '../hooks/api/useNetValueList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useEffect, useState} from "react";
import Pagination from "../components/common/Pagination";

export default function NetValuePage() {
    const {data, loading, add, remove, update, search} = useNetValueList();
    const handleDelete = useDeleteWithToast(remove);

    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加净值");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

    // 分页和搜索状态
    const [currentPage, setCurrentPage] = useState(1);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [perPage, setPerPage] = useState(10);

    // 搜索函数
    const handleSearch = (keyword = searchKeyword, page = 1, pageSize = perPage) => {
        setSearchKeyword(keyword);
        setCurrentPage(page);
        search(keyword, page, pageSize);
    };

    // 页码改变
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        search(searchKeyword, newPage, perPage);
    };

    // 每页数量改变
    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage);
        setCurrentPage(1); // 重置到第一页
        search(searchKeyword, 1, newPerPage);
    };


    // 初始化加载数据
    useEffect(() => {
        handleSearch('', 1, perPage);
    }, []);

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

    const handleFormSubmit = async (formData) => {
        await modalSubmit(formData);
        setShowModal(false);
        // 重新加载当前页数据
        handleSearch(searchKeyword, currentPage, perPage);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">净值历史</h1>
            <NetValueSearchBox onSearch={search}/>
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