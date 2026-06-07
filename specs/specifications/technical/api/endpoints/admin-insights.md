# Admin Insights Endpoints

Endpoints backing the `/admin/insights` page. All admin (`A-ADMIN`) endpoints share a single authorization gate: requests from non-allowlisted callers return a Not Found response byte-equivalent to Next.js's default 404 (same status, body bytes, and headers) — never a JSON error body, never `Forbidden`, never `Unauthorized`.

## Authentication

Two authentication modes are used:

| Mode | Used by | Behavior on auth failure |
|------|---------|--------------------------|
| `A-ADMIN` | All page and admin-facing API routes | Returns byte-equivalent 404 via `requireAdminOrNotFound(request)`. Tests in `tests/integration/api/admin/insights/parity-404.test.ts` assert byte equality against a control 404. |
| `A-WORKFLOW` | Endpoints called by `insights-analyze.yml` | Bearer `WORKFLOW_API_TOKEN` via `validateWorkflowAuth`; returns `401 { "error": "Unauthorized" }` on failure (these paths are not user-discoverable and are not subject to the 404-parity rule). |

`requireAdminOrNotFound` (`app/lib/auth/admin.ts`) resolves the current user via `getCurrentUserOrNull(request)`, normalizes the email (trim + lowercase), and checks membership in `getAdminAllowlist()` (which re-parses `ADMIN_ALLOWLIST` fresh on every call so operator rotations apply on the next request without restart).

## Endpoint Summary

| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/api/admin/insights/preflight` | GET | A-ADMIN | UI pre-check before showing trigger button |
| `/api/admin/insights/trigger` | POST | A-ADMIN | Start a new analysis run |
| `/api/admin/insights/reports` | GET | A-ADMIN | List past reports (capped at 200) |
| `/api/admin/insights/reports/:id` | GET | A-ADMIN | Single report metadata |
| `/api/admin/insights/reports/:id/html` | GET | A-ADMIN | Stream HTML artifact into iframe |
| `/api/admin/insights/reports/:id/status` | PATCH | A-WORKFLOW | Terminal status transition (called by workflow) |
| `/api/admin/insights/reports/:id/finalize` | PUT | A-WORKFLOW | Artifact upload (called by workflow) |
| `/api/admin/insights/jobs` | GET | A-WORKFLOW | Eligible-unanalyzed session enumeration (called by workflow) |
| `/api/admin/insights/jobs/:jobId/raw-native` | GET | A-WORKFLOW | Cross-tenant raw native session stream (called by workflow) |

---

## GET /api/admin/insights/preflight

Mirror the trigger endpoint's pre-flight logic without mutating any state. Used by the page to decide whether to enable the "Run new analysis" button and which refusal message (if any) to display.

**Authentication**: A-ADMIN

**Response** (200 OK):
```json
{
  "canTrigger": true,
  "eligibleSessionsSincePreviousRun": 17,
  "previousRunEnd": "2026-05-04T09:00:00.000Z",
  "runningSince": null,
  "refusal": null
}
```

`eligibleSessionsSincePreviousRun` is the count of eligible Claude sessions not yet analyzed (the marker anti-join), which the page header also surfaces as the awaiting-analysis counter. `previousRunEnd` is the last COMPLETED run's `periodEnd` (display only). When `canTrigger` is `false`, `refusal` carries `{ refusalCode, message }` matching the trigger refusal body so the UI can render the message verbatim without firing a POST. `refusalCode` is one of `'NO_CLAUDE_SESSIONS' | 'NO_NEW_SESSIONS' | 'ALREADY_RUNNING'`.

**Non-admin response**: Byte-equivalent 404.

---

## POST /api/admin/insights/trigger

Start a new Insights analysis run. Subject to the pre-flight (eligible-unanalyzed Claude sessions) and concurrency (no RUNNING row) gates.

**Authentication**: A-ADMIN

**Request body** (`Content-Type: application/json`): Optional. When empty (or `{}`), the endpoint computes a fresh analysis window. To retry a failed report with the same period window, pass:

```json
{
  "periodStart": "2026-05-04T09:00:00.000Z",
  "periodEnd": "2026-05-11T12:34:56.789Z"
}
```

Validated with Zod: both fields must be present together or both absent; `periodStart` must be before `periodEnd`. Returns 400 on validation failure.

**Server flow** (in order):

1. `requireAdminOrNotFound(request)` → admin email.
2. `reconcileOrphanedRunningReports(new Date())` — lazy reconciliation auto-FAILs any RUNNING row older than `INSIGHTS_RUN_TIMEOUT_MINUTES`.
3. Parse and validate request body via `triggerBodySchema`.
4. **Fresh run** (no period params): Pre-flight: compute `count = countEligibleUnanalyzedSessions()` (the marker anti-join — completed Claude sessions with a captured transcript and no `InsightsAnalyzedSession` marker, any ticket outcome, not de-duplicated per ticket). If `count === 0`:
   - When no run has ever completed (`getLastCompletedRunEnd() === null`) → refuse with `NO_CLAUDE_SESSIONS` (no eligible Claude sessions exist at all).
   - Otherwise → refuse with `NO_NEW_SESSIONS` with the prior run's `periodEnd` as the boundary; never synthesize `new Date()` as a fabricated "last run" timestamp.
   **Retry** (period params present): Skip the pre-flight eligible-sessions check (the original run proved eligibility).
5. Concurrency gate (always enforced): if a RUNNING row exists, refuse with `ALREADY_RUNNING`.
6. Compute period bounds (display only — selection is marker-driven, not windowed) — **fresh run**: `periodStart = getEarliestEligibleSessionTimestamp() ?? now`; `periodEnd = now`. **Retry**: use the provided `periodStart` and `periodEnd` directly.
7. In a single transaction:
   - Insert `InsightsReport` with `status='RUNNING'`, `generatedAt=now`, `periodStart`, `periodEnd`.
   - Insert companion `Job` with `command='insights-analyze'`, `status='PENDING'`, `ticketId=null`, `projectId=<host project id>` (the ai-board host project — used so existing project-scoped log queries resolve).
   - Link the report to the job via `jobId`.
8. Dispatch `.github/workflows/insights-analyze.yml` on the ai-board repository with inputs `report_id`, `job_id`, `period_start`, `period_end`, `app_url`.
9. On Octokit `RequestError`, atomically transition the report to FAILED with `errorReason="Workflow dispatch failed: <status> <message>"`, delete the job row, and return 502 with `DISPATCH_FAILED`.

**Success response** (201):
```json
{
  "id": 42,
  "status": "RUNNING",
  "createdAt": "2026-05-11T12:34:56.789Z"
}
```

**Refusal responses** (409):
```json
{ "refusalCode": "NO_NEW_SESSIONS", "message": "No new sessions since last run on 2026-05-04T09:00:00.000Z" }
```
```json
{ "refusalCode": "NO_CLAUDE_SESSIONS", "message": "No Claude sessions to analyze yet" }
```
```json
{ "refusalCode": "ALREADY_RUNNING", "message": "Already running since 2026-05-11T12:30:00.000Z" }
```

**Dispatch failure response** (502):
```json
{ "refusalCode": "DISPATCH_FAILED", "message": "Workflow dispatch failed", "code": "GITHUB_ERROR" }
```

**Non-admin response**: Byte-equivalent 404.

---

## GET /api/admin/insights/reports

List past reports in reverse-chronological order, capped at 200.

**Authentication**: A-ADMIN

**Server flow**:
1. `requireAdminOrNotFound(request)`.
2. `reconcileOrphanedRunningReports(new Date())`.
3. `prisma.insightsReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 200, include: { job: { select: { workflowRunId: true } } } })`.

The 200-row cap is enforced at the database query level, not only at response serialization. Each row is serialized via `toListEntry()`, which joins the linked Job's `workflowRunId` and constructs the `githubActionsUrl` server-side from `GITHUB_OWNER`/`GITHUB_REPO` environment variables.

**Response** (200 OK):
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
      "expectedSessionsCount": 130,
      "ticketsCount": 17,
      "errorReason": null,
      "completedAt": "2026-05-11T12:39:12.345Z",
      "createdAt": "2026-05-11T12:34:56.789Z",
      "workflowRunId": "12345678",
      "githubActionsUrl": "https://github.com/owner/repo/actions/runs/12345678"
    }
  ]
}
```

