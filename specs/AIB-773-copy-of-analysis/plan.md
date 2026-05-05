# Implementation Plan: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-773-copy-of-analysis` | **Date**: 2026-05-05 | **Spec**: `specs/AIB-773-copy-of-analysis/spec.md`

## Summary

Pair each shipped ticket's most-recent stored analysis (predictions for friction, cost range, quality range, workflow recommendation) with its captured outcome (actual cost, quality score, friction-free flag, workflow type) into a new `AnalysisOutcomePairing` record. Surface aggregated drift signals — friction confusion matrix, cost-range hit rate, quality-gate hit rate, and an analysed-vs-shipped usage counter — in an owner-only drift dashboard at `/projects/[projectId]/analytics/drift`. Pairing fires fire-and-forget on SHIP (chained after the existing outcome capture), with a nightly sweep to retroactively pair late-arriving outcomes within a 24-hour window.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, PostgreSQL 14+, NextAuth.js, TanStack Query v5.95.2, Zod, shadcn/ui + Radix, TailwindCSS 3.4
**Storage**: PostgreSQL via Prisma; one new model `AnalysisOutcomePairing`, one new field `TicketAnalysis.countedInDrift`. Single migration `add_analysis_outcome_pairing`.
**Testing**: Vitest (unit + integration), Playwright (E2E for the drift dashboard owner-access flow if any browser-only behaviour exists; otherwise Vitest integration). Component tests use `tests/utils/component-test-utils.tsx` `renderWithProviders`.
**Target Platform**: Linux server (Vercel deploy) for app; GitHub Actions (Ubuntu) for the nightly sweep cron.
**Project Type**: Web (Next.js App Router, server + client components, API routes co-located).
**Performance Goals**:
- p95 < 1.5s for `GET /api/projects/:projectId/drift` (well under SC-002 < 2s p95).
- Pairing computation completes in < 100ms (pure function + one upsert).
- Nightly sweep handles 1000 pending rows in < 60s.
**Constraints**:
- No new infrastructure dependencies (no queue, no separate ETL).
- Owner-only authorization on drift dashboard (FR-007).
- All numeric signals labelled with text (FR-008, SC-005 — accessibility).
- 24h pairing retry window (FR-005).
- Idempotent on `ticketId` (FR-006).
- Must NOT alter existing analysis or outcome flows (FR-014, SC-007).
**Scale/Scope**: Up to ~10k tickets per project; up to ~100 paired records per project per quarter typical; one drift dashboard per project; project counts bounded by existing tenancy model.

No NEEDS CLARIFICATION remaining — all spec auto-resolved decisions are accepted as-is and additional implementation-level questions (cost-range envelope, friction binarization edge cases, retry trigger ordering) resolved in `research.md`.

## Constitution Check

*Constitution: `.ai-board/memory/constitution.md` v1.8.0*

### I. TypeScript-First Development — PASS

- All new files (`lib/drift/*`, `components/drift/*`, `app/projects/[projectId]/analytics/drift/page.tsx`, `app/api/projects/[projectId]/drift/route.ts`, `app/api/maintenance/sweep-unpaired-pairings/route.ts`) authored under `strict: true`.
- No `any` introduced; analysis output JSON parsed via `AnalysisOutputSchema.safeParse` to obtain a typed value.
- All exported function signatures explicitly typed; `DriftData`, `PairingDeltas`, `DriftFilters` interfaces in `lib/drift/types.ts`.

### II. Component-Driven Architecture — PASS

- shadcn/ui `<Table>`, `<Card>`, `<Badge>` for confusion matrix and panel layouts; no custom UI primitives.
- Server Component for the page route; one Client Component (`drift-dashboard.tsx`) for the polling/filtering experience (matches existing `analytics-dashboard.tsx` pattern).
- Feature folder: `components/drift/` (drift-dashboard.tsx, confusion-matrix.tsx, range-hit-panel.tsx, usage-panel.tsx). Sub-components extracted only where reused or where parent would exceed ~300 lines.
- API route at `app/api/projects/[projectId]/drift/route.ts` (standard layout); maintenance endpoint at `app/api/maintenance/sweep-unpaired-pairings/route.ts`.

### III. Test-Driven Development — PASS

