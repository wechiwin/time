// src/components/tables/NetValueTable.jsx
import DeleteButton from '../common/DeleteButton';

export default function NetValueTable({ data = [], loading, onDelete }) {
    if (loading) return <p className="text-sm text-gray-500">加载中…</p>;

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th className="table-header">基金代码</th>
                    <th className="table-header">日期</th>
                    <th className="table-header">单位净值</th>
                    <th className="table-header">累计净值</th>
                    <th className="table-header text-right">操作</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {data.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{n.fund_code}</td>
                        <td className="table-cell">{n.date}</td>
                        <td className="table-cell">{n.unit_net_value}</td>
                        <td className="table-cell">{n.accumulated_net_value}</td>
                        <td className="table-cell text-right">
                            <DeleteButton
                                onConfirm={() => onDelete(n.id)}
                                description={`删除 ${n.fund_code} 在 ${n.date} 的记录？`}
                            />
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}