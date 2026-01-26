import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
        plugins: [react()],
        // Configure the build process
        build: {
            // Explicitly set the input for Rollup to the index.html file.
            // This tells Vite/Rollup where to find the main HTML file for building.
            // `__dirname` refers to the directory where vite.config.js is located (i.e., 'frontend').
            // `path.resolve` then constructs the absolute path to 'public/index.html' from there.
            // rollupOptions: {
            //     input: path.resolve(__dirname, 'public/index.html')
            // },
            // Specify the output directory for the build (default is 'dist', but explicit is good)
            outDir: 'dist'
        },
        server: {
            // 是对外的，它让你的前端开发服务器在局域网上可见。
            host: '0.0.0.0',
            proxy: {
                // Proxy API requests to the backend Flask server (assuming backend runs on port 5000)
                '/time': {
                    target: env.VITE_API_TARGET_URL,
                    changeOrigin: true,
                    secure: false,
                    headers: {
                        'Connection': 'keep-alive'
                    },
                    configure: (proxy, options) => {
                        proxy.on('proxyRes', (proxyRes, req, res) => {
                            // 确保所有头部都被传递
                            Object.keys(proxyRes.headers).forEach((key) => {
                                res.setHeader(key, proxyRes.headers[key]);
                            });
                        });
                    }
                }
            }
        }
    }
})