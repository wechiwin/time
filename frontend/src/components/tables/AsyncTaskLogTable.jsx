// AsyncTaskLogTable.jsx
import {useTranslation} from 'react-i18next';
import {useEnumTranslation} from '../../contexts/EnumContext';
import DeleteButton from '../common/DeleteButton';
import {useMemo} from 'react';

// 状态到样式的映射。
// 明确职责：此对象仅负责提供 Tailwind CSS 类名，用于控制状态徽章的视觉样式（如背景色、文字颜色）。
// 不包含任何文字内容。
const statusStyles = {
    PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    RUNNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    SUCCESS: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    RETRYING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    // 未来如果增加新的状态，只需在此添加对应的样式类名
};

export default function AsyncTaskLogTable({
    data = [],
    onDelete,
    selectedIds = new Set(),
    onSelectionChange,
}) {
    const {t} = useTranslation();
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

    // 渲染状态徽章的辅助函数。
    // 明确职责：此函数负责将状态的样式（来自 statusStyles）和国际化文本（来自 translateEnum）结合，
    // 生成一个完整的、可显示的UI徽章。
    const renderStatusBadge = (status) => (
        <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || statusStyles.PENDING}`}>
            {/* 状态的文字内容通过 translateEnum 翻译获取，与样式完全分离。*/}
            {translateEnum('TaskStatusEnum', status)}
        </span>
    );

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
                    <th scope="col" className="table-header">{t('th_task_name')}</th>
                    <th scope="col" className="table-header">{t('th_status')}</th>
                    <th scope="col" className="table-header">{t('th_error_message')}</th>
                    <th scope="col" className="table-header">{t('th_result_summary')}</th>
                    <th scope="col" className="table-header">{t('th_retries')}</th>
                    <th scope="col" className="table-header">{t('th_updated_at')}</th>
                    <th scope="col" className="table-header">{t('th_created_at')}</th>
                    <th scope="col" className="table-header sticky-action-header">{t('th_actions')}</th>
                </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                        {/* 复选框 */}
                        <td className="table-cell w-12">
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedIds.has(log.id)}
                                onChange={handleSelectOne(log.id)}
                                aria-label={`${t('th_select')} ${log.task_name}`}
                            />
                        </td>
                        <td className="table-cell">{log.task_name}</td>
                        <td className="table-cell">{renderStatusBadge(log.status)}</td>
                        <td className="table-cell max-w-xs truncate" title={log.error_message}>{log.error_message}</td>
                        <td className="table-cell max-w-xs truncate" title={log.result_summary}>{log.result_summary}</td>
                        <td className="table-cell">{`${log.retry_count} / ${log.max_retries}`}</td>
                        <td className="table-cell">{log.updated_at}</td>
                        <td className="table-cell">{log.created_at}</td>
                        <td className="table-cell sticky-action-cell">
                            {onDelete && (
                                <DeleteButton
                                    onConfirm={() => onDelete(log.id)}
                                    name={`${log.task_name} (${translateEnum('TaskStatusEnum', log.status)})`}
                                />
                            )}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