Test files extended/created (per `research.md` Existing Files inventory):
- **Unit (Vitest)**: `tests/unit/lib/drift/compute-pairing.test.ts` (pure delta function); `tests/unit/components/drift-dashboard.test.tsx` (RTL — confusion matrix, range panels, usage panel render with text labels).
- **Integration (Vitest)**:
  - `tests/integration/drift/pair-on-ship.test.ts` (pair lifecycle: with/without analysis, with/without outcome at SHIP, late outcome).
  - `tests/integration/drift/drift-route.test.ts` (API contract, owner-only access, cross-project isolation, invariant checks).
  - `tests/integration/drift/sweep-pairings.test.ts` (24h expiry, retry-success path).
  - `tests/integration/outcomes/outcome-capture-on-ship.test.ts` (EXTEND existing file): assert pairing chain fires after capture resolves.
- **E2E (Playwright)**: only if owner-access denial requires browser context; default to Vitest integration with `x-test-user-id` header for cross-user access checks.

Tests use accessibility-first queries (`getByRole`, `getByText`); no `data-testid` reliance for semantic content. Mocks target the same module instance the SUT imports (e.g., `lib/drift/pair` mocked via `vi.mock('@/lib/drift/pair', …)`).

### IV. Security-First Design — PASS

- All API inputs validated via Zod (cursor and pageSize on `/api/projects/:id/drift`).
- Prisma parameterized queries only — no raw SQL.
- Owner-only authorization via `verifyProjectOwnership` (FR-007); members and non-owners receive 404 (no information leak).
- Maintenance endpoint guarded by `Authorization: Bearer ${WORKFLOW_API_TOKEN}` — same pattern as existing `nightly-log-prune` endpoint.
- No new secrets introduced; `WORKFLOW_API_TOKEN` already provisioned for the nightly cron.
- No PII in logs — only ids, counts, timestamps.

### V. Database Integrity — PASS

- Single Prisma migration `add_analysis_outcome_pairing`. No raw SQL.
- `prisma.$transaction` wraps the pairing upsert AND the `countedInDrift` flag flip (atomic — see workflows/pairing-on-ship.md Phase 5).
- Soft delete not applicable (drift records are immutable post-pairing; no user editing).
- All foreign keys declared with `onDelete: Cascade` (a deleted ticket cascades to its pairing, mirroring the `TicketOutcome` policy).
- Pairing function re-reads outcome and analysis rows on each invocation rather than relying on captured pre-pairing snapshots; sweep retries do not act on stale state.
- External calls (none) — no risk of orphaned PENDING rows.

### V (cont). Specification Clarification Guardrails — PASS

- Spec includes Auto-Resolved Decisions block (lines 8–60). All auto-resolved decisions are CONSERVATIVE; none required PRAGMATIC trim.
- Plan-level decisions documented in `research.md`'s "Open Decisions (Resolved Here)" section with rationale and alternatives.
- No new auto-resolution introduced at plan time; all newly-surfaced clarifications were resolved with explicit rationale.

### Standards (Code Quality, State, Errors) — PASS

- Descriptive names (`pairAnalysisWithOutcome`, `computePairingDeltas`, `DriftDashboardSnapshot`); JSDoc on exported entry points.
- Server state via TanStack Query v5 (15s polling matching existing analytics dashboard); local UI state via `useState`.
- Every API route uses try/catch; structured error responses `{ error, code? }`; auth errors return 401/403/404 deliberately (not 500).
- Logging tagged with `[drift-pairing]` and `[drift-sweep]`; no `console.error` swallowed.

**Result**: All gates PASS. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```
specs/AIB-773-copy-of-analysis/
├── plan.md                           # This file
├── research.md                       # Phase 0 output
├── data-model.md                     # Phase 1 output
├── contracts/
│   └── drift-api.md                  # GET /api/projects/:id/drift + maintenance endpoint
├── workflows/
│   ├── pairing-on-ship.md            # Pairing internal process
│   └── nightly-pairing-sweep.md      # 24h retry cron
└── tasks.md                          # Phase 2 output (NOT created here — speckit.tasks generates)
```

### Source Code (repository root)

