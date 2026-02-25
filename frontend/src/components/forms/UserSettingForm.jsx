// src/components/forms/UserSettingForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import {LANGUAGES} from "../../constants/sysConst";
import FormField from "../common/FormField";
import useBenchmark from "../../hooks/api/useBenchmark";

export default function UserSettingForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        us_id: '',
        username: '',
        default_lang: 'en',
        email_address: '',
        risk_free_rate: 0.02,
        benchmark_id: null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation();
    const {benchmarks, fetchBenchmarkList} = useBenchmark();

    // Fetch benchmark list on mount
    useEffect(() => {
        fetchBenchmarkList().catch(err => {
            console.error('[UserSettingForm] Failed to fetch benchmarks:', err);
            showErrorToast(err.message);
        });
    }, [fetchBenchmarkList]);

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
                risk_free_rate: initialValues.risk_free_rate ?? 0.02,
                benchmark_id: initialValues.benchmark_id ?? null,
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
                        readOnly
                        disabled
                        className="input-field bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                    />
                </FormField>

                <FormField label={t('th_default_language')}>
                    <select
                        value={form.default_lang}
                        onChange={(e) => setForm({...form, default_lang: e.target.value})}
                        className="input-field"
                    >
                        {LANGUAGES.map((option) => (
                            <option key={option.code} value={option.code}>
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

                <FormField label={t('th_risk_free_rate')}>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            max="1"
                            value={form.risk_free_rate}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0 && value <= 1) {
                                    setForm({...form, risk_free_rate: value});
                                }
                            }}
                            className="input-field flex-1"
                        />
                        <span className="text-sm text-slate-500 whitespace-nowrap">
                            ({(form.risk_free_rate * 100).toFixed(2)}%)
                        </span>
                    </div>
                </FormField>

                <FormField label={t('th_benchmark')}>
                    <select
                        value={form.benchmark_id ?? ''}
                        onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value, 10) : null;
                            setForm({...form, benchmark_id: value});
                        }}
                        className="input-field"
                    >
                        {/* <option value="">{t('th_benchmark_placeholder')}</option> */}
                        {benchmarks.map((bm) => (
                            <option key={bm.id} value={bm.id}>
                                {bm.bm_name} ({bm.bm_code})
                            </option>
                        ))}
                    </select>
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
