# API Contracts: Insights — Analyze Every Agent Session (AIB-852)

**Feature**: AIB-852 | **Spec**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

Only the **deltas** to the existing `/api/admin/insights/*` surface are specified here.
Endpoints not listed (`finalize`, `reports/:id/html`, `reports/:id`) are unchanged.
Auth modes: **A-ADMIN** = `requireAdminOrNotFound` (session); **A-WORKFLOW** =
`validateWorkflowAuth` (bearer `WORKFLOW_API_TOKEN`). Non-admin on A-ADMIN routes returns a
byte-equivalent 404 (parity preserved).

---

## GET `/api/admin/insights/preflight` — A-ADMIN  *(shape change)*

Now reports **sessions**, not distinct tickets (FR-015).

**200 response** (`PreflightSnapshot`):
```jsonc
{
  "canTrigger": true,
  "analyzableSessions": 14,          // RENAMED from shippedSincePreviousRun; uncovered sessions w/ transcript
  "expectedSessions": 16,            // NEW: incl. sessions whose transcript isn't available yet
  "previousRunEnd": "2026-06-01T00:00:00.000Z" | null,
  "runningSince": "2026-06-07T09:00:00.000Z" | null,
  "refusal": {
    "refusalCode": "NO_CLAUDE_SESSIONS" | "NO_NEW_SESSIONS" | "ALREADY_RUNNING",
    "message": "string"
  } | null
}
```

**Refusal codes** (renamed for the session model; UI maps to copy):
| Code | When |
|------|------|
| `NO_CLAUDE_SESSIONS` | No analyzable Claude sessions exist at all (first-run, empty corpus). Replaces `NO_CLAUDE_JOBS`. |
| `NO_NEW_SESSIONS` | A prior run exists; zero uncovered analyzable sessions remain. Replaces `NO_NEW_SHIPPED`. |
| `ALREADY_RUNNING` | A RUNNING report exists. |

`canTrigger` ⇔ `refusal === null`. The gate is keyed on **analyzableSessions > 0** (a period
with only transcript-pending sessions cannot be analyzed yet).

---

## POST `/api/admin/insights/trigger` — A-ADMIN  *(behavior change, same I/O shape)*

**Request body** (unchanged shape):
```jsonc
{ "periodStart"?: "ISO-8601", "periodEnd"?: "ISO-8601" }  // both-or-neither
```
- **Fresh run** (empty body): pre-flight = `countAnalyzableClaudeSessions()` (uncovered,
  transcript-present). Refuse with `NO_CLAUDE_SESSIONS` / `NO_NEW_SESSIONS` when zero.
  `periodEnd = now`; `periodStart = derivePeriodStart()` (max covered completion, else
  oldest available session completion, else now — D7, FR-014).
- **Retry** (both fields present): skip pre-flight; selection ignores the coverage marker
  for the explicit window (D8, FR-006 exception).

**Responses** (unchanged):
- `201` `{ "id": number, "status": "RUNNING", "createdAt": "ISO" }`
- `409` `{ "refusalCode", "message" }` — `NO_CLAUDE_SESSIONS|NO_NEW_SESSIONS|ALREADY_RUNNING`
- `400` invalid body; `500` no host project; `502` `{ "refusalCode": "DISPATCH_FAILED", ... }`

**Invariants preserved** (P4, P5): DB-insert-then-dispatch; on dispatch failure → `markFailed`
+ delete Job; partial-unique index maps concurrent inserts to `ALREADY_RUNNING`.

Workflow dispatch inputs unchanged: `report_id, job_id, project_id, period_start, period_end`.

---

## GET `/api/admin/insights/jobs?periodStart&periodEnd` — A-WORKFLOW  *(shape change)*

Enumerates **all analyzable Claude sessions** in the window (FR-001/FR-002, no per-ticket
dedup, no SHIP filter) and returns the expected count for reconciliation.

**200 response**:
```jsonc
{
  "jobs": [
    { "jobId": 123, "projectId": 7, "ticketId": 88, "rawArtifactKey": "raw-logs/7/88/123.tar.gz" }
    // every analyzable session — multiple per ticket allowed; spans all stages & projects
  ],
  "expectedCount": 16   // NEW: |expected set| incl. transcript-pending sessions (FR-011)
}
```
- `jobs.length` = analyzed/analyzable count = `sessionsCount` reported back at COMPLETED.
- Selection: `Expected ∧ analyzable` (data-model). Fresh window excludes `covered`; if the
  trigger passed an explicit retry window the same window is used (coverage already ignored
  upstream — the endpoint selects by the window it is given).
