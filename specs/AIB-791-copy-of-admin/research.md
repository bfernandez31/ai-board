# Research: Admin Section + Claude Code Insights Report

**Feature**: AIB-791 — Copy of Admin section with Claude Code Insights report
**Date**: 2026-05-11

This document resolves technical decisions left implicit by `spec.md`, inventories existing files
the implementation must touch (or deliberately avoid duplicating), and pins the patterns the new
code MUST follow so prior-attempt regressions (AIB-777 / AIB-786 / AIB-787 / AIB-790) cannot
recur.

## Decisions

### D-1: Blob key shape and content type for the report artifact
- **Decision**: Store the report HTML at `insights/reports/<reportId>.html` with
  `contentType: 'text/html; charset=utf-8'` and `access: 'private'`. The reportId is the
  autoincrement primary key of the new `InsightsReport` row (matching the deterministic-key
  convention used by `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz`).
- **Rationale**: The iframe `src` points directly at `/api/admin/insights/reports/:id/html`,
  which streams the blob with `Content-Type: text/html; charset=utf-8`. Storing as raw HTML
  (not gzipped) keeps the serving endpoint simple — no Content-Encoding negotiation, no
  decompression on the host — and matches the access pattern: each report is served once per
  view, not as a download. Reports are expected to be a few hundred KB; gzip's win is small
  relative to the simplicity cost.
- **Alternatives considered**:
  - Gzip at storage + `Content-Encoding: gzip` on serve — adds a redactor-style decompress
    fall-through and risks `application/gzip` leaking through if a header is dropped.
  - Reuse `uploadJobLogArtifact` directly — its hardcoded `contentType: 'application/gzip'`
    makes the iframe try to download the file. Rejected.
  - Use `addRandomSuffix: true` — defeats the deterministic-key contract that makes the
    `<reportId>` → blob key mapping inferable without a lookup column.

### D-2: Storage uploader/reader helpers — extend the existing blob client wrapper
- **Decision**: Add two new exported functions in `app/lib/blob/client.ts`:
  `uploadInsightsReportArtifact(key, html)` and `streamInsightsReportArtifact(key)`. Both follow
  the existing `uploadJobLogArtifact` / `streamJobLogArtifact` shape — `access: 'private'`,
  `addRandomSuffix: false`, `allowOverwrite: true`, `requireToken()` to surface a clear error
  when `BLOB_READ_WRITE_TOKEN` is missing.
