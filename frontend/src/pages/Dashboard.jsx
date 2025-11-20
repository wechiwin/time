import {useTranslation} from "react-i18next";

export default function Dashboard() {
    const {t} = useTranslation()
    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card p-4 rounded shadow">卡片 1</div>
                <div className="card p-4 rounded shadow">卡片 2</div>
                <div className="card p-4 rounded shadow">卡片 3</div>
            </div>
        </div>
    );
}