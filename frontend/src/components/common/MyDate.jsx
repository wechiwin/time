import React from 'react'
import DatePicker, {registerLocale} from 'react-datepicker'
import {useTranslation} from 'react-i18next'
import zhCN from 'date-fns/locale/zh-CN'
import enUS from 'date-fns/locale/en-US'
import it from 'date-fns/locale/it'
import 'react-datepicker/dist/react-datepicker.css'
import useDarkMode from "../../hooks/useDarkMode";
import {toDate, toString} from '../../utils/timeUtil';

/* 把可能用到的语言一次性注册 */
registerLocale('zh', zhCN)
registerLocale('en', enUS)
registerLocale('it', it)

const localeMap = {zh: zhCN, en: enUS, it}

export default function MyDate({
                                   value,          // "YYYY-MM-DD" 字符串
                                   onChange,       // (dateStr: string) => void
                                   label,          // 不传就默认用 t('th_nav_date')
                                   placeholder,
                                   ...rest         // 其余原生属性 min/max/disabled/className 等
                               }) {
    const {i18n, t} = useTranslation()
    const {dark} = useDarkMode(); // 获取当前暗黑模式状态

    return (
        <div className="flex flex-col">
            <DatePicker
                selected={toDate(value)}
                onChange={(d) => onChange(toString(d))}
                dateFormat="yyyy-MM-dd"
                locale={localeMap[i18n.language] || enUS}
                placeholderText={placeholder || t('msg_mydate_select_date')}
                className={`input-field ${rest.className || ''}`}
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                calendarClassName={dark ? "dark" : ""}
                {...rest}
            />
        </div>
    )
}