// src/pages/TradePage.jsx
import TradeSearchBox from '../components/search/TradeSearchBox';
import TradeForm from '../components/forms/TradeForm';
import TradeTable from '../components/tables/TradeTable';
import useTradeList from '../hooks/api/useTradeList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import FormModal from "../components/common/FormModal";
import {useState} from "react";
import {useToast} from "../components/toast/ToastContext";

export default function TradePage() {
    const {data, loading, add, remove, search, update, importData, downloadTemplate} = useTradeList();
    const handleDelete = useDeleteWithToast(remove);
    // 模态框控制
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加新交易");
    const [modalSubmit, setModalSubmit] = useState(() => add);
    const [initialValues, setInitialValues] = useState({});
    const {showSuccessToast, showErrorToast} = useToast();

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
            <TradeSearchBox onSearch={search}/>
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
            {/* <TradeForm onSubmit={add}/> */}
            <TradeTable data={data} onDelete={handleDelete} onEdit={openEditModal}/>
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