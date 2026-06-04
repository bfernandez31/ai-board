import { TokenSavingOutcome } from '@prisma/client';

/**
 * Static label/icon/description/class helpers for the token-saving feature (AIB-849).
 *
 * Two concerns:
 *  - The effective-ON header badge (US4): a single ON state.
 *  - The per-job outcome indicator (US2, jobs-timeline): ACTIVE / INACTIVE / FELL_BACK.
 *
 * All Tailwind classes are full literal strings (CLAUDE.md: never construct class
 * names dynamically — the purger only sees complete string literals).
 */

// ---------------------------------------------------------------------------
// Effective-ON badge (US4)
// ---------------------------------------------------------------------------

/** Icon for the effective-ON token-saving badge. */
export function getTokenSavingIcon(): string {
  return '🪙';
}

/** Label for the effective-ON token-saving badge. */
export function getTokenSavingLabel(): string {
  return 'Token saving';
}

/**
 * Tooltip description for the effective-ON badge.
 * @param isOverride - true when the ON value comes from a ticket override (not the project default)
 */
export function getTokenSavingDescription(isOverride: boolean): string {
  return isOverride
    ? 'Token saving ON (ticket override)'
    : 'Token saving ON (inherited from project default)';
}

// ---------------------------------------------------------------------------
// Per-job outcome indicator (US2)
// ---------------------------------------------------------------------------

interface OutcomeDisplay {
  icon: string;
  label: string;
  description: string;
  /** Full literal Tailwind class string (text + background) for the indicator chip. */
  className: string;
}

const OUTCOME_DISPLAY: Record<TokenSavingOutcome, OutcomeDisplay> = {
  [TokenSavingOutcome.ACTIVE]: {
    icon: '🪙',
    label: 'Token saving active',
    description: 'RTK installed and output compression hook active for this run',
    className: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950',
  },
  [TokenSavingOutcome.INACTIVE]: {
    icon: '—',
    label: 'Token saving inactive',
    description: 'Token saving was off or the agent is not Claude — no compression attempted',
    className: 'text-muted-foreground bg-muted',
  },
  [TokenSavingOutcome.FELL_BACK]: {
    icon: '⚠️',
    label: 'Token saving fell back',
    description: 'Token saving was on but RTK activation failed — the run continued without compression',
    className: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950',
  },
};

/** Display metadata for a per-job token-saving outcome. */
export function getTokenSavingOutcomeDisplay(outcome: TokenSavingOutcome): OutcomeDisplay {
  return OUTCOME_DISPLAY[outcome];
}
