# Implementation Plan: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Branch**: `AIB-744-analysis-calibration-predicted` | **Date**: 2026-04-30
**Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/AIB-744-analysis-calibration-predicted/spec.md`

> Phase 0 + Phase 1 outputs live alongside this file:
> [`research.md`](./research.md) · [`data-model.md`](./data-model.md) · [`contracts/calibration-api.md`](./contracts/calibration-api.md) · [`workflows/pair-on-outcome.md`](./workflows/pair-on-outcome.md)

---

## Summary

When a `TicketOutcome` row is written by AIB-742's `captureOutcomeOnShip` flow, chain a pure in-process pairing step that joins the outcome with the latest `success` `TicketAnalysis` row for the same ticket and persists the four predicted-vs-actual deltas (friction confusion cell, quality verdict, cost verdict, two recommendation booleans) to a new immutable `AnalysisCalibration` table. Expose the data via a project-owner-only `GET /api/projects/:projectId/calibration` endpoint that returns the most recent 30 calibration rows aggregated into a confusion matrix, two distributions, a recommendation panel, and an adoption counter — rendered by a new `/projects/:projectId/calibration` page that polls every 15 seconds. No new GitHub workflow, no LLM call, no edits to AIB-742 or AIB-743 schemas.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6.x, NextAuth.js, TanStack Query 5.95.2, Zod, shadcn/ui + Radix, Tailwind 3.4, Recharts 3.x (already used by analytics dashboard)
**Storage**: PostgreSQL 14+ via Prisma — one new table (`AnalysisCalibration`); no edits to existing tables
**Testing**: Vitest unit + integration. No new E2E (no browser-only flows; the dashboard is read-only and exercised by component + integration tests)
**Target Platform**: Vercel serverless (Next.js routes), no GitHub Actions runners (no workflow added)
**Project Type**: web (Next.js full-stack monorepo) — Option 1
**Performance Goals**:
- Pairing latency (Phase 1 idempotency check + Phase 9 persist): p95 ≤ 200 ms
- End-to-end SHIP → calibration row visible: ≤ 5 minutes p95 (SC-001), inherited from AIB-742's capture latency
- Dashboard API response (`getCalibrationDashboard`): tens of milliseconds — three projection-only Prisma queries against indexed columns
- Dashboard polling cadence: 15 s (FR-017 — matches `components/analytics/analytics-dashboard.tsx:99`)
**Constraints**:
- Append-only writes on `AnalysisCalibration` (FR-005, SC-002 — 0 mutations observed in audit)
- 1:1 keying with Ticket via `@@unique([ticketId])` (FR-001)
- No regression on AIB-742 / AIB-743 (FR-020, SC-009) — calibration code does not import write paths from those features; only their read schemas
- CLAUDE.md commit rules: `bun run type-check` and `bun run lint` clean; `bunx prisma generate` after schema change; no `--no-verify`
- Owner-only HTTP route (FR-013, SC-007) — reuses the existing `verifyProjectOwnership` helper, returns indistinguishable 404 for member / non-member cases
**Scale/Scope**:
- Steady state: ~1 calibration row per shipped+analyzed ticket per project; bounded by AIB-742's ~50 SHIP transitions/day and AIB-743's analysed-tickets share
- Dashboard query budget: 30 rows + a count + an adoption pair-of-aggregates per request — well under tens of milliseconds
- No backfill in v1 (`research.md` D10) — historical shipped+analyzed tickets remain unpaired

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — both passes recorded below.

Evaluated against `.ai-board/memory/constitution.md` (v1.8.0).

### Pre-Phase-0 evaluation

| Principle | Verdict | Evidence |
|---|---|---|
| **I. TypeScript-First Development** | PASS | All new code in `lib/calibration/` is TypeScript strict; explicit Zod-derived types for the row payload, the API response, and the dashboard data; no `any` planned. |
| **II. Component-Driven Architecture** | PASS | Dashboard is composed of focused sub-components (`ConfusionMatrixTable`, `VerdictDistributionChart`, `RecommendationPanel`, `AdoptionCounter`) — each justified by reuse (`VerdictDistributionChart` is reused for quality and cost), self-contained data, or > 40 lines of cohesive markup. shadcn/ui Card + Recharts (already in the platform). API route in `/app/api/[resource]/route.ts`. Lib utilities under `lib/calibration/` follow single-responsibility split (types, derive, pair, persist, queries, serialize) — mirrors the `lib/outcomes/` layout. |
| **III. Test-Driven Development (NON-NEGOTIABLE)** | PASS | Test layout follows `tests/integration/outcomes/` and `tests/integration/analysis/` patterns. New folder `tests/integration/calibration/` justified by domain isolation (research.md "Existing Files" + plan §"Testing Strategy"). Each requirement maps to a named test file. Decision tree applied: `derive.ts` is pure → unit; pairing/dashboard involve Prisma → integration; React components → unit RTL. **No E2E added** (no browser-only flow). |
| **IV. Security-First Design** | PASS | All inputs validated via Zod (`AnalysisCalibrationCreateSchema` with cross-field superRefine; route query/path parsed via Zod). No new credentials or env vars. Owner-only gate via existing `verifyProjectOwnership` (FR-013). 404 collapses authenticated-not-owner with project-not-found to prevent existence leak (SC-007). No raw SQL — all queries through Prisma. |
| **V. Database Integrity** | PASS | New model added via `prisma migrate dev --name add_analysis_calibration`. `@@unique([ticketId])` enforces 1-row immutability at DB level. `prisma.analysisCalibration.create()` wrapped in try/catch with P2002 idempotency (mirrors `lib/outcomes/persist.ts:144-152`, the established pattern). No external-call-after-DB-mutation pattern (the pairing is the terminal step). Cascade-on-delete to Ticket / Project / TicketAnalysis / TicketOutcome — no orphaned rows. After mutation, the in-memory pre-write object is never re-used (the pairing returns a status flag, not the row). |
| **V. Specification Clarification Guardrails** | PASS | Spec records 16 AUTO→CONSERVATIVE auto-resolved decisions with trade-offs and reviewer notes. PLAN inherits them verbatim. The only **technical** decisions PLAN adds (chain location, confusion-cell encoding, verdict enums, recommendation derivation, adoption-derivation source, in-process vs workflow trigger) are documented in `research.md` D1–D10 with rationale and alternatives — no silent overrides. |
| **Code Quality** | PASS | Functional components with hooks; descriptive names (`pairCalibrationOnOutcome`, `binariseFriction`, `quantifyQualityVerdict`, `computeRecommendationAxes`); JSDoc on exported functions in `lib/calibration/`. |
| **State Management** | PASS | Server state via TanStack Query (`useCalibrationDashboard`); local state via `useState`. No new global state; no mutations needed (the dashboard is read-only). Optimistic updates not applicable. |
| **Error Handling** | PASS | API route has try/catch returning `{ error, code? }`; 401/404/500 distinct paths; errors logged with route prefix `[calibration-api]`. Pairing's failures are logged with `[calibration]` prefix and never propagate to SHIP (FR-019). |

### Post-Phase-1 re-evaluation

After `data-model.md`, `contracts/calibration-api.md`, and `workflows/pair-on-outcome.md` were authored:

| Concern | Re-checked | Resolution |
|---|---|---|
| New model has 23 columns — risk of "data soup" | Yes | Each column is required by spec FR-006…FR-011 (snapshot integrity). The persistence Zod schema's `superRefine` (data-model.md §"Validation invariants") prevents inconsistent rows. No column is decorative. |
| Confusion-cell encoding chosen as a string enum, not 4 booleans | Yes | Documented in research.md D3 with the rationale (mutually exclusive cells, cleaner aggregation, no CHECK constraint needed). PASS — matches `partialReason` precedent on `TicketOutcome`. |
| Mirrored `partialReason` enum is not a Prisma enum (matches AIB-742's `String @db.VarChar(40)`) | Yes | Single source of truth lives in `lib/outcomes/persist.ts`'s `PARTIAL_REASONS` array; calibration imports the type-only union. Prevents drift. |
| 4 cascade FKs on one row | Yes | Necessary: Ticket and Project are independent owners; Analysis and Outcome are paired references. Cascading on all four prevents orphaned rows (constitution V). |
| Pairing chain modifies the existing SHIP block in `transition.ts` | Yes | Replaces a 10-line block with a 16-line async IIFE. The change is additive (capture's failure semantics preserved); test extension `tests/integration/ticket-transition.test.ts` asserts SHIP is unaffected by pairing failures. |
| Dashboard renders Recharts but spec requires tabular fallback | Yes | Each chart has a sibling `<table>` rendered alongside; the confusion matrix is rendered as the primary `<table>` (no chart). FR-018 satisfied; matches the analytics dashboard's `dimension-comparison-chart.tsx` precedent. |
| Owner-only collapses 404 for member-vs-non-member | Yes | `verifyProjectOwnership` already throws `'Project not found'` for both cases. The route maps that single message to 404 with a generic body. SC-007 satisfied. |

**Verdict**: PASS at both gates. No principles violated. No exceptions to record in `Complexity Tracking`.

---

## Project Structure

### Documentation (this feature)

```
specs/AIB-744-analysis-calibration-predicted/
├── plan.md                                    # this file
├── research.md                                # Phase 0 — Decisions D1–D10, Existing Files, Patterns
├── data-model.md                              # Phase 1 — AnalysisCalibration model + invariants
├── contracts/
│   └── calibration-api.md                     # Phase 1 — GET /api/projects/:projectId/calibration
├── workflows/
│   └── pair-on-outcome.md                     # Phase 1 — in-process pairing chained from transition.ts
├── checklists/                                # (existing)
├── spec.md                                    # (existing)
└── tasks.md                                   # Phase 2 — generated by /ai-board.tasks (NOT created here)
```

### Source Code (repository root)

New and modified paths grouped by responsibility (paths verified to exist or to be net-new in `research.md` §"Existing Files"):

```
prisma/
└── schema.prisma                                       # MODIFY — add AnalysisCalibration model + 4 back-pointer relations (Ticket, Project, TicketAnalysis, TicketOutcome). No edits to existing columns.

