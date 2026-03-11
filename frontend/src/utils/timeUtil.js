// frontend/src/utils/timeUtil.js
import dayjs from 'dayjs';

/**
 * 获取当前时间字符串（YYYY-MM-DD HH:mm:ss）
 */
export function now() {
    return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 字符串 -> Date
 * @param {string|undefined|null} str
 * @returns {Date|null}
 */
export function toDate(str) {
    return str ? new Date(str) : null;
}

/**
 * Date -> 'YYYY-MM-DD'
 * @param {Date|undefined|null} date
 * @returns {string}
 */
export function toString(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 4. 辅助函数：获取昨天的日期（YYYY-MM-DD 格式）
 */
export function getYesterdayDateString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

export function getYearString() {
    return new Date().getFullYear().toString();
}