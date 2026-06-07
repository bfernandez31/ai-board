# API Contract Deltas: Insights (AIB-856)

**Branch**: `AIB-856-copy-of-insights` | **Spec**: [spec.md](../spec.md)

Only the **changes** to the existing AIB-791 Insights API are documented here.
Endpoints not listed are unchanged. Auth modes: **A-ADMIN** = `requireAdminOrNot
Found` (admin session, byte-equal 404 on non-admin). **A-WORKFLOW** =
`validateWorkflowAuth` (Bearer `WORKFLOW_API_TOKEN`).

---

## POST `/api/admin/insights/trigger` — A-ADMIN — MODIFIED

Pre-flight gate now counts **eligible-unanalyzed sessions** (marker anti-join),
not newly-shipped tickets.

**Request body** (unchanged shape): empty `{}` for a fresh run, or
`{ periodStart, periodEnd }` for a retry (display window only).

**Behavior changes**:
- Pre-flight: `countEligibleUnanalyzedSessions()` (replaces
  `countShippedClaudeTicketsSince`).
- `periodStart` (fresh run) = `getEarliestEligibleSessionTimestamp() ?? now`;
  `periodEnd = now`. Display only.
- Single-tx insert (P-5), dispatch-then-rollback (P-5), single-RUNNING
  partial-unique → `ALREADY_RUNNING` (P-3) — **all unchanged**.

**Refusal codes (RENAMED, D-7)** — `409`:
| Old | New | Condition |
|-----|-----|-----------|
| `NO_CLAUDE_JOBS` | `NO_CLAUDE_SESSIONS` | No eligible Claude sessions exist at all, and no prior run. |
| `NO_NEW_SHIPPED` | `NO_NEW_SESSIONS` | Eligible sessions exist but all are already analyzed. |
| `ALREADY_RUNNING` | `ALREADY_RUNNING` | A run is RUNNING. |

**Responses**: `201 { id, status:'RUNNING', createdAt }` (unchanged);
`409 { refusalCode, message }`; `502 { refusalCode:'DISPATCH_FAILED', ... }`;
`400 { error }`; `500 { error }` (no host project) — all unchanged.

---

## GET `/api/admin/insights/preflight` — A-ADMIN — MODIFIED

Returns the marker-based snapshot.

**Response `200`** (`PreflightSnapshot`):
```jsonc
{
  "canTrigger": true,
  "eligibleSessionsSincePreviousRun": 17,   // RENAMED from shippedSincePreviousRun
  "previousRunEnd": "2026-06-01T12:00:00.000Z" | null,  // last COMPLETED periodEnd (display)
  "runningSince": null,
  "refusal": { "refusalCode": "NO_NEW_SESSIONS", "message": "…" } | null
}
```
Field rename `shippedSincePreviousRun → eligibleSessionsSincePreviousRun` and
refusal-code enum updated to `'NO_CLAUDE_SESSIONS' | 'NO_NEW_SESSIONS' |
'ALREADY_RUNNING'`. Consumed by `use-insights-preflight.ts` (type updated).

---

## GET `/api/admin/insights/jobs` — A-WORKFLOW — MODIFIED

Marker-driven enumeration of the corpus (D-5).

**Query params**: `periodStart`, `periodEnd` are now **optional and ignored for
selection** (retained only for backward-compatible callers / logging). Selection
is `listEligibleUnanalyzedSessions()`.

**Response `200`**:
```jsonc
{ "jobs": [ { "jobId": 101, "projectId": 10, "ticketId": 42, "rawArtifactKey": "raw-logs/10/42/101.jsonl.gz" }, ... ] }
```
Shape unchanged (`JobRef[]`), but now returns **all** eligible-unanalyzed Claude
sessions across **all** ticket outcomes (FR-002, FR-003, FR-007), **not**
de-duplicated per ticket and **not** restricted to shipped tickets. Order:
ascending `startedAt` (deterministic).