prisma/migrations/<timestamp>_add_analysis_calibration/
└── migration.sql                                       # NEW — generated by `bunx prisma migrate dev --name add_analysis_calibration`

lib/calibration/                                        # NEW directory — feature-scoped utilities
├── types.ts                                            # NEW — CALIBRATION_RULE_SET_VERSION, FrictionCell / Verdict enums, PairedCalibration / CalibrationDashboardData interfaces
├── derive.ts                                           # NEW — pure: binariseFriction, classifyFrictionCell, quantifyQualityVerdict, quantifyCostVerdict, computeRecommendationAxes, sumCostRange
├── pair.ts                                             # NEW — pairCalibrationOnOutcome orchestrator (Phases 1–9 from workflows/pair-on-outcome.md)
├── persist.ts                                          # NEW — Zod-validated prisma.analysisCalibration.create() with P2002 guard (mirrors lib/outcomes/persist.ts)
├── queries.ts                                          # NEW — getCalibrationDashboard(projectId): 30-row window + adoption counter
└── serialize.ts                                        # NEW — row → API DTO; aggregates the windowed rows into CalibrationDashboardData

lib/tickets/
└── transition.ts                                       # MODIFY — replace lines 355–364 with the async IIFE that chains capture → pair (workflows/pair-on-outcome.md §"Trigger surface")