- **Rationale**: Keeps all Vercel Blob access in a single wrapper. A future audit ("where do we
  call `@vercel/blob`?") finds one file. The wrapper already centralizes private-access keys and
  404→null translation. Adding two siblings beats creating a parallel module.
- **Alternatives considered**: New file `app/lib/blob/insights.ts` — duplicates the token plumbing
  and `get()` 404 handling. Rejected on cohesion grounds.

### D-3: Job command identifier for the insights run
- **Decision**: `insights-analyze` (a new value in the existing `Job.command` VarChar column —
  not an enum migration). Update the `command` documentation comment in
  `prisma/schema.prisma:32` and the CLAUDE.md command list.
- **Rationale**: `Job.command` is already `String @db.VarChar(50)` (prisma/schema.prisma:32); no
  migration needed for a new value. The existing pipeline (workflow dispatch, status PATCH,
  log artifact upload, push notification) already keys on `command` and `status` without
  hardcoded enums.
- **Alternatives considered**: A new `InsightsJob` model — gratuitous duplication; we already
  have `Job` with `JobLog`, retries, push hooks, etc. Rejected.

### D-4: Where reports' identity and lifecycle live — a dedicated `InsightsReport` model
- **Decision**: Introduce a new model `InsightsReport` (see `data-model.md`). It is NOT a
  subtype of `Job`; it has its own status enum (`InsightsRunStatus = RUNNING | COMPLETED |
  FAILED`) and lifecycle. It optionally references a `Job` row (the workflow's job) for log
  artifact traceability but does not require one (the row is created before dispatch — see D-5).
- **Rationale**: The report has its own metadata (period bounds, sessions/tickets counts,
  blob key, error reason) that does not map cleanly onto `Job`. Coupling them would force
  artificial fields on `Job` ("periodEndsAt"?) and pollute the existing job-status state
  machine. Two related rows (an `InsightsReport` and a `Job`) is cleaner.
- **Alternatives considered**: Store everything on `Job` with a `command='insights-analyze'`
  marker and a JSON column — works but leaks insights-only fields into every job's row footprint
  and breaks the canonical phrasing query (SC-005). Rejected.

### D-5: Dispatch failure handling — leave a FAILED row, do not DELETE
- **Decision**: When the GitHub workflow dispatch call fails AFTER the `InsightsReport` row has
  been created in RUNNING status, the trigger endpoint transitions the row to FAILED with reason
  `"Workflow dispatch failed: <non-secret reason>"` (atomic conditional update: `WHERE id=? AND
  status='RUNNING'`). It does NOT delete the row.
- **Rationale**: FR-013 mandates an auditable record for every accepted trigger, including
  dispatch failures. This deliberately diverges from the existing `Job` rollback in
  `lib/workflows/transition.ts:365` (which deletes on dispatch failure) because the spec
  explicitly chooses auditability over "clean slate". The FAILED row also does NOT advance the
  high-water mark, so the next trigger re-covers the same window (FR-009 + edge case).
- **Alternatives considered**: Mirror transition.ts's DELETE exactly — closer to the existing
  pattern but violates FR-013. Rejected by spec.

### D-6: Pre-flight + reconciliation share a single predicate file
- **Decision**: Place the shared predicate in `app/lib/insights/predicate.ts` with two exports:
  `countShippedClaudeTicketsSince(since: Date | null): Promise<number>` and
  `listShippedClaudeJobsForWindow(start: Date, end: Date): Promise<JobRef[]>` (the workflow's
  enumeration step calls the second via an API endpoint that wraps it). Both functions call a
  single private query that joins `Job → Ticket → Project` and applies the effective-agent
  predicate inline. The same predicate function is the ONLY allowed source of truth for "is this
  job Claude?" in this feature.
- **Rationale**: FR-025 forbids drift between pre-flight ("count shipped tickets") and the
  workflow's analysis-input enumeration. Co-locating both in one module with one private query
  makes drift physically harder; any future change to the predicate edits one file.
- **Alternatives considered**: Inline the predicate everywhere — exactly the AIB-787-class
  failure mode (pre-flight queried `TicketOutcome.shippedAt`, workflow queried `Job` rows; they
  drifted). Rejected.

### D-7: Effective-agent predicate
- **Decision**: A job's effective agent is `ticket.agent ?? ticket.project.defaultAgent ??
  'CLAUDE'`. A job is "Claude" iff this resolves to `'CLAUDE'`. This matches the production
  predicate already used at `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-62`.
- **Rationale**: Reuses the exact predicate that AIB-779/AIB-783 ship-validated. The
  hardcoded `'CLAUDE'` fallback covers the legacy case of a project created before
  `defaultAgent` was non-nullable.
- **Alternatives considered**: `ticket.agent === 'CLAUDE'` alone — explicitly identified as a
  prior-attempt bug (silently dropped legitimate Claude work whose agent was inherited from the
  project default). Rejected.

### D-8: Output validation — structural-marker check
- **Decision**: Validate the HTML produced by `/insights` against a list of substring markers
  before transitioning the row to COMPLETED. The marker list is colocated in
  `app/lib/insights/output-validation.ts` and includes (at minimum) `"Suggested CLAUDE.md
  additions"`, `"Big wins"`, `"Horizon"`, and a friction-section header. Validation runs in the
  workflow (so a failed run never reaches the artifact-upload step with bad output) AND server-
  side on the `/api/admin/insights/reports/:id/status` PATCH (defense in depth — even if the
  workflow tooling drifts and forgets to validate, the server rejects). On failure, the row is
  marked FAILED with reason `"Insights output validation failed"`.
- **Rationale**: FR-026 + SC-011. Validating in two places means a regression in either layer
  still gets caught.
- **Alternatives considered**: HTML-parser-based structural check (parse → find a heading
  matching regex) — overkill. Substring matching is sufficient because the analyzer's structural
  markers are stable strings.

### D-9: Sandbox iframe attributes and CSP
- **Decision**: The host page renders `<iframe sandbox="allow-scripts" src="/api/admin/insights/
  reports/:id/html">`. Critically `allow-same-origin` is OMITTED so the iframe is treated as a
  unique opaque origin. The serving endpoint sets:
  - `Content-Type: text/html; charset=utf-8`
  - `Content-Security-Policy: frame-ancestors 'self'` (the host application — admin shell — may
    frame this endpoint; nothing else may).
  - `X-Frame-Options: DENY` is set on the **page** route `/admin/*` (not the report-body
    endpoint, which is intentionally framable by `'self'`). Effectively: top-level admin pages
    cannot be framed by anyone; report-body endpoints can only be framed by same-origin (and
    the iframe sandbox neutralizes their access to host state).
  - `Cache-Control: private, max-age=300` to keep the response off shared caches.
- **Rationale**: FR-018 + edge case "hostile crafted report". `sandbox=""` (the AIB-790
  regression) disables scripts and breaks `/insights`' interactive content. Omitting
  `allow-same-origin` while keeping `allow-scripts` is the documented MDN pattern for "run JS
  but treat as foreign origin".
- **Alternatives considered**: `srcDoc` injection — explicitly forbidden by FR-018 because the
  inline HTML inherits the host's origin unless `sandbox` is set, and `sandbox=""` (no scripts)
  breaks the analyzer.

### D-10: Unauthorized response shape — call Next.js `notFound()` and never branch on JSON
- **Decision**: Every admin route (page + API) calls `notFound()` from `next/navigation` (for
  page routes) or returns `new Response(null, { status: 404 })` whose body and headers match
  Next.js's default 404 byte-for-byte (for API routes). Tests assert byte equality against a
  control request to `/this-path-does-not-exist`.
- **Rationale**: FR-003 + SC-002. The existing app has no root `app/not-found.tsx`, so Next.js
  renders the default 404. We DO NOT add a custom `not-found.tsx` (which would change the baseline
  used by the byte-equality test). The API-side returns an empty 404 with `Content-Type:
  text/html; charset=utf-8` matching Next.js's own catch-all response.
- **Alternatives considered**: Returning `{ error: "Not Found" }` JSON — explicitly identified
  as an AIB-786 regression (revealed the area's existence via JSON payload). Rejected.

### D-11: Admin allowlist source
- **Decision**: Single env var `ADMIN_ALLOWLIST` containing a comma-separated list of email
  addresses (normalized via `.toLowerCase().trim()`). Resolved at request time (no module-level
  caching) so config rotations take effect on the next request without restart (SC-009). Lookup
  helper lives at `app/lib/auth/admin.ts` with `getAdminAllowlist()` and
  `isUserAdmin(email: string | null | undefined): boolean`.
- **Rationale**: Matches `DEV_LOGIN_*` env-var style. No DB migration, no UI to grant/revoke. The
  resolved-at-request-time semantics is critical for SC-009 (no restart required).
- **Alternatives considered**: Cache the parsed list at module level — silently breaks SC-009.
  Rejected.

### D-12: Concurrency and orphan reconciliation
- **Decision**: The trigger endpoint and the list endpoint both call
  `reconcileOrphanedRunningReports(now: Date)` BEFORE evaluating their main logic. That function
  uses an atomic `prisma.insightsReport.updateMany({ where: { status: 'RUNNING', createdAt:
  { lt: cutoff } }, data: { status: 'FAILED', completedAt: now, errorReason: 'Run timed out
  — workflow did not report terminal status' } })` so concurrent reconciliation calls cannot
  flip rows backwards. Late workflow callbacks PATCH the row via
  `prisma.insightsReport.updateMany({ where: { id, status: 'RUNNING' }, data: … })` — the same
  guard pattern used by `app/api/jobs/[id]/status/route.ts:271`.
- **Rationale**: FR-014 + FR-015 + SC-012. Atomic conditional updates are the canonical pattern
  in this repo (transition.ts:177, status/route.ts:271). A naïve `update({ where: { id }, … })`
  is exactly the AIB-787 regression.
- **Alternatives considered**: Distributed lock (`SELECT … FOR UPDATE`) — overkill for a manual
  trigger that runs hours apart.

### D-13: Period semantics and high-water mark sourcing
- **Decision**: The "previous successful run's analysis-end timestamp" is computed by
  `getLastCompletedRunEnd(): Promise<Date | null>` — `SELECT periodEnd FROM InsightsReport WHERE
  status='COMPLETED' ORDER BY periodEnd DESC LIMIT 1`. On first-ever run, this returns `null`,
  and the workflow's `periodStart` becomes the timestamp of the oldest Claude job ever
  (`SELECT MIN(startedAt) FROM Job JOIN Ticket ON … WHERE effective_agent='CLAUDE'`). Both
  reads happen inside the trigger handler in a single transaction along with the RUNNING-row
  insert so the high-water mark cannot change between read and insert.
- **Rationale**: FR-009. The single-transaction approach prevents two near-simultaneous triggers
  from both seeing the same high-water mark (although the concurrency gate also prevents two
  RUNNING rows from coexisting; this is belt-and-suspenders).

### D-14: Run timeout — `INSIGHTS_RUN_TIMEOUT_MINUTES` env var, default 60
- **Decision**: Single env var, parsed as integer minutes, defaulting to 60. Read at request
  time (no module caching). Validation: `Math.max(1, parseInt(value, 10) || 60)` mirroring
  `LOG_RETENTION_DAYS` parsing at `app/api/maintenance/prune-logs/route.ts:16`.
- **Rationale**: FR-027 + matches existing env-var parsing idiom.

### D-15: Past-reports list cap — DB-level LIMIT, not slice-after-fetch
- **Decision**: `prisma.insightsReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 200 })`.
  The `take: 200` is hardcoded inside the list endpoint handler — not configurable, not
  paginated.
- **Rationale**: FR-017 + SC-007. Slicing in JS after fetching all rows is the
  attack-surface-y mistake.

### D-16: Notification-free observation
- **Decision**: Insights status transitions do NOT call `sendJobCompletionNotification` (the
  hook fired at `app/api/jobs/[id]/status/route.ts:323`). The Insights workflow PATCHes a
  separate endpoint (`PATCH /api/admin/insights/reports/:id/status`) that is intentionally
  scoped to InsightsReport rows only and does not run job-completion side effects.
- **Rationale**: FR-022 prohibits notifications. Reusing `/api/jobs/:id/status` would fire push
  notifications even though we want pull-only.
- **Alternatives considered**: Reuse `/api/jobs/:id/status` with a `command='insights-analyze'`
  branch in `handleJobCompletionAutoTransition` — adds an off-by-one risk and couples insights
  state to job state. Rejected.

---

## Existing Files

This inventory identifies real files the implementation must touch (extend) or reference
(reuse-as-is). New files have NO existing equivalent.

### To extend (modify in place)

| File | What it covers | Plan action |
|------|----------------|-------------|
| `prisma/schema.prisma:29-81, 110-147, 173-215, 338-367` | Job, Project, Ticket, JobStatus, Agent enums | Add `InsightsReport` model + `InsightsRunStatus` enum after the existing `Job`/`JobLog`. Document `insights-analyze` as a valid `Job.command` value in the model's docstring. |
| `app/lib/blob/client.ts:1-64` | Vercel Blob put/get/del wrapper for log artifacts | Add `uploadInsightsReportArtifact(key, html)` and `streamInsightsReportArtifact(key)` siblings following the `uploadJobLogArtifact`/`streamJobLogArtifact` shape. |
| `CLAUDE.md` (job command list) | Documents Job command identifiers | Add `insights-analyze` to the bullet list under "Job commands". |
| `components/layout/header.tsx:20-80` and `components/navigation/nav-items.ts:12-19` | Global nav | NO changes — admin link is intentionally invisible (FR-001, FR-002). Verify no accidental admin link slips in. |
| `next.config.ts` | Next.js config | Add `headers()` rule scoped to `/admin/:path*` returning `X-Frame-Options: DENY` and `Cache-Control: private, no-store`. Report-body endpoint sets its own headers. |

### To create (new files)

| File | Purpose |
|------|---------|
| `prisma/migrations/<timestamp>_add_insights_report/migration.sql` | Migration for `InsightsReport` table + `InsightsRunStatus` enum + indexes (status, generatedAt). |
| `app/admin/layout.tsx` | Admin shell layout — server component, checks `isUserAdmin(session.user.email)`; on failure calls `notFound()`. Renders a minimal sidebar with one entry: "Insights". |
| `app/admin/page.tsx` | Admin root — server component, redirects authenticated allowlisted user to `/admin/insights`. Calls `notFound()` for non-admins (same as layout). |
| `app/admin/insights/page.tsx` | Insights page — server component, fetches latest COMPLETED report + list (via DB or proxied through the list endpoint). Hosts client island for the iframe and Run-analysis button. |
| `app/admin/not-found.tsx` | (Intentionally omitted — see D-10.) |
| `components/admin/insights/insights-report-view.tsx` | Client component — sandboxed iframe, metadata header (canonical phrasing), past-reports list with selection. |
| `components/admin/insights/run-analysis-button.tsx` | Client component — POSTs to trigger endpoint; surfaces refusal messages. |
| `components/admin/insights/report-error-placeholder.tsx` | Stable error placeholder ("Report content is no longer available") for blob-404 fallback (FR-024). |
| `app/lib/auth/admin.ts` | `getAdminAllowlist()`, `isUserAdmin(email)`, `requireAdminOrNotFound(request)` (returns the authenticated admin email or calls `notFound()` / returns a 404 Response, mirroring `app/lib/auth/dev-login.ts`'s structure). |
| `app/lib/insights/predicate.ts` | `countShippedClaudeTicketsSince(since)`, `listShippedClaudeJobsForWindow(start, end)`, single private predicate (see D-6). |
| `app/lib/insights/output-validation.ts` | `validateInsightsOutput(html: string): { ok: true } \| { ok: false; reason: string }` — substring marker checks (D-8). |
| `app/lib/insights/reconcile.ts` | `reconcileOrphanedRunningReports(now: Date)` — atomic updateMany using `INSIGHTS_RUN_TIMEOUT_MINUTES` (D-12, D-14). |
| `app/lib/insights/state-machine.ts` | `canTransition(from, to)`, mirroring `app/lib/job-state-machine.ts:1-77` shape. |
| `app/lib/insights/repository.ts` | DB access helpers: `createRunningReport`, `getLastCompletedRunEnd`, `getLatestCompletedReport`, `listReports(limit=200)`, `getReportById`, `markCompleted(id, fields)`, `markFailed(id, reason)`. All status transitions go through atomic `updateMany`. |
| `app/lib/insights/blob-keys.ts` | `buildInsightsReportKey(reportId): string` returning `insights/reports/${reportId}.html`. Mirrors `app/lib/logs/artifact-key.ts:1-23`. |
| `app/api/admin/insights/reports/route.ts` | `GET` — admin-gated list endpoint (runs reconciliation first). |
| `app/api/admin/insights/reports/[id]/route.ts` | `GET` — admin-gated single-report metadata fetch. |
| `app/api/admin/insights/reports/[id]/html/route.ts` | `GET` — admin-gated streaming of the HTML artifact. Sets the CSP and frame-ancestors headers from D-9. |
| `app/api/admin/insights/reports/[id]/status/route.ts` | `PATCH` — workflow-token-gated terminal status update. Atomic `updateMany` (mirrors `app/api/jobs/[id]/status/route.ts:271`). |
| `app/api/admin/insights/reports/[id]/finalize/route.ts` | `PUT` — workflow-token-gated artifact upload (proxies to `uploadInsightsReportArtifact`; workflow does NOT hold blob credentials). |
| `app/api/admin/insights/trigger/route.ts` | `POST` — admin-gated trigger (reconcile → pre-flight → concurrency → create row → dispatch). |
| `app/api/admin/insights/preflight/route.ts` | `GET` — admin-gated; returns pre-flight count + refusal message (for the UI to disable the button without committing to a trigger). |
| `app/api/admin/insights/jobs/route.ts` | `GET` — workflow-token-gated; returns the enumerated `JobRef[]` for the given window (the workflow calls this rather than reaching into the DB directly, keeping the predicate in one place). |
| `app/lib/hooks/queries/use-insights-reports.ts` | TanStack Query hook — 15s polling while a RUNNING row is visible, off otherwise. |
| `.github/workflows/insights-analyze.yml` | New workflow file. Mirrors `speckit.yml` shape (clone, set up, run agent, PATCH status). |
| `.claude/commands/insights-analyze.md` and/or skill in `.claude-plugin/` | Slash-command/skill metadata the workflow invokes inside Claude Code. |

### To reuse as-is (pattern reference, no edits)

| File | Pattern provided |
|------|------------------|
| `lib/workflows/transition.ts:214-389` | Dispatch-then-rollback ordering (we diverge on rollback shape — see D-5, but the dispatch ordering and Octokit error mapping is identical). |
| `app/api/jobs/[id]/status/route.ts:240-340` | Atomic conditional `updateMany` for terminal status transitions, idempotent late-callback handling. |
| `app/api/jobs/[id]/logs/raw-artifact/route.ts:8-112` | Workflow-token-authenticated artifact PUT with content-type and size validation. |
| `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts:10-105` | Authenticated streaming of a blob artifact back to a browser. |
| `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-62` | Effective-agent inline predicate (we extract into `app/lib/insights/predicate.ts` rather than re-inline). |
| `app/lib/job-state-machine.ts:1-77` | Shape of a state-machine module (`canTransition`, `isTerminalStatus`). |
| `app/lib/auth/dev-login.ts:30-46, 85-127` | Pattern for env-var-driven feature gates with timing-safe equality. |
| `lib/db/auth-helpers.ts:30-120` | `verifyProjectAccess`/`verifyTicketAccess` error-throwing shape — we mirror with `requireAdminOrNotFound`. |
| `app/api/maintenance/prune-logs/route.ts:16` | Env-var parsing idiom for integer-valued operator config. |
| `.github/workflows/speckit.yml` | Workflow scaffolding (inputs, agent invocation, status PATCH). |
| `lib/db/users.ts:200-214` | `getCurrentUser(request)` — used inside `requireAdminOrNotFound` to retrieve the authenticated identity. |
| `app/layout.tsx:1-66` | Provider composition — admin layout reuses the existing root providers (no additional providers needed). |
| `app/globals.css:629-689` | Aurora utility classes — we apply `aurora-bg-dialog` / `aurora-bg-card-blue` to the metadata header surface for visual consistency. |

### Existing tests to extend (search FIRST, do not duplicate)

| Test file | Existing coverage | Extension |
|-----------|-------------------|-----------|
| `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` | `shippedAt` capture on ticket SHIP | Add a case asserting that `countShippedClaudeTicketsSince(prevEnd)` agrees with the workflow-side enumeration for a mixed-agent window. |
| `tests/integration/api/jobs/status.test.ts` (if it exists; check `tests/integration/`) | PATCH status atomic-update tests | Adapt as a reference; create a parallel `tests/integration/api/admin/insights/reports.status.test.ts` rather than mix concerns. |
| `tests/unit/lib/auth/dev-login.test.ts` (if it exists) | Env-var-driven auth gate | Create parallel `tests/unit/lib/auth/admin.test.ts`. |

If `tests/integration/api/admin/` does NOT exist, create the folder; the parent `api/` likely
already has subfolders. NO existing test file covers the `/admin/*` route family — all admin
tests will be in new files.

---

## Patterns to Follow

These are the concrete patterns the new code MUST follow. Each is a direct quotation or
near-quotation of existing production code; the implementation should look the same.

### P-1: Atomic conditional update for state-machine transitions
**Reference**: `app/api/jobs/[id]/status/route.ts:271-289`

```ts
const transitionResult = await prisma.job.updateMany({
  where: { id: jobId, status: currentStatus },
  data: updateData,
});

if (transitionResult.count === 0) {
  const currentJob = await prisma.job.findUnique({ where: { id: jobId }, … });
  return NextResponse.json({ id: currentJob!.id, status: currentJob!.status, … }, { status: 200 });
}
```

**Apply where**: Every `InsightsReport` status transition (RUNNING→COMPLETED, RUNNING→FAILED,
RUNNING→FAILED via reconciliation). The `WHERE status='RUNNING'` guard prevents late callbacks
from flipping a row backwards.

### P-2: Dispatch-then-rollback for workflow dispatch failures
**Reference**: `lib/workflows/transition.ts:349-388`

```ts
try {
  await octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id, ref: 'main', inputs });
} catch (githubError) {
  if (githubError instanceof RequestError) {
    // … log …
    await prisma.job.delete({ where: { id: job.id } }).catch(…);
    return { success: false, error: errorMessage, errorCode: 'GITHUB_ERROR' };
  }
  throw githubError;
}
```

**Apply where**: The trigger endpoint, with one deliberate divergence — instead of
`prisma.insightsReport.delete(...)`, the catch block runs an atomic transition to FAILED:
```ts
await prisma.insightsReport.updateMany({
  where: { id: report.id, status: 'RUNNING' },
  data: { status: 'FAILED', errorReason: errorMessage, completedAt: new Date() },
});
```
This divergence is mandated by FR-013 (auditable record for dispatch failures).

### P-3: Workflow-token auth for write endpoints
**Reference**: `app/api/jobs/[id]/logs/raw-artifact/route.ts:8-30`

```ts
const auth = validateWorkflowAuth(request);
if (!auth.isValid) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Apply where**: `PUT /api/admin/insights/reports/:id/finalize` (artifact upload) and
`PATCH /api/admin/insights/reports/:id/status` (terminal status), AND
`GET /api/admin/insights/jobs` (the workflow-only enumeration endpoint).

**Security note**: The workflow-token endpoints DO NOT call `requireAdminOrNotFound` — they
are gated only by the workflow token (the workflow has no user session). Compromise of the
workflow token gives access to insights write endpoints. This matches the existing trust
boundary (the same token controls log artifact uploads for every project's jobs).

### P-4: Effective-agent inline predicate
**Reference**: `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-62`

```ts
const effectiveAgent = job.ticket?.agent ?? job.ticket?.project?.defaultAgent ?? 'CLAUDE';
if (effectiveAgent !== 'CLAUDE') { /* refuse */ }
```

**Apply where**: Inside `app/lib/insights/predicate.ts` — the SINGLE point in this feature
where the predicate appears. Every other consumer (trigger, list, workflow) calls into this
file. No re-implementation anywhere else.

### P-5: Streaming a blob artifact back to a browser
**Reference**: `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw/route.ts:60-95`

```ts
let result;
try {
  result = await streamJobLogArtifact(artifactKey);
} catch (error) {
  return NextResponse.json({ error: 'Blob backend unavailable', code: 'BLOB_UNREACHABLE' }, { status: 502 });
}
if (!result) { /* 404 */ }
return new Response(result.stream, { status: 200, headers });
```

**Apply where**: `GET /api/admin/insights/reports/:id/html`. Differences:
- Content-Type is `text/html; charset=utf-8` (not `application/gzip`).
- The CSP and Cache-Control headers from D-9 are added.
- A blob 404 returns the FR-024 placeholder (200 with the stable error HTML) instead of a 404
  — the row exists, so emitting a true 404 would leak (it would look identical to a non-admin
  hit), but in this context the caller IS an admin and the failure mode "blob removed" should
  be visibly distinct. Implementation: return 200 with a small static HTML body containing
  "Report content is no longer available".

### P-6: Env-var-driven boolean/list config
**Reference**: `app/lib/auth/dev-login.ts:30-46`

```ts
const enabled = env.DEV_LOGIN_ENABLED === 'true';
const secret = env.DEV_LOGIN_SECRET;
if (!enabled || !secret) return false;
```

**Apply where**: `app/lib/auth/admin.ts` — `getAdminAllowlist()` reads `process.env.ADMIN_ALLOWLIST`
fresh on each call, splits on `,`, lowercases, trims, and filters empty entries. No module-level
caching.

### P-7: Lazy reconciliation at every read/write entry point
**Reference**: Pattern is new to this feature (no existing lazy reconciliation in the repo —
see the "Orphan/Stale Job Reconciliation" finding: only inline rollback on dispatch failure).

```ts
// At the top of every list/trigger endpoint:
await reconcileOrphanedRunningReports(new Date());
```

**Apply where**: `GET /api/admin/insights/reports` and `POST /api/admin/insights/trigger`. The
`reconcileOrphanedRunningReports` helper uses the same atomic `updateMany` pattern as P-1 so
concurrent invocations are safe.

### P-8: Provider composition — reuse the existing root providers
**Reference**: `app/layout.tsx:1-66`

The admin shell (`app/admin/layout.tsx`) is a child of the root layout. The root layout already
provides `QueryProvider`, `SessionProvider`, `TooltipProvider`, `Header`, `Footer`, `Toaster`,
`PushOptInPrompt`, `NotificationListener`. The admin layout should NOT re-wrap any of these.

**Note**: The global `Header` is visible to admins. It MUST NOT show an admin link (FR-001).
We achieve this by NOT adding a link in `components/layout/header.tsx`. Admins navigate to
`/admin` by typing it (or via a bookmark); the global header treats it as any other URL.

### P-9: Test parity with a control 404
**Reference**: New pattern. Tests will use a baseline `fetch('/this-path-does-not-exist')`
response captured once per test and assert byte equality (status, body bytes, content-type
header) against every admin route hit by a non-admin/unauthenticated request.

```ts
const controlResponse = await fetch(`${BASE}/this-path-does-not-exist`);
const controlBody = await controlResponse.text();
const controlHeaders = headerSnapshot(controlResponse);

for (const path of ADMIN_PATHS) {
  const r = await fetch(`${BASE}${path}`);
  expect(r.status).toBe(controlResponse.status);
  expect(await r.text()).toBe(controlBody);
  expect(headerSnapshot(r)).toEqual(controlHeaders);
}
```

This is the SC-002-enforcing test. It belongs in `tests/integration/api/admin/insights/
parity-404.test.ts`.

---

## Open Questions

None. All `NEEDS CLARIFICATION` items from `spec.md` were resolved by the spec's Auto-Resolved
Decisions block before this plan was generated; the technical decisions above (D-1 through
D-16) cover only design-level choices that the spec's policy implies but does not pin to a
specific code location.
