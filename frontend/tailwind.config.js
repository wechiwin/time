module.exports = {
    darkMode: 'class', // 启用手动切换暗黑模式
    content: [
        "./index.html",
        "./src/**/*.{js,jsx,ts,tsx}",
        "./node_modules/@heroicons/react/**/*.{js,ts,jsx,tsx}",
        "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js"
    ],
    theme: {
        extend: {
            keyframes: {
                'fade-in': {
                    '0%': {opacity: '0', transform: 'translateY(10px)'},
                    '100%': {opacity: '1', transform: 'translateY(0)'}
                }
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease-out'
            }
        }
    },
}