app/api/projects/[projectId]/calibration/
└── route.ts                                            # NEW — GET handler with verifyProjectOwnership + getCalibrationDashboard

app/projects/[projectId]/calibration/
└── page.tsx                                            # NEW — Server Component: parse projectId, verify ownership via getProject() catch, seed initial data, render <CalibrationDashboard>

components/calibration/                                 # NEW directory
├── calibration-dashboard.tsx                           # NEW — TanStack Query container (15s polling), composes the four panels
├── confusion-matrix-table.tsx                          # NEW — labelled HTML <table> with TP/TN/FP/FN counts + percentages + precision/recall
├── verdict-distribution-chart.tsx                      # NEW — Recharts BarChart + tabular fallback (used for both quality and cost)
├── recommendation-panel.tsx                            # NEW — two stat cards (matchedRate, frictionAlignedRate) + tabular fallback
├── adoption-counter.tsx                                # NEW — single stat card "X of Y analysed since feature available — Z%"
└── empty-state.tsx                                     # NEW — "still warming up" indicator (rendered when warmingUp=true)

app/lib/query-keys.ts                                   # MODIFY — extend the queryKeys object with calibration.dashboard(projectId)
app/lib/hooks/queries/useCalibration.ts                 # NEW — useCalibrationDashboard hook (15s refetchInterval, staleTime 10000)

