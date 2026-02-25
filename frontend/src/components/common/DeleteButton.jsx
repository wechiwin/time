// src/components/common/DeleteButton.jsx
import {useState} from 'react';
import {TrashIcon} from '@heroicons/react/24/outline';
import {useTranslation} from "react-i18next";
import ConfirmationModal from "./ConfirmationModal";

export default function DeleteButton({onConfirm, name, isLoading = false}) {
    const [open, setOpen] = useState(false);
    const {t} = useTranslation();

    // 使用 i18n 格式化删除确认描述
    const description = name
        ? t('msg_delete_confirmation_simple', {name})
        : t('msg_delete_default');

    const handleConfirm = async () => {
        await onConfirm();
        setOpen(false);
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400"
            >
                <TrashIcon className="w-5 h-5"/>
            </button>

            <ConfirmationModal
                isOpen={open}
                onClose={() => setOpen(false)}
                onConfirm={handleConfirm}
                title={t('title_delete_confirmation')}
                description={description}
                isLoading={isLoading}
            />
        </>
    );
}
