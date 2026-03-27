/**
 * Rank-based accent color mapping for comparison dashboard.
 * Returns complete static Tailwind class strings per rank position.
 */

export interface AccentColorSet {
  /** Full-opacity text color (e.g., "text-ctp-green") */
  text: string;
  /** Low-opacity background (e.g., "bg-ctp-green/10") */
  bgSubtle: string;
  /** Medium-opacity background (e.g., "bg-ctp-green/20") */
  bgMedium: string;
  /** Border color (e.g., "border-ctp-green/20") */
  border: string;
  /** Ring/outline (e.g., "ring-ctp-green/30") */
  ring: string;
  /** Box-shadow glow for dots */
  shadow: string;
  /** HSL CSS value for SVG attributes */
  hsl: string;
  /** Human-readable color name */
  label: string;
}

const RANK_COLORS: Record<number, AccentColorSet> = {
  1: {
    text: 'text-ctp-green',
    bgSubtle: 'bg-ctp-green/10',
    bgMedium: 'bg-ctp-green/20',
    border: 'border-ctp-green/20',
    ring: 'ring-ctp-green/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-green))]',
    hsl: 'hsl(var(--ctp-green))',
    label: 'Green',
  },
  2: {
    text: 'text-ctp-blue',
    bgSubtle: 'bg-ctp-blue/10',
    bgMedium: 'bg-ctp-blue/20',
    border: 'border-ctp-blue/20',
    ring: 'ring-ctp-blue/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-blue))]',
    hsl: 'hsl(var(--ctp-blue))',
    label: 'Blue',
  },
  3: {
    text: 'text-ctp-mauve',
    bgSubtle: 'bg-ctp-mauve/10',
    bgMedium: 'bg-ctp-mauve/20',
    border: 'border-ctp-mauve/20',
    ring: 'ring-ctp-mauve/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-mauve))]',
    hsl: 'hsl(var(--ctp-mauve))',
    label: 'Mauve',
  },
  4: {
    text: 'text-ctp-peach',
    bgSubtle: 'bg-ctp-peach/10',
    bgMedium: 'bg-ctp-peach/20',
    border: 'border-ctp-peach/20',
    ring: 'ring-ctp-peach/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-peach))]',
    hsl: 'hsl(var(--ctp-peach))',
    label: 'Peach',
  },
  5: {
    text: 'text-ctp-pink',
    bgSubtle: 'bg-ctp-pink/10',
    bgMedium: 'bg-ctp-pink/20',
    border: 'border-ctp-pink/20',
    ring: 'ring-ctp-pink/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-pink))]',
    hsl: 'hsl(var(--ctp-pink))',
    label: 'Pink',
  },
  6: {
    text: 'text-ctp-yellow',
    bgSubtle: 'bg-ctp-yellow/10',
    bgMedium: 'bg-ctp-yellow/20',
    border: 'border-ctp-yellow/20',
    ring: 'ring-ctp-yellow/30',
    shadow: 'shadow-[0_0_6px_hsl(var(--ctp-yellow))]',
    hsl: 'hsl(var(--ctp-yellow))',
    label: 'Yellow',
  },
};

/** Returns the accent color set for a given rank position (1-6). Falls back to rank 6 for out-of-range. */
export function getAccentColorByRank(rank: number): AccentColorSet {
  return (RANK_COLORS[rank] ?? RANK_COLORS[6]) as AccentColorSet;
}
