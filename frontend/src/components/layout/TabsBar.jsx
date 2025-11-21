// src/components/layout/TabsBar.jsx
export default function TabsBar({ tabs, activeKey, onSwitch, onClose }) {
    return (
        <div className="flex items-center border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
            {tabs.map((tab) => (
                <div
                    key={tab.key}
                    className={`px-4 py-2 cursor-pointer flex items-center ${
                        tab.key === activeKey
                            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-300'
                    }`}
                    onClick={() => onSwitch(tab.key)}
                >
                    {tab.name}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose(tab.key);
                        }}
                        className="ml-2 text-xs hover:text-red-500"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}
