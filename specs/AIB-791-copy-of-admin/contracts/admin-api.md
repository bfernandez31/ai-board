# Contract: Admin Insights API Endpoints

**Feature**: AIB-791
**Date**: 2026-05-11

## Auth shorthand

- **A-ADMIN**: Caller must satisfy `await requireAdminOrNotFound(request)`. Any non-admin call
  returns a Not Found response byte-equivalent to Next.js's default 404 (D-10, FR-003). Never
  401, never 403, never a JSON error body.
- **A-WORKFLOW**: Caller must satisfy `validateWorkflowAuth(request)` (Bearer
  `WORKFLOW_API_TOKEN`). Failure returns `401 { error: "Unauthorized" }` (consistent with
  existing log-artifact endpoints — these are not user-discoverable paths and are not subject
  to FR-003).

## Endpoints

### `POST /api/admin/insights/trigger` — Trigger a new analysis

**Auth**: A-ADMIN.

**Request body**: empty (`Content-Type: application/json` accepted with empty body).

**Server flow** (in order):
1. `await requireAdminOrNotFound(request)` → admin email.
2. `await reconcileOrphanedRunningReports(new Date())` (P-7).
3. Pre-flight: `prevEnd = await getLastCompletedRunEnd()` then `count =
   await countShippedClaudeTicketsSince(prevEnd)`. If `count === 0`:
   - If `prevEnd === null` AND no Claude jobs exist anywhere → 409 with `{ refusalCode:
     "NO_CLAUDE_JOBS", message: "No shipped Claude tickets to analyze yet" }`.
   - Else → 409 with `{ refusalCode: "NO_NEW_SHIPPED", message: "No new shipped tickets since
     last run on <PREVIOUS_RUN_DATE>" }` (date formatted as ISO).
4. Concurrency gate: `running = await prisma.insightsReport.findFirst({ where: { status:
   'RUNNING' } })`. If present → 409 with `{ refusalCode: "ALREADY_RUNNING", message: "Already
   running since <RUN_START_DATE>" }`.
5. Determine `periodStart`: `prevEnd ?? await getEarliestClaudeJobTimestamp()`. Determine
   `periodEnd`: `new Date()` (now).
6. In a single transaction:
   - INSERT `InsightsReport` with `status='RUNNING'`, `generatedAt=now`, `periodStart`,
     `periodEnd`, `createdAt=now`.
   - INSERT `Job` with `command='insights-analyze'`, `status='PENDING'`, `ticketId=null`,
     `projectId=null` (also nullable in this migration). Capture `job.id`.
   - UPDATE the `InsightsReport` to set `jobId=job.id`.