- **400** when `periodStart >= periodEnd` or params missing/invalid (unchanged).
- Must use the **same predicate** as `/preflight` (FR-016, SC-006, P1).

---

## GET `/api/admin/insights/jobs/[jobId]/raw-native` — A-WORKFLOW  *(authorization relaxation)*

**Change**: remove the unshipped-ticket 404 gate (current `route.ts:74-76`,
`if (!job.ticket.outcome) → 404`). Sessions of non-shipped tickets are now in scope (FR-008).

**Retained**: 404 for non-Claude effective agent (P2); `canonicalizeRawArtifactKey`
path-traversal defense (P7); 404 when no `rawArtifactKey`; `502 BLOB_UNREACHABLE` on blob
error; streams `application/gzip` (`tar.gz` or legacy `jsonl.gz`).

| jobId state | Before | After |
|-------------|--------|-------|
| Claude, shipped, has artifact | 200 | 200 |
| Claude, **unshipped**, has artifact | **404** | **200** |
| Non-Claude | 404 | 404 |
| No artifact | 404 | 404 |

---

## PATCH `/api/admin/insights/reports/[id]/status` — A-WORKFLOW  *(payload + side-effect change)*

Drives RUNNING → COMPLETED/FAILED, and on COMPLETED **advances coverage** (FR-007, D5).

**Request body (COMPLETED)**:
```jsonc
{
  "status": "COMPLETED",
  "sessionsCount": 14,                 // analyzed (= analyzedJobIds.length)
  "expectedSessionsCount": 16,         // NEW (FR-011)
  "ticketsCount": 9,                   // distinct tickets among analyzed
  "analyzedJobIds": [123, 124, 130],   // NEW: exact jobs analyzed → coverage rows (FR-007/D5)
  "artifactKey": "insights/reports/<id>.html",
  "artifactSize": 51234
}
```
**Validation**:
- COMPLETED requires `sessionsCount, expectedSessionsCount, ticketsCount, analyzedJobIds,
  artifactKey, artifactSize`.
- `analyzedJobIds`: non-empty `number[]`, each positive int; `length === sessionsCount`.
- `expectedSessionsCount >= sessionsCount`.
- `artifactKey` must equal `insights/reports/<id>.html` (existing check retained).

**Request body (FAILED)** — unchanged:
```jsonc
{ "status": "FAILED", "errorReason": "string (1..500)" }
```

**Side effects on COMPLETED** (single `$transaction`, P3/P6):
1. Atomic flip `updateMany WHERE id=? AND status='RUNNING'`. If `count===0` → idempotent
   no-op response (no coverage written).
2. Server re-fetches blob + re-runs `validateInsightsOutput`; on failure → FAILED (D8,
   existing behavior), **no coverage written**.
3. Set `expectedSessionsCount`; set `coverageGapReason = TRANSCRIPT_NOT_AVAILABLE` iff
   `expectedSessionsCount > sessionsCount`, else null.
4. `InsightsSessionCoverage.createMany({ data: analyzedJobIds.map(...), skipDuplicates: true })`.
5. Cascade linked Job → COMPLETED via direct `updateMany` (no notifications, P6).

**Responses**:
- `200` `{ "id", "status", "completedAt" }` (transition or idempotent no-op).
- `400` validation; `404` unknown id; `503 BLOB_UNREACHABLE` on blob fetch failure (RUNNING
  row untouched so the workflow can retry — existing behavior).

**FAILED writes no coverage** — the sessions remain uncovered and eligible (FR-007).

---

## GET `/api/admin/insights/reports` & `/reports/[id]` — A-ADMIN  *(serialization additions)*

`ReportListEntry` gains:
```jsonc
{
  // ... existing fields ...
  "sessionsCount": 14,             // analyzed (semantics clarified)
  "expectedSessionsCount": 16,     // NEW
  "coverageGapReason": "TRANSCRIPT_NOT_AVAILABLE" | null  // NEW
}
```
Used by the report-view metadata header to render analyzed-vs-expected and the gap flag
(FR-011/FR-012, surface = `insights-report-view.tsx` metadata card). `artifactKey` stays
excluded by design (clients fetch HTML via `/html`).
</content>
