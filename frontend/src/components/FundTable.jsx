import React, {useState} from 'react';
import useApi from '../hooks/useApi';
import {CheckCircleIcon} from '@heroicons/react/24/outline';
import DeleteConfirmation from './DeleteConfirmation';
import {TOAST_TYPE, TOAST_MESSAGE, useToast} from './toast/ToastContext';  // 引入全局Toast

export default function FundTable() {
    const {showSuccessToast, showErrorToast} = useToast();
    const [form, setForm] = useState({
        fund_name: '',
        fund_code: '',
        fund_type: 'ETF' // Default to ETF
    });
    // 使用自定义hook获取数据
    const {
        data: funds,
        loading,
        error,
        post,
        del,
        refetch
    } = useApi('/api/holdings');

    // Fund type options
    const fundTypeOptions = [
        {value: 'ETF', label: 'ETF'},
        {value: 'LOF', label: 'LOF'}
    ];

    // 提交表单处理
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await post('/api/holdings', form);
            setForm({fund_name: '', fund_code: '', fund_type: 'ETF'}); // 重置为默认值'ETF'
            // showToast(TOAST_TYPE.SUCCESS, TOAST_MESSAGE.SUCCESS);
            showSuccessToast();
        } catch (err) {
            console.error('添加基金失败:', err);
            // showToast(TOAST_TYPE.ERROR, TOAST_MESSAGE.FAILURE + err);
            showErrorToast(err.message);
        }
    };

    // 删除基金处理
    const handleDelete = async (id) => {
        try {
            await del(`/api/holdings/${id}`);
            // showToast(TOAST_TYPE.SUCCESS, TOAST_MESSAGE.SUCCESS);
            showSuccessToast();
        } catch (err) {
            console.error('删除失败:', err);
            // showToast(TOAST_TYPE.ERROR, TOAST_MESSAGE.FAILURE + err);
            showErrorToast(err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* 添加基金表单 */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-medium text-gray-800">添加新基金</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                        className="input-field"
                        placeholder="基金代码"
                        value={form.fund_code}
                        onChange={e => setForm({...form, fund_code: e.target.value})}
                        required
                    />
                    <input
                        className="input-field"
                        placeholder="基金名称"
                        value={form.fund_name}
                        onChange={e => setForm({...form, fund_name: e.target.value})}
                        required
                    />
                    <select
                        className="input-field"
                        value={form.fund_type}
                        onChange={e => setForm({...form, fund_type: e.target.value})}
                        required
                    >
                        {fundTypeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <button type="submit" className="btn-primary">
                    添加基金
                </button>
            </form>

            {/* 基金表格 */}
            <div className="table-container">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                    <tr>
                        <th className="table-header hidden">ID</th>
                        <th className="table-header">基金代码</th>
                        <th className="table-header">基金名称</th>
                        <th className="table-header">基金类型</th>
                        <th className="table-header">基金操作</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {funds.map(fund => (
                        <tr key={fund.id} className="hover:bg-gray-50">
                            <td className="table-cell hidden">{fund.id}</td>
                            <td className="table-cell">{fund.fund_code}</td>
                            <td className="table-cell font-medium text-gray-900">{fund.fund_name}</td>
                            <td className="table-cell">{fund.fund_type}</td>
                            <td className="table-cell">
                                <DeleteConfirmation
                                    onConfirm={() => handleDelete(fund.id)}
                                    description={`确定要删除基金 ${fund.fund_name} (${fund.fund_code}) 吗？`}
                                />
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}