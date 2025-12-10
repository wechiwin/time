// src/components/tables/TradeTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";

export default function TradeTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation()
    const navigate = useNavigate();
    const handleRowClick = (tr) => {
        navigate(`/trade/${tr.ho_code}`);
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">{t('th_ho_name')}</th>
                    <th className="table-header">{t('th_ho_short_name')}</th>
                    <th className="table-header">{t('th_tr_type')}</th>
                    <th className="table-header">{t('th_nav_date')}</th>
                    <th className="table-header">{t('th_tr_nav_per_unit')}</th>
                    <th className="table-header">{t('th_tr_shares')}</th>
                    <th className="table-header">{t('th_tr_net_amount')}</th>
                    <th className="table-header">{t('th_tr_fee')}</th>
                    <th className="table-header">{t('th_tr_amount')}</th>
                    <th className="table-header text-right">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((tr) => (
                    <tr key={tr.tr_id} className="hover:page-bg">
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
                        tr.tr_type === 1 || tr.tr_type === '1'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }`}
                >
                    {tr.tr_type === 1 || tr.tr_type === '1' ? t('tr_type_buy') : t('tr_type_sell')}
                </span>
                        </td>
                        <td className="table-cell">{tr.tr_date}</td>
                        <td className="table-cell">{tr.tr_nav_per_unit}</td>
                        <td className="table-cell">{tr.tr_shares}</td>
                        <td className="table-cell">{tr.tr_net_amount}</td>
                        <td className="table-cell">{tr.tr_fee}</td>
                        <td className="table-cell">{tr.tr_amount}</td>
                        <td className="table-cell text-right">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(tr)}
                                >
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(tr.tr_id)}
                                    description={`${t('msg_delete_confirmation')} ${tr.ho_code} - ${tr.tr_amount} ?`}
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