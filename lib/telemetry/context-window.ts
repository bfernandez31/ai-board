/**
 * Model context-window registry and per-turn peak threshold helpers.
 *
 * Centralizes the mapping from a `Job.model` string to the model's max context
 * window so that UI surfaces (timeline pill, analytics histogram) can derive
 * a percent-of-window value and a threshold state ('healthy' / 'warning' /
 * 'danger' / 'unknown') without each surface duplicating the lookup table or
 * the threshold constants.
 *
 * Threshold constants come from research.md D-004 (conservative defaults).
 */

export type PeakContextState = 'healthy' | 'warning' | 'danger' | 'unknown';

const CLAUDE_CONTEXT_WINDOW = 200_000;
const CLAUDE_OPUS_4_8_CONTEXT_WINDOW = 1_000_000;
const OPENAI_CONTEXT_WINDOW = 400_000;
const GEMINI_CONTEXT_WINDOW = 1_048_576;

/**
 * Exact-match registry of model id → context window in tokens.
 *
 * Mistral models are intentionally absent — Mistral jobs have no per-turn
 * peak tracked today (FR-004), so they never need a context window resolved.
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic Claude 4.x family
  'claude-opus-4-8': CLAUDE_OPUS_4_8_CONTEXT_WINDOW,
  'claude-opus-4-7': CLAUDE_CONTEXT_WINDOW,
  'claude-opus-4-6': CLAUDE_CONTEXT_WINDOW,
  'claude-sonnet-4-6': CLAUDE_CONTEXT_WINDOW,
  'claude-haiku-4-5': CLAUDE_CONTEXT_WINDOW,
  'claude-haiku-4-5-20251001': CLAUDE_CONTEXT_WINDOW,

  // OpenAI Codex / GPT-5 family
  'gpt-5': OPENAI_CONTEXT_WINDOW,
  'gpt-5.4': OPENAI_CONTEXT_WINDOW,
  'gpt-5.5': OPENAI_CONTEXT_WINDOW,
  'gpt-5-codex': OPENAI_CONTEXT_WINDOW,

  // Google Gemini 2.5 / 2.0 families (1M-token context window)
  'gemini-2.5-pro': GEMINI_CONTEXT_WINDOW,
  'gemini-2.5-flash': GEMINI_CONTEXT_WINDOW,
  'gemini-2.0-flash': GEMINI_CONTEXT_WINDOW,
};

/**
 * Resolve the context window for a model string.
 *
 * Tries an exact-match lookup first, then falls back to a substring match
 * across every registered family so versioned identifiers from OTLP
 * (e.g. `claude-sonnet-4-6-20250514`, `gpt-5-codex-2026...`) still resolve
 * to their base family's window. Keys are checked longest-first so more
 * specific entries (e.g. `gpt-5.4`) win over their shorter prefixes
 * (e.g. `gpt-5`). Returns `null` when no family matches so callers can
 * hide UI rather than render a misleading percentage.
 */
export function getContextWindow(model: string | null): number | null {
  if (!model) {
    return null;
  }

  const exact = MODEL_CONTEXT_WINDOWS[model];
  if (exact != null) {
    return exact;
  }

  const normalized = model.toLowerCase();
  const sortedKeys = Object.keys(MODEL_CONTEXT_WINDOWS).sort(
    (a, b) => b.length - a.length
  );
  for (const key of sortedKeys) {
    if (normalized.includes(key.toLowerCase())) {
      return MODEL_CONTEXT_WINDOWS[key]!;
    }
  }

  return null;
}

/**
 * Threshold cutoffs (research.md D-004 — conservative defaults).
 *
 * peak < 60% of window  → 'healthy'
 * 60% ≤ peak < 80%       → 'warning'
 * peak ≥ 80%             → 'danger'
 */
export const PEAK_CONTEXT_WARNING_THRESHOLD = 0.6;
export const PEAK_CONTEXT_DANGER_THRESHOLD = 0.8;

/**
 * Classify the peak per-turn context size as healthy / warning / danger.
 * Returns 'unknown' when either the peak or the model's context window is
 * not resolvable, so the UI can hide the indicator (FR-008).
 */
export function getPeakContextThresholdState(
  peak: number | null,
  model: string | null
): PeakContextState {
  if (peak == null) {
    return 'unknown';
  }

  const window = getContextWindow(model);
  if (window == null || window <= 0) {
    return 'unknown';
  }

  const ratio = peak / window;
  if (ratio >= PEAK_CONTEXT_DANGER_THRESHOLD) {
    return 'danger';
  }
  if (ratio >= PEAK_CONTEXT_WARNING_THRESHOLD) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Static Tailwind class strings for each threshold state.
 *
 * Per CLAUDE.md "NEVER construct Tailwind class names dynamically" — every
 * branch returns a complete literal string so the Tailwind purger detects them.
 * No "healthy green" — neutral styling avoids false reassurance before the
 * thresholds are tuned with real data.
 */
export function getPeakContextColor(
  state: PeakContextState
): { text: string; bg: string } {
  if (state === 'danger') {
    return { text: 'text-ctp-red', bg: 'bg-ctp-red/10' };
  }
  if (state === 'warning') {
    return { text: 'text-ctp-yellow', bg: 'bg-ctp-yellow/10' };
  }
  return { text: 'text-ctp-overlay1', bg: 'bg-transparent' };
}
