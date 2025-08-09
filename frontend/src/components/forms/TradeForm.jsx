// src/components/forms/TradeForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';
import FundSearchSelect from '../common/FundSearchSelect'; // 复用基金下拉

const init = {
    id: '',
    fund_code: '',
    transaction_type: '买入',
    transaction_date: '',
    transaction_net_value: '',
    transaction_shares: '',
    transaction_fee: '',
};

export default function TradeForm({onSubmit, onClose, initialValues}) {
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
                transaction_type: initialValues.transaction_type || '买入',
                transaction_date: initialValues.transaction_date || '',
                transaction_net_value: initialValues.transaction_net_value || '',
                transaction_shares: initialValues.transaction_shares || '',
                transaction_fee: initialValues.transaction_fee || ''
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={submit} className="space-y-4 p-4 page-bg rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金代码</label>
                    <FundSearchSelect
                        value={form.fund_code}
                        onChange={(code) => setForm({...form, fund_code: code})}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">交易类型</label>
                    <select
                        value={form.transaction_type}
                        onChange={(e) => setForm({...form, transaction_type: e.target.value})}
                        className="input-field"
                    >
                        <option>买入</option>
                        <option>卖出</option>
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">交易日期</label>
                    <input
                        type="date"
                        required
                        value={form.transaction_date}
                        onChange={(e) => setForm({...form, transaction_date: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">交易净值</label>
                    <input
                        placeholder="交易净值"
                        required
                        value={form.transaction_net_value}
                        onChange={(e) => setForm({...form, transaction_net_value: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">交易份数</label>
                    <input
                        placeholder="交易份数"
                        required
                        value={form.transaction_shares}
                        onChange={(e) => setForm({...form, transaction_shares: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">手续费</label>
                    <input
                        placeholder="手续费"
                        required
                        value={form.transaction_fee}
                        onChange={(e) => setForm({...form, transaction_fee: e.target.value})}
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
    )
        ;
}