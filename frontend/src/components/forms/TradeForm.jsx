// src/components/forms/TradeForm.jsx
import {useEffect, useRef, useState, useMemo} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import useTradeList from "../../hooks/api/useTradeList";
import MyDate from "../common/MyDate";
import MySelect from "../common/MySelect";
import {useEnumTranslation} from "../../contexts/EnumContext";
import HoldingSearchSelect from "../search/HoldingSearchSelect";
import {roundNumber} from "../../utils/numberFormatters";
import {EventSourcePolyfill} from 'event-source-polyfill';
import FormField from "../common/FormField";
import WarningBubble from "../common/WarningBubble";
import {validateForm} from "../../utils/formValidation";
import {CameraIcon} from "@heroicons/react/24/outline";

const init = {
    id: '',
    ho_id: '',
    ho_code: '',
    ho_short_name: '',
    tr_type: '',
    tr_date: '',
    tr_nav_per_unit: '',
    tr_shares: '',
    tr_amount: '',
    tr_fee: '',
    cash_amount: '',
    dividend_type: null,
};

export default function TradeForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState(init);
    const [warnings, setWarnings] = useState({}); // 存储校验警告信息
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()
    const [uploading, setUploading] = useState(false);
    const {upload_sse} = useTradeList({autoLoad: true,});

    const [processingStatus, setProcessingStatus] = useState(''); // 显示 "上传中" 或 "AI分析中"
    // 用于管理 EventSource 连接，以便随时关闭
    const eventSourceRef = useRef(null);

    const fileInputRef = useRef(null);
    const {getEnumOptions} = useEnumTranslation();
    const typeOptions = useMemo(() => getEnumOptions('TradeTypeEnum'), [getEnumOptions]);
    const dividendTypeOptions = useMemo(() => getEnumOptions('DividendTypeEnum'), [getEnumOptions]);

    const [errors, setErrors] = useState({});

    // 组件卸载时，强制关闭未完成的连接
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // --- 核心逻辑：实时校验 ---
    useEffect(() => {
        const newWarnings = {};
        const nav = parseFloat(form.tr_nav_per_unit);
        const shares = parseFloat(form.tr_shares);
        const amount = parseFloat(form.tr_amount);
        const fee = parseFloat(form.tr_fee);
        const cash = parseFloat(form.cash_amount);
        const type = form.tr_type;

        // 仅在非现金分红时校验 tr_amount
        if (form.dividend_type !== 'CASH' && !isNaN(nav) && !isNaN(shares) && !isNaN(amount)) {
            const calcAmount = roundNumber(nav * shares, 2);
            if (Math.abs(calcAmount - amount) > 0.05) {
                newWarnings.tr_amount = {
                    message: `${t('calculation_value')} (${calcAmount}) ${t('value_mismatch_error')}`,
                    suggestedValue: calcAmount
                };
            }
        }

        // 仅在买入/卖出类型时校验 cash_amount
        const isBuySell = ['BUY', 'SUBSCRIPTION', 'INVEST', 'SELL', 'REDEMPTION', 'DIVEST'].includes(type?.toUpperCase());
        if (isBuySell && !isNaN(amount) && !isNaN(fee) && !isNaN(cash)) {
            let expectedCash = null;
            const isBuy = ['BUY', 'SUBSCRIPTION', 'INVEST'].includes(type.toUpperCase());
            const isSell = ['SELL', 'REDEMPTION', 'DIVEST'].includes(type.toUpperCase());

            if (isBuy) {
                expectedCash = roundNumber(amount + fee, 2);
            } else if (isSell) {
                expectedCash = roundNumber(amount - fee, 2);
            }

            if (expectedCash !== null && Math.abs(expectedCash - cash) > 0.05) {
                newWarnings.cash_amount = {
                    message: `${t('calculation_value')} (${expectedCash}) ${t('value_mismatch_error')}`,
                    suggestedValue: expectedCash
                };
            }
        }

        setWarnings(newWarnings);
    }, [form]); // 依赖整个 form 对象，简化依赖列表

    // 统一的 Change 处理，触发自动计算
    const handleFieldChange = (field, value) => {
        setForm(prev => {
            const nextForm = {...prev, [field]: value};

            // 1. 当交易类型改变时，重置相关字段
            if (field === 'tr_type') {
                // 如果新类型不是分红，清空分红类型
                if (value !== 'DIVIDEND') {
                    nextForm.dividend_type = null;
                }
                // 每次类型切换都清空数值，避免旧数据污染
                nextForm.tr_nav_per_unit = '';
                nextForm.tr_shares = '';
                nextForm.tr_amount = '';
                nextForm.tr_fee = '';
                nextForm.cash_amount = '';
            }

            // 2. 当分红类型改变时，重置相关字段
            if (field === 'dividend_type') {
                if (value === 'CASH') {
                    // 现金分红，清空再投资字段
                    nextForm.tr_nav_per_unit = '';
                    nextForm.tr_shares = '';
                    nextForm.tr_amount = '';
                    nextForm.tr_fee = '';
                } else if (value === 'REINVEST') {
                    // 分红再投资，清空现金字段
                    nextForm.cash_amount = '';
                }
            }

            // 3. 联动计算逻辑
            const nav = parseFloat(nextForm.tr_nav_per_unit);
            const shares = parseFloat(nextForm.tr_shares);
            const type = nextForm.tr_type;

            // 3.1 自动计算 tr_amount (适用于买卖和分红再投资)
            if (['tr_nav_per_unit', 'tr_shares'].includes(field) && !isNaN(nav) && !isNaN(shares)) {
                nextForm.tr_amount = roundNumber(nav * shares, 2).toString();
            }

            // 3.2 自动计算 cash_amount (仅适用于买卖)
            const isBuySell = ['BUY', 'SUBSCRIPTION', 'INVEST', 'SELL', 'REDEMPTION', 'DIVEST'].includes(type?.toUpperCase());
            if (isBuySell) {
                const currentAmount = parseFloat(nextForm.tr_amount);
                const currentFee = parseFloat(nextForm.tr_fee);
                if (!isNaN(currentAmount) && !isNaN(currentFee)) {
                    const isBuy = ['BUY', 'SUBSCRIPTION', 'INVEST'].includes(type.toUpperCase());
                    if (isBuy) {
                        nextForm.cash_amount = roundNumber(currentAmount + currentFee, 2).toString();
                    } else {
                        nextForm.cash_amount = roundNumber(currentAmount - currentFee, 2).toString();
                    }
                }
            }
            return nextForm;
        });
    };

    const handleApplyFix = (field, value) => {
        // 调用 handleFieldChange 以确保触发联动逻辑（例如修正 Amount 后自动修正 Cash）
        handleFieldChange(field, value.toString());
    };

    const handleFundSelectChange = (fund) => {
        setForm(prev => ({
            ...prev,
            ho_code: fund?.ho_code || '',
            // 确保 ID 为字符串，避免 Select 组件回显问题
            ho_id: fund?.id ? String(fund.id) : '',
            ho_short_name: fund?.ho_short_name || ''
        }));
    };

    // SSE 上传逻辑
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || uploading) return;

        // 1. 重置状态
        setUploading(true);
        setProcessingStatus(t('msg_uploading') || 'Uploading...'); // "上传中..."

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 2. HTTP POST 上传文件，获取 task_id
            const res = await upload_sse(file);
            // console.log(res)
            const taskId = res.task_id;
            // console.log(taskId)
            setProcessingStatus(t('msg_ai_analyzing') || 'AI Analyzing...');
            startEventSource(taskId);
        } catch (err) {
            // 捕获 API 层面的错误（包括 JSON 解析失败）
            console.error(err);
            // 这里 err.message 可能就是 "Unexpected end of JSON input"
            showErrorToast(err.message || t('msg_upload_failed'));
            setUploading(false);
            setProcessingStatus('');
        } finally {
            // 清空 input，允许重复上传同一张图片
            e.target.value = '';
        }
    };

    const startEventSource = (taskId) => {
        // 关闭旧连接（如果有）
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const token = localStorage.getItem('access_token');

        // 建立新连接
        const eventSource = new EventSourcePolyfill(`/time/trade/stream/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            heartbeatTimeout: 120000,
        });

        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'success') {
                    // LLM 处理成功，填充表单
                    const o = data.data.parsed_json;

                    setForm(prev => {
                        const isEditMode = !!initialValues?.id;
                        return {
                            ...prev,
                            id: o.id ?? prev.id ?? '',
                            ho_code: isEditMode ? prev.ho_code : (o.ho_code ?? prev.ho_code ?? ''),
                            // 确保 ID 为字符串
                            ho_id: isEditMode ? prev.ho_id : (o.ho_id ? String(o.ho_id) : (prev.ho_id ?? '')),
                            ho_short_name: isEditMode ? prev.ho_short_name : (o.ho_short_name ?? prev.ho_short_name ?? ''),
                            tr_amount: o.tr_amount ?? prev.tr_amount ?? '',
                            tr_date: o.tr_date ?? prev.tr_date ?? '',
                            tr_fee: o.tr_fee ?? prev.tr_fee ?? '',
                            tr_nav_per_unit: o.tr_nav_per_unit ?? prev.tr_nav_per_unit ?? '',
                            tr_shares: o.tr_shares ?? prev.tr_shares ?? '',
                            cash_amount: o.cash_amount ?? prev.cash_amount ?? '',
                            tr_type: o.tr_type ?? prev.tr_type ?? '',
                        };
                    });

                    showSuccessToast();
                    console.log("OCR Text:", data.data.ocr_text);

                    // 成功后关闭连接
                    eventSource.close();
                    eventSourceRef.current = null;
                    setUploading(false);
                    setProcessingStatus('');

                } else if (data.error) {
                    showErrorToast(data.error);
                    // 出错后关闭连接
                    eventSource.close();
                    eventSourceRef.current = null;
                    setUploading(false);
                    setProcessingStatus('');
                }
                // 注意：如果是 'processing' 等中间状态，不要关闭连接，也不要设置 uploading 为 false
            } catch (e) {
                console.error("Parse Error", e);
                showErrorToast(t('msg_data_parsing_failed'));
                eventSource.close();
                eventSourceRef.current = null;
                setUploading(false);
                setProcessingStatus('');
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Connection Error", err);
            // 如果连接意外断开（不是我们主动 close 的），通常意味着出错
            if (eventSource.readyState !== EventSource.CLOSED) {
                showErrorToast(t('msg_connection_timeout'));
            }
            eventSource.close();
            eventSourceRef.current = null;
            setUploading(false);
            setProcessingStatus('');
        };
    };

    const submit = async (e) => {
        e.preventDefault();
        if (isSubmitting || uploading) return;

        setIsSubmitting(true);

        // 动态生成必填字段
        let requiredFields = ['ho_code', 'tr_type', 'tr_date'];

        if (form.tr_type === 'DIVIDEND') {
            requiredFields.push('dividend_type');
            if (form.dividend_type === 'CASH') {
                // 现金分红：只需要金额
                requiredFields.push('cash_amount');
            } else if (form.dividend_type === 'REINVEST') {
                // 红利再投：需要净值、份额、金额、费用
                requiredFields.push('tr_nav_per_unit', 'tr_shares', 'tr_amount', 'tr_fee');
            }
        } else {
            // 普通买卖：需要全部字段
            requiredFields.push('tr_nav_per_unit', 'tr_shares', 'tr_amount', 'tr_fee', 'cash_amount');
        }

        // 执行验证
        const {isValid, errors: newErrors} = validateForm(form, requiredFields, t);

        if (!isValid) {
            setErrors(newErrors); // 设置错误状态，触发红框
            setIsSubmitting(false);
            return;
        }

        try {
            await onSubmit(form);
        } catch (err) {
            console.error('Form submission error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                id: initialValues.id,
                ho_id: initialValues.ho_id ? String(initialValues.ho_id) : '',
                ho_code: initialValues.ho_code || '',
                ho_short_name: initialValues.ho_short_name || '',
                tr_type: initialValues.tr_type || '',
                tr_date: initialValues.tr_date || '',
                tr_nav_per_unit: initialValues.tr_nav_per_unit || '',
                tr_shares: initialValues.tr_shares || '',
                tr_amount: initialValues.tr_amount || '',
                tr_fee: initialValues.tr_fee || '',
                cash_amount: initialValues.cash_amount || '',
                dividend_type: initialValues.dividend_type || null,
            });
        }
    }, [initialValues]);

    // 计算是否为编辑模式
    const isEditMode = !!initialValues?.id;
    const holdingSelectValue = form.ho_id ? {
        id: form.ho_id,
        ho_code: form.ho_code,
        ho_short_name: form.ho_short_name
    } : null;

    // 条件渲染的控制变量
    const isDividend = form.tr_type === 'DIVIDEND';
    const isCashDividend = isDividend && form.dividend_type === 'CASH';
    const isReinvestDividend = isDividend && form.dividend_type === 'REINVEST';

    // 决定哪些字段组可见
    const showReinvestFields = !isDividend || isReinvestDividend;
    const showCashAmountField = !isDividend || isCashDividend;

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* 基金代码 - 全宽 */}
                <FormField label={t('th_ho_code')} error={errors['ho_code']} required>
                    <HoldingSearchSelect
                        value={holdingSelectValue}
                        onChange={handleFundSelectChange}
                        placeholder={t('th_ho_code')}
                        disabled={isEditMode}
                    />
                </FormField>

                {/* 交易类型 - 半宽 */}
                <FormField label={t('th_tr_type')} error={errors['tr_type']} required>
                    <MySelect
                        options={typeOptions}
                        value={form.tr_type}
                        onChange={(val) => handleFieldChange('tr_type', val)}
                        className="input-field"
                    />
                </FormField>

                {/* 交易日期 - 半宽 */}
                <FormField label={t('th_market_date')} error={errors['tr_date']} required>
                    <MyDate
                        value={form.tr_date}
                        onChange={(dateStr) => setForm({...form, tr_date: dateStr})}
                        className="input-field"
                    />
                </FormField>

                {/* 分红类型 - 条件显示 */}
                {isDividend && (
                    <FormField label={t('th_dividend_type')} error={errors['dividend_type']} required>
                        <MySelect options={dividendTypeOptions} value={form.dividend_type}
                                  onChange={(val) => handleFieldChange('dividend_type', val)}
                                  className="input-field"/>
                    </FormField>
                )}
                {showReinvestFields && (
                    <>
                        {/* 净值 - 半宽 */}
                        <FormField label={t('th_tr_nav_per_unit')} error={errors['tr_nav_per_unit']} required>
                            <input
                                type="number"
                                step="0.0001"
                                placeholder={t('placeholder_nav_per_unit')}
                                value={form.tr_nav_per_unit}
                                onChange={(e) => setForm({...form, tr_nav_per_unit: e.target.value})}
                                className={`input-field ${warnings.tr_amount ? 'border-orange-500 focus:ring-orange-500 focus:border-orange-500' : ''}`}
                            />
                        </FormField>

                        {/* 份额 - 半宽 */}
                        <FormField label={t('th_tr_shares')} error={errors['tr_shares']} required>
                            <input
                                type="number"
                                step="0.0001"
                                placeholder={t('placeholder_shares')}
                                value={form.tr_shares}
                                onChange={(e) => setForm({...form, tr_shares: e.target.value})}
                                className="input-field"
                            />
                        </FormField>

                        {/* 交易金额 - 半宽 (带校验) */}
                        <FormField label={t('th_tr_amount')} error={errors['tr_amount']} required>
                            <input
                                type="number"
                                step="0.0001"
                                placeholder={t('placeholder_amount')}
                                value={form.tr_amount}
                                onChange={(e) => handleFieldChange('tr_amount', e.target.value)}
                                className={`input-field ${warnings.tr_amount ? 'border-orange-500 focus:ring-orange-500 focus:border-orange-500' : ''}`}
                            />
                            <WarningBubble
                                warning={warnings.tr_amount}
                                onApply={(val) => handleApplyFix('tr_amount', val)}
                            />
                        </FormField>

                        {/* 费用 - 半宽 */}
                        <FormField label={t('th_tr_fee')} error={errors['tr_fee']} required>
                            <input
                                type="number"
                                step="0.0001"
                                placeholder={t('placeholder_fee')}
                                value={form.tr_fee}
                                onChange={(e) => handleFieldChange('tr_fee', e.target.value)}
                                className="input-field"
                            />
                        </FormField>
                    </>
                )}
                {/* 结算金额 - 全宽 (带校验) */}
                {showCashAmountField && (
                    <FormField label={t('th_cash_amount')} error={errors['cash_amount']} required>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('placeholder_cash_amount')}
                            value={form.cash_amount}
                            onChange={(e) => setForm({...form, cash_amount: e.target.value})}
                            className={`input-field font-semibold bg-gray-50 ${warnings.cash_amount ? 'border-orange-500 focus:ring-orange-500 focus:border-orange-500' : ''}`}
                        />
                        <WarningBubble
                            warning={warnings.cash_amount}
                            onApply={(val) => handleApplyFix('cash_amount', val)}
                        />
                    </FormField>
                )}
            </div>

            {/* 状态提示 */}
            {uploading && (
                <div className="text-sm text-blue-600 animate-pulse text-center">
                    {processingStatus}
                </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={handleUpload}
                    className="hidden"
                    style={{display: 'none'}}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`btn-ai ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <CameraIcon className="w-4 h-4" />
                    {t('button_upload_image')}
                </button>

                <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    disabled={uploading}
                >
                    {t('button_cancel')}
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={isSubmitting || uploading}
                >
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}