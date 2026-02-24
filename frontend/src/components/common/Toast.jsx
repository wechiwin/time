import React from 'react';
import {CheckCircleIcon, XCircleIcon} from '@heroicons/react/24/outline';

export default function Toast({type = 'success', message, onClose}) {
    // type 可选 'success' 或 'error'

    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const Icon = type === 'success' ? CheckCircleIcon : XCircleIcon;

    return (
        <div
            className={`fixed bottom-4 right-4 z-toast animate-fade-in ${bgColor} text-white px-4 py-2 rounded-md shadow-lg flex items-center cursor-pointer`}
            onClick={onClose}
            role="alert"
            aria-live="assertive"
        >
            <Icon className="w-5 h-5 mr-2"/>
            {message}
        </div>
    );
}