`sessionsCount` is the number of sessions actually analyzed (markers written); `expectedSessionsCount` is the number of eligible sessions the run enumerated at start (`null` for legacy rows). A coverage gap exists when `expectedSessionsCount > sessionsCount` (transcripts pruned before they could be read). `ticketsCount` is the number of distinct tickets among the analyzed sessions.

`workflowRunId` is the Job's BigInt workflow run ID serialized as a string, or `null` when the linked job has no run ID. `githubActionsUrl` is the full GitHub Actions URL constructed from the `workflowRunId` and the repository coordinates, or `null` when either the run ID or the repository environment variables are missing.

`artifactKey` is never returned. The client fetches the HTML body via `GET /api/admin/insights/reports/:id/html`.

**Non-admin response**: Byte-equivalent 404.

---

## GET /api/admin/insights/reports/:id

Fetch a single report's metadata.

**Authentication**: A-ADMIN

**Response** (200 OK): Same shape as one entry from the list endpoint (includes `workflowRunId` and `githubActionsUrl`).

**Not-found response**: Byte-equivalent 404 (same shape as non-admin response, so a probe cannot distinguish "no such row" from "no such page").

**Non-admin response**: Byte-equivalent 404.

---

## GET /api/admin/insights/reports/:id/html

Stream the HTML artifact for a COMPLETED report. The host page embeds this URL as the `src` of a sandboxed iframe with `sandbox="allow-scripts"` and **without** `allow-same-origin`, so the report's scripts and charts can execute while remaining isolated from the host's cookies, storage, and DOM.

**Authentication**: A-ADMIN

**Server flow**:
1. `requireAdminOrNotFound(request)`.
2. Look up the row. If absent, or `status !== 'COMPLETED'`, or `artifactKey` is null → byte-equivalent 404.
3. Stream the artifact via `streamInsightsReportArtifact(artifactKey)`.
4. If the blob is missing (storage incident) → respond with the stable placeholder HTML body:
   ```html
   <!DOCTYPE html><html lang="en"><body><p>Report content is no longer available.</p></body></html>
   ```

**Response headers** (200 OK):
```
Content-Type: text/html; charset=utf-8
Content-Security-Policy: frame-ancestors 'self'
Cache-Control: private, max-age=300
X-Content-Type-Options: nosniff
```

`X-Frame-Options` is intentionally NOT set on this endpoint — the admin shell needs to frame it. The `frame-ancestors 'self'` CSP prevents embedding from other origins.

**Blob backend unreachable** (502): the admin shell iframes this endpoint, so the body MUST stay renderable HTML rather than a raw JSON payload bleeding through the iframe. The response sets the same headers as a 200 plus `Retry-After: 30` and uses this placeholder body:

```html
<!DOCTYPE html><html lang="en"><body><p>Report content is temporarily unavailable. Please retry shortly.</p></body></html>
```

**Non-admin response**: Byte-equivalent 404.

---

## PATCH /api/admin/insights/reports/:id/status

