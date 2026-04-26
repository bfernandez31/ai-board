# Implementation Plan: Capture Ticket Outcomes at SHIP

**Branch**: `AIB-742-capture-ticket-outcomes` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/AIB-742-capture-ticket-outcomes/spec.md`

## Summary

When a ticket transitions to stage `SHIP`, persist a single, immutable `TicketOutcome` row aggregating: total cost/duration/tokens across all jobs, pipeline-vs-friction job counts, final verify quality score, files touched, lines added/removed, code-vs-test ratio, structural domains (top-level path segments + frequency map), semantic tags (`touched_db_schema`, `touched_tests`, `touched_ci`), a derived `frictionFree` boolean, and a `partial` flag for tickets with no usable commit reference. Capture happens asynchronously after SHIP succeeds — never blocks the transition. A separate per-project, idempotent, resumable backfill workflow populates outcomes for historical shipped tickets. A system-owned stack-indicator lookup makes the change-shape derivation work generically across TypeScript/Next, Python, Go, Rust, and Zig with no per-project config.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router) routes + lib utilities, Prisma 6.x, `@octokit/rest` (already in repo via `lib/github/spec-fetcher.ts:8`, `lib/config-sync.ts:7`), `@prisma/client`
**Storage**: PostgreSQL 14+. New tables: `TicketOutcome` (one immutable row per shipped ticket), `BackfillProgress` (per-project resume cursor). Stack-indicator lookup is in-code (TypeScript const), not a DB table — versioned alongside the rule set.
**Testing**: Vitest unit + integration; Playwright not required (no new browser-facing flows).
**Target Platform**: Vercel serverless (Next.js API routes), GitHub Actions runners (backfill workflow).
**Project Type**: web (Next.js full-stack — single repo).
**Performance Goals**: SHIP API p95 latency increases ≤ 50 ms (SC-007). Outcome capture completes within 5 minutes of SHIP at p99 (SC-001). Aggregate queries (e.g., "fraction frictionFree") return < 1 s per project (SC-003).
**Constraints**: Outcome write must NOT block SHIP transition (FR-002, FR-019). Outcome row is write-once / immutable (FR-001, FR-021, FR-022). Backfill MUST NOT introduce new credentials or env vars (FR-016). Concurrent live capture and backfill must produce no duplicates (FR-017, SC-009).
**Scale/Scope**: 700+ historical shipped tickets to backfill across all current projects. Steady-state ~50 SHIP transitions/day. Five supported language stacks at launch (TypeScript/Next, Python, Go, Rust, Zig).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.ai-board/memory/constitution.md` (v1.8.0):

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in `lib/outcomes/`, `app/api/.../outcome*` is TypeScript strict, fully typed; no `any`. New Prisma models give a typed query surface. |
| II. Component-Driven Architecture | PASS | No new UI components in this scope. API routes follow `/app/api/[resource]/route.ts` convention. Lib utilities under `lib/outcomes/` follow single-responsibility split (capture, derivation, classification, lookup). |
| III. TDD (NON-NEGOTIABLE) | PASS | Phase 0 inventory enforces "extend, not duplicate". Test plan below maps each new file to either an existing test file (extension) or a new one only where domains don't overlap. Decision tree: classifier/lookup/derivation are pure → unit; persistence path → integration; backfill loop → integration. No E2E required. |
| IV. Security-First | PASS | Reuses existing `GITHUB_TOKEN` (live) and per-project owner credential resolution path used by `lib/config-sync.ts` — no new credentials, secrets, or env vars (FR-016). All inputs to new API routes validated via Zod. Authorization gated by `verifyProjectAccess` / `verifyProjectOwnership` (existing helpers in `lib/auth.ts`). No raw SQL. |
| V. Database Integrity | PASS | All schema changes via `prisma migrate dev` (new migration). `TicketOutcome` has `@@unique([ticketId])` enforcing 1-row immutability at DB level. Inserts use `prisma.ticketOutcome.create()` and catch P2002 to skip duplicates (StripeEvent pattern, `app/api/webhooks/stripe/route.ts:67-78`). No external dispatch happens after a TicketOutcome write (write is the terminal step), so the "external call after DB mutation" rule is vacuously satisfied. |
| V. Spec Clarification Guardrails | PASS | Spec's `Auto-Resolved Decisions` section enumerates all CONSERVATIVE choices with trade-offs and reviewer notes (spec.md:8-99). Plan inherits those decisions verbatim — no new auto-resolutions introduced. |

