/**
 * Structural-marker validation for the HTML produced by Claude Code's
 * `/insights` command (AIB-791, D-8, FR-026, SC-011).
 *
 * The marker set MUST stay aligned with the `/insights` output template;
 * a regression in either layer should fail this check rather than ship a
 * silently broken report. The check is intentionally a cheap substring
 * scan — `/insights` output is structurally stable HTML with these exact
 * headings.
 */

export type InsightsOutputValidation =
  | { ok: true }
  | { ok: false; reason: string };

const STRUCTURAL_MARKERS = [
  'Suggested CLAUDE.md Additions',
  'Big Wins',
  'Horizon',
];

const FRICTION_SECTION_HEADERS = [
  'Friction',
  'Pain points',
  'What hurt',
];

export function validateInsightsOutput(html: string): InsightsOutputValidation {
  if (typeof html !== 'string' || html.length === 0) {
    return { ok: false, reason: 'Insights output is empty' };
  }

  // Cheap heuristic check that input looks like HTML at all. We don't parse,
  // but rejecting plain text avoids "valid markers in a chat log" false-passes.
  if (!html.includes('<') || !html.includes('>')) {
    return { ok: false, reason: 'Insights output is not HTML' };
  }

  for (const marker of STRUCTURAL_MARKERS) {
    if (!html.includes(marker)) {
      return {
        ok: false,
        reason: `Insights output missing required marker: "${marker}"`,
      };
    }
  }

  const hasFrictionHeader = FRICTION_SECTION_HEADERS.some((header) =>
    html.includes(header)
  );
  if (!hasFrictionHeader) {
    return {
      ok: false,
      reason: 'Insights output missing any friction-section header',
    };
  }

  return { ok: true };
}
