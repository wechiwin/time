import {useEffect, useState} from 'react';
import {useToast} from '../context/ToastContext';
import {useTranslation} from "react-i18next";
import MyDate from "../common/MyDate";
import useCommon from "../../hooks/api/useCommon";
import MySelect from "../common/MySelect";
import FormField from "../common/FormField";
import {validateForm} from "../../utils/formValidation";

const INITIAL_FORM_STATE = {
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
};

const REQUIRED_FIELDS = [
    'ho_code',
    'ho_name',
    'ho_short_name',
    'fund_detail.manage_exp_rate',
    'fund_detail.trustee_exp_rate',
    'fund_detail.sales_exp_rate'
];

const ENUM_TYPES = [
    'HoldingTypeEnum',
    'FundTradeMarketEnum',
    'CurrencyEnum',
    'FundDividendMethodEnum',
];

export default function HoldingForm({onSubmit, onClose, initialValues, onCrawl}) {
    const [form, setForm] = useState(INITIAL_FORM_STATE);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const {showSuccessToast, showErrorToast} = useToast();
    const {t} = useTranslation();
    const {fetchMultipleEnumValues} = useCommon();

    const [hoTypeOptions, setHoTypeOptions] = useState([]);
    const [tradeMarketOptions, setTradeMarketOptions] = useState([]);
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [dividendOptions, setDividendOptions] = useState([]);

    useEffect(() => {
        const loadEnumValues = async () => {
            try {
                const [typeOptions, marketOptions, currencyOptions, dividendOptions] =
                    await fetchMultipleEnumValues(ENUM_TYPES);
                setHoTypeOptions(typeOptions);
                setTradeMarketOptions(marketOptions);
                setCurrencyOptions(currencyOptions);
                setDividendOptions(dividendOptions);
            } catch (err) {
                console.error('Failed to load enum values:', err);
                showErrorToast(t('msg_failed_to_load_enum'));
            }
        };
        loadEnumValues();
    }, [fetchMultipleEnumValues, showErrorToast]);

    const handleFieldChange = (field, value) => {
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            setForm(prev => ({
                ...prev,
                [parent]: {...prev[parent], [child]: value}
            }));
        } else {
            setForm(prev => ({...prev, [field]: value}));
        }

        if (errors[field]) {
            setErrors(prev => {
                const {[field]: _, ...rest} = prev;
                return rest;
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const {isValid, errors: newErrors} = validateForm(form, REQUIRED_FIELDS, t);

        if (!isValid) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(form);
            setForm(INITIAL_FORM_STATE);
            showSuccessToast();
            onClose();
        } catch (err) {
            showErrorToast(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCrawl = () => {
        if (!form.ho_code) return showErrorToast(t('code_required_prompt'));
        onCrawl(form.ho_code, (patch) =>
            setForm(prev => ({...prev, ...patch}))
        );
    };

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
                <FormField label={t('th_ho_code')} error={errors['ho_code']} required>
                    <input
                        placeholder={t('th_ho_code')}
                        value={form.ho_code}
                        onChange={(e) => handleFieldChange('ho_code', e.target.value)}
                        className={`input-field ${initialValues?.id ? 'read-only-input' : ''}`}
                        readOnly={!!initialValues?.id}
                    />
                </FormField>

                <FormField
                    label={t('th_ho_name')}
                    error={errors['ho_name']}
                    required
                >
                    <input
                        placeholder={t('th_ho_name')}
                        value={form.ho_name}
                        onChange={(e) => handleFieldChange('ho_name', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField
                    label={t('th_ho_short_name')}
                    error={errors['ho_short_name']}
                    required
                >
                    <input
                        placeholder={t('th_ho_short_name')}
                        value={form.ho_short_name}
                        onChange={(e) => handleFieldChange('ho_short_name', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                {/* 非必填项，不传 error 和 required 即可 */}
                <FormField label={t('th_ho_nickname')}>
                    <input
                        placeholder={t('th_ho_nickname')}
                        value={form.ho_nickname}
                        onChange={(e) => handleFieldChange('ho_nickname', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_ho_type')}>
                    <MySelect
                        options={hoTypeOptions}
                        value={form.ho_type}
                        onChange={(val) => handleFieldChange('ho_type', val)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_ho_establish_date')}>
                    <MyDate
                        value={form.establishment_date}
                        onChange={(dateStr) => handleFieldChange('establishment_date', dateStr)}
                        className="input-field"
                    />
                </FormField>

                {/* 嵌套字段示例 */}
                <FormField
                    label={t('th_ho_manage_exp_rate')}
                    error={errors['fund_detail.manage_exp_rate']}
                    required
                >
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_manage_exp_rate')}
                        value={form.fund_detail.manage_exp_rate}
                        onChange={(e) => handleFieldChange('fund_detail.manage_exp_rate', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField
                    label={t('th_ho_trustee_exp_rate')}
                    error={errors['fund_detail.trustee_exp_rate']}
                    required
                >
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_trustee_exp_rate')}
                        value={form.fund_detail.trustee_exp_rate}
                        onChange={(e) => handleFieldChange('fund_detail.trustee_exp_rate', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField
                    label={t('th_ho_sales_exp_rate')}
                    error={errors['fund_detail.sales_exp_rate']}
                    required
                >
                    <input
                        type="number"
                        step="0.0001"
                        placeholder={t('th_ho_sales_exp_rate')}
                        value={form.fund_detail.sales_exp_rate}
                        onChange={(e) => handleFieldChange('fund_detail.sales_exp_rate', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_currency')}>
                    <MySelect
                        options={currencyOptions}
                        value={form.currency}
                        onChange={(val) => handleFieldChange('currency', val)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_risk_level')}>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        placeholder={t('th_risk_level')}
                        value={form.fund_detail.risk_level}
                        onChange={(e) => handleFieldChange('fund_detail.risk_level', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_fund_type')}>
                    <input
                        placeholder={t('th_fund_type')}
                        value={form.fund_detail.fund_type}
                        onChange={(e) => handleFieldChange('fund_detail.fund_type', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_trade_market')}>
                    <MySelect
                        options={tradeMarketOptions}
                        value={form.fund_detail.trade_market}
                        onChange={(val) => handleFieldChange('fund_detail.trade_market', val)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_dividend_method')}>
                    <MySelect
                        options={dividendOptions}
                        value={form.fund_detail.dividend_method}
                        onChange={(val) => handleFieldChange('fund_detail.dividend_method', val)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_company_id')}>
                    <input
                        placeholder={t('th_company_id')}
                        value={form.fund_detail.company_id}
                        onChange={(e) => handleFieldChange('fund_detail.company_id', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_company_name')}>
                    <input
                        placeholder={t('th_company_name')}
                        value={form.fund_detail.company_name}
                        onChange={(e) => handleFieldChange('fund_detail.company_name', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_fund_manager')}>
                    <input
                        placeholder={t('th_fund_manager')}
                        value={form.fund_detail.fund_manager}
                        onChange={(e) => handleFieldChange('fund_detail.fund_manager', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_index_code')}>
                    <input
                        placeholder={t('th_index_code')}
                        value={form.fund_detail.index_code}
                        onChange={(e) => handleFieldChange('fund_detail.index_code', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_index_name')}>
                    <input
                        placeholder={t('th_index_name')}
                        value={form.fund_detail.index_name}
                        onChange={(e) => handleFieldChange('fund_detail.index_name', e.target.value)}
                        className="input-field"
                    />
                </FormField>

                <FormField label={t('th_feature')}>
                    <input
                        placeholder={t('th_feature')}
                        value={form.fund_detail.feature}
                        onChange={(e) => handleFieldChange('fund_detail.feature', e.target.value)}
                        className="input-field"
                    />
                </FormField>
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
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}