```
app/
├── api/
│   ├── projects/[projectId]/drift/
│   │   └── route.ts                          # NEW: GET — owner-only drift snapshot
│   └── maintenance/sweep-unpaired-pairings/
│       └── route.ts                          # NEW: POST — bearer-token sweep endpoint
└── projects/[projectId]/analytics/
    └── drift/
        └── page.tsx                          # NEW: server component, owner-gated, renders dashboard

components/drift/                              # NEW directory
├── drift-dashboard.tsx                       # NEW: client component, TanStack Query, polling
├── confusion-matrix.tsx                      # NEW: 2×2 table with TP/FP/TN/FN + precision/recall
├── range-hit-panel.tsx                       # NEW: shared panel for cost and quality (in/under/over counts)
└── usage-panel.tsx                           # NEW: analysed-vs-leftInbox counter + ratio

lib/drift/                                     # NEW directory
├── pair.ts                                   # NEW: pairAnalysisWithOutcome(ticketId) entry point
├── compute-deltas.ts                         # NEW: pure function: prediction × outcome → PairingDeltas
├── persist.ts                                # NEW: transactional upsert + countedInDrift flag flip
├── sweep.ts                                  # NEW: sweep entry point (called by maintenance API)
├── queries.ts                                # NEW: getDriftData(projectId, filters) for dashboard
└── types.ts                                  # NEW: PairingDeltas, DriftData, DriftFilters

lib/tickets/transition.ts                      # EXTEND: chain pairing after captureOutcomeOnShip on SHIP
app/lib/query-keys.ts                          # EXTEND: add queryKeys.drift.*

prisma/schema.prisma                           # EXTEND: add AnalysisOutcomePairing model + countedInDrift on TicketAnalysis
prisma/migrations/<timestamp>_add_analysis_outcome_pairing/migration.sql  # NEW: single migration

.github/workflows/nightly-pairing-sweep.yml    # NEW: cron at 01:45 UTC

tests/
├── unit/lib/drift/compute-pairing.test.ts            # NEW
├── unit/components/drift-dashboard.test.tsx          # NEW
├── integration/drift/pair-on-ship.test.ts            # NEW
├── integration/drift/drift-route.test.ts             # NEW
├── integration/drift/sweep-pairings.test.ts          # NEW
└── integration/outcomes/outcome-capture-on-ship.test.ts  # EXTEND: assert pairing chain fires
```

**Structure Decision**: Web application layout. Drift feature is a vertical slice spanning persistence (`prisma/`), domain logic (`lib/drift/`), API (`app/api/projects/.../drift/`), and presentation (`app/projects/.../analytics/drift/page.tsx`, `components/drift/`). Co-located with existing analytics rather than promoted to a top-level route to match user mental model from spec User Story 1 ("analysis drift section of analytics area"). All new files live alongside existing analogues to keep navigation coherent.

## Implementation Phases (high-level — full task breakdown is `tasks.md`'s job)

### Implementation Phase A — Persistence layer

1. Add `AnalysisOutcomePairing` model and `TicketAnalysis.countedInDrift` field to `prisma/schema.prisma` (see `data-model.md`).
2. Generate migration via `bunx prisma migrate dev --name add_analysis_outcome_pairing`.
3. Run `bunx prisma generate` to refresh the client.

### Implementation Phase B — Domain logic

1. `lib/drift/compute-deltas.ts` — pure delta computation (unit tested first).
2. `lib/drift/persist.ts` — transactional upsert + `countedInDrift` flag flip; reuses the P2002-tolerant pattern from `lib/outcomes/persist.ts`.
3. `lib/drift/pair.ts` — orchestrator (Phase 1–5 from `workflows/pairing-on-ship.md`); reuses `AnalysisOutputSchema.safeParse` from `lib/analysis/output-schema.ts`.
4. `lib/drift/sweep.ts` — sweep entry point; iterates pending rows + tickets-without-row.
5. `lib/drift/queries.ts` — `getDriftData(projectId, filters)` aggregator.
6. `lib/drift/types.ts` — exported types.

### Implementation Phase C — Wire into SHIP transition

1. Extend `lib/tickets/transition.ts:355-364` SHIP block: chain `pairAnalysisWithOutcome` after `captureOutcomeOnShip`. Single fire-and-forget envelope with combined `.catch`.
2. Test extension: assert chain fires in `tests/integration/outcomes/outcome-capture-on-ship.test.ts` (extend, do not duplicate).

### Implementation Phase D — API & maintenance endpoint

1. `app/api/projects/[projectId]/drift/route.ts` — GET handler, `verifyProjectOwnership`, Zod-validated query params, returns `DriftDashboardSnapshot` per `contracts/drift-api.md`.
2. `app/api/maintenance/sweep-unpaired-pairings/route.ts` — POST handler, Bearer-token auth, calls `sweepUnpairedPairings`, returns counters.
3. `.github/workflows/nightly-pairing-sweep.yml` — cron at 01:45 UTC, mirrors `nightly-log-prune.yml` shape.

### Implementation Phase E — Presentation

