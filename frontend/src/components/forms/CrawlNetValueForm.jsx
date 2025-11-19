// src/components/forms/CrawlNetValueForm.jsx
import {useState, useCallback, useEffect} from 'react';
import HoldingSearchSelect from '../search/HoldingSearchSelect';
import useHoldingList from '../../hooks/api/useHoldingList';
import useNavHistoryList from '../../hooks/api/useNavHistoryList';
import {useToast} from "../toast/ToastContext";

/**
 * 4. 辅助函数：获取昨天的日期（YYYY-MM-DD 格式）
 */
const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

export default function CrawlNetValueForm({onSubmit, onClose, initialValues}) {
    const [formData, setFormData] = useState({
        ho_code: initialValues.ho_code || '',
        start_date: initialValues.start_date || '',
        end_date: initialValues.end_date || ''
    });

    const [quickStartDate, setQuickStartDate] = useState({creation: '', lastNav: ''});

    // 用于获取基金的创建日期
    const {getByCode} = useHoldingList({autoLoad: false});

    // 用于触发单个基金的净值历史搜索
    const [navSearchCode, setNavSearchCode] = useState(initialValues.ho_code || '');

    // 用于获取基金的最后净值日期
    const {data: navData} = useNavHistoryList({
        page: 1,
        perPage: 1, // 只需要最新的一条
        keyword: navSearchCode, // 根据选择的基金代码搜索
        autoLoad: !!navSearchCode, // 只有当 navSearchCode 有值时才自动加载
    });

    const {showSuccessToast, showErrorToast} = useToast();

    useEffect(() => {
        if (navData && navData.items && navData.items.length > 0) {
            // 假设 nav_date 已经是 'YYYY-MM-DD' 格式
            const lastNavDate = navData.items[0].nav_date;
            setQuickStartDate(prev => ({...prev, lastNav: lastNavDate}));
        } else {
            // 如果没有数据，清空
            setQuickStartDate(prev => ({...prev, lastNav: ''}));
        }
    }, [navData]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.ho_code) {
            alert('请选择基金');
            return;
        }
        onSubmit(formData);
    };

    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    // 处理基金选择变化的函数
    const handleFundSelectChange = useCallback(async (code) => {
        handleChange('ho_code', code); // 更新表单的 ho_code

        if (code) {
            // a. 触发 nav history 搜索（用于获取最后净值日）
            setNavSearchCode(code);

            // b. 异步获取基金信息（用于获取创建日期）
            try {
                const holding = await getByCode(code);
                if (holding && holding.created_at) {
                    const creationDate = holding.ho_establish_date;
                    setQuickStartDate(prev => ({...prev, creation: creationDate}));
                } else {
                    setQuickStartDate(prev => ({...prev, creation: ''}));
                }
            } catch (err) {
                console.error("获取基金信息失败:", err);
                setQuickStartDate(prev => ({...prev, creation: ''}));
            }
        } else {
            // 如果清空了基金选择，则重置所有状态
            setNavSearchCode('');
            setQuickStartDate({creation: '', lastNav: ''});
        }
    }, [handleChange, getByCode]); // 依赖 handleChange 和 getByCode

    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-1">
            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    基金代码
                </label>
                <HoldingSearchSelect
                    value={formData.ho_code}
                    onChange={handleFundSelectChange}
                    placeholder="搜索并选择基金"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    开始日期
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                        className="input w-42"
                    />
                    {/* 开始日期的快速选项 */}
                    {quickStartDate.creation && (
                        <button
                            type="button"
                            className="btn-link text-sm px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            onClick={() => handleChange('start_date', quickStartDate.creation)}
                        >
                            创建日期 ({quickStartDate.creation})
                        </button>
                    )}
                    {quickStartDate.lastNav && (
                        <button
                            type="button"
                            className="btn-link text-sm px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            onClick={() => handleChange('start_date', quickStartDate.lastNav)}
                        >
                            最后净值日 ({quickStartDate.lastNav})
                        </button>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    结束日期
                </label>
                <div className="flex flex-wrap gap-3">
                    <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => handleChange('end_date', e.target.value)}
                        className="input w-42"
                    />
                    {/* 结束日期的快速选项 */}
                    <button
                        type="button"
                        className="btn-link text-sm px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        onClick={() => handleChange('end_date', getYesterdayDate())}
                    >
                        昨天 ({getYesterdayDate()})
                    </button>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                    onClick={() => showSuccessToast('后台运行，请稍等')}
                >
                    开始爬取
                </button>
            </div>
        </form>
    );
}