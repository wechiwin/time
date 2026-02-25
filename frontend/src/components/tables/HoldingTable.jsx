// src/components/tables/FundTable.jsx
import DeleteButton from '../common/DeleteButton';
import EditButton from '../common/EditButton';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next'
import {useEnumTranslation} from '../../contexts/EnumContext';
import React, {useMemo} from "react";

export default function HoldingTable({
    data = [],
    onDelete,
    onEdit,
    selectedIds = new Set(),
    onSelectionChange,
}) {
    const navigate = useNavigate();
    const {t} = useTranslation()
    const {translateEnum} = useEnumTranslation();

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
                // 全选当前页
                data.forEach(item => {
                    if (!selectedIds.has(item.id)) {
                        onSelectionChange(item.id, true);
                    }
                });
            } else {
                // 取消选择当前页
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

    return (
        <div className="table-container">
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
                    <th className="table-header">{t('th_ho_code')}</th>
                    <th className="table-header">{t('th_ho_name')}</th>
                    <th className="table-header">{t('th_ho_type')}</th>
                    <th className="table-header">{t('th_ho_establish_date')}</th>
                    <th className="table-header">{t('info_hold_status')}</th>
                    {/* <th className="table-header">{t('th_currency')}</th> */}
                    <th scope="col" className="table-header sticky-action-header">
                        {t('th_actions')}
                    </th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        {/* 复选框 */}
                        <td className="table-cell w-12">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedIds.has(f.id)}
                                onChange={handleSelectOne(f.id)}
                                aria-label={`${t('th_select')} ${f.ho_short_name}`}
                            />
                        </td>
                        <td className="table-cell">
                            {f.ho_code}
                        </td>
                        <td className="table-cell font-medium">{f.ho_short_name}</td>
                        <td className="table-cell">{translateEnum('HoldingTypeEnum', f.ho_type)}</td>
                        <td className="table-cell">{f.establishment_date}</td>
                        <td className="table-cell">{translateEnum('HoldingStatusEnum', f.ho_status)}</td>
                        <td className="table-cell sticky-action-cell">
                            <div className="flex items-center justify-center gap-2">
                                <EditButton onClick={() => onEdit(f)} title={t('button_edit')} />
                                <DeleteButton
                                    onConfirm={() => onDelete(f)}
                                    name={f.ho_short_name}
                                />
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
