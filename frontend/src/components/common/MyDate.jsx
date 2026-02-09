import React from 'react'
import DatePicker, {registerLocale} from 'react-datepicker'
import {useTranslation} from 'react-i18next'
import zhCN from 'date-fns/locale/zh-CN'
import enUS from 'date-fns/locale/en-US'
import it from 'date-fns/locale/it'
import 'react-datepicker/dist/react-datepicker.css'
import '../../index.css'
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
                                   label,
                                   placeholder,
                                   ...rest         // 其余原生属性 min/max/disabled/className 等
                               }) {
    const {i18n, t} = useTranslation()
    const {isDarkMode} = useDarkMode(); // 获取当前暗黑模式状态
    const handleChange = (date) => {
        // 如果 date 为 null (用户清空输入)，则传递 null
        // 如果是有效日期，则转换为 "YYYY-MM-DD" 字符串
        onChange(date ? toString(date) : null);
    };
    return (
        <div className="flex flex-col">
            <DatePicker
                selected={toDate(value)}
                onChange={handleChange}
                dateFormat="yyyy-MM-dd"
                locale={localeMap[i18n.language] || enUS}
                placeholderText={placeholder || t('msg_mydate_select_date')}
                className={`input-field ${rest.className || ''}`}
                calendarClassName={isDarkMode ? "dark" : ""}
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                isClearable
                portalId="datepicker-portal"
                popperClassName="z-popover"
                {...rest}
            />
        </div>
    )
}