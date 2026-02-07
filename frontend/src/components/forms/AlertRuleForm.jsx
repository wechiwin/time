import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import HoldingSearchSelect from "../search/HoldingSearchSelect";
import useCommon from "../../hooks/api/useCommon";
import MySelect from "../common/MySelect";
import FormField from "../common/FormField";
import {validateForm} from "../../utils/formValidation";

export default function AlertRuleForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        id: null,
        ho_id: '',
        ho_code: '',
        action: '',
        target_price: '',
        ar_is_active: 1,
        ho_short_name: '',
        ar_name: '',
    });
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()
    const isEditMode = !!initialValues?.id;

    const {fetchMultipleEnumValues} = useCommon();
    const [actionOptions, setActionOptions] = useState([]);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [
                    actionOptions,
                ] = await fetchMultipleEnumValues([
                    'AlertRuleActionEnum',
                ]);
                setActionOptions(actionOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);


    // 自动生成监控名称的effect
    useEffect(() => {
        // 编辑模式下不自动生成，保持原值
        // if (isEditMode) return;

        // 检查必要字段是否都有值
        if (form.ho_short_name && form.target_price) {
            // 获取告警类型文本映射
            const typeTextMap = {
                0: t('alert_type_sell'),
                1: t('alert_type_buy'),
                2: t('alert_type_add')
            };

            const typeText = typeTextMap[form.action] || '';
            // 生成名称格式：基金简称_操作类型_目标净值
            const generatedName = `${form.ho_code}_${form.ho_short_name}_${typeText}_${form.target_price}`;

            // 只在生成的名称与当前不同时才更新，避免不必要的渲染
            if (generatedName !== form.ar_name) {
                setForm(prev => ({
                    ...prev,
                    ar_name: generatedName
                }));
            }
        }
    }, [form.ho_short_name, form.action, form.target_price, t, isEditMode]);

    // 2. 辅助函数：清除指定字段的错误
    const clearError = (field) => {
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 定义必填字段
        const requiredFields = [
            'ho_code',
            'target_price',
        ];
        // 3. 执行验证
        const {isValid, errors: newErrors} = validateForm(form, requiredFields, t);

        if (!isValid) {
            setErrors(newErrors); // 设置错误状态，触发红框
            // showErrorToast(t('validation_failed_msg')); // 可选：弹一个总的提示
            return;
        }

        try {
            await onSubmit(form);
            showSuccessToast();
            onClose();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                id: initialValues.id || null,
                ho_id: initialValues.ho_id || '',
                ho_code: initialValues.ho_code || '',
                ho_short_name: initialValues.ho_short_name || '',
                ar_name: initialValues.ar_name || '',
                action: initialValues.action || '',
                target_price: initialValues.target_price || '',
                ar_is_active: initialValues.ar_is_active || 1,
            });
        }
    }, [initialValues]);
    const holdingSelectValue = form.ho_short_name
        ? {ho_code: form.ho_code, ho_short_name: form.ho_short_name, id: form.ho_id}
        : form.ho_code;

    const handleFundSelectChange = (fund) => {
        clearError('ho_code');
        if (fund) {
            setForm(prev => ({
                ...prev,
                ho_code: fund.ho_code,
                ho_id: fund.id,
                ho_short_name: fund.ho_short_name
            }));
        } else {
            setForm(prev => ({
                ...prev,
                ho_code: '',
                ho_id: '',
                ho_short_name: ''
            }));
        }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('th_ho_code')} error={errors['ho_code']} required>
                    {isEditMode ? (
                        // 编辑模式下显示只读输入框
                        <input
                            value={form.ho_code}
                            disabled
                            readOnly
                            placeholder={t('th_ho_code')}
                            className="input-field bg-gray-100 cursor-not-allowed dark:bg-gray-700"
                        />
                    ) : (
                        // 添加模式下显示可编辑的选择器
                        <HoldingSearchSelect
                            value={holdingSelectValue}
                            onChange={handleFundSelectChange}
                            placeholder={t('th_ho_code')}
                        />
                    )}
                </FormField>
                {/* 基金名称只读输入框 */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_short_name')}</label>
                    <input
                        value={form.ho_short_name}
                        disabled
                        readOnly
                        placeholder={t('th_ho_short_name')}
                        className="input-field bg-gray-100 cursor-not-allowed dark:bg-gray-700"
                    />
                </div>

                <FormField label={t('th_ar_name')}>
                    <input
                        placeholder={t('th_ar_name')}
                        value={form.ar_name}
                        onChange={(e) => setForm({...form, ar_name: e.target.value})}
                        disabled
                        readOnly
                        className="input-field bg-gray-100 cursor-not-allowed dark:bg-gray-700"
                    />
                </FormField>

                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_type')}</label>
                    <MySelect
                        options={actionOptions}
                        value={form.action}
                        onChange={(val) => setForm({...form, action: val})}
                        className="input-field"
                    />
                </div>

                <FormField label={t('alert_target_price')} error={errors['target_price']} required>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('alert_target_price')}
                        value={form.target_price}
                        onChange={(e) => {
                            // 5. 输入时清除错误
                            clearError('target_price');
                            setForm({...form, target_price: parseFloat(e.target.value)})
                        }}
                        className="input-field"
                    />
                </FormField>

                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_status')}</label>
                    <select
                        value={form.ar_is_active}
                        onChange={(e) => setForm({...form, ar_is_active: parseInt(e.target.value)})}
                        className="input-field"
                    >
                        <option value="1">{t('status_active')}</option>
                        <option value="0">{t('status_inactive')}</option>
                    </select>
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                    {t('button_cancel')}
                </button>
                <button type="submit" className="btn-primary">
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}
