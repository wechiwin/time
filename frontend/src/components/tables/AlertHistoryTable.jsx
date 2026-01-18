import {useTranslation} from 'react-i18next';
import useCommon from "../../hooks/api/useCommon";
import {useEffect, useState} from "react";
import {useToast} from "../context/ToastContext";

export default function AlertHistoryTable({data = []}) {
    const {t} = useTranslation();
    const {fetchMultipleEnumValues} = useCommon();
    const [emailStatusOptions, setEmailStatusOptions] = useState([]);
    const {showSuccessToast, showErrorToast} = useToast();

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [
                    emailStatusOptions,
                ] = await fetchMultipleEnumValues([
                    'AlertEmailStatusEnum',
                ]);
                setEmailStatusOptions(emailStatusOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

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
                        <td className="table-cell">{history.ah_status$view}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
