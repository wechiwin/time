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
                },
                blob: {
                    '0%': {
                        transform: 'translate(0px, 0px) scale(1)',
                    },
                    '33%': {
                        transform: 'translate(30px, -50px) scale(1.1)',
                    },
                    '66%': {
                        transform: 'translate(-20px, 20px) scale(0.9)',
                    },
                    '100%': {
                        transform: 'translate(0px, 0px) scale(1)',
                    },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease-out',
                'blob': 'blob 7s infinite',
            },
            zIndex: {
                'modal': '50',
                'modal-backdrop': '40',
                'popover': '60', // for datepicker, dropdowns etc.
                'toast': '70', // for toast notifications, always on top
            }
        }
    },
}