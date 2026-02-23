// src/components/common/EditButton.jsx
import {PencilIcon} from '@heroicons/react/24/outline';

export default function EditButton({onClick, title}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400"
        >
            <PencilIcon className="w-5 h-5"/>
        </button>
    );
}
