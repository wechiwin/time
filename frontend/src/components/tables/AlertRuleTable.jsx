import DeleteButton from '../common/DeleteButton';
import EditButton from '../common/EditButton';
import {useTranslation} from 'react-i18next';
import {useEnumTranslation} from '../../contexts/EnumContext';
import {useMemo} from 'react';

export default function AlertRuleTable({
    data = [],
    onDelete,
    onEdit,
    selectedIds = new Set(),
    onSelectionChange,
}) {
    const {t} = useTranslation();
    const {translateEnum, getEnumOptions} = useEnumTranslation();

    const getStatusText = (status) => {
        return status === 1 ? t('status_active') : t('status_inactive');
    };

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
                    <th className="table-header">{t('th_ar_name')}</th>
                    <th className="table-header">{t('alert_type')}</th>
                    <th className="table-header">{t('alert_target_price')}</th>
                    <th className="table-header">{t('alert_status')}</th>
                    <th className="table-header sticky-action-header">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        {/* 复选框 */}
                        <td className="table-cell w-12">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedIds.has(rule.id)}
                                onChange={handleSelectOne(rule.id)}
                                aria-label={`${t('th_select')} ${rule.ar_name}`}
                            />
                        </td>
                        <td className="table-cell">{rule.ho_code}</td>
                        <td className="table-cell">{rule.ar_name}</td>
                        <td className="table-cell">{translateEnum('AlertRuleActionEnum', rule.action)}</td>
                        <td className="table-cell">{rule.target_price}</td>
                        <td className="table-cell">{getStatusText(rule.ar_is_active)}</td>
                        <td className="table-cell sticky-action-cell">
                            <div className="flex items-center space-x-2">
                                <EditButton onClick={() => onEdit(rule)} title={t('button_edit')} />
                                <DeleteButton
                                    onConfirm={() => onDelete(rule.id)}
                                    name={rule.ar_name}
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
