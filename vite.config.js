import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: '/flow-free-solver/',
    build: {
        outDir: 'dist',
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
