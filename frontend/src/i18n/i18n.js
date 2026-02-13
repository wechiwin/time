import i18n from 'i18next'
import {initReactI18next} from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
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
            // 仅使用localStorage来检测和存储用户选择
            order: ['localStorage'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },

    })
// 确保保存语言选择到localStorage
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('i18nextLng', lng);
});
export default i18n