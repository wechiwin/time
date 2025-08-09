// src/pages/FundPage.jsx
import FundSearchBox from '../components/search/FundSearchBox';
import FundForm from '../components/forms/FundForm';
import FundTable from '../components/tables/FundTable';
import useFundList from '../hooks/api/useFundList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import {useDebouncedSearch} from "../hooks/useDebouncedSearch";
import {useState} from 'react';
import FormModal from "../components/common/FormModal";

export default function FundPage() {
    const {data, loading, add, remove, search, update} = useFundList();
    const handleDelete = useDeleteWithToast(remove, '基金');
    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加新基金");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">基金管理</h1>
            <FundSearchBox onSearch={search}/>
            {/* 添加按钮 */}
            <div className="text-left">
                <button
                    onClick={openAddModal}
                    className="btn-primary"
                >
                    添加基金
                </button>
            </div>
            <FundTable data={data} onDelete={handleDelete} onEdit={openEditModal}/>
            {/* 模态框 */}
            <FormModal
                title={modalTitle}
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={modalSubmit}
                FormComponent={FundForm}
                initialValues={initialValues}
            />
        </div>
    );
}