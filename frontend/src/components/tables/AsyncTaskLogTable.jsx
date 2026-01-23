// AsyncTaskLogTable.jsx
import React from 'react';
import {useTranslation} from 'react-i18next';

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

export default function AsyncTaskLogTable({data = [] /*, onShowDetails */}) {
    const {t} = useTranslation();

    // 渲染状态徽章的辅助函数。
    // 明确职责：此函数负责将状态的样式（来自 statusStyles）和国际化文本（来自 t()）结合，
    // 生成一个完整的、可显示的UI徽章。
    const renderStatusBadge = (status, status$view) => (
        <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || statusStyles.PENDING}`}>
            {/* 状态的文字内容通过 i18n 翻译获取，与样式完全分离。
                例如，对于 'PENDING' 状态，它会查找并显示 'task_status_PENDING' 对应的翻译文本。*/}
            {status$view}
        </span>
    );

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="page-bg dark:bg-gray-700/50">
                <tr>
                    <th scope="col" className="table-header">{t('th_task_name')}</th>
                    <th scope="col" className="table-header">{t('th_status')}</th>
                    <th scope="col" className="table-header">{t('th_error_message')}</th>
                    <th scope="col" className="table-header">{t('th_result_summary')}</th>
                    <th scope="col" className="table-header">{t('th_created_at')}</th>
                    <th scope="col" className="table-header">{t('th_updated_at')}</th>
                    <th scope="col" className="table-header">{t('th_retries')}</th>
                </tr>
                </thead>
                <tbody className="card divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((log) => (
                    <tr key={log.id} className="hover:page-bg dark:hover:bg-gray-700/50">
                        <td className="table-cell">{log.task_name}</td>
                        <td className="table-cell">{renderStatusBadge(log.status, log.status$view)}</td>
                        <td className="table-cell max-w-xs truncate" title={log.error_message}>{log.error_message}</td>
                        <td className="table-cell max-w-xs truncate" title={log.result_summary}>{log.result_summary}</td>
                        <td className="table-cell">{log.created_at}</td>
                        <td className="table-cell">{log.updated_at}</td>
                        <td className="table-cell">{`${log.retry_count} / ${log.max_retries}`}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