---

## GET `/api/admin/insights/jobs/:jobId/raw-native` — A-WORKFLOW — MODIFIED

**Change (D-8, FR-007)**: remove the shipped-outcome gate (current lines 69-76:
`if (!job.ticket.outcome) → 404`). Retained gates: `jobId` valid, job exists,
`ticketId != null`, effective agent = `CLAUDE` (else `404`), `rawArtifactKey`
present (else `404`), canonical key match (else `404`). Blob stream as today;
`502 BLOB_UNREACHABLE` on outage. See research §Security for the trust-boundary
justification.

---

## PATCH `/api/admin/insights/reports/:id/status` — A-WORKFLOW — MODIFIED

Terminal transition now also **marks the analyzed sessions**.

**Request body**:
```jsonc
// COMPLETED
{
  "status": "COMPLETED",
  "analyzedJobIds": [101, 102, 103],     // NEW — readable sessions actually fed to /insights
  "expectedSessionsCount": 5,            // NEW — sessions enumerated at run start
  "ticketsCount": 2,                     // distinct tickets among analyzed
  "artifactKey": "insights/reports/<id>.html",
  "artifactSize": 12345
  // sessionsCount is no longer sent by the workflow; the API derives it
}
// FAILED
{ "status": "FAILED", "errorReason": "…" }
```

**Validation (Zod, P-6)** — add to `StatusPatchSchema`:
- `analyzedJobIds: z.array(z.number().int().positive())` — **required** when
  `status==='COMPLETED'` (may be empty only if the run legitimately found
  nothing readable — but enumeration ≥1 is guaranteed by the gate, so an empty
  array on COMPLETED with `expectedSessionsCount>0` means full prune → treat as
  FAILED `'No readable Claude sessions'`).
- `expectedSessionsCount: z.number().int().nonnegative()` — **required** when
  `status==='COMPLETED'`.
- `.refine`: COMPLETED requires `analyzedJobIds`, `expectedSessionsCount`,
  `ticketsCount`, `artifactKey`, `artifactSize` (extends existing refinement).
- `sessionsCount` field becomes optional/ignored (server-derived).

**Behavior (COMPLETED)** — within one `prisma.$transaction`, guarded by
`status='RUNNING'` (P-1, P-3):
1. `artifactKey` must equal `buildInsightsReportKey(id)` else `400` (unchanged).
2. Blob re-fetch + `validateInsightsOutput` (unchanged, P-4): `503` on outage,
   override to FAILED on invalid content.
3. Filter `analyzedJobIds` to currently-eligible Claude sessions (defense in
   depth, P-4). Let `marked = filtered set`.
4. If `marked` is empty (all pruned/ineligible) → transition FAILED
   `'No readable Claude sessions available'` (no markers).
5. Else: `updateMany({ where:{ id, status:'RUNNING' }, data:{ status:'COMPLETED',
   sessionsCount: marked.length, ticketsCount, expectedSessionsCount,
   artifactKey, artifactSize, completedAt } })`. If `count===0` → idempotent
   no-op `200` (no markers).
6. `insightsAnalyzedSession.createMany({ data: marked.map(jobId => ({ jobId,
   reportId: id, analyzedAt: now })), skipDuplicates: true })`.
7. Cascade linked Job → COMPLETED (try/catch log-and-continue, P-4).

**Behavior (FAILED)**: unchanged — `markFailed`-style guarded transition, **no
markers written** (FR-006).

**Responses**: `200 { id, status, completedAt }` (success or idempotent no-op);
`400` validation; `404` unknown id; `401` bad token; `503 BLOB_UNREACHABLE`.

---

## Unchanged endpoints (serializer note)

`GET /reports`, `GET /reports/:id` — `ReportListEntry` / `toListEntry` gain
`expectedSessionsCount: number | null`. `GET /reports/:id/html`,
`PUT /reports/:id/finalize` — unchanged.
</content>