tests/
├── unit/calibration/
│   └── derive.test.ts                                  # NEW — pure-function unit tests for all derive.ts helpers
├── unit/components/
│   ├── calibration-dashboard.test.tsx                  # NEW — RTL render with fixture payload + filter / empty-state branches
│   └── confusion-matrix-table.test.tsx                 # NEW — RTL render: role="table", correct cells, precision/recall
├── integration/calibration/
│   ├── pair-on-outcome.test.ts                         # NEW — happy path: success analysis + outcome → exactly one calibration row
│   ├── multi-analysis.test.ts                          # NEW — US3: latest success analysis paired; older row unmodified
│   ├── cold-start.test.ts                              # NEW — US4: cold-start latest analysis ⇒ no row written
│   ├── partial-outcome.test.ts                         # NEW — FR-011 / SC-011: partial outcome ⇒ row with n_a verdicts where required
│   ├── no-success-analysis.test.ts                     # NEW — FR-004 / Edge case 1: no success analysis ⇒ no row, ticket counts in adoption
│   ├── immutability.test.ts                            # NEW — FR-005 / SC-002: second pair attempt is a no-op (P2002)
│   ├── api-calibration.test.ts                         # NEW — US6 / SC-007: owner→200; member→404; non-member→404 (indistinguishable)
│   ├── dashboard-window.test.ts                        # NEW — FR-015: 30-row window + "30 of N" caption + warmingUp branch
│   └── adoption-counter.test.ts                        # NEW — FR-016 / SC-008: denominator excludes pre-feature tickets; numerator includes failed/cold-start
└── integration/
    └── ticket-transition.test.ts                       # EXTEND — assert SHIP transition is unaffected by calibration failures (mirrors AIB-742's existing capture-failure assertion)
