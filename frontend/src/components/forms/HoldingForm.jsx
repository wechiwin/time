// src/components/forms/HoldingForm.jsx
import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import MyDate from "../common/MyDate";
import useCommon from "../../hooks/api/useCommon";
import MySelect from "../common/MySelect";

export default function HoldingForm({onSubmit, onClose, initialValues, onCrawl}) {
    const [form, setForm] = useState({
        id: '',
        ho_code: '',
        ho_name: '',
        ho_short_name: '',
        ho_nickname: '',
        ho_type: '',
        establishment_date: '',
        ho_status: '',
        currency: '',
        fund_detail: {
            fund_type: '',
            risk_level: '',
            trade_market: '',
            manage_exp_rate: '',
            trustee_exp_rate: '',
            sales_exp_rate: '',
            company_id: '',
            company_name: '',
            fund_manager: '',
            dividend_method: '',
            index_code: '',
            index_name: '',
            feature: '',
        }
    });

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation()

    const {fetchMultipleEnumValues} = useCommon();
    const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [tradeMarketOptions, setTradeMarketOptions] = useState([]);
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [dividendOptions, setDividendOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [typeOptions,
                    marketOptions,
                    currencyOptions,
                    dividendOptions
                ] = await fetchMultipleEnumValues([
                    'HoldingTypeEnum',
                    'FundTradeMarketEnum',
                    'CurrencyEnum',
                    'FundDividendMethodEnum',
                ]);
                setHoTypeOptions(typeOptions);
                setTradeMarketOptions(marketOptions);
                setCurrencyOptions(currencyOptions);
                setDividendOptions(dividendOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast('加载类型选项失败');
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

    // 处理基金选择
    const handleHoldingSelect = (holding) => {
        if (holding) {
            setForm(prev => ({
                ...prev,
                id: holding.id || '',
                ho_code: holding.ho_code || '',
                ho_name: holding.ho_name || '',
                ho_short_name: holding.ho_short_name || '',
                ho_type: holding.ho_type || '',
                establishment_date: holding.establishment_date || '',
                currency: holding.currency || '',
                fund_detail: {
                    fund_type: holding.fund_detail?.fund_type || '',
                    risk_level: holding.fund_detail?.risk_level || '',
                    trade_market: holding.fund_detail?.trade_market || '',
                    manage_exp_rate: holding.fund_detail?.manage_exp_rate || '',
                    trustee_exp_rate: holding.fund_detail?.trustee_exp_rate || '',
                    sales_exp_rate: holding.fund_detail?.sales_exp_rate || '',
                    company_id: holding.fund_detail?.company_id || '',
                    company_name: holding.fund_detail?.company_name || '',
                    fund_manager: holding.fund_detail?.fund_manager || '',
                    dividend_method: holding.fund_detail?.dividend_method || '',
                    index_code: holding.fund_detail?.index_code || '',
                    index_name: holding.fund_detail?.index_name || '',
                    feature: holding.fund_detail?.feature || '',
                },
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // 验证必填字段
            if (!form.ho_code) {
                showErrorToast('基金代码不能为空');
                return;
            }
            if (!form.ho_name) {
                showErrorToast('基金名称不能为空');
                return;
            }

            await onSubmit(form);
            // 重置表单
            setForm({
                id: '',
                ho_code: '',
                ho_name: '',
                ho_short_name: '',
                ho_nickname: '',
                ho_type: '',
                establishment_date: '',
                ho_status: '',
                currency: '',
                fund_detail: {
                    fund_type: '',
                    risk_level: '',
                    trade_market: '',
                    manage_exp_rate: '',
                    trustee_exp_rate: '',
                    sales_exp_rate: '',
                    company_id: '',
                    company_name: '',
                    fund_manager: '',
                    dividend_method: '',
                    index_code: '',
                    index_name: '',
                    feature: '',
                }
            });
            showSuccessToast();
            onClose();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    const handleCrawl = () => {
        if (!form.ho_code) return showErrorToast('请先输入基金代码');
        console.log(form)
        // 把当前表单 setForm 传进去，方便回调里直接 setState
        onCrawl(form.ho_code, (patch) =>
            setForm((prev) => ({...prev, ...patch}))
        );
    };

    // 当 initialValues 变化时，回显到表单
    useEffect(() => {
        if (initialValues) {
            setForm({
                id: initialValues.id || '',
                ho_code: initialValues.ho_code || '',
                ho_name: initialValues.ho_name || '',
                ho_short_name: initialValues.ho_short_name || '',
                ho_nickname: initialValues.ho_nickname || '',
                ho_type: initialValues.ho_type || '',
                establishment_date: initialValues.establishment_date || '',
                ho_status: initialValues.ho_status || '',
                currency: initialValues.currency || '',
                fund_detail: {
                    fund_type: initialValues.fund_detail?.fund_type || '',
                    risk_level: initialValues.fund_detail?.risk_level || '',
                    trade_market: initialValues.fund_detail?.trade_market || '',
                    manage_exp_rate: initialValues.fund_detail?.manage_exp_rate || '',
                    trustee_exp_rate: initialValues.fund_detail?.trustee_exp_rate || '',
                    sales_exp_rate: initialValues.fund_detail?.sales_exp_rate || '',
                    company_id: initialValues.fund_detail?.company_id || '',
                    company_name: initialValues.fund_detail?.company_name || '',
                    fund_manager: initialValues.fund_detail?.fund_manager || '',
                    dividend_method: initialValues.fund_detail?.dividend_method || '',
                    index_code: initialValues.fund_detail?.index_code || '',
                    index_name: initialValues.fund_detail?.index_name || '',
                    feature: initialValues.fund_detail?.feature || '',
                }
            });
        }
    }, [initialValues]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 基金搜索选择器 - 只在新增时显示 */}
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_code')}</label>
                    <input
                        placeholder={t('th_ho_code')}
                        value={form.ho_code}
                        onChange={(e) => setForm({...form, ho_code: e.target.value})}
                        required
                        className={`input-field ${initialValues?.id ? 'read-only-input' : ''}`}
                        readOnly={!!initialValues?.id}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_name')}</label>
                    <input
                        placeholder={t('th_ho_name')}
                        value={form.ho_name}
                        onChange={(e) => setForm({...form, ho_name: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_short_name')}</label>
                    <input
                        placeholder={t('th_ho_short_name')}
                        value={form.ho_short_name}
                        onChange={(e) => setForm({...form, ho_short_name: e.target.value})}
                        required
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_nickname')}</label>
                    <input
                        placeholder={t('th_ho_nickname')}
                        value={form.ho_nickname}
                        onChange={(e) => setForm({...form, ho_nickname: e.target.value})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_type')}</label>
                    <MySelect
                        options={hoTypeOptions}
                        value={form.ho_type}
                        onChange={(val) => setForm({...form, ho_type: val})}
                        className="input-field"
                    />
                    {/* <select */}
                    {/*     value={form.ho_type} */}
                    {/*     onChange={(e) => setForm({...form, ho_type: e.target.value})} */}
                    {/*     className="input-field" */}
                    {/* > */}
                    {/*     {hoTypeOptions.map((o) => ( */}
                    {/*         <option key={o.value} value={o.value}>{o.label}</option> */}
                    {/*     ))} */}
                    {/* </select> */}
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">
                        {t('th_ho_establish_date')}
                    </label>
                    <MyDate
                        value={form.establishment_date}
                        onChange={(dateStr) => setForm({...form, establishment_date: dateStr})}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_manage_exp_rate')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_manage_exp_rate')}
                        required
                        value={form.fund_detail.manage_exp_rate}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, manage_exp_rate: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_trustee_exp_rate')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_trustee_exp_rate')}
                        required
                        value={form.fund_detail.trustee_exp_rate}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, trustee_exp_rate: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_ho_sales_exp_rate')}</label>
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_sales_exp_rate')}
                        required
                        value={form.fund_detail.sales_exp_rate}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, sales_exp_rate: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_currency')}</label>
                    <MySelect
                        options={currencyOptions}
                        value={form.currency}
                        onChange={(val) => setForm({...form, currency: val})}
                        className="input-field"
                    />
                    {/* <select */}
                    {/*     value={form.currency} */}
                    {/*     onChange={(e) => setForm({...form, currency: e.target.value})} */}
                    {/*     className="input-field" */}
                    {/* > */}
                    {/*     {currencyOptions.map((o) => ( */}
                    {/*         <option key={o.value} value={o.value}>{o.label}</option> */}
                    {/*     ))} */}
                    {/* </select> */}
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_risk_level')}</label>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        placeholder={t('th_risk_level')}
                        value={form.fund_detail.risk_level}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, risk_level: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_fund_type')}</label>
                    <input
                        placeholder={t('th_fund_type')}
                        value={form.fund_detail.fund_type}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, fund_type: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_trade_market')}</label>
                    <MySelect
                        options={tradeMarketOptions}
                        value={form.fund_detail.trade_market}
                        onChange={(val) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, trade_market: val}
                        })}
                        className="input-field"
                    />
                    {/* <select */}
                    {/*     value={form.trade_market} */}
                    {/*     onChange={(e) => setForm({...form, trade_market: e.target.value})} */}
                    {/*     className="input-field" */}
                    {/* > */}
                    {/*     {tradeMarketOptions.map((o) => ( */}
                    {/*         <option key={o.value} value={o.value}>{o.label}</option> */}
                    {/*     ))} */}
                    {/* </select> */}
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_dividend_method')}</label>
                    <MySelect
                        options={dividendOptions}
                        value={form.fund_detail.dividend_method}
                        onChange={(val) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, dividend_method: val}
                        })}
                        className="input-field"
                    />
                    {/* <select */}
                    {/*     value={form.trade_market} */}
                    {/*     onChange={(e) => setForm({...form, trade_market: e.target.value})} */}
                    {/*     className="input-field" */}
                    {/* > */}
                    {/*     {tradeMarketOptions.map((o) => ( */}
                    {/*         <option key={o.value} value={o.value}>{o.label}</option> */}
                    {/*     ))} */}
                    {/* </select> */}
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_company_id')}</label>
                    <input
                        placeholder={t('th_company_id')}
                        value={form.fund_detail.company_id}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, company_id: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>

                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_company_name')}</label>
                    <input
                        placeholder={t('th_company_name')}
                        value={form.fund_detail.company_name}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, company_name: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_fund_manager')}</label>
                    <input
                        placeholder={t('th_fund_manager')}
                        value={form.fund_detail.fund_manager}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, fund_manager: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_index_code')}</label>
                    <input
                        placeholder={t('th_index_code')}
                        value={form.fund_detail.index_code}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, index_code: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>

                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_index_name')}</label>
                    <input
                        placeholder={t('th_index_name')}
                        value={form.fund_detail.index_name}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, index_name: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-sm font-medium mb-1">{t('th_feature')}</label>
                    <input
                        placeholder={t('th_feature')}
                        value={form.fund_detail.feature}
                        onChange={(e) => setForm({
                            ...form,
                            fund_detail: {...form.fund_detail, feature: e.target.value}
                        })}
                        className="input-field"
                    />
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
                <p className="text-s text-gray-500 mt-1">
                    {t('crawl_hint')}
                </p>
                <button type="button" className="btn-primary" onClick={handleCrawl}>
                    {t('button_crawl_info')}
                </button>
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