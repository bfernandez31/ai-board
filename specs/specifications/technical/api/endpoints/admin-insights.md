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
| `/api/admin/insights/jobs` | GET | A-WORKFLOW | Window enumeration (called by workflow) |
| `/api/admin/insights/jobs/:jobId/raw-native` | GET | A-WORKFLOW | Cross-tenant raw native session stream (called by workflow) |

---

## GET /api/admin/insights/preflight

Mirror the trigger endpoint's pre-flight logic without mutating any state. Used by the page to decide whether to enable the "Run new analysis" button and which refusal message (if any) to display.

**Authentication**: A-ADMIN

**Response** (200 OK):
```json
{
  "canTrigger": true,
  "shippedSincePreviousRun": 4,
  "previousRunEnd": "2026-05-04T09:00:00.000Z",
  "runningSince": null,
  "refusal": null
}
```

When `canTrigger` is `false`, `refusal` carries `{ refusalCode, message }` matching the trigger refusal body so the UI can render the message verbatim without firing a POST.

**Non-admin response**: Byte-equivalent 404.

---

## POST /api/admin/insights/trigger

Start a new Insights analysis run. Subject to the pre-flight (shipped Claude tickets) and concurrency (no RUNNING row) gates.

**Authentication**: A-ADMIN

**Request body**: empty (`Content-Type: application/json` accepted with empty body).

**Server flow** (in order):

1. `requireAdminOrNotFound(request)` → admin email.
2. `reconcileOrphanedRunningReports(new Date())` — lazy reconciliation auto-FAILs any RUNNING row older than `INSIGHTS_RUN_TIMEOUT_MINUTES`.
3. Pre-flight: compute `prevEnd = getLastCompletedRunEnd()` and `count = countShippedClaudeTicketsSince(prevEnd)`. If `count === 0`:
   - When `prevEnd === null` → refuse with `NO_CLAUDE_JOBS` (no Claude tickets have shipped yet).
   - Otherwise → refuse with `NO_NEW_SHIPPED` with the prior run's `periodEnd` as the boundary; never synthesize `new Date()` as a fabricated "last run" timestamp.
4. Concurrency gate: if a RUNNING row exists, refuse with `ALREADY_RUNNING`.
5. Compute period bounds — `periodStart = prevEnd ?? getEarliestClaudeJobTimestamp()`; `periodEnd = now`.
6. In a single transaction:
   - Insert `InsightsReport` with `status='RUNNING'`, `generatedAt=now`, `periodStart`, `periodEnd`.
   - Insert companion `Job` with `command='insights-analyze'`, `status='PENDING'`, `ticketId=null`, `projectId=<host project id>` (the ai-board host project — used so existing project-scoped log queries resolve).
   - Link the report to the job via `jobId`.
7. Dispatch `.github/workflows/insights-analyze.yml` on the ai-board repository with inputs `report_id`, `job_id`, `period_start`, `period_end`, `app_url`.
8. On Octokit `RequestError`, atomically transition the report to FAILED with `errorReason="Workflow dispatch failed: <status> <message>"`, delete the job row, and return 502 with `DISPATCH_FAILED`.

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
{ "refusalCode": "NO_NEW_SHIPPED", "message": "No new shipped tickets since last run on 2026-05-04T09:00:00.000Z" }
```
```json
{ "refusalCode": "NO_CLAUDE_JOBS", "message": "No shipped Claude tickets to analyze yet" }
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

The 200-row cap is enforced at the database query level, not only at response serialization. The driving `Job.workflowRunId` is joined into each row so the client can render the FAILED diagnostics view's GitHub Actions link without a second round trip.

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
      "ticketsCount": 17,
      "errorReason": null,
      "completedAt": "2026-05-11T12:39:12.345Z",
      "createdAt": "2026-05-11T12:34:56.789Z",
      "workflowRunId": "8123456789"
    }
  ]
}
```

`workflowRunId` is the underlying `Job.workflowRunId` serialized as a decimal string (BigInt → string at the API boundary) or `null` when the linked job has no recorded run id (e.g. dispatch failed atomically, or the row was auto-FAILED by reconciliation before dispatch). The client composes the GitHub Actions run URL from this value plus the centralized-workflow repository configuration (`GITHUB_OWNER` / `GITHUB_REPO`).

`artifactKey` is never returned. The client fetches the HTML body via `GET /api/admin/insights/reports/:id/html`.

**Non-admin response**: Byte-equivalent 404.

---

## GET /api/admin/insights/reports/:id

Fetch a single report's metadata.

**Authentication**: A-ADMIN

**Response** (200 OK): Same shape as one entry from the list endpoint.

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
  sessionsCount?: number,    // required when status === 'COMPLETED'
  ticketsCount?: number,     // required when status === 'COMPLETED'
  artifactKey?: string,      // required when status === 'COMPLETED'; matches /^insights\/reports\/\d+\.html$/
  artifactSize?: number,     // required when status === 'COMPLETED'
  errorReason?: string,      // required when status === 'FAILED'; 1–500 chars
}
```

On `status === 'COMPLETED'`, the endpoint re-fetches the uploaded blob and re-runs `validateInsightsOutput` server-side as defense in depth. If validation fails, the COMPLETED transition is overridden into FAILED with `errorReason = "Insights output validation failed"`.

**Response** (200 OK):
```json
{ "id": 42, "status": "COMPLETED", "completedAt": "2026-05-11T12:39:12.345Z" }
```

When the atomic update finds no RUNNING row with that id (late callback after auto-FAIL), the endpoint returns 200 with the current terminal row's metadata — an idempotent no-op.

