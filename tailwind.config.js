/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"JetBrains Mono"', 'monospace'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                stoic: {
                    bg: '#151716',
                    line: '#272a2b',
                    accent: '#2B9EA8',
                    'accent-hover': '#237D86',
                    primary: '#E6E4DF',
                    secondary: '#8A8E8C',
                    'secondary-hover': '#455050',
                    'block-bg': '#1C1F1E',
                    'block-border': '#3A4240',
                    'block-hover': '#1A1D1C',
                    'inblock-border': '#2D3433',
                },
            },
        },
    },
    plugins: [],
}
