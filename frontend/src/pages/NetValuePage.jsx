// src/pages/NetValuePage.jsx
import NetValueSearchBox from '../components/search/NetValueSearchBox';
import NetValueForm from '../components/forms/NetValueForm';
import NetValueTable from '../components/tables/NetValueTable';
import useNetValueList from '../hooks/api/useNetValueList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useState} from "react";

export default function NetValuePage() {
    const {data, loading, add, remove, update, search} = useNetValueList();
    const handleDelete = useDeleteWithToast(remove);
    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加净值");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});

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
            <NetValueTable data={data} onDelete={handleDelete} onEdit={openEditModal}/>
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