7. Dispatch the workflow (`.github/workflows/insights-analyze.yml`) with inputs:
   - `report_id` (string)
   - `job_id` (string)
   - `period_start` (ISO string)
   - `period_end` (ISO string)
   - `app_url` (string — current deployment's base URL)
8. On Octokit `RequestError` (P-2 with the FR-013 divergence from D-5): atomic transition the
   `InsightsReport` row to FAILED with `errorReason="Workflow dispatch failed: <code>"`. Also
   delete the `Job` row (it never reached PENDING-with-dispatch state). Return 502 with
   `{ refusalCode: "DISPATCH_FAILED", message: "Workflow dispatch failed", code: "GITHUB_ERROR" }`.

**Success response** (201):
```json
{ "id": 42, "status": "RUNNING", "createdAt": "2026-05-11T12:34:56.789Z" }
```

**Refusal responses** (409): see step 3, 4. Always JSON, always 409.

**Non-admin response**: byte-equivalent 404 (A-ADMIN).

---

### `GET /api/admin/insights/reports` — List past reports

**Auth**: A-ADMIN.

**Server flow**:
1. `await requireAdminOrNotFound(request)`.
2. `await reconcileOrphanedRunningReports(new Date())` (P-7).
3. `rows = await prisma.insightsReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 200 })`.

**Response** (200):
```json
{
  "reports": [
    {
      "id": 42,
      "status": "COMPLETED",
      "generatedAt": "2026-05-11T12:34:56.789Z",
      "periodStart": "2026-05-04T09:00:00.000Z",
      "periodEnd": "2026-05-11T12:34:56.789Z",
      "sessionsCount": 123,
      "ticketsCount": 17,
      "errorReason": null,
      "completedAt": "2026-05-11T12:39:12.345Z"
    },
    { "id": 41, "status": "FAILED", "errorReason": "Insights output validation failed", ... },
    { "id": 40, "status": "RUNNING", "createdAt": "...", ... }
  ]
}
```

`artifactKey` is NEVER returned (clients fetch the HTML via `/html` endpoint by id).

**Non-admin response**: byte-equivalent 404.

---

### `GET /api/admin/insights/reports/:id` — Single report metadata

**Auth**: A-ADMIN.

**Server flow**: Look up by id; reconciliation not needed for single-row read. If row absent → 404
with byte equality to Next.js default (not a JSON error). If found → 200 with same shape as one
entry from the list endpoint.

**Non-admin response**: byte-equivalent 404.

---

### `GET /api/admin/insights/reports/:id/html` — Stream the HTML artifact

**Auth**: A-ADMIN.

**Server flow**:
1. `await requireAdminOrNotFound(request)`.
2. Look up `report = await prisma.insightsReport.findUnique({ where: { id } })`.
   - If absent → byte-equivalent 404.
   - If `status !== 'COMPLETED'` → byte-equivalent 404 (FR-018; no body is served for non-
     COMPLETED rows). The host UI displays the failure reason or RUNNING placeholder from the
     row metadata, not via this endpoint.
3. `result = await streamInsightsReportArtifact(report.artifactKey!)`.
   - If `null` (blob 404 / removed) → 200 with the stable placeholder HTML body:
     ```html
     <!DOCTYPE html><html lang="en"><body><p>Report content is no longer available.</p></body></html>
     ```
     Content-Type and headers per below.
4. Stream the result.

**Response headers** (200):
```
Content-Type: text/html; charset=utf-8
Content-Security-Policy: frame-ancestors 'self'
Cache-Control: private, max-age=300
X-Content-Type-Options: nosniff
```

Note: `X-Frame-Options` is NOT set on this endpoint (it must be frameable by the admin shell).

**Non-admin response**: byte-equivalent 404.

---

### `GET /api/admin/insights/preflight` — Pre-flight count (for UI)

**Auth**: A-ADMIN.

**Server flow**: Compute `prevEnd`, `count`, and `latestRunning` (if any). Mirror the trigger
endpoint's pre-flight logic without performing any mutation.

**Response** (200):
```json
{
  "canTrigger": true,
  "shippedSincePreviousRun": 4,
  "previousRunEnd": "2026-05-04T09:00:00.000Z",
  "runningSince": null,
  "refusal": null
}
```

When `canTrigger === false`, `refusal` has the same shape as the trigger refusal body
(`{ refusalCode, message }`). The UI uses this to disable the button and show the message
without firing a POST.

**Non-admin response**: byte-equivalent 404.

---

### `PATCH /api/admin/insights/reports/:id/status` — Workflow-driven status transition

**Auth**: A-WORKFLOW.

**Request body** (Zod-validated):
```ts
const schema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']),
  sessionsCount: z.number().int().nonnegative().optional(),  // required if status === 'COMPLETED'
  ticketsCount: z.number().int().nonnegative().optional(),   // required if status === 'COMPLETED'
  artifactKey: z.string().regex(/^insights\/reports\/\d+\.html$/).optional(), // required if status === 'COMPLETED'
  artifactSize: z.number().int().positive().optional(),      // required if status === 'COMPLETED'
  errorReason: z.string().min(1).max(500).optional(),         // required if status === 'FAILED'
});
```

Plus a refinement: when `status==='COMPLETED'`, all four artifact fields are required AND the
HTML stored at `artifactKey` must pass `validateInsightsOutput(html)` (D-8). The endpoint
re-fetches the blob and re-validates server-side as defense in depth; on validation failure,
it OVERRIDES the requested COMPLETED transition into FAILED with `errorReason="Insights output
validation failed"`. Logged.

**Server flow**:
1. `validateWorkflowAuth(request)` → 401 on failure.
2. Look up `report`. If absent → 404 JSON `{ error: "Not Found" }` (this is a workflow-only
   endpoint and is not subject to FR-003).
3. Atomic conditional update (P-1):
   ```ts
   const result = await prisma.insightsReport.updateMany({
     where: { id, status: 'RUNNING' },
     data: { status, sessionsCount, ticketsCount, artifactKey, artifactSize, errorReason, completedAt: new Date() },
   });
   if (result.count === 0) {
     const current = await prisma.insightsReport.findUnique({ where: { id }, select: { id: true, status: true, completedAt: true } });
     return NextResponse.json(current, { status: 200 });  // idempotent no-op
   }
   ```
4. On 'COMPLETED' branch: re-fetch the blob, validate, override to FAILED if validation fails.
5. Update the linked `Job` row's status similarly (so the existing job-completion notification
   opt-out and log capture flow run correctly). Use the existing `/api/jobs/:id/status`
   endpoint OR direct atomic update — TBD at implementation time; prefer direct update because
   `/api/jobs/:id/status` fires push notifications (FR-022 forbids them for insights).

