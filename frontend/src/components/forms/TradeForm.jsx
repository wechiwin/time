// src/components/forms/TradeForm.jsx
import {useEffect, useRef, useState} from 'react';
import {useToast} from '../toast/ToastContext';
import {useTranslation} from "react-i18next";
import useTradeList from "../../hooks/api/useTradeList";
import MyDate from "../common/MyDate";

const init = {
    tr_id: '',
    ho_code: '',
    tr_type: 1,
    tr_date: '',
    tr_nav_per_unit: '',
    tr_shares: '',
    tr_net_amount: '',
    tr_fee: '',
    tr_amount: '',
};

export default function TradeForm({onSubmit, onClose, initialValues}) {
    const [form, setForm] = useState(init);
    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()
    const [uploading, setUploading] = useState(false);
    const {uploadTradeImg, upload_sse} = useTradeList({autoLoad: true,});

    const [processingStatus, setProcessingStatus] = useState(''); // 显示 "上传中" 或 "AI分析中"
    // 用于管理 EventSource 连接，以便随时关闭
    const eventSourceRef = useRef(null);

    // 组件卸载时，强制关闭未完成的连接
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    // SSE
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

        // 建立新连接
        const eventSource = new EventSource(`/api/trade/stream/${taskId}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.status === 'success') {
                    // LLM 处理成功，填充表单
                    const o = data.data.parsed_json; // 注意后端结构是 data -> data -> parsed_json

                    setForm(prev => {
                        const isEditMode = !!initialValues?.tr_id;
                        return {
                            ...prev,
                            // 使用 nullish coalescing  仅当 LLM 返回有效值时覆盖
                            ho_code: isEditMode ? prev.ho_code : (o.ho_code ?? prev.ho_code ?? ''), // 在编辑模式下禁止被覆盖
                            tr_amount: o.tr_amount ?? prev.tr_amount ?? '',
                            tr_date: o.tr_date ?? prev.tr_date ?? '',
                            tr_fee: o.tr_fee ?? prev.tr_fee ?? '',
                            tr_nav_per_unit: o.tr_nav_per_unit ?? prev.tr_nav_per_unit ?? '',
                            tr_shares: o.tr_shares ?? prev.tr_shares ?? '',
                            tr_net_amount: o.tr_net_amount ?? prev.tr_net_amount ?? '',
                            tr_type: o.tr_type ?? prev.tr_type ?? 1,
                        };
                    });

                    showSuccessToast();

                    // 可选：显示 OCR 原文
                    // console.log("OCR Text:", data.data.ocr_text);

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
                tr_id: initialValues.tr_id,
                ho_code: initialValues.ho_code || '',
                tr_type: initialValues.tr_type !== undefined ? Number(initialValues.tr_type) : 1,
                tr_date: initialValues.tr_date || '',
                tr_nav_per_unit: initialValues.tr_nav_per_unit || '',
                tr_shares: initialValues.tr_shares || '',
                tr_net_amount: initialValues.tr_net_amount || '',
                tr_fee: initialValues.tr_fee || '',
                tr_amount: initialValues.tr_amount || ''
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={submit} className="space-y-4 p-4 page-bg rounded-lg">
            {/* 移动端使用单列布局，桌面端使用多列 */}
            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_ho_code')}</label>
                        <input
                            placeholder={t('th_ho_code')}
                            value={form.ho_code}
                            onChange={(e) => setForm({...form, ho_code: e.target.value})}
                            required
                            className={`input-field ${initialValues?.tr_id ? 'read-only-input' : ''}`}
                            readOnly={!!initialValues?.tr_id}
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_type')}</label>
                        <select
                            value={form.tr_type}
                            onChange={(e) => setForm({...form, tr_type: Number(e.target.value)})}
                            className="input-field"
                        >
                            <option value={1}>{t('tr_type_buy')}</option>
                            <option value={0}>{t('tr_type_sell')}</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_nav_date')}</label>
                        <MyDate
                            value={form.tr_date}
                            onChange={(dateStr) => setForm({...form, tr_date: dateStr})}
                            className="input-field"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_nav_per_unit')}</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('th_tr_nav_per_unit')}
                            required
                            value={form.tr_nav_per_unit}
                            onChange={(e) => setForm({...form, tr_nav_per_unit: e.target.value})}
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_shares')}</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('th_tr_shares')}
                            required
                            value={form.tr_shares}
                            onChange={(e) => setForm({...form, tr_shares: e.target.value})}
                            className="input-field"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_net_amount')}</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('th_tr_net_amount')}
                            required
                            value={form.tr_net_amount}
                            onChange={(e) => setForm({...form, tr_net_amount: e.target.value})}
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_fee')}</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('th_tr_fee')}
                            required
                            value={form.tr_fee}
                            onChange={(e) => setForm({...form, tr_fee: e.target.value})}
                            className="input-field"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">{t('th_tr_amount')}</label>
                        <input
                            type="number"
                            step="0.0001"
                            placeholder={t('th_tr_amount')}
                            required
                            value={form.tr_amount}
                            onChange={(e) => setForm({...form, tr_amount: e.target.value})}
                            className="input-field"
                        />
                    </div>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-2">
                {/* 状态提示 */}
                {uploading && (
                    <div className="sm:hidden text-sm text-blue-600 animate-pulse">
                        {processingStatus}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    {/* 上传按钮 */}
                    <div>
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
                            className={`btn-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {t('button_upload_image')}
                        </label>
                    </div>

                    <button
                        type="button"
                        className="btn-secondary w-full sm:w-auto"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        {t('button_cancel')}
                    </button>
                    <button
                        type="submit"
                        className="btn-primary w-full sm:w-auto"
                        disabled={uploading}
                    >
                        {t('button_confirm')}
                    </button>
                </div>

                {/* 桌面端状态提示 */}
                {uploading && (
                    <div className="hidden sm:block text-sm text-blue-600 animate-pulse ml-2">
                        {processingStatus}
                    </div>
                )}
            </div>
        </form>
    );
}