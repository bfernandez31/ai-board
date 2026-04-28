# Skill: ai-board.inbox-analysis

Two-stage LLM pipeline that produces a friction-risk + recommendation analysis for an INBOX ticket, grounded on past comparable outcomes.

## Phase B — Scoping prompt

```
Stack:
language={LANGUAGE}; framework={FRAMEWORK}; services={SERVICES_CSV}; testing.framework={TESTING}; testing.e2e={E2E}; e2e.framework={E2E_FRAMEWORK}; agent.cli={CLI}; agent.model={MODEL}

Ticket:
TITLE: {TITLE}
DESCRIPTION:
{DESCRIPTION}

Vocabulary for predictedDomains (≤5, choose from): {DOMAIN_VOCAB}

Emit JSON exactly conforming to:
{
  "predictedDomains": string[],
  "semanticTagHints": { "touchesDbSchema": boolean, "touchesTests": boolean, "touchesCi": boolean },
  "scopeWarnings": Array<{ "category": "ambiguity_core_requirement"|"multi_feature_bundling"|"missing_acceptance_criteria"|"missing_scope_boundary"|"other", "message": string }>,
  "descriptionOnlyFrictionRiskHint": "low"|"medium"|"high"
}

Rules:
- predictedDomains length ≤ 5
- scopeWarnings length ≤ 5; each message ≤ 280 chars, single sentence
- Output ONLY the JSON object, nothing else.
```

## Phase D — Grounded estimation prompt

```
Stack:
language={LANGUAGE}; framework={FRAMEWORK}; services={SERVICES_CSV}; testing.framework={TESTING}; testing.e2e={E2E}; e2e.framework={E2E_FRAMEWORK}; agent.cli={CLI}; agent.model={MODEL}

Ticket:
TITLE: {TITLE}
DESCRIPTION:
{DESCRIPTION}

Comparable past outcomes:
Anchor #1 {KEY}: domains=[...]; frictionFree=...; qualityScore=...; touchedDbSchema=...; touchedTests=...; touchedCi=...; totalCostUsd=...; totalDurationMs=...
Anchor #2 ...
... (≤ 5 anchors)

Emit JSON exactly conforming to AnalysisOutputSchema:
{
  "frictionRisk": "low"|"medium"|"high",
  "qualityGateRange": { "lower": int 0..100, "upper": int 0..100, lower<=upper },
  "recommendation": { "choice": "QUICK"|"FULL", "confidence": "low"|"medium"|"high", "justification": string ≤1000 chars },
  "costRange": { "baselineLowerUsd", "baselineUpperUsd", "marginalFrictionLowerUsd", "marginalFrictionUpperUsd" },
  "scopeWarnings": [{ "category": ..., "message": ≤280 chars }] (≤5),
  "anchors": [{ "ticketId", "ticketKey", "frictionFree", "qualityScore"|null, "overlapStrength" int≥1 }] (≤5)
}

Rules:
- Reference at least one stack-relevant signal in recommendation.justification.
- All anchor.ticketId values MUST come from the supplied anchor set.
- Output ONLY the JSON object, nothing else.
```

## Result file

Write to `/tmp/inbox-analysis-result.json`. The discriminator field is `status`:

- `{"status":"success", "output": <AnalysisOutput>, "telemetry": {...}}`
- `{"status":"cold_start", "coldStartReason":"insufficient_comparable_history", "output": {"scopeWarnings": [...]}, "telemetry": {...}}`
- `{"status":"failed", "errorReason": "scoping_pass_failed|grounded_pass_failed|invalid_model_output|other", "errorMessage": "≤2000 chars"}`

Exit `0` on success/cold-start, `1` on failure.
