import React, { useState, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import AlertRuleTable from '../components/tables/AlertRuleTable';
import AlertHistoryTable from '../components/tables/AlertHistoryTable';
import AlertRuleForm from '../components/forms/AlertRuleForm';
import useAlertList from '../hooks/api/useAlertList';
import FormModal from "../components/common/FormModal";
import { useToast } from "../components/context/ToastContext";
import Pagination from "../components/common/Pagination";
import { usePaginationState } from "../hooks/usePaginationState";
import TableToolBar from "../components/search/TableToolBar";
import SearchBar from "../components/search/SearchBar";

export default function AlertPage() {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { page, perPage, handlePageChange, handlePerPageChange } = usePaginationState();

    const [mode, setMode] = useState('rule');
    const [keyword, setKeyword] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [filters, setFilters] = useState({ ar_is_active: "", ar_type: "", ah_status: "" });

    const { data, addRule, updateRule, deleteRule } = useAlertList({
        page, perPage, keyword, autoLoad: true, mode, refreshKey, ...filters
    });

    const handleSearch = useCallback((val) => { setKeyword(val); handlePageChange(1); }, [handlePageChange]);
    const handleFilterChange = (e) => { setFilters(prev => ({ ...prev, [e.target.name]: e.target.value })); handlePageChange(1); };

    const handleDelete = async (id) => {
        if (!window.confirm(t('msg_confirm_delete'))) return;
        try { await deleteRule(id); showSuccessToast(); setRefreshKey(p => p + 1); } catch (err) { showErrorToast(err.message); }
    };

    const [modalConfig, setModalConfig] = useState({ show: false, title: "", submitAction: null, initialValues: {} });
    const openModal = (type, values = {}) => {
        setModalConfig({
            show: true, title: type === 'add' ? t('button_add') : t('button_edit'),
            submitAction: type === 'add' ? addRule : updateRule,
            initialValues: type === 'add' ? { ar_type: 1, ar_is_active: 1 } : values
        });
    };

    return (
        <div className="space-y-6">
            {/* Tab 切换 */}
            <div className="flex justify-center md:justify-start">
                <div className="relative inline-flex w-64 rounded-md border border-gray-300 bg-white p-1 shadow-sm">
                    <div className={`absolute left-0 top-0 h-full w-1/2 rounded-md bg-blue-500 transition-all duration-300 ease-in-out ${mode === 'history' ? 'translate-x-full' : 'translate-x-0'}`} />
                    <button onClick={() => { setMode('rule'); handlePageChange(1); }} className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${mode === 'rule' ? 'text-white' : 'text-gray-700'}`}>{t('alert_rule_management')}</button>
                    <button onClick={() => { setMode('history'); handlePageChange(1); }} className={`relative z-10 flex-1 px-4 py-2 text-sm font-medium transition-colors duration-200 ${mode === 'history' ? 'text-white' : 'text-gray-700'}`}>{t('alert_history_management')}</button>
                </div>
            </div>

            {/* 自由布局：左右对齐 */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">

                    {/* 左侧：搜索 + 动态筛选 */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="w-full md:w-auto min-w-[240px]">
                            <SearchBar key={mode + refreshKey} placeholder={t('msg_search_placeholder')} onSearch={handleSearch} />
                        </div>
                        {mode === 'rule' ? (
                            <>
                                <select name="ar_is_active" value={filters.ar_is_active} onChange={handleFilterChange} className="input-field w-full md:w-32">
                                    <option value="">{t('all_status') || "所有状态"}</option>
                                    <option value="1">激活</option>
                                    <option value="0">禁用</option>
                                </select>
                                <select name="ar_type" value={filters.ar_type} onChange={handleFilterChange} className="input-field w-full md:w-32">
                                    <option value="">{t('all_types') || "所有类型"}</option>
                                    <option value="BUY">{t('TR_BUY')}</option>
                                    <option value="SELL">{t('TR_SELL')}</option>
                                </select>
                            </>
                        ) : (
                            <select name="ah_status" value={filters.ah_status} onChange={handleFilterChange} className="input-field w-full md:w-40">
                                <option value="">{t('all_status') || "所有状态"}</option>
                                <option value="PENDING">{t('AR_EM_PENDING')}</option>
                                <option value="SENT">{t('AR_EM_SENT')}</option>
                                <option value="FAILED">{t('AR_EM_FAILED')}</option>
                            </select>
                        )}
                    </div>

                    {/* 右侧：按钮 */}
                    {mode === 'rule' && (
                        <div className="flex gap-2 self-end xl:self-auto">
                            <button onClick={() => openModal('add')} className="btn-primary">{t('button_add')}</button>
                        </div>
                    )}
                </div>
            </div>

            {mode === 'rule' ? (
                <AlertRuleTable data={data?.items || []} onDelete={handleDelete} onEdit={(item) => openModal('edit', item)} />
            ) : (
                <AlertHistoryTable data={data?.items || []} />
            )}

            {data?.pagination && (
                <Pagination
                    pagination={{ page, per_page: perPage, total: data.pagination.total, pages: data.pagination.pages }}
                    onPageChange={handlePageChange} onPerPageChange={handlePerPageChange}
                />
            )}

            {mode === 'rule' && (
                <FormModal
                    title={modalConfig.title} show={modalConfig.show} onClose={() => setModalConfig(p => ({ ...p, show: false }))}
                    onSubmit={modalConfig.submitAction} FormComponent={AlertRuleForm} initialValues={modalConfig.initialValues}
                />
            )}
        </div>
    );
}
