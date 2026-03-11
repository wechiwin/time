// src/components/forms/CalculateAllForm.jsx
import {useCallback, useEffect, useState} from 'react';
import {useTranslation} from "react-i18next";
import MyDate from "../common/MyDate";
import FormField from "../common/FormField";
import {validateForm} from "../../utils/formValidation";
import useAsyncTaskLogList from "../../hooks/api/useAsyncTaskLogList";

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

export default function CalculateAllForm({onSubmit, onClose, initialValues}) {
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        start_date: initialValues.start_date || '',
        end_date: initialValues.end_date || ''
    });

    const [quickDates, setQuickDates] = useState({
        firstTradeDate: '',
        lastSnapshotDate: ''
    });

    const {getDateInfo} = useAsyncTaskLogList({autoLoad: false});
    const {t} = useTranslation();

    // Fetch date info on mount
    useEffect(() => {
        const fetchDateInfo = async () => {
            try {
                const info = await getDateInfo();
                if (info) {
                    setQuickDates({
                        firstTradeDate: info.first_trade_date || '',
                        lastSnapshotDate: info.last_snapshot_date || ''
                    });
                }
            } catch (err) {
                console.error('Failed to fetch date info:', err);
            }
        };
        fetchDateInfo();
    }, [getDateInfo]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        // Define required fields - dates are optional, backend will use defaults
        const requiredFields = [];
        const {isValid: isRequiredValid, errors: requiredErrors} = validateForm(formData, requiredFields, t);

        // Validate date logic
        let isLogicValid = true;
        const logicErrors = {};
        if (formData.start_date && formData.end_date) {
            if (new Date(formData.end_date) < new Date(formData.start_date)) {
                isLogicValid = false;
                logicErrors.end_date = t('end_date_cannot_be_earlier_than_start_date');
            }
        }

        const allErrors = {...requiredErrors, ...logicErrors};
        const isFormValid = isRequiredValid && isLogicValid;
        if (!isFormValid) {
            setErrors(allErrors);
            return;
        }

        setIsSubmitting(true);
        onSubmit(formData);
        setIsSubmitting(false);
    };

    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user modifies the field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [errors]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6 p-1">
            <FormField label={t('start_date')} error={errors['start_date']}>
                <div className="flex flex-wrap items-center gap-2">
                    <MyDate
                        value={formData.start_date}
                        onChange={(dateStr) => handleChange('start_date', dateStr)}
                        className="input-field py-1.5 w-42"
                    />
                    {/* Quick selection buttons for start date */}
                    {quickDates.firstTradeDate && (
                        <button
                            type="button"
                            className="btn-subtle"
                            onClick={() => handleChange('start_date', quickDates.firstTradeDate)}
                        >
                            {t('first_trade_date')} ({quickDates.firstTradeDate})
                        </button>
                    )}
                    {quickDates.lastSnapshotDate && (
                        <button
                            type="button"
                            className="btn-subtle"
                            onClick={() => handleChange('start_date', quickDates.lastSnapshotDate)}
                        >
                            {t('last_snapshot_date')} ({quickDates.lastSnapshotDate})
                        </button>
                    )}
                </div>
            </FormField>

            <FormField label={t('end_date')} error={errors['end_date']}>
                <div className="flex flex-wrap items-center gap-2">
                    <MyDate
                        value={formData.end_date}
                        onChange={(dateStr) => handleChange('end_date', dateStr)}
                        className="input-field py-1.5 w-42"
                    />
                    {/* Quick selection button for end date */}
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
                    disabled={isSubmitting}
                >
                    {t('button_confirm')}
                </button>
            </div>
        </form>
    );
}
