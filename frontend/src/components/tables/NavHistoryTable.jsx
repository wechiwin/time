// src/components/tables/NavHistoryTable.jsx
import DeleteButton from '../common/DeleteButton';

export default function NavHistoryTable({data = [], onDelete, onEdit}) {

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">基金代码</th>
                    <th className="table-header">基金简称</th>
                    <th className="table-header">交易日期</th>
                    <th className="table-header">单位净值</th>
                    <th className="table-header">累计净值</th>
                    <th className="table-header text-right">操作</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((n) => (
                    <tr key={n.nav_id} className="hover:page-bg">
                        <td className="table-cell font-medium">{n.ho_code}</td>
                        <td className="table-cell font-medium">{n.ho_short_name}</td>
                        <td className="table-cell">{n.nav_date}</td>
                        <td className="table-cell">{n.nav_per_unit}</td>
                        <td className="table-cell">{n.nav_accumulated_per_unit}</td>
                        <td className="table-cell text-right">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(n)}
                                >
                                    修改
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(n.nav_id)}
                                    description={`删除 ${n.ho_code} 在 ${n.nav_date} 的记录？`}
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