```

**Structure Decision**: Single Next.js project (Option 1). Feature-scoped module under `lib/calibration/` keeps all derivation/pairing/persistence/query logic colocated and pure-or-thin (testable as units or with seeded Prisma fixtures). The trigger glue lives in one place — the existing SHIP block in `lib/tickets/transition.ts`. The HTTP surface is one new GET route group plus one new page. The component surface is six small files under `components/calibration/`, mirroring the `components/analytics/` precedent. No new top-level package, no new service, no new workflow.

---

## Implementation Phases (high level — detailed tasks generated by `/ai-board.tasks`)

> Tasks.md is created by the `/ai-board.tasks` command, not this plan. The phases below sketch the dependency order so a future agent can split work into parallel-safe chunks.

### Phase 2.1 — Schema and primitives (parallel-safe)
- Add `AnalysisCalibration` model + 4 back-pointer relations to `prisma/schema.prisma`. Generate migration via `bunx prisma migrate dev --name add_analysis_calibration`. Run `bunx prisma generate`.
- Add `lib/calibration/types.ts` (constants, enums, interfaces).
- Add `lib/calibration/derive.ts` (pure helpers). Unit tests for each.

### Phase 2.2 — Persistence
- Add `lib/calibration/persist.ts` mirroring `lib/outcomes/persist.ts` (Zod superRefine + P2002 guard, P1 in research.md).
- Integration test: persist round-trip + duplicate skip.

### Phase 2.3 — Pairing orchestrator
- Add `lib/calibration/pair.ts` implementing Phases 1–9 from `workflows/pair-on-outcome.md`.
- Integration tests: `pair-on-outcome.test.ts`, `multi-analysis.test.ts`, `cold-start.test.ts`, `partial-outcome.test.ts`, `no-success-analysis.test.ts`, `immutability.test.ts`.

### Phase 2.4 — Wiring into SHIP
- Modify `lib/tickets/transition.ts` lines 355–364 to chain pairing after capture (research.md P2).
- Extend `tests/integration/ticket-transition.test.ts` with: (a) calibration row appears after SHIP, (b) calibration failure does not affect SHIP response, (c) SHIP path unchanged when ticket has no success analysis.

### Phase 2.5 — Dashboard read path
- Add `lib/calibration/queries.ts` (`getCalibrationDashboard`).
- Add `lib/calibration/serialize.ts` (windowed rows → DTO aggregation).
- Add API route at `app/api/projects/[projectId]/calibration/route.ts` with `verifyProjectOwnership` gate.
- Integration tests: `api-calibration.test.ts`, `dashboard-window.test.ts`, `adoption-counter.test.ts`.

### Phase 2.6 — UI
- Add `app/lib/hooks/queries/useCalibration.ts` (15s polling).
- Add `components/calibration/*.tsx` (six files).
- Add `app/projects/[projectId]/calibration/page.tsx` (Server Component).
- Component tests: `calibration-dashboard.test.tsx`, `confusion-matrix-table.test.tsx`.
- Manual visual pass: navigate to `/projects/<id>/calibration` as owner, member, and non-member; verify 200 / 404 / 404 responses; verify the dashboard renders with seeded fixtures.

### Phase 2.7 — Cross-cutting
- Run `bun run type-check && bun run lint && bun run test` — green before tasks.md is closed.
- Confirm no regression on `tests/integration/outcomes/*` and `tests/integration/analysis/*` (FR-020, SC-009).

---

## Testing Strategy

Constitution §III decision tree applied to each new file:

| New code | Test type | File | Justification |
|---|---|---|---|
| `lib/calibration/derive.ts` (pure: predictions + actuals → verdicts/cells) | Vitest unit | `tests/unit/calibration/derive.test.ts` (NEW) | No existing file covers calibration derivation. New folder mirrors `tests/unit/outcomes/`. |
| `lib/calibration/persist.ts` (Prisma write + Zod validation) | Vitest integration | covered by `pair-on-outcome.test.ts` (asserts the Zod superRefine guards via successful round-trip) and `immutability.test.ts` (asserts P2002 idempotency) | Avoids a parallel `persist.test.ts` that would duplicate the pairing fixture. |
| `lib/calibration/pair.ts` (orchestrator) | Vitest integration | `pair-on-outcome.test.ts`, `multi-analysis.test.ts`, `cold-start.test.ts`, `partial-outcome.test.ts`, `no-success-analysis.test.ts` (NEW) | DB read + write path; not a pure function. New folder `tests/integration/calibration/` justified by domain isolation. |
| `lib/calibration/queries.ts` (read-only Prisma aggregation) | Vitest integration | `dashboard-window.test.ts`, `adoption-counter.test.ts` (NEW) | Requires seeded calibration rows + analysis rows + tickets across the feature-availability boundary. |
| `lib/calibration/serialize.ts` (pure aggregation of windowed rows) | Vitest unit | covered by `dashboard-window.test.ts` (asserts the DTO shape against fixture rows) | Pure function with trivial logic; covering it via the integration test avoids redundant fixtures. |
| Calibration API route (`/api/projects/:projectId/calibration`) | Vitest integration | `api-calibration.test.ts` (NEW) | Auth gate + DB query path. Mocks `@/lib/db/auth-helpers` for the access-level fan-out. |
| SHIP transition chain | Vitest integration | EXTEND `tests/integration/ticket-transition.test.ts` (existing file owns the SHIP transition path; adding scenarios there avoids parallel files mixing concerns — explicit constitution §III "extend, don't duplicate" instruction) | Full SHIP → capture → pair end-to-end with assertions on response timing and DB rows. |
| `<CalibrationDashboard>` and sub-components | Vitest unit (RTL) | `calibration-dashboard.test.tsx`, `confusion-matrix-table.test.tsx` (NEW) | Component-level rendering of fixture data; no browser-only behaviour. |

**No E2E**: All new flows are server-side or read-only React. The constitution's E2E criterion ("REQUIRES a browser — OAuth, drag-drop, viewport") does not apply. The dashboard's accessibility (WCAG AA, FR-018) is verified by the component tests checking `role="table"`, axis labels, and tabular fallbacks — the platform's existing axe / pa11y CI hooks (if any) will pick up further violations.

**Mocks** (constitution §III "mocks must target the same module instance the code under test imports"):
- API integration tests mock `@/lib/db/auth-helpers` via `vi.mock('@/lib/db/auth-helpers')` — the same path the route imports from.
- Pairing tests use real Prisma against the test database; no mocks. The `TicketAnalysis.output` JSON is built with the real `AnalysisOutputSchema` from `lib/analysis/output-schema.ts` to guarantee shape parity.

**Test data**:
- Use seeded `[e2e]` projects (1-2) for fixtures requiring more than ~5 tickets (e.g., `dashboard-window.test.ts` needs 30+ rows).
- Use the standard `tests/global-setup.ts` fixtures for single-ticket pairing tests.
- Test names and ticket titles use the `[e2e]` prefix per CLAUDE.md.

**Test environment isolation**:
- `tests/integration/calibration/` runs in the same Vitest worker pool as other integration tests; no new server fixtures.
- The transition extension test (`ticket-transition.test.ts`) already has the SHIP-path scaffolding — calibration assertions are additions, not a rewrite.

---

## Complexity Tracking

*No violations to justify. Constitution Check passes both pre-Phase-0 and post-Phase-1 design.*
