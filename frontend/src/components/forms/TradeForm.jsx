// src/components/forms/TradeForm.jsx
import {useEffect, useRef, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import useTradeList from "../../hooks/api/useTradeList";
import MyDate from "../common/MyDate";
import MySelect from "../common/MySelect";
import useCommon from "../../hooks/api/useCommon";
import HoldingSearchSelect from "../search/HoldingSearchSelect";
import {roundNumber} from "../../utils/formatters";
import {ExclamationTriangleIcon, CheckCircleIcon} from "@heroicons/react/24/outline";
import {EventSourcePolyfill} from 'event-source-polyfill';

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
};

// 气泡提示组件
const WarningBubble = ({warning, onApply}) => {
    if (!warning) return null;

    // 解构 warning 对象，兼容旧逻辑（如果只是字符串）
    const message = typeof warning === 'string' ? warning : warning.message;
    const suggestedValue = typeof warning === 'object' ? warning.suggestedValue : null;

    return (
        <div className="absolute z-20 left-0 -bottom-1 translate-y-full w-full">
            <div
                className="relative bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-md p-2 shadow-lg flex flex-col gap-1">
                {/* 小三角箭头 */}
                <div
                    className="absolute -top-1.5 left-4 w-3 h-3 bg-orange-50 border-t border-l border-orange-200 transform rotate-45"></div>
                <div className="flex items-start gap-1.5">
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-600"/>
                    <span className="leading-tight">{message}</span>
                </div>

                {/* 应用按钮：只有存在建议值时才显示 */}
                {suggestedValue !== null && suggestedValue !== undefined && (
                    <button
                        type="button"
                        onClick={() => onApply(suggestedValue)}
                        className="mt-1 flex items-center justify-center gap-1 w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-1 px-2 rounded transition-colors text-xs font-medium border border-orange-200"
                    >
                        <CheckCircleIcon className="w-3.5 h-3.5"/>
                        应用 {suggestedValue}
                    </button>
                )}
            </div>
        </div>
    );
};

