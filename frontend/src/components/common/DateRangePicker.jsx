import React, {useEffect, useState} from 'react';
import Datepicker from 'react-tailwindcss-datepicker';
import {useTranslation} from 'react-i18next';
import PropTypes from 'prop-types';

export default function DateRangePicker({value, onChange, placeholder}) {
    const {t, i18n} = useTranslation();
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    useEffect(() => {
        const handleLanguageChange = (lng) => {
            setCurrentLanguage(lng);
        };

        i18n.on('languageChanged', handleLanguageChange);
        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, [i18n]);
    // 1.6.6 版本严格要求 value 必须是对象，不能是 null/undefined
    // 且内部属性必须存在，即使是 null
    const safeValue = {
        startDate: value?.startDate || null,
        endDate: value?.endDate || null
    };

    const handleValueChange = (newValue) => {
        // 防止库返回 null
        if (!newValue) {
            onChange({startDate: null, endDate: null});
        } else {
            onChange(newValue);
        }
    };
    const getDatepickerLanguage = () => {
        switch (currentLanguage) {
            case 'zh':
                return 'zh-CN';
            case 'en':
                return 'en';
            case 'it':
                return 'it';
            default:
                return 'en'; // 默认英语
        }
    };

    return (
        <div className="w-full relative z-20">
            <Datepicker
                value={safeValue}
                onChange={handleValueChange}
                showShortcuts={true}
                i18n={getDatepickerLanguage()}
                configs={{
                    shortcuts: {
                        today: t('today') || "今天",
                        yesterday: t('yesterday') || "昨天",
                        past: (period) => `${t('past') || '近'} ${period} ${t('days') || '天'}`,
                        currentMonth: t('current_month') || "本月",
                        pastMonth: t('past_month') || "上个月",
                    }
                }}
                placeholder={placeholder || t('msg_select_date_range') || "选择日期范围"}
                inputClassName="w-full h-[42px] rounded-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                toggleClassName="absolute right-0 h-full px-3 text-gray-400 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                containerClassName="relative w-full"
                useRange={false}
                asSingle={false}
                primaryColor={"blue"}
            />
        </div>
    );
}

DateRangePicker.propTypes = {
    value: PropTypes.shape({
        startDate: PropTypes.string,
        endDate: PropTypes.string
    }),
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string
};
