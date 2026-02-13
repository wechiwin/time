import DeleteButton from '../common/DeleteButton';
import {useTranslation} from 'react-i18next';
import {useEnumTranslation} from '../../contexts/EnumContext';

export default function AlertRuleTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation();
    const {translateEnum, getEnumOptions} = useEnumTranslation();

    const getStatusText = (status) => {
        return status === 1 ? t('status_active') : t('status_inactive');
    };

    return (
        <div className="table-container">
            <table className="min-w-full">
                <thead>
                <tr>
                    <th className="table-header">{t('th_ho_code')}</th>
                    {/* <th className="table-header">{t('th_ho_short_name')}</th> */}
                    <th className="table-header">{t('th_ar_name')}</th>
                    <th className="table-header">{t('alert_type')}</th>
                    <th className="table-header">{t('alert_target_price')}</th>
                    <th className="table-header">{t('alert_status')}</th>
                    <th className="table-header text-right">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((rule) => (
                    <tr key={rule.id} className="hover:page-bg">
                        <td className="table-cell">{rule.ho_code}</td>
                        {/* <td className="table-cell">{rule.ho_short_name}</td> */}
                        <td className="table-cell">{rule.ar_name}</td>
                        <td className="table-cell">{translateEnum('AlertRuleActionEnum', rule.action)}</td>
                        <td className="table-cell">{rule.target_price}</td>
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
                                    onConfirm={() => onDelete(rule.id)}
                                    description={`${rule.ar_name} ?`}
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
