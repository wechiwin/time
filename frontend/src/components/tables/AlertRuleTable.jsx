import DeleteButton from '../common/DeleteButton';
import {useTranslation} from 'react-i18next';
import useCommon from "../../hooks/api/useCommon";
import {useEffect, useState} from "react";
import {useToast} from "../context/ToastContext";

export default function AlertRuleTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation();
    const {fetchMultipleEnumValues} = useCommon();
    const [actionOptions, setActionOptions] = useState([]);
    const {showSuccessToast, showErrorToast} = useToast();

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [
                    actionOptions,
                ] = await fetchMultipleEnumValues([
                    'AlertRuleActionEnum',
                ]);
                setActionOptions(actionOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);


    const getStatusText = (status) => {
        return status === 1 ? t('status_active') : t('status_inactive');
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="page-bg">
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
                        <td className="table-cell">{rule.action$view}</td>
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
                                    description={`${t('msg_delete_confirmation')} ${rule.ar_name} ?`}
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
