// src/components/tables/TradeTable.jsx
import DeleteButton from '../common/DeleteButton';

export default function TradeTable({ data = [], loading, onDelete }) {
    if (loading) return <p className="text-sm text-gray-500">加载中…</p>;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th className="table-header">基金代码</th>
                    <th className="table-header">类型</th>
                    <th className="table-header">日期</th>
                    <th className="table-header">净值</th>
                    <th className="table-header">份数</th>
                    <th className="table-header">手续费</th>
                    <th className="table-header text-right">操作</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {data.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{t.fund_code}</td>
                        <td className="table-cell">
                <span
                    className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                        t.transaction_type === '买入'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                >
                  {t.transaction_type}
                </span>
                        </td>
                        <td className="table-cell">{t.transaction_date}</td>
                        <td className="table-cell">{t.transaction_net_value}</td>
                        <td className="table-cell">{t.transaction_shares}</td>
                        <td className="table-cell">{t.transaction_fee}</td>
                        <td className="table-cell text-right">
                            <DeleteButton
                                onConfirm={() => onDelete(t.id)}
                                description={`删除 ${t.fund_code} 的这条交易？`}
                            />
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}