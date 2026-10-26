// Paleta categórica validada (dataviz skill): ordem fixa, nunca ciclada.
// slots 1-8, light/dark já passam nos gates de CVD/contraste do validador.
const CATEGORICAL_LIGHT = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
];

const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

const MUTED_LIGHT = '#7d87a8';
const MUTED_DARK = '#7d87a8';

// Tema fixo dark (ver tailwind.config.js) — não acompanha mais o tema do
// navegador/sistema, então essa função sempre resolve pro lado dark da
// paleta, independente do prefers-color-scheme real do dispositivo.
export function isDarkMode() {
  return true;
}

// Cor categórica pela posição (0-indexed) numa lista já ordenada de forma
// estável (ex: sortOrder da pessoa/categoria/cartão). Além do 8º slot,
// cai pra cinza neutro em vez de repetir uma cor (nunca ciclar hue).
export function categoricalColor(index, dark = isDarkMode()) {
  const palette = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  if (index < palette.length) return palette[index];
  return dark ? MUTED_DARK : MUTED_LIGHT;
}

export const CHART_INK = {
  primary: '#eef1fb',
  primaryDark: '#eef1fb',
  secondary: '#aab2cc',
  secondaryDark: '#aab2cc',
  muted: '#7d87a8',
  grid: '#2a3150',
  gridDark: '#2a3150',
  baseline: '#3a4268',
  baselineDark: '#3a4268',
};

export const SEQUENTIAL_BLUE = ['#15325c', '#1d4e89', '#2a78d6', '#5598e7', '#9ec5f4'];

export const STATUS = {
  good: '#34d399',
  warning: '#fbbf63',
  serious: '#fb923c',
  critical: '#f87171',
};
