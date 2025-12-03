import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
        host: '0.0.0.0',
        proxy: {
            // Proxy API requests to the backend Flask server (assuming backend runs on port 5000)
            '/api': 'http://192.168.3.33:5000'
        }
    }
})
