# Implementation Plan: Admin section with Claude Code Insights report

**Branch**: `AIB-777-admin-section-with` | **Date**: 2026-05-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-777-admin-section-with/spec.md`

## Summary

Add the smallest viable admin shell at `/admin` and a single page at `/admin/insights` that lets allowlisted operators (a) read the most recent Claude Code `/insights` report inline, (b) trigger a new analysis (subject to a "shipped tickets since previous run" pre-flight and a single-flight concurrency gate), and (c) browse past reports. The HTML body of each report is the genuine output of Claude Code's `/insights` analyzer — captured unchanged, stored as a private blob artifact, and rendered in a sandboxed iframe that disallows same-origin access against the host. Report metadata (status, period, counts, error reason, blob pointer) lives in a new `AdminInsightsReport` table.

The trigger endpoint creates the row with `status='RUNNING'` *before* dispatching a new GitHub Actions workflow (`insights-analyze.yml`) that reuses the existing centralized-execution + authenticated-artifact-upload + workflow-token-callback patterns established by `deploy-preview.yml`, `app/api/jobs/[id]/logs/raw-artifact/route.ts`, and `app/api/jobs/[id]/status/route.ts`. The web app never holds blob credentials directly. Admin access is gated by a comma-separated `ADMIN_ALLOWLIST_EMAILS` env var matched case-insensitively against `session.user.email`; non-allowlisted callers receive a response byte-equivalent to a genuine 404 across status, body, and headers.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router) with React 18, Prisma 6.x, NextAuth.js, TanStack Query v5, shadcn/ui + Radix, Tailwind 3.4, `@vercel/blob` ^2.3.x, `@octokit/rest`, Zod
**Storage**: PostgreSQL 14+ (one new table: `AdminInsightsReport`); Vercel Blob (one new key prefix: `insights/reports/<id>.html`)
**Testing**: Vitest unit + integration; Playwright E2E only for the page-render golden path. Existing patterns at `tests/integration/jobs/status.test.ts`, `tests/integration/api/jobs/logs-raw-artifact-put.test.ts`, `tests/unit/lib/workflow-auth.test.ts`.
**Target Platform**: Vercel-hosted Next.js server + GitHub Actions runners (Linux, Ubuntu-latest) for the `insights-analyze.yml` workflow.
**Project Type**: Single web application (Next.js App Router monorepo with `app/`, `components/`, `lib/`, `prisma/`, `tests/`, `.github/workflows/`).
**Performance Goals**: Page-render target ≤ 5 s on a normally provisioned environment (SC-001); pre-flight refusal ≤ 2 s (SC-004); past-reports list capped at 200 entries server-side regardless of total row count (FR-017, SC-007). Polling cadence 2 s only while a `RUNNING` report is in the list (matches `CLAUDE.md` job-status polling cadence).
**Constraints**:
- 100% byte-equivalent 404 baseline for non-admin callers across all admin routes (SC-002, FR-003).
- Zero non-Claude sessions in any analysis input (SC-006, FR-010).
- Read-only after creation: no edit/delete/rename endpoints (FR-020).
- No notifications and no scheduled triggers of analysis (FR-021, FR-022).
- HTML body capped at `ARTIFACT_MAX_BYTES` = 25 MB (existing constant in `app/lib/logs/schema.ts:6`).
- Lazy reconciliation only (D2 in `research.md`) — no new scheduled GitHub workflow.
**Scale/Scope**: Operator-only feature. Single-digit admin set, manual triggers (single-digit per week typical), thousands of historical rows tolerable but listing capped at 200 per page render. Application-wide vantage point — *not* per-project.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** | PASS | All new code is strict-mode TS; no `any`; explicit return types; Zod schemas drive request validation; Prisma generates DB types. |
| **II. Component-Driven Architecture** | PASS | New page is `app/admin/insights/page.tsx` (Server Component); Client Components only for the trigger button and polling hook (`"use client"`). UI primitives: shadcn/ui only (`Card`, `Button`, `Skeleton`, `Table`). The iframe is a single primitive of the platform — not a custom-styled component. |
| **III. Test-Driven Development** | PASS | Decision-tree application: API routes → Vitest integration; auth helpers → Vitest unit; state machine → Vitest unit; page golden path → Playwright E2E (one test). Existing test files extended where applicable (`tests/integration/admin/` is the new home; allowlist tests follow the shape of `tests/unit/lib/workflow-auth.test.ts`). |
| **IV. Security-First Design** | PASS | Every admin route returns the 404 baseline for non-admins (P5); workflow callbacks gated by `WORKFLOW_API_TOKEN`; HTML body served with strict CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, sandboxed iframe (`allow-scripts` only); Zod validation matches Prisma column constraints (data-model.md "Field validations" table); no secrets logged in `errorReason`; allowlist env-driven, no DB role table. |
| **V. Database Integrity** | PASS | One Prisma migration (additive); atomic conditional updates (P2); rollback-on-dispatch-failure (P1) keeps no orphaned `RUNNING` rows after dispatch errors; lazy reconciliation handles workflow-side orphans. `triggeredById` uses `onDelete: SetNull` to preserve audit history without dangling FKs. |
| **V (second). Specification Clarification Guardrails** | PASS | Spec's Auto-Resolved Decisions block applied CONSERVATIVE to all 11 decisions; this plan honours every Reviewer Note (response parity tested, blob key shape pinned, row created before dispatch, period semantics consistent across pre-flight and enumeration, sandbox disallows same-origin, list capped, no DELETE endpoint). |

**Gate result: PASS — no violations to justify in Complexity Tracking.**

### Re-check after Phase 1 design

The Phase 1 artifacts (`data-model.md`, `contracts/admin-insights-api.md`, `workflows/insights-analyze-workflow.md`, `workflows/insights-analyze-command.md`) introduce no new dependencies, no new infrastructure, no new auth mechanism. The new database table is single, additive, and uses the same conventions (`@@index`, `@db.VarChar`, `onDelete`) as existing models. The new workflow file follows the exact callback shape of `deploy-preview.yml`. The new HTTP endpoints follow the exact shape of `app/api/jobs/[id]/status/route.ts` and `app/api/jobs/[id]/logs/raw-artifact/route.ts`. **Gate result: PASS.**

## Project Structure

### Documentation (this feature)

```
specs/AIB-777-admin-section-with/
├── plan.md                                # This file
├── research.md                            # Phase 0 — D1–D7 + Existing Files + Patterns to Follow
├── data-model.md                          # Phase 1 — AdminInsightsReport schema + state machine
├── contracts/
│   └── admin-insights-api.md              # Phase 1 — wire contract for all 6 endpoints
├── workflows/
│   ├── insights-analyze-workflow.md       # Phase 1 — .github/workflows/insights-analyze.yml spec
│   └── insights-analyze-command.md        # Phase 1 — `claude /insights` invocation contract
├── checklists/                            # (existing)
├── spec.md                                # (existing)
└── tasks.md                               # Phase 2 — created by /ai-board.tasks (not in this command)
```

### Source Code (repository root)

The implementation extends the existing single-project layout. Paths shown are concrete and were verified to exist (or to be planned new-creates) during Phase 0:

```
prisma/
└── schema.prisma                          # EXTEND: add AdminInsightsReport model + enum + User back-relation
                                           # NEW migration: add_admin_insights_report

