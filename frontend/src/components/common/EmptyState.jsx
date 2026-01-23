import React from 'react';
import {InboxIcon} from "@heroicons/react/24/outline/index";

export default function EmptyState({ message, icon: IconComponent }) {
    // 允许通过 prop 传入自定义图标，如果未传入则使用默认图标
    const CurrentIcon = IconComponent || InboxIcon  ;

    return (
        <div
            className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
            <CurrentIcon className="h-12 w-12 text-gray-400"/>
            <p className="text-gray-500 dark:text-gray-400">{message}</p>
        </div>
    );
}
