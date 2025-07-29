// src/pages/NetValuePage.jsx
import NetValueSearchBox from '../components/search/NetValueSearchBox';
import NetValueForm from '../components/forms/NetValueForm';
import NetValueTable from '../components/tables/NetValueTable';
import useNetValueList from '../hooks/useNetValueList';

export default function NetValuePage() {
    const { data, loading, add, remove, search } = useNetValueList();
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">净值历史</h1>
            <NetValueSearchBox onSearch={search} />
            <NetValueForm onSubmit={add} />
            <NetValueTable data={data} loading={loading} onDelete={remove} />
        </div>
    );
}