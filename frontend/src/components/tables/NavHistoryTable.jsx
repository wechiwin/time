// src/components/tables/NavHistoryTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";

export default function NavHistoryTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation()
    const navigate = useNavigate();
    const handleRowClick = (n) => {
        navigate(`/historical_trend/${n.ho_id}`);
    };
    return (
        <div className="table-container">
            <table className="min-w-full">
                <thead>
                <tr>
                    <th scope="col" className="table-header">{t('th_ho_code')}</th>
                    <th scope="col" className="table-header">{t('th_ho_short_name')}</th>
                    <th scope="col" className="table-header">{t('th_market_date')}</th>
                    <th scope="col" className="table-header">{t('th_price_per_unit')}</th>
                    <th scope="col" className="table-header">{t('th_adj_ref_price')}</th>
                    <th scope="col" className="table-header">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((n) => (
                    <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        <td className="table-cell font-medium">
                            <button
                                className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                onClick={() => handleRowClick(n)}
                            >
                                {n.ho_code}
                            </button>
                        </td>
                        <td className="table-cell font-medium">{n.ho_short_name}</td>
                        <td className="table-cell">{n.nav_date}</td>
                        <td className="table-cell">{n.nav_per_unit}</td>
                        <td className="table-cell">{n.nav_accumulated_per_unit}</td>
                        <td className="table-cell">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(n)}
                                >
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(n.id)}
                                    description={`${n.ho_code} - ${n.nav_date} ?`}
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