export default function TradeForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState(init);
    const [warnings, setWarnings] = useState({}); // 存储校验警告信息
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()
    const [uploading, setUploading] = useState(false);
    const {uploadTradeImg, upload_sse} = useTradeList({autoLoad: true,});

    const [processingStatus, setProcessingStatus] = useState(''); // 显示 "上传中" 或 "AI分析中"
    // 用于管理 EventSource 连接，以便随时关闭
    const eventSourceRef = useRef(null);

    const {fetchEnumValues} = useCommon();
    const [typeOptions, setTypeOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const options = await fetchEnumValues('TradeTypeEnum');
                setTypeOptions(options);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchEnumValues, showErrorToast]);

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

        // 1. 校验 tr_amount
        if (!isNaN(nav) && !isNaN(shares) && !isNaN(amount)) {
            const calcAmount = roundNumber(nav * shares, 2);
            if (Math.abs(calcAmount - amount) > 0.05) {
                newWarnings.tr_amount = {
                    message: `计算值 (${calcAmount}) 与输入值不符`,
                    suggestedValue: calcAmount
                };
            }
        }

        // 2. 校验 cash_amount
        if (!isNaN(amount) && !isNaN(fee) && !isNaN(cash) && type) {
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
                    message: `计算值 (${expectedCash}) 与输入值不符`,
                    suggestedValue: expectedCash
                };
            }
        }

        setWarnings(newWarnings);
    }, [form.tr_nav_per_unit, form.tr_shares, form.tr_amount, form.tr_fee, form.cash_amount, form.tr_type]);

    // 提取公共计算函数
    const calculateCash = (currentAmount, currentFee, currentType) => {
        const amount = parseFloat(currentAmount);
        const fee = parseFloat(currentFee);

        if (!isNaN(amount) && !isNaN(fee) && currentType) {
            const isBuy = ['BUY', 'SUBSCRIPTION', 'INVEST'].includes(currentType.toUpperCase());
            const isSell = ['SELL', 'REDEMPTION', 'DIVEST'].includes(currentType.toUpperCase());

            if (isBuy) {
                return roundNumber(amount + fee, 2).toString();
            } else if (isSell) {
                return roundNumber(amount - fee, 2).toString();
            }
        }
        return ''; // 无法计算时返回空，或者保持原值（这里选择返回空字符串让逻辑决定是否更新）
    };

    // 统一的 Change 处理，触发自动计算
    const handleFieldChange = (field, value) => {
        setForm(prev => {
            const nextForm = {...prev, [field]: value};
            // 联动计算逻辑:
            // 1. 如果修改的是影响 Amount 的字段，重新计算 Amount
            if (['tr_nav_per_unit', 'tr_shares'].includes(field)) {
                const nav = parseFloat(nextForm.tr_nav_per_unit);
                const shares = parseFloat(nextForm.tr_shares);
                if (!isNaN(nav) && !isNaN(shares)) {
                    nextForm.tr_amount = roundNumber(nav * shares, 2).toString();
                }
            }
            // 2. 如果修改的是影响 Cash 的字段，重新计算 Cash
            // 注意：Amount 的计算会影响 Cash，所以这个判断要放在后面
            if (['tr_nav_per_unit', 'tr_shares', 'tr_amount', 'tr_fee', 'tr_type'].includes(field)) {
                const newCash = calculateCash(
                    nextForm.tr_amount,
                    nextForm.tr_fee,
                    nextForm.tr_type
                );
                if (newCash !== '') {
                    nextForm.cash_amount = newCash;
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

    // SSE 上传逻辑
    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

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
            showErrorToast(err.message || "Upload failed");
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
        const eventSource = new EventSourcePolyfill(`/api/trade/stream/${taskId}`, {
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
                    const o = data.data.parsed_json; // 注意后端结构是 data -> data -> parsed_json

                    setForm(prev => {
                        const isEditMode = !!initialValues?.id;
                        return {
                            ...prev,
                            id: o.id ?? prev.id ?? '',
                            ho_code: isEditMode ? prev.ho_code : (o.ho_code ?? prev.ho_code ?? ''),
                            ho_id: isEditMode ? prev.ho_id : (o.ho_id ?? prev.ho_id ?? ''),
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

                } else if (data.error) {
                    showErrorToast(data.error);
                }
            } catch (e) {
                console.error("Parse Error", e);
                showErrorToast("Data parsing failed");
            } finally {
                // 无论成功失败，收到消息后即关闭连接
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
                showErrorToast("Connection timeout or server error");
            }
            eventSource.close();
            eventSourceRef.current = null;
            setUploading(false);
            setProcessingStatus('');
        };
    };

    const submit = async (e) => {
        e.preventDefault();

        // 提交时，如果存在警告，可以阻断也可以仅提示。
        // 这里选择：如果存在警告，弹窗询问一次，或者直接允许提交但用户已看到气泡。
        // 鉴于已经有了气泡提示，这里直接提交，或者做一个简单的确认
        if (Object.keys(warnings).length > 0) {
            // 可选：强制确认
            // if (!window.confirm("当前数据存在计算差异，是否强制保存？")) return;
        }

        try {
            await onSubmit(form);
            setForm(init);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                id: initialValues.id,
                ho_id: initialValues.ho_id || '',
                ho_code: initialValues.ho_code || '',
                ho_short_name: initialValues.ho_short_name || '',
                tr_type: initialValues.tr_type || '',
                tr_date: initialValues.tr_date || '',
                tr_nav_per_unit: initialValues.tr_nav_per_unit || '',
                tr_shares: initialValues.tr_shares || '',
                tr_amount: initialValues.tr_amount || '',
                tr_fee: initialValues.tr_fee || '',
                cash_amount: initialValues.cash_amount || '',
            });
        }
    }, [initialValues]);

    // 计算是否为编辑模式
    const isEditMode = !!initialValues?.id;

    // 构造传给 HoldingSearchSelect 的 value 对象
    // 确保包含 id，这样 HoldingSearchSelect 内部逻辑更完整
    const holdingSelectValue = form.ho_id
        ? {id: form.ho_id, ho_code: form.ho_code, ho_short_name: form.ho_short_name}
        : null;

    return (
        <form onSubmit={submit} className="p-3 sm:p-4 page-bg rounded-lg">
            {/*
               --- 改进点 1: 紧凑布局 ---
               手机端使用 grid-cols-2，gap-3
               通过 col-span-2 控制全宽字段
            */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">

                {/* 基金代码 - 全宽 */}
                <div className="col-span-2 flex flex-col">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_ho_code')}</label>
                    <HoldingSearchSelect
                        value={holdingSelectValue}
                        onChange={handleFundSelectChange}
                        placeholder={t('th_ho_code')}
                        disabled={isEditMode}
                        className="w-full text-sm"
                    />
                </div>

                {/* 交易类型 - 半宽 */}
                <div className="col-span-1 flex flex-col">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_tr_type')}</label>
                    <MySelect
                        options={typeOptions}
                        value={form.tr_type}
                        onChange={(val) => handleFieldChange('tr_type', val)}
                        className="input-field text-sm py-1.5" // 稍微减小内边距
                    />
                </div>

                {/* 交易日期 - 半宽 */}
                <div className="col-span-1 flex flex-col">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_nav_date')}</label>
                    <MyDate
                        value={form.tr_date}
                        onChange={(dateStr) => setForm({...form, tr_date: dateStr})}
                        className="input-field text-sm py-1.5"
                    />
                </div>

                {/* 净值 - 半宽 */}
                <div className="col-span-1 flex flex-col">
                    <label
                        className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_tr_nav_per_unit')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.0000"
                        required
                        value={form.tr_nav_per_unit}
                        onChange={(e) => setForm({...form, tr_nav_per_unit: e.target.value})}
                        className="input-field text-sm py-1.5"
                    />
                </div>

                {/* 份额 - 半宽 */}
                <div className="col-span-1 flex flex-col">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_tr_shares')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.00"
                        required
                        value={form.tr_shares}
                        onChange={(e) => setForm({...form, tr_shares: e.target.value})}
                        className="input-field text-sm py-1.5"
                    />
                </div>

                {/* 交易金额 - 半宽 (带校验) */}
                <div className="col-span-1 flex flex-col relative">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_tr_amount')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.00"
                        required
                        value={form.tr_amount}
                        onChange={(e) => handleFieldChange('tr_amount', e.target.value)}
                        className={`input-field text-sm py-1.5 ${warnings.tr_amount ? 'border-orange-500 focus:ring-orange-500 focus:border-orange-500' : ''}`}
                    />
                    <WarningBubble
                        warning={warnings.tr_amount}
                        onApply={(val) => handleApplyFix('tr_amount', val)}
                    />
                </div>

                {/* 费用 - 半宽 */}
                <div className="col-span-1 flex flex-col">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_tr_fee')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.00"
                        required
                        value={form.tr_fee}
                        onChange={(e) => handleFieldChange('tr_fee', e.target.value)}
                        className="input-field text-sm py-1.5"
                    />
                </div>

                {/* 结算金额 - 全宽 (带校验) */}
                <div className="col-span-2 flex flex-col relative">
                    <label className="text-xs sm:text-sm font-medium mb-1 text-gray-700">{t('th_cash_amount')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder="0.00"
                        required
                        value={form.cash_amount}
                        onChange={(e) => setForm({...form, cash_amount: e.target.value})}
                        className={`input-field text-sm py-1.5 font-semibold bg-gray-50 ${warnings.cash_amount ? 'border-orange-500 focus:ring-orange-500 focus:border-orange-500' : ''}`}
                    />
                    <WarningBubble
                        warning={warnings.cash_amount}
                        onApply={(val) => handleApplyFix('cash_amount', val)}
                    />
                </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-2">
                {/* 状态提示 */}
                {uploading && (
                    <div className="sm:hidden text-xs text-blue-600 animate-pulse text-center mb-2">
                        {processingStatus}
                    </div>
                )}

                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2">
                    {/* 上传按钮 - 手机端占一半宽度 */}
                    <div className="col-span-2 sm:w-auto">
                        <input
                            id="trade-upload"
                            type="file"
                            accept="image/*"
                            disabled={uploading}
                            onChange={handleUpload}
                            className="hidden"
                        />
                        <label
                            htmlFor="trade-upload"
                            className={`btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto text-sm py-2 ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {t('button_upload_image')}
                        </label>
                    </div>

                    <button
                        type="button"
                        className="btn-secondary w-full sm:w-auto text-sm py-2"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        {t('button_cancel')}
                    </button>
                    <button
                        type="submit"
                        className="btn-primary w-full sm:w-auto text-sm py-2"
                        disabled={uploading}
                    >
                        {t('button_confirm')}
                    </button>
                </div>

                {/* 桌面端状态提示 */}
                {uploading && (
                    <div className="hidden sm:block text-sm text-blue-600 animate-pulse ml-2 self-center">
                        {processingStatus}
                    </div>
                )}
            </div>
        </form>
    );
}