Workflow-driven terminal status transition. All transitions use an atomic conditional update guarded on `WHERE id = ? AND status = 'RUNNING'`, so late callbacks that arrive after a reconciliation auto-FAIL are no-ops (the row's terminal status is preserved).

**Authentication**: A-WORKFLOW (Bearer `WORKFLOW_API_TOKEN`)

**Request body** (Zod-validated):
```ts
{
  status: 'COMPLETED' | 'FAILED',
  analyzedJobIds?: number[],       // required when status === 'COMPLETED'; positive ints — the readable sessions actually fed to /insights
  expectedSessionsCount?: number,  // required when status === 'COMPLETED'; non-negative — sessions enumerated at run start
  ticketsCount?: number,           // required when status === 'COMPLETED'; distinct tickets among analyzed sessions
  artifactKey?: string,            // required when status === 'COMPLETED'; matches /^insights\/reports\/\d+\.html$/
  artifactSize?: number,           // required when status === 'COMPLETED'
  errorReason?: string,            // required when status === 'FAILED'; 1–500 chars
  // sessionsCount is no longer sent by the workflow — the API derives it from the accepted analyzedJobIds
}
```

`analyzedJobIds`, `expectedSessionsCount`, `ticketsCount`, `artifactKey`, and `artifactSize` are all required together when `status === 'COMPLETED'` (Zod refinement). `sessionsCount`, if sent, is ignored — the server derives it.

**COMPLETED transition** — within a single `prisma.$transaction` guarded on `WHERE id = ? AND status = 'RUNNING'`:

1. `artifactKey` must equal `buildInsightsReportKey(id)`, else `400`.
2. The endpoint re-fetches the uploaded blob and re-runs `validateInsightsOutput` server-side as defense in depth (`503` on a blob outage; overridden into FAILED with `errorReason = "Insights output validation failed"` on invalid content).
3. `analyzedJobIds` is filtered to sessions still currently eligible (a Claude session belonging to a ticket with a transcript and no existing marker) — a poisoning defense so a compromised caller cannot mark arbitrary jobs. Call the surviving set `marked`.
4. If `marked` is empty (every reported session was pruned or ineligible) → transition to FAILED with `errorReason = "No readable Claude sessions available"`; no markers written.
5. Otherwise the row transitions to COMPLETED with `sessionsCount = marked.length` (derived, not taken from the request), plus `ticketsCount`, `expectedSessionsCount`, `artifactKey`, `artifactSize`, and `completedAt`. One `InsightsAnalyzedSession` row is inserted per `marked` job via `createMany({ skipDuplicates: true })` (the `@unique(jobId)` index makes this once-and-only-once).

**FAILED transition**: unchanged — guarded conditional update writing `errorReason`; **no markers are written**, so the run's sessions remain eligible for a later run.

**Response** (200 OK):
```json
{ "id": 42, "status": "COMPLETED", "completedAt": "2026-05-11T12:39:12.345Z" }
```

When the atomic update finds no RUNNING row with that id (late callback after auto-FAIL), the endpoint returns 200 with the current terminal row's metadata — an idempotent no-op.

**Errors**:
- `400`: Validation failed
- `401`: Invalid or missing workflow token
- `404`: Report not found (workflow-only endpoint — JSON `{ "error": "Not Found" }`, not the byte-equivalent 404 used for admin endpoints)
- `503`: Blob backend unreachable during the COMPLETED re-validation (the run stays RUNNING for a retry)

**Side effects**:
- Inserts one `InsightsAnalyzedSession` marker per accepted job (COMPLETED only), inside the same guarded transaction, so coverage is recorded atomically with the status transition.
- Updates the linked `Job` row's status via a direct atomic update (bypassing the user-facing `/api/jobs/:id/status` handler so push notifications are **not** fired — insights jobs never send notifications).

---

## PUT /api/admin/insights/reports/:id/finalize

Workflow-driven artifact upload. The workflow streams the produced HTML body to this endpoint; the server validates content type, size, and structural markers BEFORE writing to Vercel Blob.

**Authentication**: A-WORKFLOW

**Request**: Raw HTML bytes with `Content-Type: text/html; charset=utf-8`.

**Server flow**:
1. `validateWorkflowAuth(request)` → 401 on failure.
2. Parse and validate the `:id` path param → 400 on invalid.
3. Validate `Content-Type` starts with `text/html` → 415 `UNSUPPORTED_MEDIA_TYPE` otherwise.
4. Look up the report row → 404 JSON on missing.
5. Read body; reject empty (400) or size > 25 MB (`ARTIFACT_MAX_BYTES`) → 413 `PAYLOAD_TOO_LARGE`.
6. Run `validateInsightsOutput(body.toString('utf-8'))` → 422 `INVALID_OUTPUT` on failure (the workflow then PATCHes status to FAILED with reason `"Insights output validation failed"`).
7. Compute `artifactKey = buildInsightsReportKey(id)` → `insights/reports/<id>.html`.
8. `uploadInsightsReportArtifact(artifactKey, buffer)` → 502 `BLOB_UPLOAD_FAILED` on backend error.

**Response** (200 OK):
```json
{ "artifactKey": "insights/reports/42.html", "artifactSize": 123456 }
```

**Error responses**:
- `400`: Invalid id, empty body, or unreadable body
- `401`: Invalid or missing workflow token
- `404`: Report not found
- `413`: Artifact exceeds 25 MB (`PAYLOAD_TOO_LARGE`)
- `415`: Content-Type not `text/html` (`UNSUPPORTED_MEDIA_TYPE`)
- `422`: Output failed structural-marker validation (`INVALID_OUTPUT`)
- `502`: Blob backend rejected the upload (`BLOB_UPLOAD_FAILED`)

---

## GET /api/admin/insights/jobs

Enumerate every eligible-unanalyzed Claude session across all projects. The workflow calls this immediately after dispatch to determine which raw native session artifacts to download.

**Authentication**: A-WORKFLOW

**Query parameters**:
- `periodStart` (ISO 8601, optional) — accepted for backward compatibility, **ignored for selection**
- `periodEnd` (ISO 8601, optional) — accepted for backward compatibility, **ignored for selection**

**Server flow**: Calls `listEligibleUnanalyzedSessions()` — the marker anti-join that shares its core predicate with the trigger's pre-flight count, so the pre-flight count and the workflow's analysis-input enumeration cannot drift.

A job is treated as Claude when its **effective agent** is Claude — the ticket-level `agent` if set, otherwise the project-level `defaultAgent`. Non-Claude jobs are silently filtered out at enumeration time.

The list returns **all** eligible-unanalyzed Claude sessions — every distinct session of every ticket, across **all** ticket outcomes (not only shipped) and **not** de-duplicated per ticket — ordered by ascending `startedAt` for deterministic processing. A session is eligible only if it is a COMPLETED Claude job belonging to a ticket, with a captured transcript (`rawArtifactKey` present), and no `InsightsAnalyzedSession` marker.

**Response** (200 OK):
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

---

## GET /api/admin/insights/jobs/:jobId/raw-native

Stream a single raw native Claude Code session JSONL artifact for a Claude job. This is the **only** workflow-token-authenticated cross-tenant read in the platform — it intentionally crosses project boundaries because the insights analyzer must see sessions from every project.

**Authentication**: A-WORKFLOW

**Server flow**:
1. `validateWorkflowAuth(request)` → 401 on failure.
2. Look up the job and verify, via the shared predicate, that it is a Claude job belonging to a ticket with a captured transcript. If not (non-Claude effective agent, no ticket, or `rawArtifactKey` absent) → 404. There is **no** shipped-outcome gate — sessions of any ticket outcome are readable. This prevents a compromised `WORKFLOW_API_TOKEN` from enumerating non-Claude artifacts.
3. Stream the artifact at `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` from Vercel Blob.

**Response** (200 OK):
- `Content-Type: application/gzip`
- Body: the gzipped native JSONL stream

**Errors**:
- `401`: Invalid or missing workflow token
- `404`: Job is not a Claude job, has no ticket, or has no captured transcript
- `502`: Blob backend unreachable

**Security note**: Compromising `WORKFLOW_API_TOKEN` already grants write access to log artifacts across the platform; adding read access for Claude raw artifacts only does not meaningfully expand the trust boundary. The predicate check before streaming is a defense-in-depth filter to prevent token misuse beyond the intended scope.

---

## Page Routes

`GET /admin` and `GET /admin/insights` are Server Components gated by `requireAdminPageOrNotFound` (the page-route variant that calls Next.js `notFound()` rather than returning a `Response`). `/admin` redirects to `/admin/insights`. Both responses carry `Cache-Control: private, no-store`; the admin shell layer sets `X-Frame-Options: DENY` on top-level admin paths to prevent click-jacking of the shell itself.

Non-admin requests to any `/admin/...` path — including paths that don't resolve to a defined page route — produce a Not Found response indistinguishable from a request to `/this-path-does-not-exist`.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `ADMIN_ALLOWLIST` | _(empty — no admins)_ | Comma-separated list of admin email addresses. Re-parsed on every request. |
| `INSIGHTS_RUN_TIMEOUT_MINUTES` | `60` | Reconciliation cutoff for orphaned RUNNING rows. |
| `WORKFLOW_API_TOKEN` | _(required in prod)_ | Bearer token for workflow-authenticated endpoints. |
| `BLOB_READ_WRITE_TOKEN` | _(required in prod)_ | Vercel Blob credentials for `insights/reports/*.html`. |
| `ANTHROPIC_API_KEY` | _(required in workflow)_ | Used by the workflow to authenticate `bunx @anthropic-ai/claude-code /insights`. |

## Workflow

`.github/workflows/insights-analyze.yml` is dispatched on the ai-board repository (not on the external target). It enumerates every eligible-unanalyzed Claude session (the `expected` count), then downloads each session's raw native JSONL with a **404-tolerant** per-job fetch: a `200` adds the job to the readable `analyzedJobIds` set, a `404` (transcript pruned between enumeration and download) is skipped without aborting, and any other non-200 fails the run. If every session was pruned the run fails with `"No readable Claude sessions available"`. It then runs `bunx @anthropic-ai/claude-code /insights --sessions ./sessions --output ./report.html` (the genuine slash command — never a free-text prompt), validates the produced HTML contains the analyzer's characteristic markers (`Suggested CLAUDE.md additions`, `Big wins`, `Horizon`), uploads via `PUT /finalize`, and PATCHes the report and job to terminal status — sending `analyzedJobIds`, `expectedSessionsCount`, and `ticketsCount` on COMPLETED. The job has a 50-minute timeout — 10 minutes below the default 60-minute `INSIGHTS_RUN_TIMEOUT_MINUTES` — so the workflow's own failure path runs before reconciliation auto-FAILs the row.

```mermaid
sequenceDiagram
    participant Admin as Admin user
    participant Web as Web app (Next.js)
    participant DB as PostgreSQL
    participant GH as GitHub Actions
    participant Claude as claude /insights
    participant Blob as Vercel Blob

    Admin->>Web: POST /api/admin/insights/trigger
    Web->>DB: reconcile orphans + pre-flight + concurrency check
    Web->>DB: INSERT InsightsReport(RUNNING) + Job(insights-analyze, PENDING)
    Web->>GH: workflow_dispatch insights-analyze.yml
    Web-->>Admin: 201 { id, status: RUNNING }

    GH->>Web: GET /api/admin/insights/jobs (all eligible-unanalyzed)
    Web-->>GH: { jobs: [{ jobId, projectId, ticketId, rawArtifactKey }] }
    GH->>Web: GET /api/admin/insights/jobs/:jobId/raw-native (per job, 404-tolerant)
    Web-->>GH: gzipped native JSONL
    GH->>Claude: bunx claude-code /insights --sessions --output
    Claude-->>GH: report.html
    GH->>Web: PUT /api/admin/insights/reports/:id/finalize (HTML body)
    Web->>Blob: upload insights/reports/:id.html
    Web-->>GH: { artifactKey, artifactSize }
    GH->>Web: PATCH status COMPLETED (analyzedJobIds + expected + tickets)
    Web->>DB: atomic UPDATE + insert session markers (one tx)
    Web-->>GH: { id, status, completedAt }
```
