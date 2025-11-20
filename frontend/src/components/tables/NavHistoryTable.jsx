// src/components/tables/NavHistoryTable.jsx
import DeleteButton from '../common/DeleteButton';
import {useTranslation} from "react-i18next";

export default function NavHistoryTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation()

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">{t('th_ho_name')}</th>
                    <th className="table-header">{t('th_ho_short_name')}</th>
                    <th className="table-header">{t('th_nav_date')}</th>
                    <th className="table-header">{t('th_nav_per_unit')}</th>
                    <th className="table-header">{t('th_nav_accumulated_per_unit')}</th>
                    <th className="table-header text-right">{t('th_actions')}</th>
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
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(n.nav_id)}
                                    description={`${t('msg_delete_confirmation')} ${n.ho_code} - ${n.nav_date} ?`}
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