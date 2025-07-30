// src/components/DarkToggle.jsx
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import useDarkMode from '../../hooks/useDarkMode';

export default function DarkToggle() {
    const { dark, toggle } = useDarkMode();

    return (
        <button
            onClick={toggle}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="toggle dark mode"
        >
            {dark ? (
                <SunIcon className="w-5 h-5 text-yellow-400" />
            ) : (
                <MoonIcon className="w-5 h-5 text-gray-600 dark:text-gray-200" />
            )}
        </button>
    );
}