lib/
├── auth/
│   └── (no changes)
├── admin/                                  # NEW directory
│   ├── admin-auth.ts                       # NEW: getAdminAllowlistEmails, isAdminEmail, requireAdmin (P4)
│   └── insights/
│       ├── state-machine.ts                # NEW: canTransition for AdminInsightsReportStatus
│       ├── artifact-key.ts                 # NEW: buildInsightsReportArtifactKey(reportId) → 'insights/reports/<id>.html'
│       ├── claude-job-filter.ts            # NEW: shared "effective agent === CLAUDE" filter (used by pre-flight + enumeration)
│       ├── reconcile.ts                    # NEW: reconcileOrphanedInsightsReports() (D2 lazy sweep)
│       └── period.ts                       # NEW: derivePeriod(previousHighWater, earliestClaudeStartedAt, now)
└── workflows/
    └── (no changes — dispatch-then-rollback pattern is reused, not modified)

app/
├── admin/                                  # NEW directory tree
│   ├── layout.tsx                          # NEW: Server Component; calls requireAdmin(); on throw, notFound()
│   ├── page.tsx                            # NEW: Server Component; redirect('/admin/insights')
│   └── insights/
│       └── page.tsx                        # NEW: Server Component; lazy-reconcile; fetch latest+running+list; renders header, iframe, list
├── api/
│   ├── admin/                              # NEW directory tree
│   │   └── insights/
│   │       ├── reports/
│   │       │   ├── route.ts                # NEW: GET list (sec. 2 of contracts)
│   │       │   └── [id]/
│   │       │       ├── status/
│   │       │       │   └── route.ts        # NEW: PATCH workflow callback (sec. 5)
│   │       │       └── html/
│   │       │           └── route.ts        # NEW: PUT (workflow) + GET (admin proxy) (sec. 4 + 6)
│   │       └── runs/
│   │           └── route.ts                # NEW: POST trigger (sec. 3)
│   └── internal/
│       └── admin-insights/
│           └── raw-artifacts/
│               └── route.ts                # NEW: GET workflow-only artifact enumeration
├── lib/
│   ├── admin/
│   │   └── insights/
│   │       └── status-update-validator.ts  # NEW: Zod discriminated union for PATCH …/status body
│   ├── blob/
│   │   └── client.ts                       # EXTEND minimally: add uploadInsightsReportHtml/streamInsightsReportHtml thin wrappers
│   ├── workflows/
│   │   └── dispatch-insights-analyze.ts    # NEW: Octokit dispatcher mirroring dispatch-deploy-preview.ts shape
│   └── query-keys.ts                       # EXTEND: add admin.insights.list / admin.insights.report(id)
├── components/
│   └── admin/                              # NEW directory tree (mirroring existing app/components/board, etc.)
│       └── insights/
│           ├── insights-page-shell.tsx     # NEW Client Component: orchestrates polling + selection state
│           ├── metadata-header.tsx         # NEW Server Component: FR-019 phrasing
│           ├── report-iframe.tsx           # NEW Client Component: <iframe sandbox="allow-scripts" src=…>
│           ├── past-reports-list.tsx       # NEW Client Component: reverse-chronological list, selection state
│           └── trigger-run-button.tsx      # NEW Client Component: disabled while RUNNING; surfaces 409 refusals
└── hooks/
    └── admin/
        ├── use-admin-insights-list.ts      # NEW: TanStack Query hook (P6)
        └── use-admin-insights-trigger.ts   # NEW: useMutation wrapper for POST /api/admin/insights/runs

