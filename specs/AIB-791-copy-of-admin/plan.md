# Implementation Plan: Copy of Admin Section with Claude Code Insights Report

**Branch**: `AIB-791-copy-of-admin` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-791-copy-of-admin/spec.md`

## Summary

Add a minimal `/admin` shell hosting one page, `/admin/insights`, that renders a manually
triggered, archived series of Claude Code `/insights` reports built strictly from the raw
native session JSONL artifacts captured by the dependency feature (AIB-783). The admin shell is
invisible to non-allowlisted users — every admin route returns a Not Found response
byte-equivalent to a genuinely missing path (FR-003). Triggering, persistence, and rendering
follow existing patterns: the dispatch-then-rollback ordering used by `lib/workflows/
transition.ts`, the atomic conditional state-machine update used by `app/api/jobs/[id]/status/
route.ts`, the workflow-token-authenticated artifact upload pattern used by
`app/api/jobs/[id]/logs/raw-artifact/route.ts`, and the private Vercel Blob wrapper at
`app/lib/blob/client.ts`. Every prior-attempt failure mode (free-text prompt instead of the
real analyzer, missing orphan reconciliation, `sandbox=""` rendering, pre-flight/enumeration
drift, JSON 403 bodies leaking the area's existence, non-atomic status updates) is closed off
by binding requirements in the spec and the patterns enforced in this plan.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router) + React 18 + Prisma 6.x + NextAuth.js + TanStack Query v5 + shadcn/ui + @vercel/blob + Octokit + Claude Code (`@anthropic-ai/claude-code` `/insights`)
**Storage**: PostgreSQL 14+ via Prisma (new `InsightsReport` model + `InsightsRunStatus` enum); Vercel Blob (new `insights/reports/<id>.html` key family, separate retention from `logs/*`)
**Testing**: Vitest (unit + integration), Playwright (E2E browser tests)
**Target Platform**: Vercel (Next.js App Router) + GitHub Actions (workflow runner)
**Project Type**: web (Next.js single-app monorepo — `app/` for UI + API routes, `lib/` for shared modules)
**Performance Goals**: Page load <5s for an admin viewing the latest report (SC-001); trigger refusal <2s (SC-004); list endpoint <1s for any practical row count (DB-level `LIMIT 200`)
**Constraints**: 100% byte-equivalent 404 parity for non-admin requests (SC-002); zero non-Claude sessions in analysis input (SC-006); atomic status transitions only (SC-012); no notifications (FR-022); no schedule (FR-021)
**Scale/Scope**: Single-digit operator allowlist; manual triggers (expected: weekly–monthly); past-reports list capped at 200 entries

## Constitution Check

The repo's constitution lives at `.ai-board/memory/constitution.md` (v1.8.0). The non-negotiable
rules and how this plan satisfies them:

| Principle | How this plan complies |
|-----------|------------------------|
| **I. TypeScript-First Development** — `strict: true`, no `any`, explicit types | All new modules (`app/lib/insights/*`, `app/lib/auth/admin.ts`, `app/api/admin/*`) authored in strict TS with explicit return types and Zod-validated API request bodies. `InsightsReport` Prisma model generates explicit types. |
| **II. Component-Driven Architecture** — shadcn/ui, server components by default, feature folder structure | New UI lives in `components/admin/insights/` and uses shadcn `Button`, `Card`, `Table` primitives. The admin layout and page are Server Components; only the iframe wrapper and trigger button are Client Components. |
| **III. TDD (Search FIRST, extend not duplicate)** | The `research.md` Existing Files inventory identifies every reference test file. New tests go to new files only where no existing file covers the domain (admin/* is entirely new). |
| **IV. Security-First Design** — Zod, parameterized Prisma, no secrets in responses, auth middleware | Every API route uses Zod for inputs; all DB access is via Prisma (no raw SQL); the unauthorized response is byte-equivalent to a genuine 404, not a descriptive JSON body; `BLOB_READ_WRITE_TOKEN` is only read by the existing wrapper, never exposed; `WORKFLOW_API_TOKEN` is timing-safe-compared. |
| **V. Database Integrity** — Prisma migrations, transactions, never reuse pre-mutation in-memory rows | Status transitions use atomic `updateMany` (P-1). Trigger uses a single transaction to insert `InsightsReport` + `Job` and to link them. Dispatch failure transitions to FAILED (mandated FR-013 divergence — auditable, no orphan PENDING). |
| **V. Specification Clarification Guardrails** | `spec.md` includes Auto-Resolved Decisions block with policy = CONSERVATIVE confirmed. All security and integrity rules retained. |

**Forbidden tech check**: No new UI libraries (uses shadcn/ui + Radix only). No new ORM (Prisma
only). No state libs added. The single new runtime dep is `@anthropic-ai/claude-code` invoked
inside a GitHub Actions step — already a documented runtime in `.ai-board/config.yml`.

**Gate evaluation**: PASS. No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```
specs/AIB-791-copy-of-admin/
├── plan.md                                       # This file
├── research.md                                   # Decisions, existing-files inventory, patterns to follow
├── data-model.md                                 # InsightsReport model + InsightsRunStatus enum
├── contracts/
│   ├── admin-pages.md                            # /admin, /admin/insights page-route contracts
│   └── admin-api.md                              # /api/admin/insights/* endpoint contracts
├── workflows/
│   ├── insights-analyze-workflow.md              # GitHub Actions workflow spec
│   └── insights-analyze-command.md               # Agent command spec
├── checklists/                                   # (Pre-existing, from /specify)
├── spec.md                                       # (Pre-existing, from /specify)
└── tasks.md                                      # Phase 2 output (/ai-board.tasks — NOT created here)
```

### Source Code (repository root)

This is a Next.js App Router project. Concrete additions:

```
app/
├── admin/                                        # NEW — admin shell
│   ├── layout.tsx                                # Server component, requireAdminOrNotFound
│   ├── page.tsx                                  # Redirects to /admin/insights
│   └── insights/
│       └── page.tsx                              # Hosts the report view
├── api/
│   ├── admin/                                    # NEW — admin API
│   │   └── insights/
│   │       ├── trigger/route.ts                  # POST trigger
│   │       ├── preflight/route.ts                # GET pre-flight check
│   │       ├── reports/
│   │       │   ├── route.ts                      # GET list (cap 200)
│   │       │   └── [id]/
│   │       │       ├── route.ts                  # GET single metadata
│   │       │       ├── html/route.ts             # GET artifact stream
│   │       │       ├── status/route.ts           # PATCH (workflow)
│   │       │       └── finalize/route.ts         # PUT artifact upload (workflow)
│   │       └── jobs/
│   │           ├── route.ts                      # GET enumeration (workflow)
│   │           └── [jobId]/raw-native/route.ts   # GET cross-tenant raw read (workflow)
│   ├── jobs/[id]/logs/...                        # EXISTING — pattern reference
│   └── jobs/[id]/status/route.ts                 # EXISTING — pattern reference
├── lib/
│   ├── auth/
│   │   ├── admin.ts                              # NEW — getAdminAllowlist, isUserAdmin, requireAdminOrNotFound
│   │   ├── dev-login.ts                          # EXISTING — pattern reference
│   │   └── workflow-auth.ts                      # EXISTING — reuse as-is
│   ├── blob/
│   │   └── client.ts                             # EXTEND — add uploadInsightsReportArtifact, streamInsightsReportArtifact
│   ├── insights/                                 # NEW — feature folder
│   │   ├── blob-keys.ts                          # buildInsightsReportKey
│   │   ├── predicate.ts                          # countShippedClaudeTicketsSince, listShippedClaudeJobsForWindow
│   │   ├── output-validation.ts                  # validateInsightsOutput
│   │   ├── reconcile.ts                          # reconcileOrphanedRunningReports
│   │   ├── repository.ts                         # InsightsReport DB helpers
│   │   └── state-machine.ts                      # canTransition, isTerminalStatus
│   └── hooks/queries/
│       └── use-insights-reports.ts               # NEW — TanStack Query hook (15s polling while RUNNING)
└── globals.css                                   # EXISTING — aurora utilities reused

components/
└── admin/                                        # NEW
    └── insights/
        ├── insights-report-view.tsx              # Sandboxed iframe + metadata header + past-reports list
        ├── run-analysis-button.tsx               # Trigger button with refusal-message handling
        └── report-error-placeholder.tsx          # FR-024 placeholder

prisma/
├── schema.prisma                                 # EXTEND — InsightsReport, InsightsRunStatus, Job.ticketId nullable
└── migrations/
    └── <ts>_add_insights_report/migration.sql    # NEW

.github/workflows/
└── insights-analyze.yml                          # NEW

.claude-plugin/ or .claude/commands/
└── insights-analyze.{md,...}                     # NEW — skill or command metadata (if invoked via skill bridge)

tests/
├── unit/
│   └── lib/
│       ├── auth/admin.test.ts                    # NEW
│       └── insights/
│           ├── predicate.test.ts                 # NEW
│           ├── output-validation.test.ts         # NEW
│           ├── reconcile.test.ts                 # NEW
│           └── state-machine.test.ts             # NEW
├── unit/components/admin/insights/
│   ├── insights-report-view.test.tsx             # NEW
│   └── run-analysis-button.test.tsx              # NEW
├── integration/
│   └── api/admin/insights/
│       ├── trigger.test.ts                       # NEW — pre-flight, concurrency, dispatch rollback
│       ├── reports-list.test.ts                  # NEW — cap 200, reconciliation, ordering
│       ├── reports-html.test.ts                  # NEW — streaming, blob-404 placeholder, CSP headers
│       ├── status-patch.test.ts                  # NEW — atomic transitions, late-callback no-op
│       ├── finalize-put.test.ts                  # NEW — content-type, size, validation
│       ├── parity-404.test.ts                    # NEW — byte equality vs control 404 (SC-002)
│       └── effective-agent.test.ts               # NEW — pre-flight + enumeration share predicate
└── e2e/
    └── admin/
        └── insights-flow.spec.ts                 # NEW — Playwright happy path
```

**Structure Decision**: Standard Next.js App Router layout (web). The admin shell is a new top-
level segment `app/admin/*` alongside existing `app/projects/*`, `app/board/*`, etc. The
admin-specific API lives under `app/api/admin/insights/*` alongside the existing
`app/api/projects/*` and `app/api/jobs/*`. Feature-specific shared logic lives in
`app/lib/insights/*` (a new feature folder). Tests follow the existing
`tests/{unit,integration,e2e}` split.

## Testing Strategy

Following the constitution's testing trophy and the spec's per-User-Story Independent Tests,
each US is covered by integration tests that mirror its acceptance scenarios. The
"search existing tests FIRST" inventory in `research.md` confirmed that no existing file
covers the `/admin/*` route family, so the new test files listed above are not duplicates.

### Unit (Vitest)

| Module | Coverage |
|--------|----------|
| `app/lib/auth/admin.ts` | `isUserAdmin` returns false for empty allowlist, undefined email, mismatched email; reads `ADMIN_ALLOWLIST` fresh each call (SC-009). |
| `app/lib/insights/predicate.ts` | Effective-agent fallback test grid: (ticket.agent=CLAUDE, project.defaultAgent=CODEX) → Claude; (ticket.agent=null, project.defaultAgent=CLAUDE) → Claude; (ticket.agent=CODEX, project.defaultAgent=CLAUDE) → not Claude; (ticket.agent=null, project.defaultAgent=null) → Claude (legacy fallback). Confirms FR-010 + SC-006. |
| `app/lib/insights/output-validation.ts` | Marker presence / absence cases. Each missing marker fails. |
| `app/lib/insights/reconcile.ts` | Backdated RUNNING row is auto-FAILED; concurrent reconciliation runs are idempotent (count of FAILED transitions across both calls = 1). |
| `app/lib/insights/state-machine.ts` | All transition pairs validated. |
| Component tests for `insights-report-view`, `run-analysis-button` | RTL + userEvent against the iframe wrapper (mock the `src` endpoint), the metadata header phrasing, the disabled state during RUNNING, the past-reports list selection. |

### Integration (Vitest, hits a real Postgres + mocks Vercel Blob via wrapper)

| Test file | User story | Scenarios |
|-----------|------------|-----------|
| `trigger.test.ts` | US3 | Accepts when pre-flight + concurrency pass; refuses NO_NEW_SHIPPED, NO_CLAUDE_JOBS, ALREADY_RUNNING with canonical messages; rollback to FAILED on dispatch failure with audit row preserved (D-5); transaction insert ordering correct. |
| `reports-list.test.ts` | US4 | Returns reverse-chronological; caps at 200 at DB query (verify by seeding 250 rows); reconciliation runs before list; FAILED entries surface error reason; RUNNING entries surface placeholder shape. |
| `reports-html.test.ts` | US1 | COMPLETED row streams the HTML with correct Content-Type, CSP `frame-ancestors 'self'`, no `X-Frame-Options`; non-COMPLETED returns byte-equivalent 404; blob 404 returns 200 with FR-024 placeholder body. |
| `status-patch.test.ts` | US3 + SC-012 | Atomic conditional update; idempotent late callback; double-completion does not run hooks twice; FAILED transition records errorReason. |
| `finalize-put.test.ts` | US3 | Content-Type gating (415 on non-HTML); size limit (413 over 25 MB); server-side output validation (422 with code); successful upload returns expected key + size. |
| `parity-404.test.ts` | US2 + SC-002 | Captures one control 404 response; asserts byte equality across status code, response body, all headers for every admin path requested by (a) unauthenticated, (b) authenticated non-admin. |
| `effective-agent.test.ts` | US3 + FR-025 | Window contains 3 jobs: (Claude+ticket-agent), (Claude+project-default), (Codex+ticket-agent); `countShippedClaudeTicketsSince(prev) === 2`; `listShippedClaudeJobsForWindow(start,end)` returns exactly those 2 jobs in the same order; the two callers produce identical sets. |

### E2E (Playwright — minimal, expensive)

| Spec | User story | Scope |
|------|------------|-------|
| `admin/insights-flow.spec.ts` | US1 happy path | Seed one COMPLETED report + admin user → sign in → navigate to `/admin/insights` → see iframe load + metadata header → click an older entry → verify view switches. Excludes triggering a real workflow (would require credentials). |

### Test data conventions

- All `[e2e]`-prefixed names for E2E ticket/project (per CLAUDE.md test rule).
- Integration tests use `x-test-user-id: test@e2e.local` (existing seeded user) and a separate
  `test-admin@e2e.local` for admin scenarios (added to a test-scoped `ADMIN_ALLOWLIST` via the
  test fixture).
- Vercel Blob is NOT exercised in tests — the `app/lib/blob/client.ts` wrapper is mocked via
  Vitest module mocking, returning canned streams.

## Implementation Phases (planning intent only; tasks.md defines order)

A high-level decomposition of the work — not the canonical task list (that's produced by
`/ai-board.tasks`).

1. **Foundation**: Prisma migration (`InsightsReport`, `InsightsRunStatus`, `Job.ticketId`
   nullable). Generate client. Update CLAUDE.md `Job commands` list.
2. **Auth**: `app/lib/auth/admin.ts` + unit tests. Verify byte-equivalent 404 by hitting the
   existing default-404 page through fetch.
3. **Shared modules**: `app/lib/insights/*` (predicate, output-validation, reconcile,
   state-machine, repository, blob-keys). Unit tests for each.
4. **API**: Admin GET endpoints first (list, single, html, preflight) — verify the byte-
   equivalent 404 parity test passes BEFORE adding write endpoints. Then admin POST trigger.
   Then workflow PATCH/PUT/GET endpoints.
5. **Blob client**: Extend `app/lib/blob/client.ts` with insights helpers.
6. **UI**: Admin layout + page, components, TanStack Query hook. Visual smoke test via
   `bun run dev` (per session rules for UI changes).
7. **Workflow**: `.github/workflows/insights-analyze.yml` + skill/command metadata (if used).
   Test the workflow end-to-end against a preview deployment with a seeded session corpus.
8. **E2E + parity tests**: Final pass for SC-002 parity and the US1 Playwright spec.

## Re-Evaluated Constitution Check (Post-Design)

Running the same gate against the concrete design above:

- **I. TypeScript-First**: All new modules have explicit types; Zod schemas at API boundaries. PASS.
- **II. Component-Driven**: Admin UI uses shadcn primitives composed with feature folder
  layout; client components only where interactivity requires it (iframe wrapper, trigger
  button). PASS.
- **III. TDD**: Search-existing-first inventory completed; new test files justified by domain
  uniqueness (no existing admin tests). PASS.
- **IV. Security-First**: Zod validation at every API entry; Prisma-only DB access; FR-003
  byte-equivalent 404 prevents area discovery; `WORKFLOW_API_TOKEN` timing-safe-compared via
  existing helper; admin allowlist read fresh-per-request (no cache leak across rotations).
  Sandbox iframe omits `allow-same-origin` (D-9). PASS.
- **V. Database Integrity**: Migration only; atomic conditional updates everywhere; transaction
  around `InsightsReport` + `Job` insert; never reuses pre-mutation in-memory rows; dispatch
  failure leaves consistent state (FAILED row with reason). PASS.

**Result**: GATES PASS. No Complexity Tracking entries required.

## Complexity Tracking

*No violations to justify. Section intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|

## Open / Deferred

- **`Job.ticketId` nullable migration** — see `data-model.md` "Migration note". The
  implementation phase MUST audit existing consumers of `job.ticketId` and confirm each handles
  the new null case. If any consumer is impractical to make null-safe, fall back to creating a
  sentinel "Admin/Insights" project + ticket (option 2 in data-model.md), which is functionally
  equivalent but more invasive in the projects list.
- **Workflow-token cross-tenant read endpoint** (`/api/admin/insights/jobs/:jobId/raw-native`)
  is a new trust-boundary touch. Plan: implement strictly Claude-only (via the shared
  predicate) and document explicitly in `app/api/admin/insights/jobs/[jobId]/raw-native/
  route.ts` why this endpoint exists and what its threat model is.
