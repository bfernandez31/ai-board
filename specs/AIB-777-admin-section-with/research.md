# Phase 0 Research — AIB-777 Admin Insights

**Feature**: Admin section at `/admin` with `/admin/insights` page hosting manually-triggered Claude Code `/insights` reports.
**Branch**: `AIB-777-admin-section-with`
**Date**: 2026-05-10

## Resolved NEEDS CLARIFICATION

The specification's `Auto-Resolved Decisions` block already pinned every policy choice (storage shape, allowlist mechanism, response shape, dispatch model, single-flight semantics, period semantics, agent scope, sandboxing, listing limits, read-only artifacts). Only mechanical decisions remained for Phase 0:

### D1. Sandboxed inline rendering — iframe attributes

- **Decision**: `<iframe sandbox="allow-scripts" src="/api/admin/insights/reports/:id/html" referrerPolicy="no-referrer" />`. The endpoint streams the genuine HTML with `Content-Type: text/html; charset=utf-8`, `Content-Security-Policy: default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`. The `srcdoc` alternative was rejected because reports can exceed ~100 KB and HTML attribute-embedding becomes awkward at that size.
- **Rationale**: `allow-scripts` without `allow-same-origin` puts the iframe in a unique opaque origin — scripts inside the report can run (so any interactive charts produced by `/insights` work), but they cannot read host cookies, host `localStorage`, or the host DOM. Spec FR-018 + Reviewer Notes on the rendering decision require exactly this.
- **Alternatives considered**: `srcdoc` inline (size constraints, awkward escaping); `sandbox=""` (would block charts even when the report renders them with vanilla JS — unnecessary loss of fidelity); raw HTML injection (rejected — `dangerouslySetInnerHTML` against a cross-tenant aggregated artifact violates the constitution's Security-First Design principle).

### D2. Run-record reconciliation cadence

- **Decision**: **Lazy reconciliation** on every admin-insights page render and every trigger-endpoint call. A small helper sweeps any `RUNNING` row whose `startedAt` is older than `INSIGHTS_RUN_TIMEOUT_MS` (default 60 minutes, env-overridable) and updates them to `FAILED` with reason `"Run timed out — workflow did not report terminal status"`. No new scheduled GitHub workflow is added.
- **Rationale**: FR-021 forbids scheduled triggers of *analysis*; reconciliation is not analysis. But adding a scheduled workflow for one safety-net query would be over-engineering for a feature that an operator opens at most a handful of times per week. Lazy reconciliation is idempotent (per spec), constant-time relative to the small number of `RUNNING` rows, and keeps every code path that depends on the single-flight invariant honest. The pre-flight check itself executes during list/trigger reads, so this layering is natural.
- **Alternatives considered**: Dedicated scheduled workflow analogous to `nightly-log-prune.yml` (rejected — extra surface area, more secrets, more YAML for a purely reactive sweep); database row-level lock with `pg_try_advisory_lock` (rejected — overkill for an operator-only feature); Postgres `LISTEN/NOTIFY`-based reconciliation (rejected — same).

### D3. Allowlist parsing & comparison

- **Decision**: Read `ADMIN_ALLOWLIST_EMAILS` once per request; parse as a comma-separated list of trimmed, lower-cased emails into a `Set<string>`. Compare the lower-cased value of `session.user.email` from the authenticated NextAuth session. No DB lookup, no claim trusted from the client. The check returns a single boolean; routes that fail the check return the *same* response shape as a genuinely missing route (404).
- **Rationale**: Mirrors the timing-resistant, env-driven pattern used in `lib/auth/workflow-token.ts:18` (`getAcceptedWorkflowTokens` → `Set` → constant-time membership). Email is the verified identity in the session (see `lib/auth.ts:160-164` — `session.user.id` is set from token). Per-request parsing is acceptable given the small list size; caching would introduce stale-allowlist risk that contradicts SC-009 ("…sees the admin area on their next page request without requiring application restart").
- **Alternatives considered**: Module-level `Set` cached at boot (rejected — would require redeploy to revoke, contradicts SC-009); DB-backed `AdminUser` table (rejected by spec's CONSERVATIVE policy decision — no new schema for admin roles in this ticket); GitHub team membership lookup (rejected — not in scope, requires external API on every request).

### D4. Report HTML artifact key shape

- **Decision**: `insights/reports/<reportId>.html` (gzip optional in v1; the dependency feature's raw artifacts are already gzipped, but `/insights` HTML is single-document and lighter to read at request time as plain HTML). Stored at `access: 'private'` via `app/lib/blob/client.ts`.
- **Rationale**: Mirrors `logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` shape established in `app/lib/logs/artifact-key.ts:1-15`. Reports are application-wide, not per-project, so they live under their own top-level prefix (`insights/reports/...`) instead of being tucked under a project folder. The `reportId` (the database row's primary key) is sufficient for uniqueness; no random suffix needed (`addRandomSuffix: false` matches the existing pattern in `app/lib/blob/client.ts:32`).
- **Alternatives considered**: `insights/<yyyy>/<mm>/<reportId>.html` (rejected — temporal sharding has no benefit at this scale); putting reports under `logs/` (rejected — they aren't logs, retention rules differ per spec's Reviewer Note on the storage decision); embedding HTML in the DB row as a `Text` column (rejected by spec — HTML can be hundreds of kilobytes).

### D5. Period semantics — "previous successful run high-water mark"

- **Decision**: The high-water mark is read with the query `prisma.adminInsightsReport.findFirst({ where: { status: 'COMPLETED' }, orderBy: { periodEnd: 'desc' }, select: { periodEnd: true } })`. The same query is used by both the trigger endpoint (pre-flight + period computation) and the workflow's enumeration step (passed as a workflow input). This guarantees consistency between "what we counted in pre-flight" and "what the workflow analyzes" (FR-025).
- **Rationale**: The trigger endpoint computes `periodStart = previousHighWater ?? earliestClaudeJobStartedAt`, `periodEnd = now()`, and writes both onto the new `RUNNING` row in the same transaction that creates that row. The workflow then reads `periodStart` / `periodEnd` from the run record (passed as workflow inputs) — it never re-derives the bounds. A FAILED run leaves the old high-water mark unchanged (because the FAILED row doesn't qualify for the `findFirst` filter), so the next attempt re-covers the same window.
- **Alternatives considered**: Storing `periodStart` only at workflow finalization (rejected — would mean the pre-flight count and the analysis enumeration could drift if the trigger endpoint and the workflow ran their own queries at different timestamps); using `createdAt` instead of `periodEnd` for ordering (rejected — `createdAt` of a RUNNING row that later becomes COMPLETED would be earlier than its `periodEnd`, ordering by it could produce off-by-one window edges).

### D6. "Shipped tickets since previous run" pre-flight query

- **Decision**: `prisma.ticket.count({ where: { stage: 'SHIP', updatedAt: { gt: previousHighWater } } })` AND that ticket has at least one `Job` with `command IN ('implement','quick-impl')`, `status = 'COMPLETED'`, `updatedAt > previousHighWater`, and (effective agent at job time = CLAUDE). The last conjunct is critical: SC-006 requires zero non-Claude sessions, and FR-025 requires the pre-flight to count the same universe the workflow will enumerate.
- **Rationale**: Spec's "shipped since" is keyed on the SHIP transition timestamp. Tickets carry `stage` and `updatedAt`; the `updatedAt` index (`prisma/schema.prisma:212`) makes the count cheap. Filtering on Claude-specific completed jobs avoids a surprise "passing pre-flight, empty report" when the only shipped tickets in the window were Codex/Mistral/Gemini work. The "effective agent" calculation must use the same fallback as `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-61` — `ticket.agent ?? project.defaultAgent ?? 'CLAUDE'`.
- **Alternatives considered**: Counting *jobs* directly (rejected — spec wording is "tickets shipped"; counting tickets is correct and the joined Claude-job filter handles the "did any Claude work happen" question); checking only `stage = 'SHIP'` regardless of agent (rejected — would let pre-flight pass on a Codex-only window, contradicting Reviewer Note on the agent-scope decision).

### D7. State machine — Insights Report

- **Decision**: Allowed transitions: `RUNNING → COMPLETED`, `RUNNING → FAILED`. No `PENDING` state (the row is created already RUNNING because we want the row to exist before workflow dispatch — see FR-013). No transitions out of terminal states. Atomic conditional writes use the same pattern as `app/api/jobs/[id]/status/route.ts:271-289` (`updateMany({ where: { id, status: 'RUNNING' }, data })`) so a duplicated workflow callback can't double-finalize a row.
- **Rationale**: The Job model has a four-state machine because workflows can be delayed (PENDING → RUNNING). For insights reports, the row is *only* written immediately before `octokit.actions.createWorkflowDispatch()`; if dispatch throws, the row is deleted via the same dispatch-then-rollback pattern at `lib/workflows/transition.ts:365`. Skipping PENDING simplifies the page UI ("Running…" placeholder) and the reconciliation timeout (one timestamp to compare).
- **Alternatives considered**: Mirroring Job's full PENDING → RUNNING → terminal cycle (rejected — adds a state with no observable behaviour, since dispatch happens synchronously after row creation); creating the row only after the workflow first calls back with RUNNING (rejected — orphaned dispatches would have no auditable record, contradicting FR-013).

## Existing Files

This inventory is the source of truth for "extend vs. create new" decisions. Every path below was confirmed by reading the file or listing the directory.

### A. Authentication & session

| Path | Purpose | Action |
|------|---------|--------|
| `lib/auth.ts` | NextAuth config; `auth()` exposes `session.user.id` (set from token at lines 160-164). | **Reuse as-is**: read session via `import { auth } from '@/lib/auth'`. |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess`/`verifyTicketAccess`/`verifyProjectOwnership` — owner-or-member; throws `Error('Project not found')` on failure. | **Pattern reference** (admin auth is *not* project-scoped, but the throw-then-404 shape is the same). |
| `lib/db/users.ts` (referenced by `auth-helpers.ts:1`) | `requireAuth()` extracts user id from session OR PAT. | **Reuse as-is** when admin endpoints need to identify the caller. |
| `app/lib/auth/workflow-auth.ts` | `validateWorkflowAuth(request)` — Bearer token guard for workflow callbacks. | **Reuse as-is** for `PATCH /api/admin/insights/reports/:id/status` and `PUT /api/admin/insights/reports/:id/html`. |
| `lib/auth/workflow-token.ts` | `getAcceptedWorkflowTokens()` — env-driven, timing-safe `Set`. | **Pattern reference** (D3) — copy the Set-based parsing shape for `ADMIN_ALLOWLIST_EMAILS`. |
| `lib/auth/test-user-override.ts` | `isExplicitTestOverrideRequest(headers)` — used by `validateWorkflowAuth` and the auth helpers; lets integration tests inject a user via header. | **Reuse as-is** so admin integration tests follow the codebase convention. |
| `app/lib/auth/dev-login.ts` | Credentials provider; preview-environment shortcut for signing in as a seeded test user. | **Reference only** — admin allowlist must validate the same `session.user.email` the dev-login flow ends up writing into the session. |

### B. Layout, navigation, UI primitives

| Path | Purpose | Action |
|------|---------|--------|
| `app/layout.tsx` | Root layout: SessionProvider, QueryProvider, Header, Footer, Toaster, TooltipProvider. | **No change** — admin pages compose normally inside `<main>`. |
| `app/admin/` | Does not exist yet. | **Create**: `app/admin/layout.tsx`, `app/admin/page.tsx` (redirect to `/admin/insights`), `app/admin/insights/page.tsx`. |
| `components/layout/header.tsx` | Global top header. | **Read only** — confirms there is no existing global nav surface that would leak the admin area. |
| `components/navigation/nav-items.ts` | Project-scoped icon-rail items — *not* global. | **No change**: admin must NOT appear here (FR-001 forbids any global navigation entry on `/admin` for non-admins, and this file is per-project). |
| `components/navigation/icon-rail-sidebar.tsx` | Project sidebar component. | **No change** for the same reason. |
| `components/ui/*` (shadcn) | `button`, `dialog`, `tooltip`, `card`, `table`, etc. | **Reuse as-is** for admin UI per Constitution Principle II. |
| `app/globals.css` | Aurora utility classes (`aurora-*`). | **Reuse as-is** for the metadata-header card surface. |

### C. Job dispatch & workflow lifecycle

| Path | Purpose | Action |
|------|---------|--------|
| `lib/workflows/transition.ts` | `handleTicketTransition` — canonical create-then-dispatch with rollback on dispatch failure. Job created at lines 216-245; workflow dispatched at 349-355; on `RequestError` the job is deleted at line 365. | **Pattern reference** (key: D7, D5) — admin trigger endpoint uses the same shape but on `AdminInsightsReport` instead of `Job`. |
| `app/lib/workflows/dispatch-deploy-preview.ts` | Stand-alone `dispatchDeployPreviewWorkflow()` — minimal example: env validation, Octokit construction, `createWorkflowDispatch()`, error wrapping. | **Pattern reference** — clone shape into `app/lib/workflows/dispatch-insights-analyze.ts`. |
| `app/lib/workflows/test-mode.ts` | `isWorkflowTestMode(token)` — short-circuits dispatch in tests. | **Reuse as-is** in the new dispatcher. |
| `app/api/jobs/[id]/status/route.ts` | The atomic-conditional-update pattern at lines 271-289 prevents duplicate terminal callbacks. State-machine validation at lines 208-222. Idempotent same-status branch at 167-205. | **Pattern reference** for `PATCH /api/admin/insights/reports/:id/status`. The new endpoint can reuse the *shape* but defines its own (smaller) state machine. |
| `app/lib/job-state-machine.ts` | `canTransition(from, to)` for Job. | **Pattern reference** — write a parallel `lib/admin/insights/state-machine.ts` for the `RUNNING → COMPLETED|FAILED` rules. |
| `app/lib/job-update-validator.ts` | Zod schema for `PATCH /api/jobs/:id/status` body. | **Pattern reference** — write a parallel zod schema for the insights report status PATCH body. |

### D. Blob storage & artifact key shapes

| Path | Purpose | Action |
|------|---------|--------|
| `app/lib/blob/client.ts` | `uploadJobLogArtifact(key, body, size)`, `streamJobLogArtifact(key)`, `deleteJobLogArtifact(key)`. Token from `BLOB_READ_WRITE_TOKEN`. `access: 'private'`, `addRandomSuffix: false`, `allowOverwrite: true`. | **Reuse as-is** (the function is generic over key — name "JobLog" is historical). For consistency, add thin wrappers `uploadInsightsReportHtml(key, body, size)` / `streamInsightsReportHtml(key)` that delegate but pass `contentType: 'text/html; charset=utf-8'` instead of `'application/gzip'`. |
| `app/lib/logs/artifact-key.ts` | Existing key builders for job logs. | **Pattern reference**, not extended — admin reports get their own builder file (`lib/admin/insights/artifact-key.ts`) returning `insights/reports/<reportId>.html`. |
| `app/lib/logs/schema.ts` | Defines `ARTIFACT_MAX_BYTES = 25 * 1024 * 1024`. | **Reuse as-is** as the upper bound on the report HTML upload (25 MB is well above any plausible `/insights` HTML size). |
| `app/api/jobs/[id]/logs/raw-artifact/route.ts` | The full PUT-an-artifact pattern: workflow auth, content-type guard, length pre-check, body read with size guard, upload via `uploadJobLogArtifact()`, JSON response. Lines 1-112. | **Pattern reference** for `PUT /api/admin/insights/reports/:id/html`. |
| `app/api/projects/[projectId]/tickets/[ticketId]/jobs/[jobId]/logs/raw-native/route.ts` (existence implied by `buildJobLogRawNativeUrl`) | The corresponding GET that streams a raw native artifact through authenticated proxying. | **Pattern reference** for `GET /api/admin/insights/reports/:id/html` (must serve through the app, not directly from blob). |

### E. Database / Prisma

| Path | Purpose | Action |
|------|---------|--------|
| `prisma/schema.prisma` | Source of truth for all data models. `Job` (lines 29-81), `JobLog` (83-102), `Ticket` (173-215), `Stage` enum with `SHIP` value (346-354), `Agent` enum with `CLAUDE` (362-367). No existing `Insights`/`Admin*` model. | **Extend**: append a new `AdminInsightsReport` model + status enum (see `data-model.md`). Add migration. |
| `lib/db/client.ts` | Singleton Prisma client (`import { prisma } from '@/lib/db/client'`). | **Reuse as-is**. |

### F. Existing tests (the constitution forbids duplicating these; extend or pattern-match)

| Path | Purpose | Action |
|------|---------|--------|
| `tests/integration/jobs/status.test.ts` | Covers the canonical job-status PATCH idempotency, transitions, atomic update, 409 on cancelled. | **Pattern reference** for `tests/integration/admin/insights-status.test.ts`. |
| `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` | Covers raw-artifact upload: auth, content-type, size limit, agent guard. | **Pattern reference** for `tests/integration/admin/insights-html-put.test.ts`. |
| `tests/integration/api/jobs/logs-raw-native-route.test.ts` | Covers authenticated streaming of a stored artifact. | **Pattern reference** for `tests/integration/admin/insights-html-get.test.ts`. |
| `tests/integration/auth/test-user-header-guard.test.ts` | Covers the `x-test-user-id` test override. | **Pattern reference** for the admin auth integration tests (allowlisted test user fixture). |
| `tests/unit/auth/dev-login-success.test.ts` & `tests/unit/auth/dev-login-failure.test.ts` | Unit-level credentials provider tests. | **Pattern reference** for `tests/unit/admin/admin-auth.test.ts` (allowlist parsing + match). |
| `tests/unit/lib/workflow-auth.test.ts` | Bearer-token validation unit tests. | **Pattern reference** — same shape applies to the admin allowlist guard. |
| `tests/unit/auth-helpers.test.ts` | `verifyProjectAccess` unit tests (Project not found / member access / owner access). | **Pattern reference** for `tests/unit/admin/require-admin.test.ts`. |
| `tests/integration/jobs/auto-mode-hook.test.ts` | Demonstrates the side-effect-after-completion test pattern. | **Pattern reference** if/when post-completion hooks are added (none planned in this ticket). |
| `tests/utils/component-test-utils.tsx` | `renderWithProviders()` for RTL component tests. | **Reuse as-is** for any component tests on the admin UI. |
| `tests/integration/admin/` | **Does not exist yet.** | **Create** new directory for admin integration tests. |

### G. Polling & query keys

| Path | Purpose | Action |
|------|---------|--------|
| `app/lib/query-keys.ts` | Hierarchical query-key factory; `projects`, `comments`, `analytics`, etc. | **Extend** with an `admin` namespace: `admin.insights.list`, `admin.insights.report(id)`, `admin.insights.runStatus`. |
| `app/providers/query-provider.tsx` (referenced by `app/layout.tsx:8`) | The QueryClientProvider wrapper. | **No change**. |

### H. Configuration & env

| Path | Purpose | Action |
|------|---------|--------|
| `.env.example` | Documents required env vars. | **Extend**: add `ADMIN_ALLOWLIST_EMAILS=` (comma-separated) and `INSIGHTS_RUN_TIMEOUT_MS=3600000` (default 60 min). |
| `lib/config-loader.ts` (existence in `lib/`) | Project config loading. | **Read only** — admin allowlist is *not* project config; it's process env. |

### I. Workflow files & infrastructure

| Path | Purpose | Action |
|------|---------|--------|
| `.github/workflows/deploy-preview.yml` | Simplest end-to-end workflow with the canonical PATCH-status callbacks (lines 41-54 RUNNING, 134-151 COMPLETED/FAILED, 49-54 the 409-cancelled abort). | **Pattern reference** — the new `insights-analyze.yml` is shaped after this one (no service containers, no spec/code mutation, just status callbacks + artifact upload). |
| `.github/workflows/speckit.yml` | Shows the full Claude Code invocation pipeline: fetch owner credential (lines 245-277), checkout target repo (310-318), setup Bun/Node/Python (320-345), execute Claude with telemetry (env block at 190-208). | **Pattern reference** for the Claude `/insights` invocation step. |
| `.github/workflows/nightly-log-prune.yml` | The minimal scheduled-callback pattern. | **Pattern reference** *only*; D2 picks lazy reconciliation, so no scheduled workflow is added. |
| `.claude-plugin/scripts/bash/setup-plan.sh` | The plan-setup script that produced our paths. | **No change**. |
| `.github/scripts/fetch-repo-token.sh` | Used by speckit.yml to resolve the owner GitHub token. | **Read only** — the new workflow does *not* clone any external project repo (it operates on stored raw artifacts), so it does not need this script. |
| `.claude/commands/*.md` | Existing agent commands (specify/plan/implement/verify/etc.). | **Pattern reference** — the new command is `ai-board.insights-analyze.md` (or equivalent), invoked by the new workflow. |

### J. Iframe / sandbox / CSP precedents

- **No existing `<iframe sandbox>` usage** anywhere in `app/` or `components/` (verified by absence of matches in the read paths and by the rendering decision being marked CONSERVATIVE — this is a new pattern).
- **No `next.config.js` `headers()`-level CSP** for app routes today (Next.js default).
- **Action**: the GET endpoint serving the report HTML sets per-response headers (CSP + `X-Content-Type-Options`); no global middleware change.

## Patterns to Follow

The implementation MUST mirror these concrete patterns where the new code does parallel work. Generic appeals to "follow existing patterns" are not enough — each row below names the exact file and lines.

### P1. Dispatch-then-rollback (state-machine integrity)

**Reference**: `lib/workflows/transition.ts:216-245` (create row), `:349-355` (dispatch), `:357-388` (catch RequestError, delete row, return error code).

**Apply to**: `POST /api/admin/insights/runs` and the helper `dispatchInsightsAnalyzeWorkflow()`.

**Rule**: Create the `AdminInsightsReport` row with `status='RUNNING'`, `periodStart`, `periodEnd` set inside a transaction, *then* call `octokit.actions.createWorkflowDispatch()`. On any thrown `RequestError`, run `await prisma.adminInsightsReport.delete({ where: { id } }).catch(...)` and translate the GitHub status to a friendly error code (401/403/404 mapped per `transition.ts:370-378`). Constitution Principle V ("If an external call fails after a DB mutation, the database state must remain consistent"): the rollback is non-negotiable.

### P2. Atomic conditional terminal-state write

**Reference**: `app/api/jobs/[id]/status/route.ts:271-289`.

**Apply to**: `PATCH /api/admin/insights/reports/:id/status`.

**Rule**: Use `updateMany({ where: { id, status: 'RUNNING' }, data })` to transition to a terminal state. If `result.count === 0`, the row was already terminal — re-read and return the current state with 200, do not error. This mirrors the Job pattern and prevents duplicated workflow callbacks (e.g., GitHub Actions retry) from double-firing finalization side effects (which for insights are: nothing — there are no notifications per FR-022, but the invariant must hold for future code that might attach side effects).

### P3. Workflow auth + atomic upload guard

**Reference**: `app/api/jobs/[id]/logs/raw-artifact/route.ts:8-112`.

**Apply to**: `PUT /api/admin/insights/reports/:id/html`.

**Rule**: First line validates `validateWorkflowAuth(request)` → 401 on failure. Then content-type check → 415. Then `Content-Length` pre-flight check against `ARTIFACT_MAX_BYTES` → 413. Then row lookup → 404 if missing. Then `arrayBuffer()` body read with empty-body and size-after-read checks. Then `uploadJobLogArtifact(key, buffer, size)` (reused for the same blob client) wrapped in try/catch returning 502 with `BLOB_UPLOAD_FAILED` code on failure. Finally update the row with `htmlBlobKey` and respond 201. Same shape, same error codes — operators reading logs will recognize them.

### P4. Env-driven Set-with-timing-safe-membership

**Reference**: `lib/auth/workflow-token.ts:18-38`.

**Apply to**: `lib/admin/admin-auth.ts` (new file).

**Rule**: `getAdminAllowlistEmails()` returns a fresh `Set<string>` parsed from `process.env.ADMIN_ALLOWLIST_EMAILS` per call (D3); `isAdminEmail(email, set)` lower-cases both sides and uses simple set membership (the values are not secrets — `timingSafeEqual` is overkill for emails, but case-insensitive equality is required because email comparison must be canonical). `requireAdmin(request?)` reads the NextAuth session via `auth()`, throws `Error('Not Found')` if the session is missing or the email is not in the set; the caller catches and returns the 404 baseline. The throw is *deliberately the same exception shape* a non-existent route would produce so that response parity (FR-003, SC-002) is the default and route handlers cannot accidentally leak the area's existence by surfacing a different error.

### P5. Identical 404 response baseline

**Reference**: Next.js 16 App Router behaviour — a request to a non-existent route returns a 404 with the framework's default `not-found.tsx` body. `app/not-found.tsx` (if present) defines that body uniformly.

**Apply to**: every admin route (page, API, asset).

**Rule**: When `requireAdmin()` throws, the page route calls `notFound()` from `next/navigation`, which renders the *same* `not-found.tsx` and emits the same status/headers/body as a genuinely missing route. API routes return `new NextResponse(null, { status: 404 })` (not a JSON body — a JSON body is itself a tell). Tests must assert byte-equivalence between an admin-route response for a non-allowlisted user and the response for a path that genuinely doesn't exist (e.g., `/admin-does-not-exist`). This is SC-002.

### P6. Polling & TanStack Query

**Reference**: existing project-scoped polling hooks under `app/components/board` (referenced via `queryKeys.projects.jobsStatus` at `app/lib/query-keys.ts:8`).

**Apply to**: `useAdminInsightsList()`, `useAdminInsightsRunStatus()`.

**Rule**: 2-second `refetchInterval` while a `RUNNING` report is in the list (matching the spec's "2s jobs" cadence in `CLAUDE.md`); pause polling otherwise (`refetchInterval: false` and `staleTime: 30_000`). Disable the trigger button while any RUNNING row exists (server-side guard is authoritative — UI is just a hint).

### P7. shadcn-only UI, Aurora-tinted host

**Reference**: Constitution Principle II + CLAUDE.md "Aurora B+ Theme".

**Apply to**: the metadata-header card and the past-reports list.

**Rule**: Use `<Card>`, `<Button>`, `<Skeleton>` from `components/ui/`. Use `aurora-card-bg` / `aurora-glow` utility classes for the metadata header surface. The iframe itself stays unstyled by the host — *it is the report's own document*.

## Risks & Open Items

- **Iframe height**: `/insights` HTML produces a long document. The host page must size the iframe to fit; using `height="100%"` on a parent with a defined min-height + overflow is the simplest approach. No `postMessage` to communicate height (would require allowing `allow-scripts` to talk back, contradicting D1's isolation goal). The constraint of "scroll inside iframe" is acceptable per spec — the host page owns nothing inside the report.
- **Empty-period reports**: Per the edge case "raw artifacts aged out", a COMPLETED report can have zero sessions. Spec FR-019 says the metadata header still uses the canonical phrasing — make sure both the workflow and the page render `Analyzed 0 Claude Code sessions across 0 tickets…` when applicable, not an empty state.
- **`/insights` analyzer availability**: Spec assumes the Claude Code CLI's `/insights` command is invokable in a workflow runtime. The new workflow's first non-callback step must verify the CLI is installed and the command is available; if not, finalize the row as FAILED with reason `"Insights analyzer unavailable in workflow runtime"`. This is consistent with the spec's "non-secret, operator-actionable" error reason requirement (FR-014, SC-010).
- **Default-agent fallback consistency**: The Claude-only filter must use `ticket.agent ?? project.defaultAgent ?? 'CLAUDE'` (from `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-61`). A divergent implementation would silently drop or admit jobs differently from the established raw-artifact path. The new code must import or duplicate this exact computation in one place (`lib/admin/insights/claude-job-filter.ts`) and reuse it from both the trigger-time pre-flight count and the workflow-time enumeration.
