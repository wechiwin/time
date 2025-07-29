export default function Header() {
    return (
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
            <h2 className="text-lg font-semibold text-gray-800">Dashboard</h2>
            <div className="text-sm text-gray-600">用户名 / 退出</div>
        </header>
    );
}