// src/components/forms/HoldingForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../toast/ToastContext';

const fundTypeOptions = [
    {value: 'ETF', label: 'ETF'},
    {value: 'LOF', label: 'LOF'},
];

export default function HoldingForm({onSubmit, onClose, initialValues, onCrawl}) {
    const [form, setForm] = useState({
        ho_id: '',
        ho_code: '',
        ho_name: '',
        ho_type: 'ETF',
        ho_establish_date: '',
        ho_short_name: '',
    });
    const {showSuccessToast, showErrorToast} = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await onSubmit(form);
            setForm({ho_code: '', ho_name: '', ho_type: 'ETF'});
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    const handleCrawl = () => {
        if (!form.ho_code) return showErrorToast('请先输入基金代码');
        // 把当前表单 setForm 传进去，方便回调里直接 setState
        onCrawl(form.ho_code, (patch) =>
            setForm((prev) => ({...prev, ...patch}))
        );
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                ho_id: initialValues.ho_id,
                ho_code: initialValues.ho_code || '',
                ho_name: initialValues.ho_name || '',
                ho_type: initialValues.ho_type || '',
                ho_establish_date: initialValues.ho_establish_date || '',
                ho_short_name: initialValues.ho_short_name || '',
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
                        value={form.ho_code}
                        onChange={(e) => setForm({...form, ho_code: e.target.value})}
                        required
                        className={`input-field ${initialValues?.ho_id ? 'read-only-input' : ''}`}
                        readOnly={!!initialValues?.ho_id}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金名称</label>
                    <input
                        placeholder="基金名称"
                        value={form.ho_name}
                        onChange={(e) => setForm({...form, ho_name: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金名称</label>
                    <input
                        placeholder="基金别称"
                        value={form.ho_short_name}
                        onChange={(e) => setForm({...form, ho_short_name: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">基金类型</label>
                    <select
                        value={form.ho_type}
                        onChange={(e) => setForm({...form, ho_type: e.target.value})}
                        className="input-field"
                    >
                        {fundTypeOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col"><label className="text-sm font-medium mb-1">创建日期</label>
                    <input
                        type="date"
                        value={form.ho_establish_date}
                        onChange={(e) => setForm({...form, ho_establish_date: e.target.value})}
                        className="input-field"
                    />
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button type="button" className="btn-primary" onClick={handleCrawl}>
                    爬取信息
                </button>
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