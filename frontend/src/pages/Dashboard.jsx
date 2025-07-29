export default function Dashboard() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded shadow">卡片 1</div>
                <div className="bg-white p-4 rounded shadow">卡片 2</div>
                <div className="bg-white p-4 rounded shadow">卡片 3</div>
            </div>
        </div>
    );
}