**Errors**:
- `400`: Validation failed
- `401`: Invalid or missing workflow token
- `404`: Report not found (workflow-only endpoint — JSON `{ "error": "Not Found" }`, not the byte-equivalent 404 used for admin endpoints)

**Side effects**:
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

Enumerate Claude jobs whose ticket has shipped within the given half-open window. The workflow calls this immediately after dispatch to determine which raw native session artifacts to download.

**Authentication**: A-WORKFLOW

**Query parameters**:
- `periodStart` (ISO 8601, required) — inclusive lower bound
- `periodEnd` (ISO 8601, required) — exclusive upper bound

Validation rejects `periodStart >= periodEnd` with 400.

**Server flow**: Calls `listShippedClaudeJobsForWindow(periodStart, periodEnd)` — the **same** predicate the trigger's pre-flight uses, so the pre-flight count and the workflow's analysis-input enumeration cannot drift.

A job is treated as Claude when its **effective agent** is Claude — the ticket-level `agent` if set, otherwise the project-level `defaultAgent`. Non-Claude jobs are silently filtered out at enumeration time.

The list is de-duplicated by `ticketId` (earliest job by `startedAt` wins) so the workflow's session count can never exceed the pre-flight's distinct-ticket count for the same window.

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
2. Look up the job and verify, via the shared predicate, that it is a Claude job whose ticket has shipped. If not (non-Claude job, no ticket, ticket not shipped) → 404. This prevents a compromised `WORKFLOW_API_TOKEN` from enumerating non-Claude artifacts.
3. Stream the artifact at `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` from Vercel Blob.

**Response** (200 OK):
- `Content-Type: application/gzip`
- Body: the gzipped native JSONL stream

**Errors**:
- `401`: Invalid or missing workflow token
- `404`: Job is not a Claude job, ticket has not shipped, or artifact missing
- `502`: Blob backend unreachable

**Security note**: Compromising `WORKFLOW_API_TOKEN` already grants write access to log artifacts across the platform; adding read access for shipped Claude raw artifacts only does not meaningfully expand the trust boundary. The predicate check before streaming is a defense-in-depth filter to prevent token misuse beyond the intended scope.

---

## Page Routes

`GET /admin` and `GET /admin/insights` are Server Components gated by `requireAdminPageOrNotFound` (the page-route variant that calls Next.js `notFound()` rather than returning a `Response`). `/admin` redirects to `/admin/insights`. Both responses carry `Cache-Control: private, no-store`; the admin shell layer sets `X-Frame-Options: DENY` on top-level admin paths to prevent click-jacking of the shell itself.

`/admin/insights` declares its document title via the Next.js segment-level `export const metadata: Metadata = { title: 'Insights LLM' }`, so the browser tab and admin sidebar entry stay in sync. The page itself renders no internal page-level heading.

Non-admin requests to any `/admin/...` path — including paths that don't resolve to a defined page route — produce a Not Found response indistinguishable from a request to `/this-path-does-not-exist`.

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `ADMIN_ALLOWLIST` | _(empty — no admins)_ | Comma-separated list of admin email addresses. Re-parsed on every request. |
| `INSIGHTS_RUN_TIMEOUT_MINUTES` | `60` | Reconciliation cutoff for orphaned RUNNING rows. |
| `WORKFLOW_API_TOKEN` | _(required in prod)_ | Bearer token for workflow-authenticated endpoints. |
| `BLOB_READ_WRITE_TOKEN` | _(required in prod)_ | Vercel Blob credentials for `insights/reports/*.html`. |
| `ANTHROPIC_API_KEY` | _(required in workflow)_ | Used by the workflow to authenticate `bunx @anthropic-ai/claude-code /insights`. |
| `GITHUB_OWNER` / `GITHUB_REPO` | _(required in prod)_ | AI-BOARD centralized-workflow repository identity. Used both to dispatch `insights-analyze.yml` and to compose the GitHub Actions run URL surfaced in the FAILED diagnostics view (`https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/actions/runs/{workflowRunId}`). |

## Workflow

`.github/workflows/insights-analyze.yml` is dispatched on the ai-board repository (not on the external target). It downloads the raw native session JSONL for each enumerated job, runs `bunx @anthropic-ai/claude-code /insights --sessions ./sessions --output ./report.html` (the genuine slash command — never a free-text prompt), validates the produced HTML contains the analyzer's characteristic markers (`Suggested CLAUDE.md additions`, `Big wins`, `Horizon`), uploads via `PUT /finalize`, and PATCHes the report and job to terminal status. The job has a 50-minute timeout — 10 minutes below the default 60-minute `INSIGHTS_RUN_TIMEOUT_MINUTES` — so the workflow's own failure path runs before reconciliation auto-FAILs the row.

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

    GH->>Web: GET /api/admin/insights/jobs?periodStart&periodEnd
    Web-->>GH: { jobs: [{ jobId, projectId, ticketId, rawArtifactKey }] }
    GH->>Web: GET /api/admin/insights/jobs/:jobId/raw-native (per job)
    Web-->>GH: gzipped native JSONL
    GH->>Claude: bunx claude-code /insights --sessions --output
    Claude-->>GH: report.html
    GH->>Web: PUT /api/admin/insights/reports/:id/finalize (HTML body)
    Web->>Blob: upload insights/reports/:id.html
    Web-->>GH: { artifactKey, artifactSize }
    GH->>Web: PATCH /api/admin/insights/reports/:id/status (COMPLETED + counts)
    Web->>DB: atomic UPDATE WHERE status='RUNNING'
    Web-->>GH: { id, status, completedAt }
```
