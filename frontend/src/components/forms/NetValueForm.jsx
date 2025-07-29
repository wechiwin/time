// src/components/forms/NetValueForm.jsx
import { useState } from 'react';
import { useToast } from '../toast/ToastContext';
import FundSearchSelect from '../common/FundSearchSelect';

const init = {
    fund_code: '',
    date: '',
    unit_net_value: '',
    accumulated_net_value: '',
};

export default function NetValueForm({ onSubmit }) {
    const [form, setForm] = useState(init);
    const { showErrorToast } = useToast();

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

    return (
        <form onSubmit={submit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-medium text-gray-800">添加净值记录</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FundSearchSelect
                    value={form.fund_code}
                    onChange={(code) => setForm({ ...form, fund_code: code })}
                />
                <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="input-field"
                />
                <input
                    placeholder="单位净值"
                    required
                    value={form.unit_net_value}
                    onChange={(e) => setForm({ ...form, unit_net_value: e.target.value })}
                    className="input-field"
                />
                <input
                    placeholder="累计净值"
                    required
                    value={form.accumulated_net_value}
                    onChange={(e) => setForm({ ...form, accumulated_net_value: e.target.value })}
                    className="input-field"
                />
            </div>
            <button type="submit" className="btn-primary">添加净值</button>
        </form>
    );
}