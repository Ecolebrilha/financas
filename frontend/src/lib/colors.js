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

const MUTED_LIGHT = '#898781';
const MUTED_DARK = '#898781';

export function isDarkMode() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  primary: '#0b0b0b',
  primaryDark: '#ffffff',
  secondary: '#52514e',
  secondaryDark: '#c3c2b7',
  muted: '#898781',
  grid: '#e1e0d9',
  gridDark: '#2c2c2a',
  baseline: '#c3c2b7',
  baselineDark: '#383835',
};

export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95'];

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};
