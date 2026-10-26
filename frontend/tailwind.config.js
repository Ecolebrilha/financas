/** @type {import('tailwindcss').Config} */
export default {
  // Tema fixo dark com identidade de cor (navy) — não deve mais trocar
  // sozinho com o tema do navegador/sistema. Estratégia 'class' (em vez
  // de 'media', o padrão) faz as classes `dark:*` só ativarem dentro de
  // um elemento com classe "dark"; essa classe é colocada fixa no <html>
  // (ver index.html) em vez de depender do prefers-color-scheme do SO —
  // assim todo o `dark:*` já usado em cada componente continua valendo
  // (hover, bordas, overlays etc.), só que sempre ativo.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#fcfcfb',
        surfacedk: '#161b2e',
        page: '#f9f9f7',
        pagedk: '#0e1220',
        ink: '#0b0b0b',
        inkdk: '#eef1fb',
        ink2: '#52514e',
        ink2dk: '#aab2cc',
        muted: '#7d87a8',
        grid: '#e1e0d9',
        griddk: '#2a3150',
        baseline: '#c3c2b7',
        baselinedk: '#3a4268',
        good: '#0ca30c',
        gooddk: '#34d399',
        warning: '#fbbf63',
        serious: '#fb923c',
        critical: '#d03b3b',
        criticaldk: '#f87171',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
