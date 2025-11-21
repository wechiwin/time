// src/components/forms/TradeForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';
import HoldingSearchSelect from '../search/HoldingSearchSelect';
import {useTranslation} from "react-i18next"; // 复用基金下拉

const init = {
    tr_id: '',
    ho_code: '',
    tr_type: '买入',
    tr_date: '',
    tr_nav_per_unit: '',
    tr_shares: '',
    tr_fee: '',
    tr_amount: '',
};

export default function TradeForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState(init);
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()

    const submit = async (e) => {
        e.preventDefault();
        try {
            await onSubmit(form);
            setForm(init);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                tr_id: initialValues.tr_id,
                ho_code: initialValues.ho_code || '',
                tr_type: initialValues.tr_type || '买入',
                tr_date: initialValues.tr_date || '',
                tr_nav_per_unit: initialValues.tr_nav_per_unit,
                tr_shares: initialValues.tr_shares,
                tr_fee: initialValues.tr_fee,
                tr_amount: initialValues.tr_amount
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={submit} className="space-y-4 p-4 page-bg rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_name')}</label>
                    <input
                        placeholder={t('th_ho_name')}
                        value={form.ho_code}
                        onChange={(e) => setForm({...form, ho_code: e.target.value})}
                        required
                        className={`input-field ${initialValues?.tr_id ? 'read-only-input' : ''}`}
                        readOnly={!!initialValues?.tr_id}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_tr_type')}</label>
                    <select
                        value={form.tr_type}
                        onChange={(e) => setForm({...form, tr_type: e.target.value})}
                        className="input-field"
                    >
                        <option>买入</option>
                        <option>卖出</option>
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_nav_date')}</label>
                    <input
                        type="date"
                        required
                        value={form.tr_date}
                        onChange={(e) => setForm({...form, tr_date: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_tr_nav_per_unit')}</label>
                    <input
                        placeholder={t('th_tr_nav_per_unit')}
                        required
                        value={form.tr_nav_per_unit}
                        onChange={(e) => setForm({...form, tr_nav_per_unit: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_tr_shares')}</label>
                    <input
                        placeholder={t('th_tr_shares')}
                        required
                        value={form.tr_shares}
                        onChange={(e) => setForm({...form, tr_shares: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_tr_fee')}</label>
                    <input
                        placeholder={t('th_tr_fee')}
                        required
                        value={form.tr_fee}
                        onChange={(e) => setForm({...form, tr_fee: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_tr_amount')}</label>
                    <input
                        placeholder={t('th_tr_amount')}
                        required
                        value={form.tr_amount}
                        onChange={(e) => setForm({...form, tr_amount: e.target.value})}
                        className="input-field"
                    />
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
    )
        ;
}