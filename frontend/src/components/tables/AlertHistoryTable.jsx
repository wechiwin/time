import {useTranslation} from 'react-i18next';

export default function AlertHistoryTable({data = []}) {
    const {t} = useTranslation();

    const getStatusText = (status) => {
        switch (status) {
            case 0:
                return t('alert_status_pending');
            case 1:
                return t('alert_status_sent');
            case 2:
                return t('alert_status_failed');
            default:
                return status;
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
                <tr>
                    <th className="table-header">{t('alert_trigger_time')}</th>
                    <th className="table-header">{t('alert_status')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200">
                {data.map((history, index) => (
                    <tr key={history.ah_id || index} className="hover:page-bg">
                        <td className="table-cell">{history.ah_triggered_time}</td>
                        <td className="table-cell">{getStatusText(history.ah_status)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
