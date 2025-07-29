// src/components/forms/TradeForm.jsx
import {useState} from 'react';
import {useToast} from '../toast/ToastContext';
import FundSearchSelect from '../common/FundSearchSelect'; // 复用基金下拉

const init = {
    fund_code: '',
    transaction_type: '买入',
    transaction_date: '',
    transaction_net_value: '',
    transaction_shares: '',
    transaction_fee: '',
};

export default function TradeForm({onSubmit}) {
    const [form, setForm] = useState(init);
    const {showErrorToast} = useToast();

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
            <h2 className="text-lg font-medium text-gray-800">添加新交易</h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <FundSearchSelect
                    value={form.fund_code}
                    onChange={(code) => setForm({...form, fund_code: code})}
                />
                <select
                    value={form.transaction_type}
                    onChange={(e) => setForm({...form, transaction_type: e.target.value})}
                    className="input-field"
                >
                    <option>买入</option>
                    <option>卖出</option>
                </select>
                <input
                    type="date"
                    required
                    value={form.transaction_date}
                    onChange={(e) => setForm({...form, transaction_date: e.target.value})}
                    className="input-field"
                />
                <input
                    placeholder="交易净值"
                    required
                    value={form.transaction_net_value}
                    onChange={(e) => setForm({...form, transaction_net_value: e.target.value})}
                    className="input-field"
                />
                <input
                    placeholder="交易份数"
                    required
                    value={form.transaction_shares}
                    onChange={(e) => setForm({...form, transaction_shares: e.target.value})}
                    className="input-field"
                />
                <input
                    placeholder="手续费"
                    required
                    value={form.transaction_fee}
                    onChange={(e) => setForm({...form, transaction_fee: e.target.value})}
                    className="input-field"
                />
            </div>
            <button type="submit" className="btn-primary">添加交易</button>
        </form>
    );
}