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
    const {data, loading, add, remove, search} = useFundList();
    const handleDelete = useDeleteWithToast(remove, '基金');
    const [keyword, setKeyword] = useDebouncedSearch(search, 300);
    // 控制模态框开关
    const [showModal, setShowModal] = useState(false);
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">基金管理</h1>
            <FundSearchBox onSearch={search}/>
            {/* 添加按钮 */}
            <div className="text-left">
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary"
                >
                    添加基金
                </button>
            </div>
            {/* <FundForm onSubmit={add}/> */}
            <FundTable data={data} onDelete={handleDelete}/>
            {/* 模态框 */}
            <FormModal
                title="添加新基金"
                show={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={add}
                FormComponent={FundForm}
            />
            {/* {showModal && ( */}
            {/*     <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"> */}
            {/*         <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6"> */}
            {/*             <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">添加新基金</h2> */}
            {/*             <FundForm */}
            {/*                 onSubmit={async (values) => { */}
            {/*                     await add(values); */}
            {/*                     setShowModal(false); // 成功后关闭 */}
            {/*                 }} */}
            {/*                 onClose={() => setShowModal(false)} */}
            {/*             /> */}
            {/*         </div> */}
            {/*     </div> */}
            {/* )} */}
        </div>
    );
}