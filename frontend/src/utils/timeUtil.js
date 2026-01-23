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
    return date ? date.toISOString().slice(0, 10) : '';
}