**Response** (200): minimal `{ id, status, completedAt }` (mirrors `/api/jobs/:id/status` shape).

---

### `PUT /api/admin/insights/reports/:id/finalize` — Workflow-driven artifact upload

**Auth**: A-WORKFLOW.

**Request**: raw bytes of the HTML body. `Content-Type: text/html; charset=utf-8`.

**Server flow**:
1. `validateWorkflowAuth(request)` → 401 on failure.
2. Look up `report`; if absent → 404 JSON.
3. Validate content type — must start with `text/html`. Otherwise 415.
4. Validate size — must be > 0 and ≤ 25 MB (mirroring `ARTIFACT_MAX_BYTES`). Otherwise 413.
5. Server-side validate the HTML against `validateInsightsOutput(buffer.toString('utf8'))`.
   - On failure: do NOT upload; respond with 422 `{ error: "Insights output validation failed",
     code: "INVALID_OUTPUT" }`. The workflow should then PATCH status to FAILED with the same
     reason.
6. `artifactKey = buildInsightsReportKey(id)`.
7. `await uploadInsightsReportArtifact(artifactKey, buffer)`.

**Response** (200):
```json
{ "artifactKey": "insights/reports/42.html", "artifactSize": 123456 }
```

---

### `GET /api/admin/insights/jobs?periodStart=...&periodEnd=...` — Workflow-driven job enumeration

**Auth**: A-WORKFLOW.

**Server flow**:
1. `validateWorkflowAuth(request)` → 401 on failure.
2. Parse `periodStart` / `periodEnd` (ISO). Validate `start < end`. Otherwise 400.
3. `jobs = await listShippedClaudeJobsForWindow(start, end)` — the SAME predicate the
   trigger's pre-flight uses (D-6, FR-025).

**Response** (200):
```json
{
  "jobs": [
    {
      "jobId": 1234,
      "projectId": 7,
      "ticketId": 89,
      "rawArtifactKey": "raw-logs/7/89/1234.jsonl.gz"
    }
  ]
}
```

The workflow then downloads each `rawArtifactKey` via the existing
`GET /api/projects/:projectId/tickets/:ticketId/jobs/:jobId/logs/raw-native` endpoint (which
requires user session auth — for the workflow we use a service-account session or the workflow
token, see workflow doc).

**Open implementation question** (resolved in workflow doc): the existing `/logs/raw-native`
endpoint requires `verifyTicketAccess` which is session-based, not workflow-token-based. The
workflow MUST use one of:
(a) A new workflow-token-authenticated variant of `/logs/raw-native` scoped to insights
    enumeration, or
(b) The workflow asks `GET /api/admin/insights/jobs` to return signed/blob-direct URLs.

The plan adopts (a): add a workflow-token-authenticated read endpoint specifically for the
insights workflow's needs. See `workflows/insights-analyze-workflow.md` for the contract.

---

## Summary table

| Path | Method | Auth | Notes |
|------|--------|------|-------|
| `/admin` (page) | GET | A-ADMIN | Redirects to `/admin/insights`. Non-admin: 404. |
| `/admin/insights` (page) | GET | A-ADMIN | Hosts the report view. Non-admin: 404. |
| `/api/admin/insights/trigger` | POST | A-ADMIN | Starts a run. 409 on refusal. Non-admin: 404. |
| `/api/admin/insights/preflight` | GET | A-ADMIN | UI pre-check for trigger. Non-admin: 404. |
| `/api/admin/insights/reports` | GET | A-ADMIN | List. Capped at 200. Non-admin: 404. |
| `/api/admin/insights/reports/:id` | GET | A-ADMIN | Single metadata. Non-admin: 404. |
| `/api/admin/insights/reports/:id/html` | GET | A-ADMIN | Streams HTML for iframe. Non-admin: 404. |
| `/api/admin/insights/reports/:id/status` | PATCH | A-WORKFLOW | Terminal status. |
| `/api/admin/insights/reports/:id/finalize` | PUT | A-WORKFLOW | Artifact upload. |
| `/api/admin/insights/jobs` | GET | A-WORKFLOW | Window enumeration. |
| `/api/admin/insights/jobs/:jobId/raw-native` | GET | A-WORKFLOW | (See workflow doc for scope rationale.) |
