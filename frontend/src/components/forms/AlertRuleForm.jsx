import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import HoldingSearchSelect from "../search/HoldingSearchSelect";
import useCommon from "../../hooks/api/useCommon";
import MySelect from "../common/MySelect";

export default function AlertRuleForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState({
        ar_id: null,
        ho_code: '',
        ar_type: 1,
        ar_target_navpu: '',
        ar_is_active: 1,
        ho_short_name: '',
        ar_name: '',
    });
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()
    const isEditMode = !!initialValues?.ar_id;

    const {fetchMultipleEnumValues} = useCommon();
    const [actionOptions, setActionOptions] = useState([]);

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
        if (form.ho_short_name && form.ar_target_navpu) {
            // 获取告警类型文本映射
            const typeTextMap = {
                0: t('alert_type_sell'),
                1: t('alert_type_buy'),
                2: t('alert_type_add')
            };

            const typeText = typeTextMap[form.ar_type] || '';
            // 生成名称格式：基金简称_操作类型_目标净值
            const generatedName = `${form.ho_code}_${form.ho_short_name}_${typeText}_${form.ar_target_navpu}`;

            // 只在生成的名称与当前不同时才更新，避免不必要的渲染
            if (generatedName !== form.ar_name) {
                setForm(prev => ({
                    ...prev,
                    ar_name: generatedName
                }));
            }
        }
    }, [form.ho_short_name, form.ar_type, form.ar_target_navpu, t, isEditMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                ar_id: initialValues.ar_id || null,
                ho_code: initialValues.ho_code || '',
                ho_short_name: initialValues.ho_short_name || '',
                ar_name: initialValues.ar_name || '',
                ar_type: initialValues.ar_type || 1,
                ar_target_navpu: initialValues.ar_target_navpu || '',
                ar_is_active: initialValues.ar_is_active || 1,
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_code')}</label>
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
                            value={form.ho_code}
                            onChange={(ho) => setForm({
                                ...form,
                                ho_code: ho.ho_code,
                                ho_short_name: ho.ho_short_name
                            })}
                            placeholder={t('th_ho_code')}
                        />
                    )}
                </div>
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
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ar_name')}</label>
                    <input
                        placeholder={t('th_ar_name')}
                        value={form.ar_name}
                        onChange={(e) => setForm({...form, ar_name: e.target.value})}
                        disabled
                        readOnly
                        className="input-field bg-gray-100 cursor-not-allowed dark:bg-gray-700"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_type')}</label>
                    <MySelect
                        options={actionOptions}
                        value={form.action}
                        onChange={(val) => setForm({...form, action: val})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('alert_target_navpu')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('alert_target_navpu')}
                        value={form.ar_target_navpu}
                        onChange={(e) => setForm({...form, ar_target_navpu: parseFloat(e.target.value)})}
                        required
                        className="input-field"
                    />
                </div>
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