**Post-Phase-1 Re-check**: PASS (after data-model.md, contracts/, and workflows/ artifacts were drafted). No new violations introduced; the dispatch-then-rollback pattern from `lib/tickets/transition.ts:309-384` is preserved by keeping outcome capture **decoupled** from the SHIP optimistic update (capture is invoked AFTER the update commits — its failure cannot revert SHIP, satisfying FR-019).

No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```
specs/AIB-742-capture-ticket-outcomes/
├── plan.md              # This file
├── research.md          # Phase 0 — Existing Files, Patterns, decisions
├── data-model.md        # Phase 1 — TicketOutcome, BackfillProgress, lookup spec
├── contracts/           # Phase 1 — API endpoint contracts
│   ├── outcome-api.md   # GET outcome by ticket; list outcomes (queries)
│   └── backfill-api.md  # POST start backfill; GET backfill status
├── workflows/           # Phase 1 — async-process specs
│   ├── capture-on-ship.md   # Live capture process triggered by SHIP transition
│   └── backfill-outcomes.md # Per-project backfill workflow (manual dispatch)
└── tasks.md             # Phase 2 — generated by /ai-board.tasks
```

### Source Code (repository root)

New and modified paths grouped by responsibility (paths verified to exist or to be net-new in research.md §"Existing Files"):

```
prisma/
└── schema.prisma                                       # +TicketOutcome, +BackfillProgress; no edits to existing models
prisma/migrations/<timestamp>_ticket_outcomes/
└── migration.sql                                       # NEW — generated by `prisma migrate dev`

lib/outcomes/                                           # NEW directory — feature-scoped utilities
├── capture.ts                                          # NEW — orchestration: aggregate + classify + derive + persist (pure)
├── derivation.ts                                       # NEW — computes change-shape (files, lines, ratio, domains) from a commit-files payload
├── classification.ts                                   # NEW — pipeline-vs-friction classifier; rule-set version export
├── stack-indicator-lookup.ts                           # NEW — in-code map: language/framework/services → glob indicators
├── github-files.ts                                     # NEW — Octokit `repos.getCommit`/`compareCommits` adapter for ticket commit refs
├── persist.ts                                          # NEW — `prisma.ticketOutcome.create()` with P2002 idempotency guard
└── types.ts                                            # NEW — DerivedOutcome, PartialReason union, RuleSetVersion constant

lib/tickets/
└── transition.ts                                       # MODIFY (after lib/tickets/transition.ts:352, post-update branch) — fire-and-forget capture; failure persists partial

lib/analytics/
├── queries.ts                                          # MODIFY (additive) — optional helper getOutcomeAggregates(projectId); existing functions untouched
└── types.ts                                            # MODIFY (additive) — re-export TicketOutcome row shape for typed consumers

lib/auth.ts                                             # NO CHANGE — reuse existing helpers
lib/db/client.ts                                        # NO CHANGE — reuse singleton
lib/config-sync.ts                                      # NO CHANGE — reuse `project.config` JSON for stack metadata
lib/github/spec-fetcher.ts                              # NO CHANGE — reference for Octokit pattern; new code follows it

app/api/projects/[projectId]/tickets/[ticketId]/outcome/
└── route.ts                                            # NEW — GET: fetch outcome for ticket (auth: verifyTicketAccess)
app/api/projects/[projectId]/outcomes/
└── route.ts                                            # NEW — GET: list outcomes by project with filters (frictionFree, partial, domain)
app/api/projects/[projectId]/backfill-outcomes/
├── route.ts                                            # NEW — POST: start backfill (auth: verifyProjectOwnership)
└── status/route.ts                                     # NEW — GET: current BackfillProgress

.github/workflows/
├── backfill-outcomes.yml                               # NEW — manual workflow_dispatch; processes one project's backlog with rate-limit yielding

tests/
├── unit/outcomes/
│   ├── classification.test.ts                          # NEW — friction-vs-pipeline classifier (pure)
│   ├── derivation.test.ts                              # NEW — change-shape derivation (pure)
│   ├── stack-indicator-lookup.test.ts                  # NEW — semantic-tag matching across stacks (pure)
│   └── capture.test.ts                                 # NEW — orchestration with mocked subordinates
├── integration/
│   ├── outcome-capture-on-ship.test.ts                 # NEW — full capture path: fixture ticket+jobs → assert outcome row
│   ├── outcome-immutability.test.ts                    # NEW — second capture attempt is a no-op (P2002)
│   ├── outcome-partial-paths.test.ts                   # NEW — no commits / unreachable repo → partial=true
│   ├── backfill-outcomes.test.ts                       # NEW — idempotent backfill: run twice on fixture, second is no-op
│   ├── backfill-resume.test.ts                         # NEW — resume from cursor after simulated interruption
│   ├── ticket-transition.test.ts                       # EXTEND (existing) — assert SHIP transition is unaffected by capture failures
│   └── api-outcomes.test.ts                            # NEW — GET endpoints, auth gates, filter behaviors
└── unit/analytics/
    └── queries.test.ts                                 # EXTEND (existing) — only if getOutcomeAggregates helper is added
```

