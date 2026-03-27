/**
 * Participant color assignments by rank for comparison dashboard.
 * Each rank gets a unique Catppuccin accent color used consistently
 * across gauges, bars, badges, and decision point verdicts.
 *
 * All class strings are complete literals for Tailwind purge compatibility.
 */

export interface ParticipantColorSet {
  /** Text color class */
  text: string;
  /** Background at ~10% opacity */
  bgSubtle: string;
  /** Background at ~20% opacity */
  bgMedium: string;
  /** Border at ~20% opacity */
  border: string;
  /** HSL stroke value for SVG */
  stroke: string;
  /** Box-shadow glow color (CSS value) */
  glow: string;
  /** Gradient bar: from-color class */
  gradientFrom: string;
}

const RANK_COLORS: ParticipantColorSet[] = [
  // Rank 1 (Winner): green
  {
    text: 'text-ctp-green',
    bgSubtle: 'bg-ctp-green/10',
    bgMedium: 'bg-ctp-green/20',
    border: 'border-ctp-green/20',
    stroke: 'hsl(var(--ctp-green))',
    glow: '0 0 12px hsl(var(--ctp-green) / 0.4)',
    gradientFrom: 'from-ctp-green/80',
  },
  // Rank 2: blue
  {
    text: 'text-ctp-blue',
    bgSubtle: 'bg-ctp-blue/10',
    bgMedium: 'bg-ctp-blue/20',
    border: 'border-ctp-blue/20',
    stroke: 'hsl(var(--ctp-blue))',
    glow: '0 0 12px hsl(var(--ctp-blue) / 0.4)',
    gradientFrom: 'from-ctp-blue/80',
  },
  // Rank 3: mauve/purple
  {
    text: 'text-ctp-mauve',
    bgSubtle: 'bg-ctp-mauve/10',
    bgMedium: 'bg-ctp-mauve/20',
    border: 'border-ctp-mauve/20',
    stroke: 'hsl(var(--ctp-mauve))',
    glow: '0 0 12px hsl(var(--ctp-mauve) / 0.4)',
    gradientFrom: 'from-ctp-mauve/80',
  },
  // Rank 4: peach/orange
  {
    text: 'text-ctp-peach',
    bgSubtle: 'bg-ctp-peach/10',
    bgMedium: 'bg-ctp-peach/20',
    border: 'border-ctp-peach/20',
    stroke: 'hsl(var(--ctp-peach))',
    glow: '0 0 12px hsl(var(--ctp-peach) / 0.4)',
    gradientFrom: 'from-ctp-peach/80',
  },
  // Rank 5: flamingo/pink
  {
    text: 'text-ctp-flamingo',
    bgSubtle: 'bg-ctp-flamingo/10',
    bgMedium: 'bg-ctp-flamingo/20',
    border: 'border-ctp-flamingo/20',
    stroke: 'hsl(var(--ctp-flamingo))',
    glow: '0 0 12px hsl(var(--ctp-flamingo) / 0.4)',
    gradientFrom: 'from-ctp-flamingo/80',
  },
  // Rank 6: yellow
  {
    text: 'text-ctp-yellow',
    bgSubtle: 'bg-ctp-yellow/10',
    bgMedium: 'bg-ctp-yellow/20',
    border: 'border-ctp-yellow/20',
    stroke: 'hsl(var(--ctp-yellow))',
    glow: '0 0 12px hsl(var(--ctp-yellow) / 0.4)',
    gradientFrom: 'from-ctp-yellow/80',
  },
];

/** Get the color set for a participant by 1-based rank. Falls back to last color for rank > 6. */
export function getParticipantColor(rank: number): ParticipantColorSet {
  const index = Math.max(0, Math.min(rank - 1, RANK_COLORS.length - 1));
  return RANK_COLORS[index]!;
}

/** Stat card color themes: Cost (yellow), Duration (blue), Quality (green), Files (mauve) */
export const STAT_CARD_COLORS = [
  {
    text: 'text-ctp-yellow',
    bgSubtle: 'bg-ctp-yellow/10',
    border: 'border-ctp-yellow/20',
    bar: 'bg-ctp-yellow',
  },
  {
    text: 'text-ctp-blue',
    bgSubtle: 'bg-ctp-blue/10',
    border: 'border-ctp-blue/20',
    bar: 'bg-ctp-blue',
  },
  {
    text: 'text-ctp-green',
    bgSubtle: 'bg-ctp-green/10',
    border: 'border-ctp-green/20',
    bar: 'bg-ctp-green',
  },
  {
    text: 'text-ctp-mauve',
    bgSubtle: 'bg-ctp-mauve/10',
    border: 'border-ctp-mauve/20',
    bar: 'bg-ctp-mauve',
  },
] as const;
