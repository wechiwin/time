// src/components/tables/TradeTable.jsx
import React, {useMemo} from 'react';
import DeleteButton from '../common/DeleteButton';
import EditButton from '../common/EditButton';
import {useTranslation} from "react-i18next";
import {useEnumTranslation} from '../../contexts/EnumContext';
import {useColorContext} from '../context/ColorContext';

export default function TradeTable({
    data = [],
    onDelete,
    onEdit,
    selectedIds = new Set(),
    onSelectionChange,
}) {
    const {t} = useTranslation()
    const {translateEnum} = useEnumTranslation();
    const {getTradeColor} = useColorContext();

    // 计算当前页是否全选
    const isAllSelected = useMemo(() => {
        return data.length > 0 && data.every(item => selectedIds.has(item.id));
    }, [data, selectedIds]);

    // 计算是否部分选中
    const isIndeterminate = useMemo(() => {
        const selectedCount = data.filter(item => selectedIds.has(item.id)).length;
        return selectedCount > 0 && selectedCount < data.length;
    }, [data, selectedIds]);

    // 全选/取消全选
    const handleSelectAll = (e) => {
        if (onSelectionChange) {
            if (e.target.checked) {
                data.forEach(item => {
                    if (!selectedIds.has(item.id)) {
                        onSelectionChange(item.id, true);
                    }
                });
            } else {
                data.forEach(item => {
                    if (selectedIds.has(item.id)) {
                        onSelectionChange(item.id, false);
                    }
                });
            }
        }
    };

    // 单行选择
    const handleSelectOne = (id) => (e) => {
        if (onSelectionChange) {
            onSelectionChange(id, e.target.checked);
        }
    };

    const handleRowClick = (tr) => {
        window.open(`/trade/${tr.ho_id}`, '_blank');
    };

    // 渲染交易类型徽章的辅助函数
    const renderTradeTypeBadge = (type) => (
        <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTradeColor(type)}`}>
            {translateEnum('TradeTypeEnum', type)}
        </span>
    );

    // 移动端卡片式布局
    const renderMobileCard = (tr) => (
        <div
            key={tr.id}
            className="card mb-3 p-4 border border-gray-200 rounded-lg shadow-sm"
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(tr.id)}
                        onChange={handleSelectOne(tr.id)}
                        aria-label={`${t('th_select')} ${tr.ho_short_name}`}
                    />
                    <button
                        className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
                        onClick={() => handleRowClick(tr)}
                    >
                        {tr.ho_code}
                    </button>
                </div>
                <div className="text-right font-medium">{tr.ho_short_name}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">{t('th_tr_type')}</div>
                <div className="text-right font-medium">{renderTradeTypeBadge(tr.tr_type)}</div>

                <div className="text-gray-600">{t('th_market_date')}</div>
                <div className="text-right">{tr.tr_date}</div>

                <div className="text-gray-600">{t('th_tr_nav_per_unit')}</div>
                <div className="text-right">{tr.tr_nav_per_unit}</div>

                <div className="text-gray-600">{t('th_tr_shares')}</div>
                <div className="text-right">{tr.tr_shares}</div>

                <div className="text-gray-600">{t('th_tr_amount')}</div>
                <div className="text-right">{tr.tr_amount}</div>

                <div className="text-gray-600">{t('th_tr_fee')}</div>
                <div className="text-right">{tr.tr_fee}</div>

                <div className="text-gray-600">{t('th_cash_amount')}</div>
                <div className="text-right font-medium">{tr.cash_amount}</div>
            </div>

            <div className="flex justify-end space-x-2 mt-3 pt-2 border-t border-gray-100">
                <EditButton onClick={() => onEdit(tr)} title={t('button_edit')} />
                <DeleteButton
                    onConfirm={() => onDelete(tr.id)}
                    name={`${tr.ho_short_name} - ${tr.tr_date}`}
                />
            </div>
        </div>
    );

    return (
        <div className="table-container">
            {/* 移动端隐藏表格，显示卡片 */}
            <div className="md:hidden">
                {data.map(renderMobileCard)}
            </div>
            {/* 桌面端：正常表格 */}
            <div className="hidden md:block">
                <table className="min-w-full">
                    <thead>
                    <tr>
                        {/* 复选框列 */}
                        <th className="table-header w-12">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={isAllSelected}
                                ref={el => {
                                    if (el) el.indeterminate = isIndeterminate;
                                }}
                                onChange={handleSelectAll}
                                aria-label={t('select_all')}
                            />
                        </th>
                        <th scope="col" className="table-header">{t('th_ho_code')}</th>
                        <th scope="col" className="table-header">{t('th_ho_name')}</th>
                        <th scope="col" className="table-header">{t('th_tr_type')}</th>
                        <th scope="col" className="table-header">{t('th_tr_date')}</th>
                        <th scope="col" className="table-header">{t('th_price_per_unit')}</th>
                        <th scope="col" className="table-header">{t('th_tr_shares')}</th>
                        <th scope="col" className="table-header">{t('th_cash_amount')}</th>
                        <th scope="col" className="table-header">{t('th_tr_fee')}</th>
                        <th scope="col" className="table-header">{t('th_tr_amount')}</th>
                        <th scope="col" className="table-header sticky-action-header">{t('th_actions')}</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((tr) => (
                        <tr key={tr.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            {/* 复选框 */}
                            <td className="table-cell w-12">
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={selectedIds.has(tr.id)}
                                    onChange={handleSelectOne(tr.id)}
                                    aria-label={`${t('th_select')} ${tr.ho_short_name}`}
                                />
                            </td>
                            <td className="table-cell">
                                <button
                                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                    onClick={() => handleRowClick(tr)}
                                >
                                    {tr.ho_code}
                                </button>
                            </td>
                            <td className="table-cell font-medium">{tr.ho_short_name}</td>
                            <td className="table-cell">
                                {renderTradeTypeBadge(tr.tr_type)}
                            </td>
                            <td className="table-cell">{tr.tr_date}</td>
                            <td className="table-cell">{tr.tr_nav_per_unit}</td>
                            <td className="table-cell">{tr.tr_shares}</td>
                            <td className="table-cell">{tr.tr_amount}</td>
                            <td className="table-cell">{tr.tr_fee}</td>
                            <td className="table-cell">{tr.cash_amount}</td>
                            <td className="table-cell sticky-action-cell">
                                <div className="flex items-center justify-end space-x-2">
                                    <EditButton onClick={() => onEdit(tr)} title={t('button_edit')} />
                                    <DeleteButton
                                        onConfirm={() => onDelete(tr.id)}
                                        name={`${tr.ho_short_name} - ${tr.tr_date}`}
                                    />
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
