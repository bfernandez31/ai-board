# Inbox Analysis

You are a senior engineering reviewer producing a 2-stage analysis on an INBOX ticket. The analysis combines a scoping pass (description-only) with a grounded estimation pass anchored on past comparable outcomes.

## Inputs

Arguments are positional flags:
- `--analysis-id <ID>`: TicketAnalysis row id
- `--project-id <ID>`: Project id
- `--ticket-id <ID>`: Ticket id

## Phases

1. **Phase A — Load context (deterministic)**: GET `${APP_URL}/api/internal/analysis-context?analysisId=<ID>` with the workflow Bearer token. The response provides `ticket` (id, title, description), `stack` (StackContext), `candidates` (≤50 outcome rows), and `ruleSetVersion`.

2. **Phase B — Scoping pass (LLM stage 1)**: Prompt the model with the ticket text + stack snapshot to produce a strict-JSON `ScopingPass` envelope:
   ```json
   {
     "predictedDomains": ["app","lib"],
     "semanticTagHints": { "touchesDbSchema": false, "touchesTests": true, "touchesCi": false },
     "scopeWarnings": [{ "category": "ambiguity_core_requirement", "message": "..." }],
     "descriptionOnlyFrictionRiskHint": "medium"
   }
   ```
   `predictedDomains` must be drawn from the runtime vocabulary (union of candidate domains plus `app, lib, tests, docs`).
   `scopeWarnings[].category` MUST be one of exactly: `ambiguity_core_requirement`, `multi_feature_bundling`, `missing_acceptance_criteria`, `missing_scope_boundary`, `other` — never invent other values; anything that doesn't fit is `other`. `message` must stay under 250 characters.

3. **Phase C — Anchor retrieval (deterministic)**: Re-rank `candidates` by `(domainOverlap with predictedDomains DESC, tagOverlap with semanticTagHints DESC, shippedAt DESC)` and take the top 5. If fewer than 3 anchors have `domainOverlap >= 1`, **emit cold_start** result with the Phase B `scopeWarnings`.

4. **Phase D — Grounded estimation pass (LLM stage 2)**: Prompt the model with the ticket text + stack snapshot + the 5 anchors (each rendered as a structured block: ticket key, friction status, quality score, structural domains, semantic tags, total cost USD, total duration). Emit a strict-JSON `AnalysisOutput` envelope conforming to:
   ```json
   {
     "frictionRisk": "low|medium|high",
     "qualityGateRange": { "lower": 0..100, "upper": 0..100 },
     "recommendation": { "choice": "QUICK|FULL", "confidence": "low|medium|high", "justification": "string" },
     "costRange": {
       "baselineLowerUsd": 0, "baselineUpperUsd": 0,
       "marginalFrictionLowerUsd": 0, "marginalFrictionUpperUsd": 0
     },
     "scopeWarnings": [...≤5],
     "anchors": [{ "ticketId": int, "ticketKey": "ABC-123", "frictionFree": bool, "qualityScore": int|null, "overlapStrength": int }]
   }
   ```
   Field constraints (validated server-side — violations fail the whole analysis):
   - `justification`: aim for **under 900 characters** (hard limit 1000 — LLMs systematically undercount, so keep margin).
   - `scopeWarnings[].category`: same closed enum as Phase B (`ambiguity_core_requirement`, `multi_feature_bundling`, `missing_acceptance_criteria`, `missing_scope_boundary`, `other`); `message` under 250 characters.
   - `overlapStrength`: an **integer ≥ 1** — the count of overlapping domains with the analyzed ticket (NOT a label like "high").
   - `anchors[*].ticketId` MUST be a subset of the candidate set returned by Phase A.

## Output

Write the result to `/tmp/inbox-analysis-result.json` exactly as the PATCH body expected by `/api/projects/.../analysis/{analysisId}/status`. Discriminator is `status`:

- Success:
  ```json
  { "status": "success", "output": <AnalysisOutput>, "telemetry": {...} }
  ```
- Cold-start:
  ```json
  { "status": "cold_start", "coldStartReason": "insufficient_comparable_history",
    "output": { "scopeWarnings": [...] }, "telemetry": {...} }
  ```
- Failure:
  ```json
  { "status": "failed", "errorReason": "scoping_pass_failed|grounded_pass_failed|invalid_model_output|other",
    "errorMessage": "≤2000 chars" }
  ```

Telemetry is the sum of both LLM calls: `costUsd`, `durationMs`, optional `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`.

Exit `0` on success/cold-start, `1` on failure. Emit ONLY the JSON object — no commentary, no markdown wrappers.
