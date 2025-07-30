// src/pages/FundPage.jsx
import FundSearchBox from '../components/search/FundSearchBox';
import FundForm from '../components/forms/FundForm';
import FundTable from '../components/tables/FundTable';
import useFundList from '../hooks/useFundList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';
import {useDebouncedSearch} from "../hooks/useDebouncedSearch";

export default function FundPage() {
    const {data, loading, add, remove, search} = useFundList();
    const handleDelete = useDeleteWithToast(remove, '基金');
    const [keyword, setKeyword] = useDebouncedSearch(search, 300);
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">基金管理</h1>
            <FundSearchBox onSearch={search} />
            <FundForm onSubmit={add} />
            <FundTable data={data} loading={loading} onDelete={handleDelete} />
        </div>
    );
}