1. `app/projects/[projectId]/analytics/drift/page.tsx` — server component; calls `verifyProjectOwnership` (or catches and `notFound()`); fetches initial `DriftDashboardSnapshot`; renders `<DriftDashboard>`.
2. `components/drift/drift-dashboard.tsx` — TanStack Query 15s polling (mirrors `analytics-dashboard.tsx:94-100`); wraps four panels.
3. `components/drift/confusion-matrix.tsx` — accessible 2×2 `<Table>` with TP/FP/TN/FN + precision/recall.
4. `components/drift/range-hit-panel.tsx` — shared panel (one instance for cost, one for quality).
5. `components/drift/usage-panel.tsx` — analysed-vs-leftInbox counter.
6. `app/lib/query-keys.ts` — extend with `queryKeys.drift.data(projectId, filters)`.
7. Add a link from the existing analytics page (or a tab) to `/projects/[id]/analytics/drift`, gated on owner status.

### Implementation Phase F — Tests

Per the constitution and the test inventory in `research.md`. Each test sits in the file paths listed in the Project Structure section. Unit tests precede integration tests in commit order (TDD).

## Testing Strategy

Per constitution §III, tests are placed by the decision tree, and the **"Search existing tests FIRST"** rule was applied via the `research.md` Existing Files inventory.

| Test type | File (action) | Verifies |
|-----------|---------------|----------|
| Unit | `tests/unit/lib/drift/compute-pairing.test.ts` (NEW) | Pure delta function: friction binarization, cost envelope range, quality range, workflow match, incomparable cases (null cost, null quality, unparseable output) |
| Unit (RTL) | `tests/unit/components/drift-dashboard.test.tsx` (NEW) | All four panels render with text labels (FR-008, SC-005); empty state when `sampleSize=0`; sample-size label rendered (FR-012) |
| Integration | `tests/integration/drift/pair-on-ship.test.ts` (NEW) | Full pair lifecycle: ship+analysis+outcome → row created; ship without analysis → no row, no error (FR-004); ship with analysis but no outcome → pendingOutcome=true; outcome arrives later → row updated; idempotent on duplicate ship (FR-006) |
| Integration | `tests/integration/drift/drift-route.test.ts` (NEW) | Owner gets 200 with snapshot; member gets 404; non-member gets 404; cross-project: owner of A querying B gets 404 (FR-007, SC-006); invariants I1–I7 from `contracts/drift-api.md` hold |
| Integration | `tests/integration/drift/sweep-pairings.test.ts` (NEW) | Bearer-only auth; pendingOutcome rows whose outcome arrived → paired; rows past 24h → unpairedReason set; counters returned correctly |
| Integration | `tests/integration/outcomes/outcome-capture-on-ship.test.ts` (EXTEND existing file) | After capture resolves, pairing chain fires (mocked spy on `pairAnalysisWithOutcome`); capture failure does not prevent transition success (existing) but pairing is not invoked when capture rejects |
| E2E | None proposed — owner-only access can be tested via Vitest integration using `x-test-user-id` header. Browser-only signals (visual rendering) covered by RTL component tests. |

**Why no Recharts**: spec mandates labelled tables for every panel; no charts in this dashboard.

**Test prefix**: All seeded test projects/tickets use the `[e2e]` prefix per CLAUDE.md.

## Re-evaluation: Constitution Check (post-design)

Re-checked all five principles against the designed artifacts (data-model.md, contracts/, workflows/) — no new violations introduced. The plan does not require:

- Any `any` types (parsed JSON is typed via `AnalysisOutputSchema`).
- Any new UI primitives outside shadcn/ui.
- Any test that mixes unrelated concerns into an existing test file.
- Any raw SQL.
- Any new secret.
- Any auto-correction of analysis prompts or outcome data (FR-013).

**Final gate**: PASS. No Complexity Tracking entries.

## Stop Point

This planning command ends here. Phase 2 (`tasks.md`) is generated by the `/ai-board.tasks` command and is intentionally NOT produced by this run.

## Generated Artifacts

| Artifact | Path |
|----------|------|
| Plan | `specs/AIB-773-copy-of-analysis/plan.md` |
| Research | `specs/AIB-773-copy-of-analysis/research.md` |
| Data model | `specs/AIB-773-copy-of-analysis/data-model.md` |
| API contract | `specs/AIB-773-copy-of-analysis/contracts/drift-api.md` |
| Workflow: pairing | `specs/AIB-773-copy-of-analysis/workflows/pairing-on-ship.md` |
| Workflow: nightly sweep | `specs/AIB-773-copy-of-analysis/workflows/nightly-pairing-sweep.md` |
| Agent context update | (see Phase 1 step 4) |

## Branch

`AIB-773-copy-of-analysis`
