// src/components/forms/FundForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';

const fundTypeOptions = [
    {value: 'ETF', label: 'ETF'},
    {value: 'LOF', label: 'LOF'},
];

export default function FundForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        id: '',
        fund_code: '',
        fund_name: '',
        fund_type: 'ETF'
    });
    const {showSuccessToast, showErrorToast} = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await onSubmit(form);
            setForm({fund_code: '', fund_name: '', fund_type: 'ETF'});
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
                fund_name: initialValues.fund_name || '',
                fund_type: initialValues.fund_type || '',
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金代码</label>
                    <input
                        placeholder="基金代码"
                        value={form.fund_code}
                        onChange={(e) => setForm({...form, fund_code: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金名称</label>
                    <input
                        placeholder="基金名称"
                        value={form.fund_name}
                        onChange={(e) => setForm({...form, fund_name: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金类型</label>
                    <select
                        value={form.fund_type}
                        onChange={(e) => setForm({...form, fund_type: e.target.value})}
                        className="input-field"
                    >
                        {fundTypeOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
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