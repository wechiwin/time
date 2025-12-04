import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';
import {useTranslation} from "react-i18next";
import HoldingSearchSelect from "../search/HoldingSearchSelect";

export default function AlertRuleForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        ho_code: '',
        ho_name: '',
        ar_type: 1,
        ar_target_navpu: '',
        ar_is_active: 1,
    });
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await onSubmit(form);
            showSuccessToast();
            onClose();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                ho_code: initialValues.ho_code || '',
                ho_name: initialValues.ho_name || '',
                ar_type: initialValues.ar_type || 1,
                ar_target_navpu: initialValues.ar_target_navpu || '',
                ar_is_active: initialValues.ar_is_active || 1,
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_code')}</label>
                    {/* <input */}
                    {/*     placeholder={t('th_ho_code')} */}
                    {/*     value={form.ho_code} */}
                    {/*     onChange={(e) => setForm({...form, ho_code: e.target.value})} */}
                    {/*     required */}
                    {/*     className="input-field" */}
                    {/* /> */}
                    <HoldingSearchSelect
                        value={form.ho_code}
                        onChange={(ho) => setForm({
                            ...form,
                            ho_code: ho.ho_code,
                            ho_name: ho.ho_name
                        })}
                        placeholder={t('th_ho_code')}
                    />
                </div>
                {/* 基金名称只读输入框 */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_name')}</label>
                    <input
                        value={form.ho_name}
                        disabled
                        readOnly
                        placeholder={t('th_ho_name')}
                        className="input-field bg-gray-100 cursor-not-allowed dark:bg-gray-700"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_type')}</label>
                    <select
                        value={form.ar_type}
                        onChange={(e) => setForm({...form, ar_type: parseInt(e.target.value)})}
                        className="input-field"
                    >
                        <option value="1">{t('alert_type_buy')}</option>
                        <option value="2">{t('alert_type_add')}</option>
                        <option value="0">{t('alert_type_sell')}</option>
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_target_navpu')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('alert_target_navpu')}
                        value={form.ar_target_navpu}
                        onChange={(e) => setForm({...form, ar_target_navpu: parseFloat(e.target.value)})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_status')}</label>
                    <select
                        value={form.ar_is_active}
                        onChange={(e) => setForm({...form, ar_is_active: parseInt(e.target.value)})}
                        className="input-field"
                    >
                        <option value="1">{t('status_active')}</option>
                        <option value="0">{t('status_inactive')}</option>
                    </select>
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                    {t('button_cancel')}
                </button>
                <button type="submit" className="btn-primary">
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}
