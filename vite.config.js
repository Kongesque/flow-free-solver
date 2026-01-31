import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    plugins: [react()],
    base: process.env.GITHUB_ACTIONS ? '/flow-free-solver/' : '/',
    build: {
        outDir: 'dist',
        sourcemap: false,
    },
    server: {
        open: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    define: {
        global: 'globalThis',
    },
    worker: {
        format: 'es',
    },
});
