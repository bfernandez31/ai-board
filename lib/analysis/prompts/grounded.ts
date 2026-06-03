import type { StackContext } from '../types';

export interface AnchorSummaryForPrompt {
  ticketKey: string;
  domains: string[];
  frictionFree: boolean;
  qualityScore: number | null;
  touchedDbSchema: boolean;
  touchedTests: boolean;
  touchedCi: boolean;
  totalCostUsd: number | null;
  totalDurationMs: number | null;
}

export interface GroundedPromptVariables {
  ticketTitle: string;
  ticketDescription: string;
  stack: StackContext;
  anchors: AnchorSummaryForPrompt[];
}

export const GROUNDED_SYSTEM = `You are an experienced engineering reviewer producing a grounded estimation pass. You receive the ticket text, stack snapshot, and ≥3 comparable past outcomes. Output strict JSON only — no prose, no markdown.`;

export function buildGroundedPrompt(vars: GroundedPromptVariables): string {
  const services = vars.stack.services.length
    ? vars.stack.services.map((s) => `${s.type}@${s.version}`).join(', ')
    : '(none)';
  const language = vars.stack.language ?? '(unspecified)';
  const framework = vars.stack.framework ?? '(unspecified)';
  const testingFramework = vars.stack.testingFramework ?? '(unspecified)';
  const e2eFramework = vars.stack.e2eFramework ?? '(none)';

  const anchorBlocks = vars.anchors
    .map(
      (a, i) =>
        `Anchor #${i + 1} ${a.ticketKey}: domains=[${a.domains.join(', ')}]; frictionFree=${a.frictionFree}; qualityScore=${a.qualityScore ?? 'no_score'}; touchedDbSchema=${a.touchedDbSchema}; touchedTests=${a.touchedTests}; touchedCi=${a.touchedCi}; totalCostUsd=${a.totalCostUsd ?? 'n/a'}; totalDurationMs=${a.totalDurationMs ?? 'n/a'}`
    )
    .join('\n');

  return `Stack:
language=${language}; framework=${framework}; services=${services}; testing.framework=${testingFramework}; testing.e2e=${vars.stack.e2e}; e2e.framework=${e2eFramework}; agent.cli=${vars.stack.agent.cli}; agent.model=${vars.stack.agent.model ?? '(default)'}

Ticket:
TITLE: ${vars.ticketTitle}
DESCRIPTION:
${vars.ticketDescription}

Comparable past outcomes (use these to ground numeric ranges):
${anchorBlocks}

Emit JSON exactly conforming to AnalysisOutputSchema:
{
  "frictionRisk": "low"|"medium"|"high",
  "qualityGateRange": { "lower": int 0..100, "upper": int 0..100, lower<=upper },
  "recommendation": { "choice": "QUICK"|"FULL", "confidence": "low"|"medium"|"high", "justification": string, aim <900 chars (hard limit 1000) },
  "costRange": { "baselineLowerUsd", "baselineUpperUsd", "marginalFrictionLowerUsd", "marginalFrictionUpperUsd" },
  "scopeWarnings": [{ "category": "ambiguity_core_requirement"|"multi_feature_bundling"|"missing_acceptance_criteria"|"missing_scope_boundary"|"other", "message": ≤250 chars }] (≤5),
  "anchors": [{ "ticketId", "ticketKey", "frictionFree", "qualityScore"|null, "overlapStrength" int≥1 }] (≤5)
}

Rules:
- Reference at least one stack-relevant signal in recommendation.justification.
- All anchor.ticketId values MUST come from the supplied anchor set.
- Output ONLY the JSON object, nothing else.`;
}
