import DarkToggle from './DarkToggle';

export default function Header() {
    return (
        <header className="card dark:bg-gray-800 shadow-sm h-16 flex items-center justify-between px-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Dashboard</h2>
            <DarkToggle/>
        </header>
    );
}