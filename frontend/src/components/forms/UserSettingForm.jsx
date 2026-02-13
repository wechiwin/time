// src/components/forms/UserSettingForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import {LANGUAGES} from "../../constants/sysConst";
import FormField from "../common/FormField";

export default function UserSettingForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        us_id: '',
        username: '',
        default_lang: 'zh-CN',
        email_address: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(form);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                us_id: initialValues.us_id || '',
                username: initialValues.username || '',
                default_lang: initialValues.default_lang || 'zh',
                email_address: initialValues.email_address || '',
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
                <FormField label={t('th_username')} required>
                    <input
                        placeholder={t('th_username')}
                        value={form.username}
                        onChange={(e) => setForm({...form, username: e.target.value})}
                        required
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_default_language')}>
                    <select
                        value={form.default_lang}
                        onChange={(e) => setForm({...form, default_lang: e.target.value})}
                        className="input-field"
                    >
                        {LANGUAGES.map((option) => (
                            <option key={option.code} value={option.value}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </FormField>

                <FormField label={t('th_email_address')}>
                    <input
                        type="email"
                        placeholder={t('th_email_address')}
                        value={form.email_address}
                        onChange={(e) => setForm({...form, email_address: e.target.value})}
                        className="input-field"
                    />
                </FormField>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                    {t('button_cancel')}
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}
