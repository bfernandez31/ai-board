# API Contracts: Inbox Ticket Analysis

**Branch**: `AIB-743-inbox-ticket-analysis` · **Date**: 2026-04-27

All endpoints are Next.js App Router route handlers under `app/api/`. Auth follows existing project conventions (`verifyTicketAccess` / `verifyProjectAccess` / `validateWorkflowAuth`). All responses are JSON; errors use the platform's `{ error: string, code?: string }` shape (constitution III).

---

## 1. `GET /api/projects/:projectId/tickets/:id/analysis`

Returns the latest persisted analysis for the ticket plus pre-click eligibility metadata so the panel can render in a single round-trip.

### Auth
- Session OR PAT (`verifyTicketAccess`).
- 401 `UNAUTHENTICATED` / 404 `TICKET_NOT_FOUND` / 403 `ACCESS_DENIED` follow existing helper semantics.

### Response 200

```jsonc
{
  "latest": {
    "id": 142,
    "ticketId": 5031,
    "projectId": 7,
    "userId": "usr_abc",
    "status": "success",                       // running | success | cold_start | failed
    "ruleSetVersion": 1,
    "agent": "CLAUDE",
    "modelId": "claude-opus-4-7",
    "startedAt": "2026-04-27T11:32:08.231Z",
    "endedAt":   "2026-04-27T11:32:23.119Z",
    "titleSnapshot": "Add export-to-CSV button",
    "descriptionSnapshot": "...",              // truncated only by client UI; server returns full text
    "stackSnapshot": { /* StackContext */ },
    "telemetry": {
      "costUsd": 0.046,
      "durationMs": 14888,
      "inputTokens": 12044,
      "outputTokens": 1812,
      "thinkingTokens": 0,
      "cacheReadTokens": 9802
    },
    "coldStartReason": null,
    "errorReason": null,
    "errorMessage": null,
    "output": { /* AnalysisOutputSchema | ColdStartOutputSchema | null */ },
    "stale": false                             // computed: isStale(currentTicket, snapshot)
  } | null,                                    // null when no analysis has ever run
  "eligibility": {
    "triggerable": true,                       // ticket.stage === 'INBOX'
    "estimatedCostUsd": { "lower": 0.04, "upper": 0.08 },
    "rateLimit": {
      "limitPerHour": 10,
      "remaining":   7,                         // from D2 query
      "nextResetAt": "2026-04-27T12:11:08.231Z" // null if remaining > 0 (no pending reset)
    }
  }
}
```

### Response 404 — `TICKET_NOT_FOUND`
Standard error shape; ticket does not exist or user lacks access (consolidate to avoid leaking existence).

### Response 401 / 403
Per `verifyTicketAccess` semantics.

### Notes
- The `stale` flag is computed server-side using `lib/analysis/stale-check.ts` so the client doesn't need both snapshot + current text.
- When `latest === null`, the panel renders the empty-state with the eligibility block (button label uses `eligibility.estimatedCostUsd`).
- Anchor entries inside `output.anchors` are filtered server-side: anchors pointing to tickets the requesting user can no longer access are stripped (FR-021, SC-008). The filter happens in the GET serialiser, not at PATCH time, so audit data remains complete in storage.
- Each anchor includes a `tombstoned: boolean` field added at serialisation time when the source ticket was hard-deleted (edge case in spec): `{ ticketId, ticketKey, frictionFree, qualityScore, overlapStrength, tombstoned: true }`. Tombstoned anchors render as the "ticket no longer available" degraded state (User Story 4 acceptance scenario 3).

---

## 2. `POST /api/projects/:projectId/tickets/:id/analysis`

Creates a new `running` analysis row, dispatches the workflow, returns 202 with the row's ID for the client to start polling. **Always creates a new row** — never overwrites or upserts (FR-008, FR-005).

### Auth
- Session OR PAT (`verifyTicketAccess`).

### Request body
```jsonc
{}  // empty — all inputs derived server-side from the ticket + project state
```

The handler **does not** trust client-supplied snapshots, model IDs, or anchor lists.

