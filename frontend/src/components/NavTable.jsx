import React, {useEffect, useRef, useState} from 'react';
import useApi from '../hooks/useApi';
import {CheckCircleIcon, ChevronUpDownIcon} from '@heroicons/react/24/outline';
import DeleteConfirmation from './DeleteConfirmation';
import {useDebounce} from '../hooks/useDebounce';

export default function NavTable() {
    const [form, setForm] = useState({
        fund_code: '',
        date: '',
        unit_net_value: '',
        accumulated_net_value: ''
    });
    const [showSuccess, setShowSuccess] = useState(false);
    const [fundOptions, setFundOptions] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    // 使用防抖后的搜索值
    const debouncedSearchInput = useDebounce(searchInput, 1000);
    const inputRef = useRef(null);

    // 使用自定义Hook获取数据
    const {
        data: navs,
        loading,
        error,
        post,
        del,
        refetch,
        request
    } = useApi('/api/net_values');

    // 获取基金列表
    useEffect(() => {
        const fetchFunds = async () => {
            try {
                if (debouncedSearchInput.length > 0) {
                    const data = await request(`/api/holdings/search?q=${debouncedSearchInput}`, 'GET');
                    setFundOptions(data);
                    setTimeout(() => {
                        if (inputRef.current) {
                            inputRef.current.focus();
                        }
                    }, 0);
                } else {
                    setFundOptions([]);
                }
            } catch (err) {
                console.error('获取基金列表失败:', err);
                setFundOptions([]);
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
            await post('/api/net_values', form);
            setForm({
                fund_code: '',
                date: '',
                unit_net_value: '',
                accumulated_net_value: ''
            });
            // await refetch();
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('提交净值数据失败:', err);
        }
    };

    const handleDelete = async (id) => {
        try {
            await del(`/api/net_values/${id}`);
            // await refetch();
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            console.error('删除净值记录失败:', err);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">加载中...</div>;
    if (error) return <div className="p-8 text-center text-red-500">错误: {error}</div>;

    return (
        <div className="space-y-6">
            {/* 添加净值表单 */}
            <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-medium text-gray-800">添加净值记录</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <div className="relative">
                            <input
                                ref={inputRef}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="搜索基金代码"
                                value={form.fund_code}
                                onChange={handleInputChange}
                                onFocus={() => setShowDropdown(true)}
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
                                className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
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

                    {/*<input*/}
                    {/*    className="input-field"*/}
                    {/*    placeholder="基金代码"*/}
                    {/*    value={form.fund_code}*/}
                    {/*    onChange={e => setForm({...form, fund_code: e.target.value})}*/}
                    {/*    required*/}
                    {/*/>*/}
                    <input
                        type="date"
                        className="input-field"
                        value={form.date}
                        onChange={e => setForm({...form, date: e.target.value})}
                        required
                    />
                    <input
                        className="input-field"
                        placeholder="单位净值"
                        value={form.unit_net_value}
                        onChange={e => setForm({...form, unit_net_value: e.target.value})}
                        required
                    />
                    <input
                        className="input-field"
                        placeholder="累计净值"
                        value={form.accumulated_net_value}
                        onChange={e => setForm({...form, accumulated_net_value: e.target.value})}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary">
                    添加净值
                </button>
            </form>

            {/* 净值表格 */}
            <div className="table-container">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                    <tr>
                        <th className="table-header hidden">ID</th>
                        <th className="table-header">基金代码</th>
                        <th className="table-header">日期</th>
                        <th className="table-header">单位净值</th>
                        <th className="table-header">累计净值</th>
                        <th className="table-header">操作</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {navs?.map(nav => (
                        <tr key={nav.id} className="hover:bg-gray-50">
                            <td className="table-cell hidden">{nav.id}</td>
                            <td className="table-cell font-medium text-gray-900">{nav.fund_code}</td>
                            <td className="table-cell">{nav.date}</td>
                            <td className="table-cell">{nav.unit_net_value}</td>
                            <td className="table-cell">{nav.accumulated_net_value}</td>
                            <td className="table-cell">
                                <DeleteConfirmation
                                    onConfirm={() => handleDelete(nav.id)}
                                    description={`确定要删除 ${nav.fund_code} 在 ${nav.date} 的净值记录吗？`}
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