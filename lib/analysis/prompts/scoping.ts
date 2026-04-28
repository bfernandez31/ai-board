import type { StackContext } from '../types';

export interface ScopingPromptVariables {
  ticketTitle: string;
  ticketDescription: string;
  stack: StackContext;
  domainVocabulary: string[];
}

export const SCOPING_SYSTEM = `You are an experienced engineering reviewer producing a scoping pass over an INBOX ticket. Output strict JSON only — no prose, no markdown.`;

export function buildScopingPrompt(vars: ScopingPromptVariables): string {
  const services = vars.stack.services.length
    ? vars.stack.services.map((s) => `${s.type}@${s.version}`).join(', ')
    : '(none)';
  const language = vars.stack.language ?? '(unspecified)';
  const framework = vars.stack.framework ?? '(unspecified)';
  const testingFramework = vars.stack.testingFramework ?? '(unspecified)';
  const e2eFramework = vars.stack.e2eFramework ?? '(none)';
  const vocab = vars.domainVocabulary.length
    ? vars.domainVocabulary.join(', ')
    : 'app, lib, tests, docs';

  return `Stack:
language=${language}; framework=${framework}; services=${services}; testing.framework=${testingFramework}; testing.e2e=${vars.stack.e2e}; e2e.framework=${e2eFramework}; agent.cli=${vars.stack.agent.cli}; agent.model=${vars.stack.agent.model ?? '(default)'}

Ticket:
TITLE: ${vars.ticketTitle}
DESCRIPTION:
${vars.ticketDescription}

Vocabulary for predictedDomains (≤5, choose from): ${vocab}

Emit JSON exactly conforming to:
{
  "predictedDomains": string[],
  "semanticTagHints": { "touchesDbSchema": boolean, "touchesTests": boolean, "touchesCi": boolean },
  "scopeWarnings": Array<{ "category": "ambiguity_core_requirement"|"multi_feature_bundling"|"missing_acceptance_criteria"|"missing_scope_boundary"|"other", "message": string }>,
  "descriptionOnlyFrictionRiskHint": "low"|"medium"|"high"
}

Rules:
- predictedDomains length ≤ 5; values drawn from the Vocabulary above
- scopeWarnings length ≤ 5; each message ≤ 280 chars, single sentence
- Output ONLY the JSON object, nothing else.`;
}
