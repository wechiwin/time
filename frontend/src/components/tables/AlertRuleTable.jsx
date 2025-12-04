import DeleteButton from '../common/DeleteButton';
import {useTranslation} from 'react-i18next';

export default function AlertRuleTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation();

    const getTypeText = (type) => {
        switch(type) {
            case 0: return t('alert_type_sell');
            case 1: return t('alert_type_buy');
            case 2: return t('alert_type_add');
            default: return type;
        }
    };

    const getStatusText = (status) => {
        return status === 1 ? t('status_active') : t('status_inactive');
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">{t('th_ho_code')}</th>
                    <th className="table-header">{t('alert_type')}</th>
                    <th className="table-header">{t('alert_target_navpu')}</th>
                    <th className="table-header">{t('alert_status')}</th>
                    <th className="table-header text-right">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((rule) => (
                    <tr key={rule.ar_id} className="hover:page-bg">
                        <td className="table-cell">{rule.ho_code}</td>
                        <td className="table-cell">{getTypeText(rule.ar_type)}</td>
                        <td className="table-cell">{rule.ar_target_navpu}</td>
                        <td className="table-cell">{getStatusText(rule.ar_is_active)}</td>
                        <td className="table-cell">
                            <div className="flex items-center space-x-2">
                                <button
                                    className="btn-secondary"
                                    onClick={() => onEdit(rule)}
                                >
                                    {t('button_edit')}
                                </button>
                                <DeleteButton
                                    onConfirm={() => onDelete(rule.ar_id)}
                                    description={`${t('msg_delete_confirmation')} ${rule.ho_code} ?`}
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
