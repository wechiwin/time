import React, {useState} from 'react'
import FundTable from './components/FundTable'
import TradeTable from './components/TradeTable'
import NavTable from './components/NavTable'

export default function App() {
    const [tab, setTab] = useState('fund')

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
                {/* 头部 */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">基金投资管理系统</h1>
                </div>

                {/* 导航标签 */}
                <div className="flex border-b border-gray-200 px-6">
                    <TabButton
                        active={tab === 'fund'}
                        onClick={() => setTab('fund')}
                    >
                        基金管理
                    </TabButton>
                    <TabButton
                        active={tab === 'trade'}
                        onClick={() => setTab('trade')}
                    >
                        交易管理
                    </TabButton>
                    <TabButton
                        active={tab === 'nav'}
                        onClick={() => setTab('nav')}
                    >
                        净值历史
                    </TabButton>
                </div>

                {/* 内容区 */}
                <div className="p-6">
                    {tab === 'fund' && <FundTable/>}
                    {tab === 'trade' && <TradeTable/>}
                    {tab === 'nav' && <NavTable/>}
                </div>
            </div>
        </div>
    )
}

// 抽离的标签按钮组件
function TabButton({active, onClick, children}) {
    return (
        <button
            className={`px-4 py-3 font-medium text-sm md:text-base relative ${
                active
                    ? 'text-blue-600 font-semibold'
                    : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={onClick}
        >
            {children}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t"></div>
            )}
        </button>
    )
}