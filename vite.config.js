import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import restart from 'vite-plugin-restart'

export default defineConfig({
    root: 'src/',
    publicDir: '../static/',
    plugins: [
        react(),
        restart({ restart: ['../static/**'] })
    ],
    server: {
        host: true,
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env)
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: true
    }
})