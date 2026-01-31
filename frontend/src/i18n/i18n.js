import i18n from 'i18next'
import {initReactI18next} from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        lng: 'en',
        fallbackLng: 'en',
        supportedLngs: ['zh', 'it', 'en'],
        debug: true,
        // 防止 XSS 攻击
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}/common.json', // 修正路径
        },
        // // 添加默认命名空间
        // defaultNS: 'common',
        // // 添加这些配置
        // ns: ['common'],
        // // 禁用键降级
        // saveMissing: false,
        // parseMissingKeyHandler: (key) => {
        //     console.warn('Missing translation:', key)
        //     return key
        // }
        detection: {
            // 检测顺序：先检查localStorage，然后是其他检测方式
            order: ['localStorage', 'querystring', 'cookie', 'navigator'],
            // 使用localStorage来缓存用户选择
            caches: ['localStorage'],

            // localStorage的配置选项
            lookupLocalStorage: 'i18nextLng',

            // 可选：当localStorage中未找到时是否检查cookie
            lookupCookie: 'i18next',

            // 可选：设置cookie过期时间（单位：天）
            cookieMinutes: 10,
            cookieDomain: window.location.hostname,

            // 可选：设置html标签的lang属性
            htmlTag: document.documentElement
        },

    })
// 确保保存语言选择到localStorage
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('i18nextLng', lng);
});
export default i18n