### Server-side flow
1. `verifyProjectAccess(projectId, request)` + `verifyTicketAccess(ticketId, request)` — 401/403/404.
2. `requireUserId(request)` — 401 if no session/PAT.
3. Load ticket; if `ticket.stage !== 'INBOX'` → **422** `STAGE_NOT_INBOX` `{ error: 'Analysis is only available on INBOX-stage tickets' }`.
4. Rate-limit check (D2): `count({ where: { userId, status: { in: ['success','cold_start'] }, endedAt: { gt: oneHourAgo } } })`. If `>= 10` → **429** `RATE_LIMIT_EXCEEDED` with body:
   ```jsonc
   {
     "error": "Hourly analysis budget exhausted. Capacity returns at 12:11 UTC.",
     "code": "RATE_LIMIT_EXCEEDED",
     "nextResetAt": "2026-04-27T12:11:08.231Z"
   }
   ```
5. Resolve project config (with `ensureFreshConfig`) → `extractStackContext(config)`.
6. **Scoping pre-step (server-side, deterministic, no LLM)**: identify the candidate domain set from the ticket's `description` only — heuristic top-level path regex match against project files is **not** required at trigger time; the candidate domain set is the union of all distinct `domains` that have ever shipped on this project (this is the search space for anchor selection). The actual predicted-domain shrinkage to ≤ 5 happens inside the workflow's scoping LLM pass.
7. `selectAnchors(projectId, candidateDomainSet)` from `lib/analysis/anchor-retrieval.ts` returns up to 50 candidate anchor ticketIds (the workflow's scoping pass refines to top 5). The candidate IDs are persisted on the row's `anchorIdsAttempted` column.
8. Resolve owner credential `getOwnerCredential(projectId, 'ANTHROPIC')`. If null → **412** `CREDENTIAL_MISSING` with `getMissingCredentialError('ANTHROPIC')` text. **No row is created** in this case (no orphaned `running` rows; FR-026 no regression).
9. INSERT `TicketAnalysis` row with `status='running'`, snapshots, stack snapshot, `anchorIdsAttempted`, `agent`, `modelId`, `ruleSetVersion`.
10. Dispatch workflow (`dispatchInboxAnalysisWorkflow`); wrap in try/catch following P1 in research.md. On dispatch failure → UPDATE row to `status='failed'`, `errorReason='dispatch_failed'`, `endedAt=now()`, then 5xx response with `INTERNAL_ERROR`.
11. Return **202 Accepted** with the row identifier.

### Response 202

```jsonc
{
  "analysis": {
    "id": 143,
    "status": "running",
    "startedAt": "2026-04-27T11:34:01.000Z"
  }
}
```

### Error responses (summary)

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | malformed projectId / ticketId in path |
| 401 | `UNAUTHENTICATED` | no valid session/PAT |
| 403 | `ACCESS_DENIED` | user not member/owner of the project |
| 404 | `TICKET_NOT_FOUND` | ticket missing |
| 412 | `CREDENTIAL_MISSING` | owner has no `ANTHROPIC` UserCredential |
| 422 | `STAGE_NOT_INBOX` | ticket.stage ≠ INBOX |
| 429 | `RATE_LIMIT_EXCEEDED` | 10 successful runs in last hour |
| 500 | `INTERNAL_ERROR` | dispatch failure (row marked `failed` first) |

### Idempotency / concurrency
- Two POSTs from two tabs both succeed: each creates its own `running` row (D9). Both count against the user's budget on success.
- A POST while another row is `running` is allowed — there is no DB unique constraint on `(ticketId, status='running')`.

---

## 3. `PATCH /api/projects/:projectId/tickets/:id/analysis/:analysisId/status`

Workflow-only endpoint that transitions a `running` row to a terminal status with the LLM result + telemetry. Pattern parity with `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` (P2 in research.md).

### Auth
- `validateWorkflowAuth(request)` (Bearer `WORKFLOW_API_TOKEN`) — 401 on failure.
- No session auth accepted (this is a workflow-only endpoint).

### Request body — discriminated by `status`

```ts
const StatusUpdateSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    output: AnalysisOutputSchema,
    telemetry: TelemetrySchema,
  }),
  z.object({
    status: z.literal('cold_start'),
    coldStartReason: z.literal('insufficient_comparable_history'),
    output: ColdStartOutputSchema,            // { scopeWarnings: [] }
    telemetry: TelemetrySchema,
  }),
  z.object({
    status: z.literal('failed'),
    errorReason: AnalysisErrorReason,         // see data-model §2.3
    errorMessage: z.string().max(2000).optional(),
  }),
]);

const TelemetrySchema = z.object({
  costUsd: z.number().min(0),
  durationMs: z.number().int().min(0),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  thinkingTokens: z.number().int().min(0).optional(),
  cacheReadTokens: z.number().int().min(0).optional(),
});
```

### Server-side flow

1. `validateWorkflowAuth` — 401 if invalid.
2. Parse + validate body with `StatusUpdateSchema`. On `success`, additionally enforce `output.anchors[*].ticketId ⊆ row.anchorIdsAttempted` (custom refinement).
3. Look up row by `(projectId, ticketId, analysisId)`; if missing → 404 `ANALYSIS_NOT_FOUND`.
4. If `row.status !== 'running'` → return **200 idempotent** with current row state (no write). This matches HealthScan idempotency (P2). The same workflow may PATCH twice on retry; the second PATCH is a no-op.
5. Update row with `WHERE id = ? AND status = 'running'`. If affected count = 0 (race) → return 200 idempotent (re-read row state).
6. Set `endedAt = now()`.
7. Return 200 with the updated row (serialised).

### Allowed transitions (mirrors HealthScan)

```
running → success
running → cold_start
running → failed
* → terminal: idempotent 200, no write
```

### Response 200 (success)

```jsonc
{
  "analysis": {
    "id": 143,
    "status": "success",                      // or cold_start | failed
    "endedAt": "2026-04-27T11:34:14.119Z",
    /* … full row fields … */
  }
}
```

### Errors

| HTTP | Code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | invalid `WORKFLOW_API_TOKEN` |
| 400 | `VALIDATION_ERROR` | body fails Zod or anchor IDs not in `anchorIdsAttempted` |
| 404 | `ANALYSIS_NOT_FOUND` | row missing |
| 422 | `INVALID_TRANSITION` | (defensive — should not occur given idempotent path) |

### Notes
- The workflow MUST send the *measured* USD cost from the LLM provider response, not derive it from the static cost table.
- `failed` status carries no `output` and no `telemetry`. The row's `costUsd` stays NULL — this is the signal the rate-limit query relies on (failed runs don't count, FR-019, SC-006).