.github/
└── workflows/
    └── insights-analyze.yml                # NEW: per workflows/insights-analyze-workflow.md

tests/
├── unit/
│   └── admin/
│       ├── admin-auth.test.ts              # NEW: allowlist parsing + match (covers P4)
│       ├── insights-state-machine.test.ts  # NEW: canTransition table-driven test
│       ├── claude-job-filter.test.ts       # NEW: effective-agent fallback consistency
│       └── period.test.ts                  # NEW: first-run vs incremental window derivation
├── integration/
│   └── admin/
│       ├── insights-list.test.ts           # NEW: GET /api/admin/insights/reports (auth + cap + ordering)
│       ├── insights-trigger.test.ts        # NEW: POST /api/admin/insights/runs (preflight + concurrency + dispatch + rollback)
│       ├── insights-status.test.ts         # NEW: PATCH workflow callback (state machine + atomic update + idempotent)
│       ├── insights-html-put.test.ts       # NEW: PUT workflow upload (auth + size + content-type + idempotent during RUNNING)
│       ├── insights-html-get.test.ts       # NEW: GET admin proxy (auth + CSP headers + 404 on missing/non-COMPLETED)
│       ├── insights-reconcile.test.ts      # NEW: lazy reconciliation sweeps stuck RUNNING (D2)
│       └── response-parity.test.ts         # NEW: 404 byte-equivalence across all admin routes (SC-002)
└── e2e/
    └── admin/
        └── insights-page.spec.ts           # NEW: one Playwright golden-path test (allowlisted user opens page, sees report)
