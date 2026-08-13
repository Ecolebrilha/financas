/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#fcfcfb',
        surfacedk: '#1a1a19',
        page: '#f9f9f7',
        pagedk: '#0d0d0d',
        ink: '#0b0b0b',
        inkdk: '#ffffff',
        ink2: '#52514e',
        ink2dk: '#c3c2b7',
        muted: '#898781',
        grid: '#e1e0d9',
        griddk: '#2c2c2a',
        baseline: '#c3c2b7',
        baselinedk: '#383835',
        good: '#0ca30c',
        gooddk: '#0ca30c',
        warning: '#fab219',
        serious: '#ec835a',
        critical: '#d03b3b',
        criticaldk: '#e66767',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
