import {useTranslation} from 'react-i18next';
import {useEnumTranslation} from '../../contexts/EnumContext';

export default function AlertHistoryTable({data = []}) {
    const {t} = useTranslation();
    const {translateEnum} = useEnumTranslation();

    return (
        <div className="table-container">
            <table className="min-w-full">
                <thead>
                <tr>
                    <th className="table-header">{t('th_ho_code')}</th>
                    <th className="table-header">{t('th_ar_name')}</th>
                    <th className="table-header">{t('alert_target_price')}</th>
                    <th className="table-header">{t('th_actions')}</th>
                    <th className="table-header">{t('alert_trigger_price')}</th>
                    <th className="table-header">{t('alert_trigger_time')}</th>
                    <th className="table-header">{t('alert_status')}</th>
                    <th className="table-header">{t('th_created_at')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((history, index) => (
                    <tr key={history.id || index} className="hover:page-bg">
                        <td className="table-cell">{history.ho_code}</td>
                        <td className="table-cell">{history.ar_name}</td>
                        <td className="table-cell">{history.target_price}</td>
                        <td className="table-cell">{translateEnum('AlertRuleActionEnum', history.action)}</td>
                        <td className="table-cell">{history.trigger_price}</td>
                        <td className="table-cell">{history.trigger_nav_date}</td>
                        <td className="table-cell">{translateEnum('AlertEmailStatusEnum', history.send_status)}</td>
                        <td className="table-cell">{history.created_at}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