```

**Structure Decision**: Single Next.js project layout. The new code occupies its own `admin/`-prefixed sub-trees in `app/admin/`, `app/api/admin/`, `lib/admin/`, `app/components/admin/`, `tests/{unit,integration,e2e}/admin/`. Cross-cutting helpers (`app/lib/blob/client.ts`, `app/lib/query-keys.ts`, `prisma/schema.prisma`) are extended minimally. No file outside the `admin/` sub-trees changes its public API; the only edits to existing files are additive (a new Prisma model, new query-key entries, two thin wrapper functions on the blob client, and one back-relation field on `User`).

This layout keeps the admin area textually invisible from the rest of the app: every reference to "admin" is namespaced under `admin/` directories and the `ADMIN_ALLOWLIST_EMAILS` env var, so a developer reading any project-scoped page or API has no incidental exposure to admin machinery — consistent with the spec's "no leak of the area's existence" principle applied beyond the wire response into the codebase itself.

## Testing Strategy

Driven by the Existing Files inventory (`research.md` §F) and the constitution's decision tree (§III).

### Unit (Vitest, no server)

Pure logic with no I/O — fastest feedback:

| Domain | New file | Pattern reference |
|--------|----------|-------------------|
| Allowlist parsing + match | `tests/unit/admin/admin-auth.test.ts` | `tests/unit/lib/workflow-auth.test.ts` (env-driven Set + membership check). Mirror its env-mocking shape. |
| Insights status state machine | `tests/unit/admin/insights-state-machine.test.ts` | `app/lib/job-state-machine.ts` (the implementation already has table-driven tests in `tests/unit/` — clone the structure). |
| Claude-only effective-agent filter | `tests/unit/admin/claude-job-filter.test.ts` | New — exercises `ticket.agent ?? project.defaultAgent ?? 'CLAUDE'` for all combinations including null/undefined. |
| Period derivation (first run vs incremental) | `tests/unit/admin/period.test.ts` | New — covers cold-system (no successful runs, no Claude jobs), first-ever-run (no successful runs, ≥1 Claude job), incremental (previous COMPLETED present). |

### Integration (Vitest, auto-managed dev server)

Hits real Postgres + real Next route handlers via `bun run test:integration`. **Default choice for any test that involves a route handler or a Prisma write.**

| Concern | New file | Pattern reference |
|---------|----------|-------------------|
| List endpoint auth + cap + ordering | `tests/integration/admin/insights-list.test.ts` | `tests/integration/jobs/status-filter.test.ts` |
| Trigger pre-flight + concurrency + dispatch + rollback | `tests/integration/admin/insights-trigger.test.ts` | `tests/integration/projects/setup-job.test.ts` (workflow dispatch in test mode), `lib/workflows/transition.ts:357-388` (rollback shape) |
| Status PATCH state machine + atomic update + idempotent | `tests/integration/admin/insights-status.test.ts` | `tests/integration/jobs/status.test.ts` |
| HTML PUT — workflow auth, content-type, size, idempotent during RUNNING | `tests/integration/admin/insights-html-put.test.ts` | `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` |
| HTML GET — admin proxy, CSP headers, 404 on non-COMPLETED | `tests/integration/admin/insights-html-get.test.ts` | `tests/integration/api/jobs/logs-raw-native-route.test.ts` |
| Lazy reconciliation sweeps stuck RUNNING | `tests/integration/admin/insights-reconcile.test.ts` | New (no exact precedent — closest is `tests/integration/api/jobs/logs-post.test.ts` for time-based behaviour). Use Vitest's `vi.setSystemTime` to advance past the timeout. |
| 404 byte-equivalence across all admin routes | `tests/integration/admin/response-parity.test.ts` | New — but uses the same `x-test-user-id` override that `tests/integration/auth/test-user-header-guard.test.ts` exercises (`lib/auth/test-user-override.ts`). |

### E2E (Playwright, expensive — single golden path only)

Per constitution decision tree §III.4, E2E only when a browser is required. The page render genuinely needs a browser (sandboxed iframe behaviour, CSP enforcement). One test:

| File | Coverage |
|------|----------|
| `tests/e2e/admin/insights-page.spec.ts` | Allowlisted seeded user (via `[e2e]`-prefixed admin email + dev login) opens `/admin/insights`, sees an existing seeded COMPLETED report rendered inline with the canonical metadata header, can open a past report, attempts to trigger a new run and either sees the canonical refusal or the running placeholder. *Browser-required because it asserts iframe content rendering and CSP.* |

E2E projects must use the `[e2e]` prefix for ticket titles, project names, and token names per CLAUDE.md "Test Environment". Admin emails used in E2E must also be `[e2e]`-prefixed (e.g., `e2e-admin@e2e.local`) and added to `ADMIN_ALLOWLIST_EMAILS` only in the test env.

### Out-of-scope tests (deliberate)

- **No tests of `/insights` analyzer behaviour itself**: the analyzer is the dependency feature's contract, not ours. Our tests treat it as a black box, mocking the `claude /insights` call in unit/integration tests via the workflow test-mode short circuit (`app/lib/workflows/test-mode.ts`).
- **No re-tests of upstream workflow auth**: `tests/unit/lib/workflow-auth.test.ts` already covers `validateWorkflowAuth`. New endpoints reusing it don't need to retest the helper — only the endpoint-specific guard wiring.
- **No re-tests of Prisma client behaviour**: standard Prisma operations don't get wrapper tests.

## Complexity Tracking

*Constitution Check passed without violations. No entries required.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) | — | — |

---

## Phase summary

- **Phase 0 — Outline & Research**: complete. See [research.md](./research.md). Seven mechanical decisions resolved (D1–D7); existing files inventoried with extend/reference verdicts; six concrete patterns (P1–P7) named with file:line citations.
- **Phase 1 — Design & Contracts**: complete.
  - Data model: [data-model.md](./data-model.md). One new entity (`AdminInsightsReport`), one new enum, one back-relation on `User`, three indexes, additive Prisma migration.
  - API contracts: [contracts/admin-insights-api.md](./contracts/admin-insights-api.md). Six endpoints across two auth classes; full request/response shapes; 404 baseline asserted by tests.
  - Workflow + agent contracts: [workflows/insights-analyze-workflow.md](./workflows/insights-analyze-workflow.md), [workflows/insights-analyze-command.md](./workflows/insights-analyze-command.md). New `.github/workflows/insights-analyze.yml`; reuses existing centralized-execution and Bearer-token-callback shapes; no custom `.claude/commands/*.md` (built-in `/insights` is invoked directly).
  - Agent context: refreshed via `update-agent-context.sh claude`.
- **Phase 2 — Tasks**: not part of this command. Run `/ai-board.tasks` next to generate `tasks.md`.

**Stop here.** No code is written by `/ai-board.plan`; the artifacts above are the inputs to `/ai-board.tasks` and ultimately `/ai-board.implement`.
