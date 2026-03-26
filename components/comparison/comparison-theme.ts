import { cn } from '@/lib/utils';

export interface ComparisonAccentTheme {
  text: string;
  textSoft: string;
  border: string;
  surface: string;
  surfaceStrong: string;
  pill: string;
  label: string;
  ringFrom: string;
  ringTo: string;
  glow: string;
  barTrack: string;
  barFill: string;
  dot: string;
}

const participantThemes: ComparisonAccentTheme[] = [
  {
    text: 'text-ctp-green',
    textSoft: 'text-ctp-green/80',
    border: 'border-ctp-green/30',
    surface: 'bg-ctp-green/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-green/[0.14] via-ctp-green/[0.06] to-transparent',
    pill: 'border-ctp-green/30 bg-ctp-green/[0.16] text-ctp-green',
    label: 'text-ctp-green/90',
    ringFrom: 'hsl(var(--ctp-green))',
    ringTo: 'hsl(var(--ctp-teal))',
    glow: 'hsl(var(--ctp-green))',
    barTrack: 'bg-ctp-green/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-green via-ctp-green to-ctp-green/20',
    dot: 'bg-ctp-green shadow-[0_0_18px_hsl(var(--ctp-green)/0.45)]',
  },
  {
    text: 'text-ctp-blue',
    textSoft: 'text-ctp-blue/80',
    border: 'border-ctp-blue/30',
    surface: 'bg-ctp-blue/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-blue/[0.14] via-ctp-blue/[0.06] to-transparent',
    pill: 'border-ctp-blue/30 bg-ctp-blue/[0.16] text-ctp-blue',
    label: 'text-ctp-blue/90',
    ringFrom: 'hsl(var(--ctp-blue))',
    ringTo: 'hsl(var(--ctp-sapphire))',
    glow: 'hsl(var(--ctp-blue))',
    barTrack: 'bg-ctp-blue/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-blue via-ctp-blue to-ctp-blue/20',
    dot: 'bg-ctp-blue shadow-[0_0_18px_hsl(var(--ctp-blue)/0.45)]',
  },
  {
    text: 'text-ctp-mauve',
    textSoft: 'text-ctp-mauve/80',
    border: 'border-ctp-mauve/30',
    surface: 'bg-ctp-mauve/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-mauve/[0.14] via-ctp-mauve/[0.06] to-transparent',
    pill: 'border-ctp-mauve/30 bg-ctp-mauve/[0.16] text-ctp-mauve',
    label: 'text-ctp-mauve/90',
    ringFrom: 'hsl(var(--ctp-mauve))',
    ringTo: 'hsl(var(--ctp-lavender))',
    glow: 'hsl(var(--ctp-mauve))',
    barTrack: 'bg-ctp-mauve/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-mauve via-ctp-mauve to-ctp-mauve/20',
    dot: 'bg-ctp-mauve shadow-[0_0_18px_hsl(var(--ctp-mauve)/0.45)]',
  },
  {
    text: 'text-ctp-peach',
    textSoft: 'text-ctp-peach/80',
    border: 'border-ctp-peach/30',
    surface: 'bg-ctp-peach/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-peach/[0.14] via-ctp-peach/[0.06] to-transparent',
    pill: 'border-ctp-peach/30 bg-ctp-peach/[0.16] text-ctp-peach',
    label: 'text-ctp-peach/90',
    ringFrom: 'hsl(var(--ctp-peach))',
    ringTo: 'hsl(var(--ctp-yellow))',
    glow: 'hsl(var(--ctp-peach))',
    barTrack: 'bg-ctp-peach/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-peach via-ctp-peach to-ctp-peach/20',
    dot: 'bg-ctp-peach shadow-[0_0_18px_hsl(var(--ctp-peach)/0.45)]',
  },
  {
    text: 'text-ctp-pink',
    textSoft: 'text-ctp-pink/80',
    border: 'border-ctp-pink/30',
    surface: 'bg-ctp-pink/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-pink/[0.14] via-ctp-pink/[0.06] to-transparent',
    pill: 'border-ctp-pink/30 bg-ctp-pink/[0.16] text-ctp-pink',
    label: 'text-ctp-pink/90',
    ringFrom: 'hsl(var(--ctp-pink))',
    ringTo: 'hsl(var(--ctp-flamingo))',
    glow: 'hsl(var(--ctp-pink))',
    barTrack: 'bg-ctp-pink/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-pink via-ctp-pink to-ctp-pink/20',
    dot: 'bg-ctp-pink shadow-[0_0_18px_hsl(var(--ctp-pink)/0.45)]',
  },
  {
    text: 'text-ctp-yellow',
    textSoft: 'text-ctp-yellow/80',
    border: 'border-ctp-yellow/30',
    surface: 'bg-ctp-yellow/[0.08]',
    surfaceStrong: 'bg-gradient-to-br from-ctp-yellow/[0.14] via-ctp-yellow/[0.06] to-transparent',
    pill: 'border-ctp-yellow/30 bg-ctp-yellow/[0.16] text-ctp-yellow',
    label: 'text-ctp-yellow/90',
    ringFrom: 'hsl(var(--ctp-yellow))',
    ringTo: 'hsl(var(--ctp-peach))',
    glow: 'hsl(var(--ctp-yellow))',
    barTrack: 'bg-ctp-yellow/[0.12]',
    barFill: 'bg-gradient-to-r from-ctp-yellow via-ctp-yellow to-ctp-yellow/20',
    dot: 'bg-ctp-yellow shadow-[0_0_18px_hsl(var(--ctp-yellow)/0.45)]',
  },
];

const winnerTheme = participantThemes[0]!;
const runnerUpTheme = participantThemes[1]!;
const tertiaryTheme = participantThemes[2]!;
const alternateTheme = participantThemes[5]!;

const statThemes: Record<string, ComparisonAccentTheme> = {
  Cost: alternateTheme,
  Duration: runnerUpTheme,
  'Quality Score': winnerTheme,
  'Files Changed': tertiaryTheme,
};

const complianceThemes: Record<string, string> = {
  pass: 'border-ctp-green/30 bg-ctp-green/[0.12] text-ctp-green',
  mixed: 'border-ctp-yellow/30 bg-ctp-yellow/[0.12] text-ctp-yellow',
  fail: 'border-ctp-red/30 bg-ctp-red/[0.12] text-ctp-red',
};

export function getParticipantTheme(rank: number): ComparisonAccentTheme {
  return participantThemes[Math.max(0, Math.min(participantThemes.length - 1, rank - 1))] ?? winnerTheme;
}

export function getStatTheme(label: string): ComparisonAccentTheme {
  return statThemes[label] ?? winnerTheme;
}

export function getDecisionVerdictTheme(
  verdictTicketId: number | null,
  winnerTicketId: number | null
): string {
  if (verdictTicketId == null) {
    return 'border-border/80 bg-background/30 text-muted-foreground';
  }

  return verdictTicketId === winnerTicketId
    ? cn(winnerTheme.border, winnerTheme.surface, winnerTheme.text)
    : cn(alternateTheme.border, alternateTheme.surface, alternateTheme.text);
}

export function getDecisionDotTheme(
  verdictTicketId: number | null,
  winnerTicketId: number | null
): string {
  if (verdictTicketId == null) {
    return 'bg-muted-foreground/30';
  }

  return verdictTicketId === winnerTicketId ? winnerTheme.dot : alternateTheme.dot;
}

export function getComplianceTheme(status: string): string {
  return complianceThemes[status] ?? 'border-border/70 bg-muted/30 text-muted-foreground';
}
