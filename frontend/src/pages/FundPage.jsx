// src/pages/FundPage.jsx
import FundSearchBox from '../components/search/FundSearchBox';
import FundForm from '../components/forms/FundForm';
import FundTable from '../components/tables/FundTable';
import useFundList from '../hooks/useFundList';

export default function FundPage() {
    const { data, loading, add, remove, search } = useFundList();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">基金管理</h1>
            <FundSearchBox onSearch={search} />
            <FundForm onSubmit={add} />
            <FundTable data={data} loading={loading} onDelete={remove} />
        </div>
    );
}