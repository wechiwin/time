import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'zh',
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
            order: ['querystring', 'cookie', 'localStorage', 'navigator'],
            caches: ['cookie'],
        },

    })

export default i18n