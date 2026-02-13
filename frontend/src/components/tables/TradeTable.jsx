// src/components/tables/TradeTable.jsx
import React from 'react';
import DeleteButton from '../common/DeleteButton';
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {useEnumTranslation} from '../../contexts/EnumContext';

// 交易类型到样式的映射
const tradeTypeStyles = {
    BUY: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    SELL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function TradeTable({data = [], onDelete, onEdit}) {
    const {t} = useTranslation()
    const navigate = useNavigate();
    const {translateEnum} = useEnumTranslation();
    const handleRowClick = (tr) => {
        navigate(`/trade/${tr.ho_id}`);
    };

    // 渲染交易类型徽章的辅助函数
    const renderTradeTypeBadge = (type) => (
        <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tradeTypeStyles[type] || ''}`}>
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
                <button
                    className="text-blue-600 hover:text-blue-800 underline cursor-pointer font-medium"
                    onClick={() => handleRowClick(tr)}
                >
                    {tr.ho_code}
                </button>
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
                <button
                    className="btn-secondary text-sm px-3 py-1"
                    onClick={() => onEdit(tr)}
                >
                    {t('button_edit')}
                </button>
                <DeleteButton
                    onConfirm={() => onDelete(tr.id)}
                    description={`${tr.ho_short_name} - ${tr.tr_date} ?`}
                    buttonSize="small"
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
                        <th scope="col" className="table-header">{t('th_ho_code')}</th>
                        <th scope="col" className="table-header">{t('th_ho_name')}</th>
                        <th scope="col" className="table-header">{t('th_tr_type')}</th>
                        <th scope="col" className="table-header">{t('th_tr_date')}</th>
                        <th scope="col" className="table-header">{t('th_price_per_unit')}</th>
                        <th scope="col" className="table-header">{t('th_tr_shares')}</th>
                        <th scope="col" className="table-header">{t('th_cash_amount')}</th>
                        <th scope="col" className="table-header">{t('th_tr_fee')}</th>
                        <th scope="col" className="table-header">{t('th_tr_amount')}</th>
                        <th scope="col" className="table-header text-right">{t('th_actions')}</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.map((tr) => (
                        <tr key={tr.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
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
                            <td className="table-cell text-right">
                                <div className="flex items-center justify-end space-x-2">
                                    <button
                                        className="btn-secondary"
                                        onClick={() => onEdit(tr)}
                                    >
                                        {t('button_edit')}
                                    </button>
                                    <DeleteButton
                                        onConfirm={() => onDelete(tr.id)}
                                        description={`${tr.ho_short_name} - ${tr.tr_date} ?`}
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
