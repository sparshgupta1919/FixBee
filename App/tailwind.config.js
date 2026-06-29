/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#4991ff',
                'primary-hover': '#357ae8',
                secondary: '#10B981',
                'background-light': '#f6f6f8',
                'background-dark': '#111221',
                'surface-light': '#ffffff',
                'surface-dark': '#1f1f2e',
                'bee-yellow': '#FDC938',
                'bee-dark': '#022054',
            },
            fontFamily: {
                display: ['Inter', 'sans-serif'],
                outfit: ['Outfit', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '0.25rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                full: '9999px',
            },
        },
    },
    plugins: [],
}
