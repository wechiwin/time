// src/components/tables/TradeTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";

export default function TradeTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation()
    const navigate = useNavigate();
    const handleRowClick = (tr) => {
        navigate(`/trade/${tr.ho_id}`);
    };
    // 移动端卡片式布局
    const renderMobileCard = (tr) => (
        <div
            key={tr.id}
            className="card mb-3 p-4 border border-gray-200 rounded-lg shadow-sm"
        >
            <div className="flex justify-between items-start mb-2">
                <button
                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
                    onClick={() => handleRowClick(tr)}
                >
                    {tr.ho_code}
                </button>
                <div className="text-right font-medium">{tr.ho_short_name}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">{t('th_tr_type')}</div>
                <div className="text-right font-medium">{tr.tr_type$view}</div>

                {/* <div className="text-gray-600">{t('th_ho_short_name')}</div> */}
                {/* <div className="text-right font-medium">{tr.ho_short_name}</div> */}

                <div className="text-gray-600">{t('th_nav_date')}</div>
                <div className="text-right">{tr.tr_date}</div>

                <div className="text-gray-600">{t('th_tr_nav_per_unit')}</div>
                <div className="text-right">{tr.tr_nav_per_unit}</div>

                <div className="text-gray-600">{t('th_tr_shares')}</div>
                <div className="text-right">{tr.tr_shares}</div>

                <div className="text-gray-600">{t('th_tr_amount')}</div>
                <div className="text-right">{tr.tr_amount}</div>

                <div className="text-gray-600">{t('th_tr_fee')}</div>
                <div className="text-right">{tr.tr_fee}</div>

                <div className="text-gray-600">{t('th_cash_amount')}</div>
                <div className="text-right font-medium">{tr.cash_amount}</div>
            </div>

            <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-100">
                <button
                    className="btn-secondary text-sm px-3 py-1"
                    onClick={() => onEdit(tr)}
                >
                    {t('button_edit')}
                </button>
                <DeleteButton
                    onConfirm={() => onDelete(tr.id)}
                    description={`${t('msg_delete_confirmation')} ${tr.ho_short_name} - ${tr.tr_date} ?`}
                    buttonSize="small"
                />
            </div>
        </div>
    );
    return (
        <div className="overflow-x-auto">
            {/* 移动端隐藏表格，显示卡片 */}
            <div className="md:hidden">
                {data.map(renderMobileCard)}
            </div>
            {/* 桌面端：正常表格 */}
            <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="page-bg">
                    <tr>
                        <th className="table-header">{t('th_ho_code')}</th>
                        <th className="table-header">{t('th_ho_name')}</th>
                        <th className="table-header">{t('th_tr_type')}</th>
                        <th className="table-header">{t('th_nav_date')}</th>
                        <th className="table-header">{t('th_tr_nav_per_unit')}</th>
                        <th className="table-header">{t('th_tr_shares')}</th>
                        <th className="table-header">{t('th_cash_amount')}</th>
                        <th className="table-header">{t('th_tr_fee')}</th>
                        <th className="table-header">{t('th_tr_amount')}</th>
                        <th className="table-header text-right">{t('th_actions')}</th>
                    </tr>
                    </thead>
                    <tbody className="card divide-y divide-gray-200">
                    {data.map((tr) => (
                        <tr key={tr.id} className="hover:page-bg">
                            <td className="table-cell">
                                <button
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                    onClick={() => handleRowClick(tr)}
                                >
                                    {tr.ho_code}
                                </button>
                            </td>
                            <td className="table-cell font-medium">{tr.ho_short_name}</td>
                            <td className="table-cell">
                                <span
                                    className={`inline-flex px-2 py-0.5 text-xs rounded-full font-medium ${
                                        tr.tr_type === 'BUY'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {tr.tr_type$view}
                                </span>
                            </td>
                            <td className="table-cell">{tr.tr_date}</td>
                            <td className="table-cell">{tr.tr_nav_per_unit}</td>
                            <td className="table-cell">{tr.tr_shares}</td>
                            <td className="table-cell">{tr.tr_amount}</td>
                            <td className="table-cell">{tr.tr_fee}</td>
                            <td className="table-cell">{tr.cash_amount}</td>
                            <td className="table-cell text-right">
                                <div className="flex items-center space-x-2">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => onEdit(tr)}
                                    >
                                        {t('button_edit')}
                                    </button>
                                    <DeleteButton
                                        onConfirm={() => onDelete(tr.id)}
                                        description={`${t('msg_delete_confirmation')} ${tr.ho_short_name} - ${tr.tr_date} ?`}
                                    />
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}