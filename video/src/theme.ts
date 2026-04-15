// Catppuccin Mocha palette — matches ai-board globals.css
export const colors = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  overlay0: '#8790ab',
  lavender: '#b4befe',
  blue: '#89b4fa',
  sapphire: '#74c7ec',
  sky: '#89dceb',
  teal: '#94e2d5',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  peach: '#fab387',
  peachLight: '#f9cb98',
  maroon: '#eba0ac',
  red: '#f38ba8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
} as const;

export const stageColors = {
  INBOX: colors.overlay0,
  SPECIFY: colors.lavender,
  PLAN: colors.blue,
  BUILD: colors.peachLight,
  VERIFY: colors.flamingo,
  SHIP: colors.green,
} as const;

export const fonts = {
  display: 'Righteous, serif',
  body: 'DM Sans, sans-serif',
  mono: 'JetBrains Mono, monospace',
} as const;

export const VIDEO = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
  TOTAL_FRAMES: 1200,
} as const;

export const SCENES = {
  INTRO:     { from: 0,   duration: 120 },  // 4s
  DASHBOARD: { from: 120, duration: 120 },  // 4s
  KANBAN:    { from: 240, duration: 600 },  // 20s
  RESULTS:   { from: 840, duration: 240 },  // 8s
  OUTRO:     { from: 1080, duration: 120 }, // 4s
} as const;

export function scoreColor(score: number): string {
  if (score >= 90) return colors.green;
  if (score >= 70) return colors.blue;
  if (score >= 50) return colors.yellow;
  return colors.red;
}

export function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}
