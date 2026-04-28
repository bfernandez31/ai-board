# Agent Command: `ai-board.inbox-analysis`

**Branch**: `AIB-743-inbox-ticket-analysis` · **Date**: 2026-04-27
**Path**: `.claude-plugin/commands/inbox-analysis.md` (slash command spec)
**Skill**: `.claude-plugin/skills/inbox-analysis/SKILL.md`

The slash command the workflow invokes via `run-agent.sh`. It orchestrates the 2-stage LLM pipeline (scoping pass → anchor retrieval → grounded estimation) and writes a JSON result to `/tmp/inbox-analysis-result.json`.

---

## 1. Invocation

```
ai-board.inbox-analysis \
  --analysis-id <ID> \
  --project-id  <ID> \
  --ticket-id   <ID>
```

All other inputs (ticket text, stack snapshot, candidate anchors) are fetched at runtime via the platform's existing APIs using `WORKFLOW_API_TOKEN`.

---

## 2. Phases

### Phase A — Load context (deterministic, no LLM)

A.1. `GET /api/internal/analysis-context?analysisId=<ID>` (new internal endpoint, see §6 below) returns:
```jsonc
{
  "ticket":   { "id": 5031, "title": "...", "description": "..." },
  "stack":    { /* StackContext snapshot from row */ },
  "candidates": [
    { "outcomeId": 412, "ticketId": 5012, "ticketKey": "AIB-712",
      "domains": ["app","lib","tests"], "frictionFree": true, "qualityScore": 88,
      "touchedDbSchema": false, "touchedTests": true, "touchedCi": false,
      "shippedAt": "2026-04-20T..." },
    /* …up to 50 candidates from anchorIdsAttempted… */
  ],
  "ruleSetVersion": 1
}
```

A.2. If `candidates.length === 0`, prepare a cold-start fast-path: skip Phase B+C, run Phase B-mini for scope warnings only, then emit `cold_start` result with `coldStartReason='insufficient_comparable_history'`.

### Phase B — Scoping pass (LLM stage 1)

Single LLM call. Prompt template loaded from `lib/analysis/prompts/scoping.ts` (new file).

Inputs:
- `ticket.title + ticket.description`
- `stack` (bounded extract)

Output (strict JSON, validated against `ScopingPassSchema`):
```ts
{
  predictedDomains: string[];                 // ≤ 5 top-level path segments
  semanticTagHints: {
    touchesDbSchema: boolean;
    touchesTests: boolean;
    touchesCi: boolean;
  };
  scopeWarnings: ScopeWarning[];              // ≤ 5
  descriptionOnlyFrictionRiskHint: 'low' | 'medium' | 'high';
}
```

The model is instructed to choose domains from a finite vocabulary computed at runtime as the union of `candidate.domains` plus a small fallback set (`['app','lib','tests','docs']`).

If the call fails or output is invalid → write a `failed` result with `errorReason='scoping_pass_failed'` and exit.

### Phase C — Anchor retrieval (deterministic, no LLM)

Re-rank `candidates` by `(domainOverlap with predictedDomains DESC, tagOverlap with semanticTagHints DESC, shippedAt DESC)`. Take the top 5.

If fewer than 3 anchors have `domainOverlap >= 1`:
- Emit `cold_start` result containing the scope warnings from Phase B and `coldStartReason='insufficient_comparable_history'`.
- Skip Phase D.

### Phase D — Grounded estimation pass (LLM stage 2)

Single LLM call. Prompt template loaded from `lib/analysis/prompts/grounded.ts`.

Inputs:
- Phase A `ticket` text
- Phase A `stack` extract
- The 5 anchors from Phase C, each rendered as a structured block: ticket key, friction status, quality score (or "no score"), structural domains, semantic tags, total cost USD, total duration.

Output (strict JSON, validated against `AnalysisOutputSchema` from `lib/analysis/output-schema.ts`):
```ts
{
  frictionRisk: 'low'|'medium'|'high',
  qualityGateRange: { lower, upper },
  recommendation: { choice, confidence, justification },
  costRange: { baselineLowerUsd, baselineUpperUsd, marginalFrictionLowerUsd, marginalFrictionUpperUsd },
  scopeWarnings: ScopeWarning[],   // may differ from Phase B (model may refine)
  anchors: AnchorCitation[]        // exactly the anchors from Phase C, projected
}
```

