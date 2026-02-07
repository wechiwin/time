import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import MyDate from "../common/MyDate";
import useCommon from "../../hooks/api/useCommon";
import MySelect from "../common/MySelect";

// 移动端专用表单组件
export default function HoldingFormMobile({onSubmit, onClose, initialValues, onCrawl}) {
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
    const {t} = useTranslation();
    const {fetchMultipleEnumValues} = useCommon();
    const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [tradeMarketOptions, setTradeMarketOptions] = useState([]);
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [dividendOptions, setDividendOptions] = useState([]);

    // Hooks for fetching data and handling form state
    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [typeOptions, marketOptions, currencyOptions, dividendOptions] = await fetchMultipleEnumValues([
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.ho_code || !form.ho_name) {
            showErrorToast('基金代码和名称不能为空');
            return;
        }
        try {
            await onSubmit(form);
            showSuccessToast();
        } catch (err) {
            showErrorToast(err.message);
        }
    };

    const handleCrawl = () => {
        if (!form.ho_code) return showErrorToast(t('code_required_prompt'));
        onCrawl(form.ho_code, (patch) => setForm((prev) => ({...prev, ...patch})));
    };

    // 渲染单个字段的辅助函数
    const renderField = (label, input) => (
        <div className="flex flex-col justify-center">
            <label className="text-[11px] font-medium mb-1 text-gray-500 dark:text-gray-400 truncate">{label}</label>
            <div className="min-h-[38px] flex items-center">
                {input}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col min-h-0">
            <form onSubmit={handleSubmit} className="flex flex-col">
                {/*
               表单内容区域
               1. 移除了 h-full 和 overflow-y-auto，让内容自然撑开高度
               2. 移除了 pb-24，因为按钮不再遮挡内容
            */}
                <div className="space-y-4">

                    {/* Card for Basic Information */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">基础信息</h3>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {renderField('持仓代码',
                                    <input placeholder="代码" value={form.ho_code}
                                           onChange={(e) => setForm({...form, ho_code: e.target.value})} required
                                           className={`w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 ${initialValues?.id ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}
                                           readOnly={!!initialValues?.id}/>
                                )}
                                {renderField(t('th_ho_name'),
                                    <input placeholder={t('th_ho_name')} value={form.ho_name}
                                           onChange={(e) => setForm({...form, ho_name: e.target.value})} required
                                           className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                                {renderField(t('th_ho_short_name'),
                                    <input placeholder={t('th_ho_short_name')} value={form.ho_short_name}
                                           onChange={(e) => setForm({...form, ho_short_name: e.target.value})}
                                           className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                                {renderField(t('th_ho_nickname'),
                                    <input placeholder={t('th_ho_nickname')} value={form.ho_nickname}
                                           onChange={(e) => setForm({...form, ho_nickname: e.target.value})}
                                           className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card for Core Attributes */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">核心属性</h3>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {renderField(t('th_ho_type'),
                                    <MySelect options={hoTypeOptions} value={form.ho_type}
                                              onChange={(val) => setForm({...form, ho_type: val})}
                                              className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1"/>
                                )}
                                {renderField(t('th_currency'),
                                    <MySelect options={currencyOptions} value={form.currency}
                                              onChange={(val) => setForm({...form, currency: val})}
                                              className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1"/>
                                )}
                                {renderField(t('th_ho_establish_date'),
                                    <MyDate value={form.establishment_date}
                                            onChange={(dateStr) => setForm({...form, establishment_date: dateStr})}
                                            className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1"/>
                                )}
                                {renderField(t('th_risk_level'),
                                    <input type="number" min="1" max="5" placeholder="1-5"
                                           value={form.fund_detail.risk_level} onChange={(e) => setForm({
                                        ...form,
                                        fund_detail: {...form.fund_detail, risk_level: e.target.value}
                                    })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card for Fee Structure */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">费率结构 (%)</h3>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {renderField(t('th_ho_manage_exp_rate'),
                                    <input type="number" step="0.0001" placeholder="管理费"
                                           value={form.fund_detail.manage_exp_rate} onChange={(e) => setForm({
                                        ...form,
                                        fund_detail: {...form.fund_detail, manage_exp_rate: e.target.value}
                                    })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                                {renderField(t('th_ho_trustee_exp_rate'),
                                    <input type="number" step="0.0001" placeholder="托管费"
                                           value={form.fund_detail.trustee_exp_rate} onChange={(e) => setForm({
                                        ...form,
                                        fund_detail: {...form.fund_detail, trustee_exp_rate: e.target.value}
                                    })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                                {renderField(t('th_ho_sales_exp_rate'),
                                    <input type="number" step="0.0001" placeholder="销售服务费"
                                           value={form.fund_detail.sales_exp_rate} onChange={(e) => setForm({
                                        ...form,
                                        fund_detail: {...form.fund_detail, sales_exp_rate: e.target.value}
                                    })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card for Advanced Details */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">其他信息</h3>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                {renderField(t('th_trade_market'),
                                    <MySelect options={tradeMarketOptions} value={form.fund_detail.trade_market}
                                              onChange={(val) => setForm({
                                                  ...form,
                                                  fund_detail: {...form.fund_detail, trade_market: val}
                                              })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1"/>
                                )}
                                {renderField(t('th_dividend_method'),
                                    <MySelect options={dividendOptions} value={form.fund_detail.dividend_method}
                                              onChange={(val) => setForm({
                                                  ...form,
                                                  fund_detail: {...form.fund_detail, dividend_method: val}
                                              })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1"/>
                                )}
                                {renderField(t('th_company_name'),
                                    <input placeholder={t('th_company_name')} value={form.fund_detail.company_name}
                                           onChange={(e) => setForm({
                                               ...form,
                                               fund_detail: {...form.fund_detail, company_name: e.target.value}
                                           })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                                {renderField(t('th_fund_manager'),
                                    <input placeholder={t('th_fund_manager')} value={form.fund_detail.fund_manager}
                                           onChange={(e) => setForm({
                                               ...form,
                                               fund_detail: {...form.fund_detail, fund_manager: e.target.value}
                                           })} className="w-full text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none py-1 text-gray-900 dark:text-gray-100"/>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/*
               底部按钮区域
               1. 移除了 absolute，改为正常流布局，使其跟随滚动
               2. -mx-4: 抵消 Modal 内容区域的 padding (p-4)，使背景延伸到边缘
               3. -mb-4: 抵消 Modal 内容区域的底部 padding，使按钮贴合 Modal 底部圆角
               4. px-4: 恢复按钮内容的左右内边距，保持美观
            */}
                <div className="mt-4 -mx-4 -mb-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 p-4 z-20 rounded-b-xl">
                    <div className="max-w-md mx-auto space-y-3">
                        <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
                            输入代码后，点击爬取可自动填充信息
                        </p>
                        <button type="button" className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-colors" onClick={handleCrawl}>
                            {t('button_crawl_info')}
                        </button>
                        <div className="flex gap-3">
                            <button type="button" className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors" onClick={onClose}>
                                {t('button_cancel')}
                            </button>
                            <button type="submit" className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg shadow-sm transition-colors">
                                {t('button_confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );

}
