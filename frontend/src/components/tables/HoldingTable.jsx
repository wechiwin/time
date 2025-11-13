// src/components/tables/FundTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useNavigate} from 'react-router-dom';

export default function HoldingTable({data = [], onDelete, onEdit}) {

    const navigate = useNavigate();

    const handleRowClick = (fund) => {
        navigate(`/holding/${fund.ho_code}`);
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">基金代码</th>
                    <th className="table-header">基金名称</th>
                    <th className="table-header">基金别称</th>
                    <th className="table-header">基金类型</th>
                    <th className="table-header">创建日期</th>
                    <th className="table-header text-right">操作</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((f) => (
                    <tr key={f.ho_id} className="hover:page-bg">
                        <td className="table-cell">
                            <button
                                className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                onClick={() => handleRowClick(f)}
                            >
                                {f.ho_code}
                            </button>
                        </td>
                        <td className="table-cell font-medium">{f.ho_name}</td>
                        <td className="table-cell font-medium">{f.ho_short_name}</td>
                        <td className="table-cell">{f.ho_type}</td>
                        <td className="table-cell">{f.ho_establish_date}</td>
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
                                    description={`确定删除基金 ${f.ho_name} (${f.ho_code}) 吗？`}
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