// src/components/forms/CrawlNetValueForm.jsx
import {useCallback, useEffect, useState} from 'react';
import HoldingSearchSelect from '../search/HoldingSearchSelect';
import useHoldingList from '../../hooks/api/useHoldingList';
import useNavHistoryList from '../../hooks/api/useNavHistoryList';
import {useToast} from "../context/ToastContext";
import {useTranslation} from "react-i18next";
import MyDate from "../common/MyDate";
import FormField from "../common/FormField";
import {validateForm} from "../../utils/formValidation";

/**
 * 4. 辅助函数：获取昨天的日期（YYYY-MM-DD 格式）
 */
const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

export default function CrawlNetValueForm({onSubmit, onClose, initialValues}) {
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        ho_id: initialValues.ho_id || '',
        ho_code: initialValues.ho_code || '',
        ho_short_name: initialValues?.ho_short_name || '',
        start_date: initialValues.start_date || '',
        end_date: initialValues.end_date || ''
    });

    const [quickStartDate, setQuickStartDate] = useState({creation: '', lastNav: ''});

    // 用于获取基金的创建日期
    const {getById} = useHoldingList({autoLoad: false});

    // 用于触发单个基金的净值历史搜索
    const [navSearchCode, setNavSearchCode] = useState(initialValues.ho_code || '');

    // 用于获取基金的最后净值日期
    const {data: navData} = useNavHistoryList({
        page: 1,
        perPage: 1, // 只需要最新的一条
        keyword: formData.ho_code, // 根据选择的基金代码搜索
        autoLoad: !!formData.ho_code, // 只有当 navSearchCode 有值时才自动加载
    });

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()

    useEffect(() => {
        if (navData && navData.items && navData.items.length > 0) {
            // nav_date: 'YYYY-MM-DD'
            const lastNavDate = navData.items[0].nav_date;
            setQuickStartDate(prev => ({...prev, lastNav: lastNavDate}));
        } else {
            // 如果没有数据，清空
            setQuickStartDate(prev => ({...prev, lastNav: ''}));
        }
    }, [navData]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // 定义必填字段
        const requiredFields = [
            'ho_code',
            'start_date',
            'end_date',
        ];
        const {isValid: isRequiredValid, errors: requiredErrors} = validateForm(formData, requiredFields, t);
        // 3. 执行特定于此表单的业务逻辑校验
        let isLogicValid = true;
        const logicErrors = {};
        // 只有在开始和结束日期都存在的情况下，才进行比较
        if (formData.start_date && formData.end_date) {
            // new Date() 会将 'YYYY-MM-DD' 格式的字符串解析为 UTC 时间的午夜
            // 这种比较方式对于仅比较日期是安全且无歧义的
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                isLogicValid = false;
                // 将错误信息关联到 `end_date` 字段，以便在 UI 上显示
                logicErrors.end_date = t('end_date_cannot_be_earlier_than_start_date');
            }
        }
        // 4. 合并错误并判断最终有效性
        const allErrors = {...requiredErrors, ...logicErrors};
        const isFormValid = isRequiredValid && isLogicValid;
        if (!isFormValid) {
            setErrors(allErrors); // 设置合并后的错误状态
            return;
        }
        onSubmit(formData);
        showSuccessToast(t('msg_after_crawl'))
    };

    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // 关键：用户一旦输入，就清除该字段的红色错误提示
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [errors]);

    // 处理基金选择变化的函数
    const handleFundSelectChange = useCallback(async (ho) => {
        // 如果 ho 为 null 或 undefined，表示清空操作
        const id = ho?.id || '';
        const code = ho?.ho_code || '';
        const shortName = ho?.ho_short_name || '';
        // 一次性更新所有与持仓相关的字段
        setFormData(prev => ({
            ...prev,
            ho_id: id,
            ho_code: code,
            ho_short_name: shortName,
        }));

        // 清除可能存在的错误提示
        if (errors['ho_code']) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors['ho_code'];
                return newErrors;
            });
        }
        if (ho) {
            // 异步获取基金的成立日期
            try {
                const holdingDetails = await getById(ho.id);
                const creationDate = holdingDetails?.establishment_date || '';
                setQuickStartDate(prev => ({...prev, creation: creationDate}));
            } catch (err) {
                console.error("fetch_holding_failed:", err);
                showErrorToast(t('msg_fetch_holding_failed'));
                setQuickStartDate(prev => ({...prev, creation: ''}));
            }
        } else {
            // 清空选择时，重置快速日期
            setQuickStartDate({creation: '', lastNav: ''});
        }
    }, [getById, showErrorToast, t, errors]); // 移除 handleChange 依赖，因为它不再被调用

    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-1">
            <FormField label={t('th_ho_code')} error={errors['ho_code']} required>
                <div>
                    <HoldingSearchSelect
                        value={{ho_code: formData.ho_code, ho_short_name: formData.ho_short_name}}
                        onChange={handleFundSelectChange}
                        placeholder={t('msg_search_placeholder')}
                    />
                </div>
            </FormField>

            <FormField label={t('start_date')} error={errors['start_date']} required>
                <div className="flex items-center gap-2">
                    <MyDate
                        value={formData.start_date}
                        onChange={(dateStr) => handleChange('start_date', dateStr)}
                        className="input-field py-1.5 w-42"
                    />
                    {/* 开始日期的快速选项 */}
                    {quickStartDate.creation && (
                        <button
                            type="button"
                            className="btn-subtle"
                            onClick={() => handleChange('start_date', quickStartDate.creation)}
                        >
                            {t('th_ho_establish_date')} ({quickStartDate.creation})
                        </button>
                    )}
                    {quickStartDate.lastNav && (
                        <button
                            type="button"
                            className="btn-subtle"
                            onClick={() => handleChange('start_date', quickStartDate.lastNav)}
                        >
                            {t('last_market_date')} ({quickStartDate.lastNav})
                        </button>
                    )}
                </div>
            </FormField>

            <FormField label={t('end_date')} error={errors['end_date']} required>
                <div className="flex flex-wrap gap-3">
                    <MyDate
                        value={formData.end_date}
                        onChange={(dateStr) => handleChange('end_date', dateStr)}
                        className="input-field py-1.5 w-42"
                    />
                    {/* 结束日期的快速选项 */}
                    <button
                        type="button"
                        className="btn-subtle"
                        onClick={() => handleChange('end_date', getYesterdayDate())}
                    >
                        {t('yesterday')} ({getYesterdayDate()})
                    </button>
                </div>
            </FormField>

            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                >
                    {t('button_cancel')}
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                >
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}