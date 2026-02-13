// src/components/common/DeleteButton.jsx
import {useState} from 'react';
import {TrashIcon} from '@heroicons/react/24/outline';
import {Dialog} from '@headlessui/react';
import {useTranslation} from "react-i18next";

export default function DeleteButton({onConfirm, description}) {
    const [open, setOpen] = useState(false);
    const {t} = useTranslation();

    // 避免在UI上直接显示 "null"
    const safeDescription = (description && !description.includes('null'))
        ? description
        : t('msg_delete_default') + ' ?'; // 提供一个通用的回退文本

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400" // 为图标按钮也添加暗黑模式样式
            >
                <TrashIcon className="w-5 h-5"/>
            </button>

            <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/30 dark:bg-black/60" aria-hidden="true"/>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="card rounded p-6 max-w-sm w-full">
                        {/* **优化点 2: 提升标题在暗黑模式下的对比度** */}
                        <Dialog.Title className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
                            {t('msg_delete_confirmation')}
                        </Dialog.Title>
                        {/* **优化点 3: 提升描述文本在暗黑模式下的对比度** */}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {safeDescription}
                        </p>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setOpen(false)} className="btn-secondary">
                                {t('button_cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    setOpen(false);
                                }}
                                className="btn-danger"
                            >
                                {t('button_delete')}
                            </button>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </>
    );
}