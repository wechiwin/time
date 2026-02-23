import {useTranslation} from 'react-i18next';

export default function AlertHistoryTable({data = []}) {
    const {t} = useTranslation();

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
                    <th className="table-header">{t('remark')}</th>
                    <th className="table-header">{t('th_updated_at')}</th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((history, index) => (
                    <tr key={history.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        <td className="table-cell">{history.ho_code}</td>
                        <td className="table-cell">{history.ar_name}</td>
                        <td className="table-cell">{history.target_price}</td>
                        <td className="table-cell">{history.action$view}</td>
                        <td className="table-cell">{history.trigger_price}</td>
                        <td className="table-cell">{history.trigger_nav_date}</td>
                        <td className="table-cell">{history.send_status$view}</td>
                        <td className="table-cell">{history.remark}</td>
                        <td className="table-cell">{history.updated_at}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
