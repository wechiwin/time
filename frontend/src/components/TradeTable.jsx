import React, {useEffect, useRef, useState} from 'react';
import useApi from '../hooks/useApi';
import {CheckCircleIcon, ChevronUpDownIcon} from '@heroicons/react/24/outline';
import DeleteConfirmation from './DeleteConfirmation';
import {useDebounce} from '../hooks/useDebounce';
import {useToast} from './toast/ToastContext';

export default function TradeTable() {
    const [form, setForm] = useState({
        fund_code: '',
        transaction_type: '买入',
        transaction_date: '',
        transaction_net_value: '',
        transaction_shares: '',
        transaction_fee: ''
    });
    const [showSuccess, setShowSuccess] = useState(false);
    const [fundOptions, setFundOptions] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isComposing, setIsComposing] = useState(false);

    // 使用防抖后的搜索值
    const debouncedSearchInput = useDebounce(searchInput, 1000);
    const [focusedInput, setFocusedInput] = useState(null);
    const transitionNetValueInputRef = useRef(null);
    const transitionSharesInputRef = useRef(null);
    const transitionFeeInputRef = useRef(null);
    const stockFundCodeInputRef = useRef(null);
    const {showSuccessToast, showErrorToast} = useToast();

    // 使用自定义Hook获取交易数据
    const {
        data: trades,
        loading,
        error,
        post,
        del,
        refetch,
        request
    } = useApi('/api/transactions');

    // 获取基金列表
    useEffect(() => {
        const fetchFunds = async () => {
            try {
                if (debouncedSearchInput.length > 0) {
                    const data = await request(`/api/holdings/search?q=${debouncedSearchInput}`, 'GET');
                    setFundOptions(data);
                    setTimeout(() => {
                        if (stockFundCodeInputRef.current) {
                            focusedInput.current.focus();
                        }
                    }, 0);
                } else {
                    setFundOptions([]);
                }
            } catch (err) {
                console.error('获取基金列表失败:', err);
                setFundOptions([]);
                showErrorToast(err.message);
            }
        };

        fetchFunds();
    }, [debouncedSearchInput, request]);

    // 处理输入变化
    const handleInputChange = (e) => {
        const value = e.target.value;
        setForm(prev => ({...prev, fund_code: value}));
        // setSearchInput(value); // 触发防抖查询
        if (!isComposing) {
            console.log('输入变化发请求')
            setSearchInput(value);
        }
    };

    const handleCompositionEnd = (e) => {
        console.log('结束', e)
        setIsComposing(false);
        // 组合结束时手动触发更新
        setForm(prev => ({...prev, fund_code: e.target.value}));
        setSearchInput(e.target.value);
    }

    const handleFundCodeFocus =()=>{
        setFocusedInput(stockFundCodeInputRef)
        setShowDropdown(true)
    }

    // 选中基金
    const handleSelectFund = (fund) => {
        setForm({
            ...form,
            fund_code: fund.fund_code,
        });
        setSearchInput(fund.fund_code); // 同步搜索输入
        setShowDropdown(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await post('/api/transactions', form);
            setForm({
                fund_code: '',
                transaction_type: '买入',
                transaction_date: '',
                transaction_net_value: '',
                transaction_shares: '',
                transaction_fee: ''
            });
            // await refetch();
            showSuccessToast();
            // setShowSuccess(true);
            // setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('提交交易数据失败:', err);
            showErrorToast(err.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            await del(`/api/transactions/${id}`);
            // await refetch();
            showSuccessToast();
            // setShowSuccess(true);
            // setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('删除交易记录失败:', err);
            showErrorToast(err.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* 添加交易表单 */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4 page-bg rounded-lg">
                <h2 className="text-lg font-medium text-gray-800">添加新交易</h2>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

                    <div className="relative">
                        <div className="relative">
                            <input
                                ref={stockFundCodeInputRef}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="搜索基金代码"
                                value={form.fund_code}
                                onChange={handleInputChange}
                                onFocus={handleFundCodeFocus}
                                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                onCompositionStart={() => {
                                    setIsComposing(true)
                                }}
                                onCompositionEnd={(e) => handleCompositionEnd(e)}
                                required
                            />
                            <ChevronUpDownIcon
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 cursor-pointer"
                                onClick={() => setShowDropdown(!showDropdown)}
                            />
                        </div>

                        {/* 下拉框 */}
                        {showDropdown && (
                            <div
                                className="absolute z-50 mt-1 w-full card shadow-lg rounded-md border card max-h-60 overflow-auto">
                                {fundOptions.length > 0 ? (
                                    fundOptions.map((fund) => (
                                        <div
                                            key={fund.id}
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                                            onClick={() => handleSelectFund(fund)}
                                        >
                                            <div className="font-medium text-gray-900">{fund.fund_code}</div>
                                            <div className="text-sm text-gray-500">{fund.fund_name}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-2 text-gray-500 text-sm">
                                        {searchInput ? "没有找到匹配基金" : "输入关键词搜索基金"}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <select
                        className="input-field"
                        value={form.transaction_type}
                        onChange={e => setForm({...form, transaction_type: e.target.value})}
                    >
                        <option value="买入">买入</option>
                        <option value="卖出">卖出</option>
                    </select>
                    <input
                        type="date"
                        className="input-field"
                        value={form.transaction_date}
                        onChange={e => setForm({...form, transaction_date: e.target.value})}
                        required
                    />
                    <input
                        ref={transitionNetValueInputRef}
                        className="input-field"
                        placeholder="交易净值"
                        value={form.transaction_net_value}
                        onFocus={()=>{setFocusedInput(transitionNetValueInputRef)}}
                        onChange={e => setForm({...form, transaction_net_value: e.target.value})}
                        required
                    />
                    <input
                        ref={transitionSharesInputRef}
                        className="input-field"
                        placeholder="交易份数"
                        value={form.transaction_shares}
                        onFocus={()=>{setFocusedInput(transitionSharesInputRef)}}
                        onChange={e => setForm({...form, transaction_shares: e.target.value})}
                        required
                    />
                    <input
                        ref={transitionFeeInputRef}
                        className="input-field"
                        placeholder="手续费"
                        value={form.transaction_fee}
                        onFocus={()=>{setFocusedInput(transitionFeeInputRef)}}
                        onChange={e => setForm({...form, transaction_fee: e.target.value})}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary">
                    添加交易
                </button>
            </form>

            {/* 交易表格 */}
            <div className="table-container">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                    <tr>
                        <th className="table-header hidden">ID</th>
                        <th className="table-header">基金代码</th>
                        <th className="table-header">交易类型</th>
                        <th className="table-header">交易日期</th>
                        <th className="table-header">交易净值</th>
                        <th className="table-header">交易份数</th>
                        <th className="table-header">手续费</th>
                        <th className="table-header">操作</th>
                    </tr>
                    </thead>
                    <tbody className="card divide-y divide-gray-200">
                    {trades?.map(trade => (
                        <tr key={trade.id} className="hover:page-bg">
                            <td className="table-cell hidden">{trade.id}</td>
                            <td className="table-cell font-medium text-gray-900">{trade.fund_code}</td>
                            <td className="table-cell">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            trade.transaction_type === '买入'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                        {trade.transaction_type}
                                    </span>
                            </td>
                            <td className="table-cell">{trade.transaction_date}</td>
                            <td className="table-cell">{trade.transaction_net_value}</td>
                            <td className="table-cell">{trade.transaction_shares}</td>
                            <td className="table-cell">{trade.transaction_fee}</td>
                            <td className="table-cell">
                                <DeleteConfirmation
                                    onConfirm={() => handleDelete(trade.id)}
                                    description={`确定要删除 ${trade.fund_code} 的这条交易记录吗？`}
                                />
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* 操作成功提示 */}
            {showSuccess && (
                <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-md shadow-lg flex items-center">
                        <CheckCircleIcon className="w-5 h-5 mr-2"/>
                        操作成功
                    </div>
                </div>
            )}
        </div>
    );
}