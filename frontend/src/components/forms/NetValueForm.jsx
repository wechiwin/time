// src/components/forms/NetValueForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';
import HoldingSearchSelect from '../search/HoldingSearchSelect';

const init = {
    id: '',
    fund_code: '',
    date: '',
    unit_net_value: '',
    accumulated_net_value: '',
};

export default function NetValueForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState(init);
    const {showSuccessToast, showErrorToast} = useToast();

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
                id: initialValues.id,
                fund_code: initialValues.fund_code || '',
                date: initialValues.date || '',
                unit_net_value: initialValues.unit_net_value || '',
                accumulated_net_value: initialValues.accumulated_net_value || ''
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={submit} className="space-y-4 p-4 page-bg rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金代码</label>
                    <HoldingSearchSelect
                        value={form.fund_code}
                        onChange={(code) => setForm({...form, fund_code: code})}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">日期</label>
                    <input
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => setForm({...form, date: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">单位净值</label>
                    <input
                        placeholder="单位净值"
                        required
                        value={form.unit_net_value}
                        onChange={(e) => setForm({...form, unit_net_value: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">累计净值</label>
                    <input
                        placeholder="累计净值"
                        required
                        value={form.accumulated_net_value}
                        onChange={(e) => setForm({...form, accumulated_net_value: e.target.value})}
                        className="input-field"
                    />
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                    取消
                </button>
                <button type="submit" className="btn-primary">
                    确认
                </button>
            </div>
        </form>
    );
}