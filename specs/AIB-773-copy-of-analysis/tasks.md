# Tasks: Analysis Calibration — Predicted vs Actual + Drift Dashboard

**Input**: Design documents from `/specs/AIB-773-copy-of-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/drift-api.md, workflows/pairing-on-ship.md, workflows/nightly-pairing-sweep.md

**Tests**: Included by default per constitution §III. All test paths reuse existing inventory or create new files only where no existing file covers the domain (verified against `research.md` "Existing Files" section).

**Organization**: Tasks are grouped by user story (P1 → P2 → P3) so each can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User-story label (US1, US2, US3, US4); omitted for Setup, Foundational, and Polish phases
- All file paths are absolute relative to repository root

## Path Conventions

Web application (Next.js App Router): `app/`, `components/`, `lib/`, `prisma/`, `tests/` at repo root. Paths verified against research.md "Existing Files" inventory and direct filesystem checks.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project tooling already configured; this feature requires only directory scaffolding for new modules.

- [x] T001 Create new directories `lib/drift/`, `components/drift/`, `app/projects/[projectId]/analytics/drift/`, `app/api/projects/[projectId]/drift/`, `app/api/maintenance/sweep-unpaired-pairings/`, `tests/integration/drift/`, `tests/unit/lib/drift/` (no placeholder files; created implicitly when first file is added)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, types, and shared modules that ALL user stories depend on. NO user-story work can begin until this phase is complete.

**⚠️ CRITICAL**: Phase 2 must be 100% complete before Phase 3 begins.

- [x] T002 Add `AnalysisOutcomePairing` model and `TicketAnalysis.countedInDrift Boolean @default(false)` field to prisma/schema.prisma (full model spec in specs/AIB-773-copy-of-analysis/data-model.md §Entities; include reverse relations on `Ticket`, `Project`, `TicketAnalysis`, `TicketOutcome`)
- [x] T003 Generate migration `add_analysis_outcome_pairing` via `bunx prisma migrate dev --name add_analysis_outcome_pairing` and `bunx prisma generate` to refresh client (writes prisma/migrations/<timestamp>_add_analysis_outcome_pairing/migration.sql)
- [x] T004 [P] Create shared types in lib/drift/types.ts exporting `PairingDeltas`, `DriftData`, `DriftDashboardSnapshot`, `DriftFilters`, `DriftRecentPairing` (shapes per data-model.md §DriftDashboardSnapshot and contracts/drift-api.md)
- [x] T005 [P] Extend app/lib/query-keys.ts with `queryKeys.drift.data(projectId, filters)` factory mirroring `queryKeys.analytics.*` pattern

**Checkpoint**: Foundation ready — database has the new table + field, types are exported, query keys are wired. User story phases can now begin in priority order.

---

## Phase 3: User Story 2 - Pairing predictions with actual outcomes at SHIP (Priority: P1) 🎯 FOUNDATION-OF-MVP

**Goal**: System creates an `AnalysisOutcomePairing` row within 5 minutes of SHIP for every ticket that has at least one stored analysis, computing deltas across friction, cost, quality, and workflow recommendation. Idempotent on `ticketId`; retries up to 24 hours when outcome arrives late; flags older analyses as excluded from drift.

**Independent Test**: Create a ticket with one stored analysis, drive it through to SHIP, ensure outcome capture runs, then verify within 5 minutes a paired record exists in `AnalysisOutcomePairing` with deltas referencing the chosen analysis (most recent), and that `TicketAnalysis.countedInDrift=true` for the chosen analysis only.

**Dependency note**: User Story 1 (drift dashboard) requires this story's pairing rows to exist as data. We sequence US2 first because dashboard data ⇒ pairing must be functional. (Spec lists this as P1 alongside US1; we implement pairing first because the dashboard reads what pairing produces.)

### Tests for User Story 2

**RULE (constitution)**: Write tests FIRST, ensure they FAIL before implementation. Test paths verified against research.md §"Existing Files" inventory.

- [x] T006 [P] [US2] Create unit tests for delta computation in tests/unit/lib/drift/compute-pairing.test.ts — covers friction binarization (TP/FP/TN/FN mapping per research.md), cost-range envelope (`[baselineLowerUsd, marginalFrictionUpperUsd]`) hit/miss/under/over, quality range hit/miss, workflow recommendation match, and `incomparable` flags when actual cost/quality/output is null/unparseable (no existing file covers this domain)
- [x] T007 [P] [US2] Create integration tests for pair lifecycle in tests/integration/drift/pair-on-ship.test.ts — covers: ship+analysis+outcome → row created with correct deltas; ship without analysis → no row, no error logged as failure (FR-004); ship with analysis but no outcome → `pendingOutcome=true` row created; outcome arrives later within 24h → row updated to paired; duplicate SHIP event → idempotent upsert (FR-006); 3 analyses on one ticket → only most recent has `countedInDrift=true` (no existing file covers this domain)
- [x] T008 [US2] Extend tests/integration/outcomes/outcome-capture-on-ship.test.ts with a test that asserts `pairAnalysisWithOutcome` is invoked (spied via `vi.mock('@/lib/drift/pair', ...)`) after `captureOutcomeOnShip` resolves; assert it is NOT invoked when capture rejects (existing file already covers capture-on-ship; extending preserves the constitution's "search existing tests FIRST" rule)

### Implementation for User Story 2

- [x] T009 [P] [US2] Implement pure delta function `computePairingDeltas(prediction, outcome): PairingDeltas` in lib/drift/compute-deltas.ts — exact algorithm from specs/AIB-773-copy-of-analysis/workflows/pairing-on-ship.md Phase 4
- [x] T010 [US2] Implement `persistPairing(tx, ticketId, projectId, analysisId, outcomeId, shippedAt, deltas)` in lib/drift/persist.ts — wraps `prisma.$transaction` to upsert `AnalysisOutcomePairing` keyed on `ticketId` AND flip `TicketAnalysis.countedInDrift` (true on chosen analysis, false on all other analyses for the ticket) per workflows/pairing-on-ship.md Phase 5; reuses P2002-tolerant upsert pattern from lib/outcomes/persist.ts
- [x] T011 [US2] Implement `pairAnalysisWithOutcome(ticketId): Promise<{ paired: boolean; reason?: string }>` orchestrator in lib/drift/pair.ts — sequences phases 1–5 from workflows/pairing-on-ship.md (lookup analysis, lookup outcome, parse via `AnalysisOutputSchema.safeParse`, compute deltas, persist); handles no-analysis early-exit (FR-004), pending-outcome path (sets `pendingOutcome=true`), unparseable-output path (sets `unpairedReason='output_unparseable'`); structured `[drift-pairing] phase=N` logging
- [x] T012 [US2] Implement `sweepUnpairedPairings(): Promise<{ examinedPending; pairedNow; expired; windowHours }>` in lib/drift/sweep.ts — phases per workflows/nightly-pairing-sweep.md: query pendingOutcome rows (LIMIT 1000), query SHIP-tickets-without-row in last 7 days (LIMIT 500), for each candidate retry `pairAnalysisWithOutcome` if age < 24h else upsert `unpairedReason='outcome_missing_24h'`; per-ticket errors logged but do not abort the sweep
- [x] T013 [US2] Extend lib/tickets/transition.ts SHIP block (currently lines 355–364) to chain `pairAnalysisWithOutcome(updatedTicket.id)` after `captureOutcomeOnShip` resolves; single fire-and-forget envelope with combined `.catch((err) => console.error('[drift-pairing] unhandled', { ticketId, err }))`; SHIP transition MUST NOT block on or surface pairing errors

**Checkpoint**: Pairing fires automatically on SHIP, retries late outcomes, exits cleanly without an analysis, and is idempotent. The `AnalysisOutcomePairing` table now has data — User Story 1 can begin.

---

## Phase 4: User Story 1 - Drift dashboard for project owners (Priority: P1) 🎯 MVP

**Goal**: Project owner opens `/projects/[projectId]/analytics/drift` and sees four labelled-table panels: friction confusion matrix (TP/FP/TN/FN + precision/recall on the "low risk" class), cost-range hit/miss panel (in/under/over counts), quality-gate hit/miss panel (in/under/over counts), and analysed-vs-leftInbox usage counter. All numeric signals accompanied by text labels (no color-only encoding).

**Independent Test**: Seed a project with at least one shipped ticket whose pairing row exists; sign in as the project owner; load `/projects/[projectId]/analytics/drift`; verify all four panels render with the seeded values, that totals reconcile per invariants I1–I3, and that every numeric signal has a text label.

**Depends on**: Phase 2 (Foundational) AND Phase 3 (US2 — pairing rows exist).

### Tests for User Story 1

- [x] T014 [P] [US1] Create integration tests for drift API in tests/integration/drift/drift-route.test.ts — covers: owner gets 200 with snapshot; member gets 404 (FR-007); non-member gets 404; cross-project isolation (Owner-A querying Project-B → 404 per I7, SC-006); empty-state when no pairings; `cursor` and `pageSize` Zod validation (400 on bad params); invariants I1–I6 from contracts/drift-api.md hold on seeded data (no existing file covers drift-route specifically; analytics-route is the pattern reference)
- [x] T015 [P] [US1] Create RTL component tests for drift dashboard in tests/unit/components/drift-dashboard.test.tsx — asserts confusion-matrix, cost panel, quality panel, usage panel each render with text labels (FR-008, SC-005); empty state renders when `sampleSize=0`; explicit sample-size label rendered (FR-012); precision/recall display "—" or null when denominators are zero (no existing file covers this domain; analytics-dashboard.test.tsx is the pattern reference)
- [x] T016 [P] [US1] Create integration tests for drift queries in tests/integration/drift/drift-route.test.ts (extend file from T014) — additional cases: filtering excludes `unpairedReason IS NOT NULL`; `usage.analysedShipped` includes paired AND expired-unpaired but excludes pending; `usage.leftInbox` reflects `stage != 'INBOX'` count

### Implementation for User Story 1

- [x] T017 [P] [US1] Implement `getDriftData(projectId, filters): Promise<DriftDashboardSnapshot>` in lib/drift/queries.ts — aggregates `AnalysisOutcomePairing` rows where `unpairedReason IS NULL` for the panel counts, joins `prisma.ticket.count` for `usage.leftInbox`, computes precision/recall (null when denominator 0, else rounded to 3 decimals), returns top `pageSize` recent pairings ordered by `shippedAt DESC` with `nextCursor` (opaque base64 of `{ shippedAt, id }`); enforces invariants I1–I6 by construction
- [x] T018 [US1] Implement GET handler in app/api/projects/[projectId]/drift/route.ts — calls `verifyProjectOwnership(projectId, request)` from lib/db/auth-helpers.ts (404 on member/non-owner per FR-007), Zod-validates `cursor` (string opt) and `pageSize` (int 1–50, default 30) per contracts/drift-api.md, returns `DriftDashboardSnapshot` JSON; structured `try/catch` with `{ error, code? }` shape; 401 from `requireAuth` for anonymous
- [x] T019 [P] [US1] Implement `<ConfusionMatrix>` shadcn/ui Table in components/drift/confusion-matrix.tsx — 2×2 with `<th scope="col">` and `<th scope="row">` headers, TP/FP/TN/FN cells with `aria-label="True positives: N"` style, plus precision and recall rows below; renders "—" when precision/recall is null (FR-008)
- [x] T020 [P] [US1] Implement reusable `<RangeHitPanel>` shadcn/ui Table in components/drift/range-hit-panel.tsx — three labelled rows (in-range, under, over) plus an incomparable row; props accept `title`, `data: { inRange; under; over; incomparable }`; used twice (cost and quality)
- [x] T021 [P] [US1] Implement `<UsagePanel>` shadcn/ui Card in components/drift/usage-panel.tsx — renders "X analysed shipped / Y tickets left INBOX" as text with the ratio (rounded to 3 decimals) per FR-011
- [x] T022 [US1] Implement `<DriftDashboard>` client component in components/drift/drift-dashboard.tsx — TanStack Query 15s polling (`refetchInterval: 15000, staleTime: 10000` per research.md Pattern 6) using `queryKeys.drift.data(projectId, filters)` and a `fetchDrift(projectId, filters)` helper; composes the four panels; reuses `components/analytics/empty-state.tsx` for `sampleSize=0`; depends on T019, T020, T021
- [x] T023 [US1] Implement page route in app/projects/[projectId]/analytics/drift/page.tsx — server component; calls `verifyProjectOwnership` (catches and triggers `notFound()` on denial per FR-007); fetches initial `DriftDashboardSnapshot` server-side via `getDriftData`; renders `<DriftDashboard>` with `initialData` prop
- [x] T024 [US1] Add a navigation link from app/projects/[projectId]/analytics/page.tsx to the drift sub-route, gated on owner status (hidden for members per FR-007)

**Checkpoint**: Owner can navigate to the drift dashboard, see all four panels with labelled values, and the data updates every 15s. MVP is functional.

---

## Phase 5: User Story 3 - Access restricted to project owners (Priority: P2)

**Goal**: Members and non-members are denied access to the drift dashboard endpoints and page route. Only the current owner of a project can view their own project's data; transferred owners lose access immediately.

**Independent Test**: Sign in as a project member (not owner) — load `/projects/[projectId]/analytics/drift` and `GET /api/projects/[projectId]/drift`; verify both deny access with a 404 (no information leak per FR-007). Sign in as a non-member — same denial. Sign in as the owner — both succeed.

**Note**: The authorization is implemented in T018 (API) and T023 (page) under US1. This phase adds dedicated test coverage and an additional cross-project leak test, since US1 tests cover the happy path while US3 hardens the negative cases.

### Tests for User Story 3

- [x] T025 [P] [US3] Extend tests/integration/drift/drift-route.test.ts with explicit owner-only cases: (a) member of project → 404, (b) non-member → 404, (c) anonymous → 401, (d) former-owner-of-transferred-project → 404, (e) owner-of-A querying project-B → 404 (cross-project isolation per I7, SC-006); use `x-test-user-id` header to switch identities

### Implementation for User Story 3

- [x] T026 [US3] Verify the maintenance endpoint app/api/maintenance/sweep-unpaired-pairings/route.ts (created in T028 below) does NOT accept session-cookie auth — only `Authorization: Bearer ${WORKFLOW_API_TOKEN}` per contracts/drift-api.md §Maintenance Sweep API (and add a unit test in tests/integration/drift/sweep-pairings.test.ts asserting 401 for cookie-only requests)

**Checkpoint**: All access paths to drift data are owner-only; maintenance endpoint is bearer-token-only; cross-project queries return 404 with no information leak.

---

## Phase 6: User Story 4 - Audit trail for older analyses (Priority: P3)

**Goal**: When a ticket has multiple analyses, all are retained in the database; the most recent (chosen at pairing time) is flagged `countedInDrift=true`, all others are flagged `false`. Re-analyses created after the pairing row exists default to `false` and never alter the pairing.

**Independent Test**: Create a ticket with three successful analyses; drive to SHIP; query `TicketAnalysis` for that ticket; verify exactly one has `countedInDrift=true` (the most recent by `createdAt`, ties broken by highest `id`) and the other two have `countedInDrift=false`. Then create a fourth analysis after pairing; verify the fourth has `countedInDrift=false` and the original chosen analysis still has `countedInDrift=true`.

**Note**: The mechanism is implemented in T010 (persistPairing transactional flag flip) and T011 (pair orchestrator's analysis-selection query). This phase adds the dedicated audit-trail tests that close out the spec scenario.

### Tests for User Story 4

- [x] T027 [P] [US4] Extend tests/integration/drift/pair-on-ship.test.ts with an audit-trail test block: (a) seed a ticket with 3 analyses with distinct `createdAt` timestamps, drive to SHIP, assert most-recent has `countedInDrift=true` and the other two have `false`; (b) tie-breaker: 2 analyses with identical `createdAt` to the millisecond → highest `id` wins; (c) post-ship re-analysis: insert a 4th analysis after pairing, re-query — chosen analysis still `true`, 4th is `false`, no second pairing row created

**Checkpoint**: Audit trail is verified — older analyses are preserved with `countedInDrift=false`, the chosen analysis carries `countedInDrift=true`, and post-ship re-analyses do not retroactively change the pairing.

---

## Phase 7: Maintenance Endpoint & Nightly Cron (Cross-cutting infrastructure)

**Purpose**: Wires the sweep function into a scheduled GitHub Actions cron + maintenance API endpoint so late outcomes are paired and 24h-expired pairings are flagged. Cross-cuts US2 (mechanism) and US3 (auth posture); placed here so US2 deliverables remain testable in isolation via the inline SHIP path before the cron is enabled.

### Tests for the maintenance endpoint

- [x] T028 [P] Create integration tests for the maintenance endpoint in tests/integration/drift/sweep-pairings.test.ts — covers: bearer-token auth (401 without; 401 with bad token; 200 with valid `WORKFLOW_API_TOKEN`); pendingOutcome rows whose outcome has arrived → paired (`pairedNow` counter increments); rows past 24h with no outcome → `unpairedReason='outcome_missing_24h'` (`expired` counter increments); response shape `{ examinedPending, pairedNow, expired, windowHours: 24 }` per contracts/drift-api.md (no existing file covers this)

### Implementation for the maintenance endpoint

- [x] T029 Implement POST handler in app/api/maintenance/sweep-unpaired-pairings/route.ts — bearer-token auth via `Authorization: Bearer ${WORKFLOW_API_TOKEN}` (mirror of app/api/maintenance/prune-logs/route.ts pattern), no body, calls `sweepUnpairedPairings()` from lib/drift/sweep.ts (T012), returns counters JSON; structured `try/catch` returning `{ error, code? }`; tagged `[drift-sweep]` logging
- [x] T030 Create .github/workflows/nightly-pairing-sweep.yml — `cron: '45 1 * * *'` (01:45 UTC, offset from log-prune at 01:15 and health at 00:30 per research.md Pattern 5), `workflow_dispatch: {}`, single job that curls the maintenance endpoint with `Authorization: Bearer $WORKFLOW_API_TOKEN`, asserts HTTP 200; mirror exact shape of .github/workflows/nightly-log-prune.yml

**Checkpoint**: Late outcomes get paired automatically each night; pairings whose outcome never arrives within 24h are flagged and excluded from drift.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification, regression checks, and final code-quality polish across all stories. No new functionality.

- [x] T031 [P] Run `bun run type-check` and resolve any new `strict`-mode errors introduced by the feature (none expected per plan §Constitution Check I)
- [x] T032 [P] Run `bun run lint` and resolve any new ESLint errors (focus on the new files under lib/drift/, components/drift/, app/api/.../drift/)
- [ ] T033 [P] Run the full test suite (`bun run test`) and verify SC-007: existing inbox-analysis (tests/integration/analysis/) and outcomes-capture (tests/integration/outcomes/, except the extended T008 file) suites pass unchanged — no regressions
- [ ] T034 Manual accessibility audit pass per SC-005: confirm every numeric signal in the four panels is reinforced by a text label; no color-only encoding; all aria-labels present on count cells
- [ ] T035 Performance verification per SC-002: load `/api/projects/[projectId]/drift` against a project with 1000 paired records; confirm p95 < 1.5s (well under SC-002 < 2s); document the result in plan.md or as a comment in lib/drift/queries.ts only if a non-obvious tuning was needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies; T001 is a one-liner directory create. Start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. T002 → T003 are sequential (schema then migration). T004 and T005 can run in parallel after T003 completes (both depend on the regenerated Prisma client).
- **Phase 3 (US2 — pairing)**: Depends on Phase 2. Tests T006–T008 in parallel; implementation T009 → T010 → T011 → T012 sequential (each depends on the previous module); T013 last (wires to transition.ts).
- **Phase 4 (US1 — dashboard)**: Depends on Phase 3 (needs pairing rows to exist as test fixtures). Tests T014–T016 in parallel; implementation T017 → T018 sequential (API depends on queries); T019, T020, T021 in parallel; T022 depends on T019, T020, T021; T023 depends on T022; T024 last.
- **Phase 5 (US3 — access control)**: Depends on Phase 4 (the API and page routes exist). T025 in parallel; T026 sequential after T029.
- **Phase 6 (US4 — audit trail)**: Depends on Phase 3 (mechanism is in `persistPairing`). T027 standalone.
- **Phase 7 (maintenance endpoint)**: Depends on Phase 3 (T012 sweep function exists). T028 in parallel with T029; T030 last.
- **Phase 8 (Polish)**: Depends on all prior phases. T031, T032, T033 in parallel; T034 and T035 manual.

### Within Each User Story

- Tests written and FAILING before implementation (TDD per constitution §III).
- Models / types before services / queries before endpoints / pages.
- Different files marked [P] can run in parallel; same-file tasks must be sequential.

### Parallel Opportunities

- **Phase 2**: T004 and T005 in parallel after T003.
- **Phase 3**: T006, T007, T008 in parallel; then T009 in parallel with starting T010 setup work.
- **Phase 4**: T014, T015, T016 in parallel; T017 in parallel with T019/T020/T021.
- **Phase 7**: T028 in parallel with T029 (different files).
- **Phase 8**: T031, T032, T033 in parallel.
- **User stories** are independent enough that US3 (T025, T026) and US4 (T027) can run in parallel after Phase 4 finishes.

---

## Parallel Execution Examples

### Phase 3 — User Story 2 tests (run together)

```bash
# All three test files independent — different paths, different fixtures:
Task: "Create unit tests for delta computation in tests/unit/lib/drift/compute-pairing.test.ts"
Task: "Create integration tests for pair lifecycle in tests/integration/drift/pair-on-ship.test.ts"
Task: "Extend tests/integration/outcomes/outcome-capture-on-ship.test.ts with pairing-chain assertion"
```

### Phase 4 — User Story 1 panel components (run together)

```bash
# Three panel components are independent file-wise:
Task: "Implement <ConfusionMatrix> in components/drift/confusion-matrix.tsx"
Task: "Implement <RangeHitPanel> in components/drift/range-hit-panel.tsx"
Task: "Implement <UsagePanel> in components/drift/usage-panel.tsx"
```

### Phase 8 — Polish (run together)

```bash
Task: "Run bun run type-check"
Task: "Run bun run lint"
Task: "Run bun run test (regression check on existing suites)"
```

---

## Implementation Strategy

### MVP First (User Stories 2 + 1)

The spec lists US1 and US2 both as P1; US2 is implemented first because the dashboard reads what pairing produces.

1. Complete Phase 1 (Setup) — single directory create.
2. Complete Phase 2 (Foundational) — schema, migration, types, query keys.
3. Complete Phase 3 (US2 — pairing) — pairing rows now appear on every SHIP.
4. **Validate US2 independently**: ship a ticket with an analysis, query the database, confirm the row exists and `countedInDrift` is correctly flipped.
5. Complete Phase 4 (US1 — dashboard) — owner sees the four panels.
6. **Validate US1 independently**: log in as owner, load the page, confirm panels render with seeded values.
7. **MVP complete**: ship to staging.

### Incremental Delivery

1. After MVP, complete Phase 5 (US3) — explicit access-control hardening + tests.
2. Then Phase 6 (US4) — audit-trail tests.
3. Then Phase 7 (maintenance endpoint + cron) — late-outcome handling automated.
4. Then Phase 8 (polish) — type-check, lint, regression suite, accessibility, performance.

### Suggested MVP Scope

**MVP = Phases 1, 2, 3, 4** (Setup + Foundational + US2 + US1). After this, an owner can view the drift dashboard for a project where pairing has fired automatically since deploy. US3 (explicit auth tests), US4 (audit-trail tests), and the nightly sweep can ship in subsequent iterations without breaking the MVP.

---

## Task Summary

| Phase | Tasks | Story | Notes |
|-------|-------|-------|-------|
| 1. Setup | T001 | — | 1 task |
| 2. Foundational | T002–T005 | — | 4 tasks (T004, T005 parallel) |
| 3. US2 — pairing | T006–T013 | US2 | 8 tasks (3 tests parallel; 1 extends existing test file) |
| 4. US1 — dashboard | T014–T024 | US1 | 11 tasks (3 tests parallel; 3 panels parallel) |
| 5. US3 — access | T025–T026 | US3 | 2 tasks |
| 6. US4 — audit | T027 | US4 | 1 task |
| 7. Maintenance + cron | T028–T030 | — | 3 tasks |
| 8. Polish | T031–T035 | — | 5 tasks (3 parallel) |
| **Total** | **35 tasks** | | |

### Per-story task counts

- US1 (drift dashboard): 11 tasks (T014–T024)
- US2 (pairing): 8 tasks (T006–T013)
- US3 (access control): 2 tasks (T025–T026; mechanism in T018/T023)
- US4 (audit trail): 1 task (T027; mechanism in T010/T011)

### Independent test criteria per story

- **US2**: Create ticket+analysis, drive to SHIP, query `AnalysisOutcomePairing` for that ticketId, assert row exists with correct deltas and `countedInDrift` flags.
- **US1**: Sign in as owner of a project with paired rows, load `/projects/[projectId]/analytics/drift`, assert four panels render with labelled values and totals reconcile per I1–I3.
- **US3**: Sign in as member, hit `GET /api/projects/[projectId]/drift` → 404; non-member → 404; anonymous → 401; cross-project owner → 404.
- **US4**: Create ticket with 3 analyses, drive to SHIP, query `TicketAnalysis` for that ticket, assert exactly one has `countedInDrift=true`.

### Format Validation

All 35 tasks confirmed to use the strict format `- [ ] TNNN [P?] [Story?] Description with file path`. Setup, Foundational, Maintenance, and Polish phases omit the `[Story]` label per the rules. All file paths are real (existing files verified via filesystem; new files explicitly justified by the lack of existing coverage in research.md §"Existing Files").

---

## Notes

- [P] tasks = different files, no dependencies — safe to parallelize.
- [Story] label maps every user-story task to its spec.md acceptance scenarios.
- Each user story is independently testable per the criteria above.
- Tests MUST fail before implementation (TDD per constitution §III).
- Existing test files are extended (T008, T025, T027) rather than duplicated, per "search existing tests FIRST" rule.
- Pairing is fire-and-forget on SHIP; SHIP transition NEVER blocks on pairing errors (FR-014, SC-007).
- Owner-only authorization at every layer (FR-007, SC-006).
- All numeric signals labelled with text — no color-only encoding (FR-008, SC-005).
- Idempotent on `ticketId` (FR-006); 24h retry window (FR-005); incomparable handling per FR-015.