**Structure Decision**: Single Next.js project (Option 1). Feature-scoped module under `lib/outcomes/` keeps all derivation/classification/lookup logic colocated and pure (testable as units). The persistence + dispatch glue lives in two thin layers: `lib/tickets/transition.ts` (live trigger) and `.github/workflows/backfill-outcomes.yml` (batch). API surface is three new route groups — strictly read-only for outcomes (no PUT/PATCH/DELETE — enforces immutability at the HTTP layer too) and a write-only POST for starting a backfill.

## Testing Strategy

Constitution §III decision tree:

| New code | Test type | File |
|----------|-----------|------|
| `classification.ts` (pure: command → pipeline/friction + rule version) | Vitest unit | `tests/unit/outcomes/classification.test.ts` (NEW — no existing classifier file) |
| `derivation.ts` (pure: file list → domains, frequency map, code/test ratio) | Vitest unit | `tests/unit/outcomes/derivation.test.ts` (NEW — distinct from `lib/comparison/implementation-metrics.ts` which is local-git-only) |
| `stack-indicator-lookup.ts` (pure: language/services → glob set + glob match) | Vitest unit | `tests/unit/outcomes/stack-indicator-lookup.test.ts` (NEW) |
| `capture.ts` (orchestration with mocked subordinates) | Vitest unit | `tests/unit/outcomes/capture.test.ts` (NEW) |
| Live capture end-to-end (DB → outcome row, immutability, partial paths) | Vitest integration | `tests/integration/outcome-capture-on-ship.test.ts`, `outcome-immutability.test.ts`, `outcome-partial-paths.test.ts` (all NEW — no existing outcome-domain integration file) |
| Backfill loop (idempotency, resume, rate-limit yield) | Vitest integration | `tests/integration/backfill-outcomes.test.ts`, `backfill-resume.test.ts` (NEW) |
| SHIP transition is not blocked by capture failure | Vitest integration | EXTEND `tests/integration/ticket-transition.test.ts` (existing file owns the SHIP transition path — adding scenarios there avoids creating a parallel file that mixes concerns) |
| API routes (GET outcomes, POST backfill, auth gates) | Vitest integration | `tests/integration/api-outcomes.test.ts` (NEW — separate from existing `api-tickets`/`api-projects` files which test different resources) |
| Analytics consumer helper (only if `getOutcomeAggregates` added) | Vitest unit | EXTEND `tests/unit/analytics/queries.test.ts` (existing) |

**No E2E**: All new flows are server-side. UI consumption of outcomes is out of scope for this ticket.

**Mocks** (per constitution §III): `tests/unit/outcomes/capture.test.ts` mocks `lib/outcomes/github-files.ts` and `lib/outcomes/persist.ts` — both at the same module path the orchestrator imports from (verified via import chain). Integration tests use real Prisma against the test database; only the GitHub HTTP layer is mocked via the existing test-mode pattern (`process.env.TEST_MODE === 'true'`, see `lib/github/spec-fetcher.ts:42` and `lib/config-sync.ts:50`).

**Test data**: Use seeded `[e2e]` projects (1-2) for backfill scenarios where many tickets are needed; use the standard `tests/global-setup.ts` fixtures for single-ticket capture tests.

## Complexity Tracking

*No violations to justify. Constitution Check passes both pre- and post-design.*
