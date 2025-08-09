// src/components/tables/FundTable.jsx
import DeleteButton from '../common/DeleteButton';

export default function FundTable({data = [], onDelete, onEdit}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">基金代码</th>
                    <th className="table-header">基金名称</th>
                    <th className="table-header">基金类型</th>
                    <th className="table-header text-right">操作</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((f) => (
                    <tr key={f.id} className="hover:page-bg">
                        <td className="table-cell">{f.fund_code}</td>
                        <td className="table-cell font-medium">{f.fund_name}</td>
                        <td className="table-cell">{f.fund_type}</td>
                        <td className="table-cell">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(f)}
                                >
                                    修改
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(f.id)}
                                    description={`确定删除基金 ${f.fund_name} (${f.fund_code}) 吗？`}
                                />
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}