---

## 4. `GET /api/projects/:projectId/tickets/:id/analysis/eligibility`

Lightweight endpoint returning **only** the eligibility block from §1, for the ticket-card / list-view tooltip use case. This is optional — the panel itself uses §1 — but included so the frontend can avoid loading the full latest row when it only needs to render the button label and budget.

### Auth
- Same as §1.

### Response 200
```jsonc
{
  "triggerable": true,
  "estimatedCostUsd": { "lower": 0.04, "upper": 0.08 },
  "rateLimit": { "limitPerHour": 10, "remaining": 7, "nextResetAt": null }
}
```

### Implementation note
Wraps the same helpers used by §1; no separate logic. If the trigger button isn't rendered outside the panel, this endpoint can be deferred to a follow-up ticket. Listed here for completeness; tasks.md will mark it `optional` (P3).

---

## 5. Cross-cutting concerns

### Caching headers
All four endpoints set `Cache-Control: no-store`. Responses contain mutable user-scoped state.

### Test mode (`TEST_MODE=true`)
- POST trigger: dispatch is suppressed (`isWorkflowTestMode` returns true → `dispatchInboxAnalysisWorkflow` no-ops). The row stays in `running` until the test PATCHes it directly. This matches `lib/health/scan-dispatch.ts:23-29`.
- PATCH `/status`: accepts `WORKFLOW_API_TOKEN=test-workflow-token-for-e2e-tests-only` per existing convention.

### Logging
- POST: `console.log('[api/analysis] POST → analysisId=… userId=… ticketId=…')` on success.
- POST: `console.error('[api/analysis] dispatch failed', err)` then re-throw.
- PATCH: `console.log('[api/analysis] PATCH → id=… status=… durationMs=…')`.

### Observability hooks
None added in v1. The `[status, startedAt]` index supports a future cron that flags `running` rows older than 5 minutes (timed-out workflows). Out of scope for AIB-743.