Validation failure → write `failed` result with `errorReason='invalid_model_output'`.

---

## 3. Telemetry

Each LLM call records:
- `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`
- `costUsd` (sum of both calls)
- `durationMs` (wall-clock for both calls combined)

Reported in the result JSON's `telemetry` block.

---

## 4. Result file format

Written to `/tmp/inbox-analysis-result.json`. Discriminated union, exactly the body the workflow PATCHes:

### Success
```jsonc
{
  "status": "success",
  "output": { /* AnalysisOutput */ },
  "telemetry": {
    "costUsd": 0.046,
    "durationMs": 14888,
    "inputTokens": 12044,
    "outputTokens": 1812,
    "thinkingTokens": 0,
    "cacheReadTokens": 9802
  }
}
```

### Cold-start
```jsonc
{
  "status": "cold_start",
  "coldStartReason": "insufficient_comparable_history",
  "output": { "scopeWarnings": [ /* ≤5 */ ] },
  "telemetry": { "costUsd": 0.011, "durationMs": 2400, ... }
}
```

### Failure
```jsonc
{
  "status": "failed",
  "errorReason": "scoping_pass_failed" | "grounded_pass_failed" | "invalid_model_output" | "other",
  "errorMessage": "first 2000 chars of error trace"
}
```

Exit code: `0` on success / cold-start, `1` on failure.

---

## 5. Idempotency & retries

The command itself does **not** retry LLM calls. The workflow does not retry the command. A failed analysis is the user's signal to click again (which creates a fresh row, doesn't consume budget).

---

## 6. Internal context endpoint — `GET /api/internal/analysis-context`

A new workflow-only endpoint that the agent uses in Phase A to bundle the row's input snapshot, stack snapshot, and the candidate-anchor projection into a single payload. Why this endpoint exists:
- The slash command runs in the workflow with only `WORKFLOW_API_TOKEN`; it cannot read the DB directly.
- Bundling the data avoids 3+ HTTP calls (analysis row, ticket, outcomes for candidates).
- Centralises authorisation logic (workflow token → row → project → outcomes).

### Auth
- `validateWorkflowAuth(request)` only.

### Request
- Query: `analysisId=<int>`

### Response 200
```jsonc
{
  "ticket": {
    "id": 5031,
    "title": "...",      // = titleSnapshot
    "description": "..."  // = descriptionSnapshot (NOT current value — input is frozen)
  },
  "stack": { /* StackContext from row.stackSnapshot */ },
  "candidates": [ /* projected from TicketOutcome rows in row.anchorIdsAttempted */ ],
  "ruleSetVersion": 1
}
```

### Errors
- 401 invalid token
- 404 row not found
- 410 if row is no longer `running` (workflow ran twice; second invocation aborts cleanly via failed PATCH).

### Implementation
- New route: `app/api/internal/analysis-context/route.ts`
- Looks up the `TicketAnalysis` row, projects the snapshot fields, fetches `TicketOutcome` rows by id-array (`prisma.ticketOutcome.findMany({ where: { id: { in: anchorIdsAttempted } } })`), denormalises the `frictionFree` / `qualityScore` / `domains` / `touched*` / `shippedAt` fields, returns the bundle.

This endpoint is the **only** new internal endpoint introduced by AIB-743. It is workflow-token-auth only — it never accepts session auth.

---

## 7. Skill content (high level)

The `inbox-analysis` skill (.claude-plugin/skills/inbox-analysis/SKILL.md) carries:
- The two prompt templates (Phase B, Phase D) as fenced code blocks.
- The exact JSON schemas the agent must emit (copied from `lib/analysis/output-schema.ts` for the model's reference).
- Output rules: "Emit ONLY the JSON object. Do not wrap in markdown. Do not add commentary."
- A short example of each shape (success, cold-start, failed).
- Instructions to write the result to `/tmp/inbox-analysis-result.json` and to exit `0`/`1` accordingly.

The skill is small (≈ 150 lines) — the bulk of the determinism is in the skill's two embedded JSON schemas and the post-call validation done by the agent before writing the result file.
