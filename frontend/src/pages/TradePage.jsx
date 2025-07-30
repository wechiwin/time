// src/pages/TradePage.jsx
import TradeSearchBox from '../components/search/TradeSearchBox';
import TradeForm from '../components/forms/TradeForm';
import TradeTable from '../components/tables/TradeTable';
import useTradeList from '../hooks/api/useTradeList';
import useDeleteWithToast from '../hooks/useDeleteWithToast';

export default function TradePage() {
    const { data, loading, add, remove, search } = useTradeList();
    const handleDelete = useDeleteWithToast(remove);
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">交易管理</h1>
            <TradeSearchBox onSearch={search} />
            <TradeForm onSubmit={add} />
            <TradeTable data={data} loading={loading} onDelete={handleDelete} />
        </div>
    );
}