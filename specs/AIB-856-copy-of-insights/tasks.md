---
description: "Task list for AIB-856 — Insights Analysis Covers All Agent Sessions of Every Ticket"
---

# Tasks: Insights Analysis Covers All Agent Sessions of Every Ticket

**Input**: Design documents from `specs/AIB-856-copy-of-insights/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/admin-api.md ✓, workflows/insights-analyze-workflow.md ✓

**Tests**: Included by default (Constitution §III). All test paths below are REAL existing files (verified) to **extend/rewrite**, except the one NEW file justified in research.md §"New test file".

**Organization**: Tasks are grouped by user story. This is a **brownfield edit** of the AIB-791 Insights subsystem — there is no new project scaffolding. Stories share a single-source predicate (P-2) and a single status route, so cross-story dependencies are noted explicitly.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 / US4 (maps to spec.md user stories)
- All paths are repository-root relative and verified to exist (new files flagged)

## Path Conventions
- Source: `app/lib/insights/`, `app/api/admin/insights/`, `components/admin/insights/`, `app/lib/hooks/queries/`, `prisma/`, `.github/workflows/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the brownfield baseline — no project initialization needed.

- [X] T001 ✅ DONE Confirm brownfield baseline: no new npm dependencies are required; verify `bun`/`bunx prisma` tooling is available and review the insights files enumerated in `specs/AIB-856-copy-of-insights/plan.md` (Project Structure) and `research.md` (Existing Files) so subsequent edits target real paths

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New persistence (`InsightsAnalyzedSession` marker + `expectedSessionsCount` column) that EVERY user story depends on.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete — the marker anti-join (US1 predicate), marker writes (US2), and counts (US4) all require the generated Prisma client.

- [X] T002 ✅ DONE Add `model InsightsAnalyzedSession` (`id Int @id @default(autoincrement())`, `jobId Int @unique` FK→`Job.id` `onDelete: Cascade`, `reportId Int` FK→`InsightsReport.id` `onDelete: Cascade`, `analyzedAt DateTime @default(now())`, `@@index([reportId])`); add `InsightsReport.expectedSessionsCount Int?`; add back-relations `Job.insightsAnalyzedSession InsightsAnalyzedSession?` and `InsightsReport.analyzedSessions InsightsAnalyzedSession[]` in `prisma/schema.prisma` (data-model.md)
- [X] T003 ✅ DONE Create migration `prisma/migrations/<ts>_insights_analyzed_session/migration.sql`: `CREATE TABLE "InsightsAnalyzedSession"` with unique index on `jobId`, index on `reportId`, FKs `ON DELETE CASCADE`; `ALTER TABLE "InsightsReport" ADD COLUMN "expectedSessionsCount" INTEGER;` — NO backfill (D-6). Use `prisma/migrations/20260511130000_insights_single_running_index/migration.sql` as the DDL style reference (depends on T002)
- [X] T004 ✅ DONE Run `bunx prisma generate` to regenerate the Prisma client with the new model, column, and relations (depends on T002, T003)

**Checkpoint**: Schema + client ready — user stories can begin.

---

## Phase 3: User Story 1 - Every session of every ticket is analyzed (Priority: P1) 🎯 MVP

**Goal**: Select **all** Claude agent sessions of **every** ticket across **all** projects (no earliest-per-ticket dedup, no per-project filter), driven by the per-session marker.

**Independent Test**: For a FULL ticket with five distinct sessions (specify/plan/implement/iterate/verify) all having captured transcripts, the enumeration returns all five (not one); sessions from multiple projects all appear; order is deterministic. Verified by the rewritten predicate unit tests.

### Tests for User Story 1
**NOTE: Write/rewrite the test FIRST and ensure it FAILS before implementing T006.**

- [X] T005 ✅ DONE [P] [US1] Rewrite `tests/unit/lib/insights/predicate.test.ts`: assert all sessions per ticket are returned (no earliest-per-ticket dedup), count/list parity over the eligible set, ascending `startedAt` order, `ticketId`-null excluded, `rawArtifactKey`-null excluded, effective-agent CLAUDE grid retained, and marker anti-join (analyzed sessions excluded when the `unanalyzed` toggle is on) — covers FR-002/003/007/009, US1, US3

### Implementation for User Story 1

- [X] T006 ✅ DONE [US1] Rewrite `app/lib/insights/predicate.ts`: one private `queryEligibleSessions(opts)` (status `COMPLETED` AND `ticketId != null` AND `log.rawArtifactKey != null` AND effective agent resolves to CLAUDE; **no** `TicketOutcome` join; `unanalyzed?` toggles the `insightsAnalyzedSession: null` filter); export `countEligibleUnanalyzedSessions()`, `listEligibleUnanalyzedSessions()` (all jobs, **no dedup**, ascending `startedAt`), `getEarliestEligibleSessionTimestamp()`; keep the `JobRef` shape; update the file-header doc (D-3/D-5/P-2) (depends on T004)
- [X] T007 ✅ DONE [P] [US1] Update predicate importers to the renamed eligible-session functions so the build stays green: `app/lib/insights/repository.ts` (re-export), `app/lib/insights/preflight.ts`, `app/api/admin/insights/trigger/route.ts` (depends on T006)
- [X] T008 ✅ DONE [P] [US1] Rewrite enumeration in `app/api/admin/insights/jobs/route.ts` to call `listEligibleUnanalyzedSessions()` and make `periodStart`/`periodEnd` query params optional and **ignored for selection** (D-5); response stays `{ jobs: JobRef[] }`, now all eligible-unanalyzed sessions across all outcomes/projects (depends on T006)

**Checkpoint**: Enumeration returns every eligible session of every ticket — US1 independently testable.

---

## Phase 4: User Story 2 - No session lost or counted twice between consecutive analyses (Priority: P1)

**Goal**: Once-and-only-once coverage via insert-only markers written only on the guarded `COMPLETED` transition; failed runs mark nothing; the pre-flight/trigger gate decides on not-yet-analyzed sessions.

**Independent Test**: Run A, create new sessions (including one at the boundary), run B → every session appears in exactly one run; a failed run leaves its sessions eligible.

### Tests for User Story 2
**NOTE: Write these FIRST and ensure they FAIL before implementing T012–T015.**

- [ ] T009 [P] [US2] Extend `tests/integration/admin/analysis-workflow.test.ts`: status PATCH COMPLETED writes one `InsightsAnalyzedSession` per accepted job and derives `sessionsCount` from the marked set; FAILED writes no markers; a late duplicate terminal PATCH is an idempotent no-op (no duplicate markers) — covers US2-AC1/AC3, FR-005/006
- [ ] T010 [P] [US2] Create NEW `tests/integration/admin/insights-session-coverage.test.ts`: two consecutive runs analyze every session exactly once (no gap, no overlap), a boundary session lands in exactly one run, a failed run leaves sessions eligible, and expected-vs-analyzed reflects a pruned-transcript gap — covers US2-AC2, US4, SC-002/005/006, FR-009/011 (justified NEW file, research.md §"New test file")
- [ ] T011 [P] [US2] Extend `tests/integration/admin/insights-api.test.ts`: marker-driven pre-flight returns renamed refusal codes (`NO_CLAUDE_SESSIONS` / `NO_NEW_SESSIONS`) and enumeration lists all eligible-unanalyzed sessions across all outcomes — covers FR-002/007/012

### Implementation for User Story 2

- [X] T012 ✅ DONE [US2] Extend `StatusPatchSchema` in `app/api/admin/insights/reports/[id]/status/route.ts`: add `analyzedJobIds: z.array(z.number().int().positive())` and `expectedSessionsCount: z.number().int().nonnegative()`, make `sessionsCount` optional/ignored (server-derived), and extend the `.refine` so COMPLETED requires `analyzedJobIds` + `expectedSessionsCount` + `ticketsCount` + `artifactKey` + `artifactSize` (P-6, contracts/admin-api.md)
- [X] T013 ✅ DONE [US2] In the COMPLETED branch of `applyTerminalTransition` in `app/api/admin/insights/reports/[id]/status/route.ts`: keep blob re-validate + `validateInsightsOutput` + `503 BLOB_UNREACHABLE` path (P-4); filter caller `analyzedJobIds` to currently-eligible Claude sessions (marker-poisoning defense, P-4); if the filtered set is empty → transition FAILED `'No readable Claude sessions available'` (no markers); else in one `prisma.$transaction` guarded by `status='RUNNING'` (P-1/P-3): `updateMany` set COMPLETED + `sessionsCount = marked.length` + `ticketsCount` + `expectedSessionsCount` + artifact fields, `insightsAnalyzedSession.createMany({ skipDuplicates: true })` for the marked jobIds, cascade linked Job→COMPLETED (try/catch log-and-continue); `count===0` → idempotent no-op `200`; FAILED branch writes no markers (depends on T004, T012)
- [X] T014 ✅ DONE [P] [US2] Update `app/lib/insights/preflight.ts`: count via `countEligibleUnanalyzedSessions()`; rename refusal codes `NO_CLAUDE_JOBS→NO_CLAUDE_SESSIONS` and `NO_NEW_SHIPPED→NO_NEW_SESSIONS`; rename field `shippedSincePreviousRun→eligibleSessionsSincePreviousRun`; keep `getLastCompletedRunEnd` for `previousRunEnd` display (D-7, FR-012) (depends on T006)
- [X] T015 ✅ DONE [US2] Update `app/api/admin/insights/trigger/route.ts`: marker-based pre-flight + renamed refusals; `periodStart = getEarliestEligibleSessionTimestamp() ?? now`, `periodEnd = now` (display only); preserve single-tx insert + dispatch-then-rollback + `ALREADY_RUNNING` (P-3/P-5) **unchanged**; keep `reconcileOrphanedRunningReports` at entry (P-7) (depends on T006, T014)

**Checkpoint**: Markers written exactly once on success, never on failure; gate driven by unanalyzed sessions — US2 independently testable.

---

## Phase 5: User Story 3 - Sessions from non-shipped tickets are included (Priority: P2)

**Goal**: Any-outcome eligibility — the download route must serve non-shipped sessions so they are not falsely reported as a gap. (The predicate's removal of the `TicketOutcome` join lands in US1/T006.)

**Independent Test**: A ticket that ran sessions but never shipped (e.g., rolled back VERIFY→PLAN) has its sessions enumerated and its raw-native transcripts fetchable.

### Tests for User Story 3

- [ ] T016 [P] [US3] Extend/verify `tests/integration/api/admin/insights/effective-agent.test.ts`: the effective-agent CLAUDE gate still selects correctly under the new any-outcome eligibility (no `TicketOutcome` dependency) — covers the agent gate
- [ ] T017 [P] [US3] Modify `tests/integration/outcomes/ship-transition-capture-resilience.test.ts`: count/list parity now holds over the eligible-session set across all outcomes with no per-ticket dedup (P-2 no-drift) — covers FR-002/003/007

### Implementation for User Story 3

- [X] T018 ✅ DONE [US3] Remove the shipped-outcome gate (`if (!job.ticket.outcome) return 404`, ~lines 69-76) from `app/api/admin/insights/jobs/[jobId]/raw-native/route.ts`; retain the `jobId` valid, job exists, `ticketId != null`, effective-agent CLAUDE, `rawArtifactKey` present, and canonical-key-match gates plus `502 BLOB_UNREACHABLE` on outage (D-8, FR-007; the FR-008 admin-facing scope note is delivered by T024)

**Checkpoint**: Non-shipped sessions are both enumerated (US1) and downloadable (US3) — US3 independently testable.

---

## Phase 6: User Story 4 - Report shows analyzed vs expected session counts (Priority: P2)

**Goal**: Surface analyzed-vs-expected counts, a gap warning when analyzed < expected, and the scope note; thread `expectedSessionsCount` through serializer, hooks, UI, and the workflow.

**Independent Test**: A period with some pruned transcripts shows analyzed < expected with a visible shortfall signal; a fully-readable period shows analyzed == expected; counts reflect all sessions (not per-ticket dedup).

### Tests for User Story 4
**NOTE: Write these FIRST and ensure they FAIL before implementing T024–T025.**

- [ ] T019 [P] [US4] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx`: "Analyzed X of Y Claude Code sessions across Z tickets" phrasing, gap-warning Badge when `sessionsCount < expectedSessionsCount`, static scope note rendered, header rewording — covers FR-008/010/011, US4
- [ ] T020 [P] [US4] Extend `tests/unit/components/admin/insights/run-analysis-button.test.tsx`: renamed refusal codes (`NO_CLAUDE_SESSIONS` / `NO_NEW_SESSIONS` / `ALREADY_RUNNING`) display correctly — covers FR-012

### Implementation for User Story 4

- [X] T021 ✅ DONE [P] [US4] Add `expectedSessionsCount: number | null` to the `ReportListEntry` type and the `toListEntry` serializer in `app/lib/insights/repository.ts` (FR-010)
- [X] T022 ✅ DONE [P] [US4] Add `expectedSessionsCount` to the reports list type in `app/lib/hooks/queries/use-insights-reports.ts`
- [X] T023 ✅ DONE [P] [US4] Update `app/lib/hooks/queries/use-insights-preflight.ts`: rename field `shippedSincePreviousRun→eligibleSessionsSincePreviousRun` and the refusal-code enum to `'NO_CLAUDE_SESSIONS' | 'NO_NEW_SESSIONS' | 'ALREADY_RUNNING'` (must match T014)
- [X] T024 ✅ DONE [US4] In `components/admin/insights/insights-report-view.tsx`: rewrite `formatMetadataPhrasing` to "Analyzed X of Y Claude Code sessions across Z tickets …"; render a gap-warning `Badge` when `sessionsCount < expectedSessionsCount` (FR-011); add a static scope note ("all Claude sessions across all projects, regardless of ticket outcome", FR-008); reword the header counter — no hardcoded colors, shadcn/ui only (depends on T021)
- [X] T025 ✅ DONE [US4] Update refusal-code references in `components/admin/insights/run-analysis-button.tsx` to the renamed codes (depends on T023)
- [X] T026 ✅ DONE [US4] Update `.github/workflows/insights-analyze.yml` per `specs/AIB-856-copy-of-insights/workflows/insights-analyze-workflow.md`: marker-driven `enumerate` step (`expected_count = .jobs | length`); 404-tolerant per-job `raw-native` download collecting `analyzed_job_ids` (200→extract+append; 404→skip, do not abort; other non-200→set `INSIGHTS_FAILURE_REASON` + `exit 1`; all-pruned→fail `'No readable Claude sessions available'`); `counts` step (`analyzed_count`, `ticket_count` over readable jobs); COMPLETED PATCH sends `analyzedJobIds` + `expectedSessionsCount` + `ticketsCount` + `artifactKey` + `artifactSize` (depends on T013; realizes US2 marking + US4 counts end-to-end)

**Checkpoint**: Reports show analyzed-vs-expected with gap signalling and scope note — US4 independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates across all stories.

- [ ] T027 Run `bun run type-check` and `bun run lint`; fix ALL errors including any pre-existing ones (CLAUDE.md commit rule — never `--no-verify`)
- [ ] T028 [P] Run targeted suites and confirm green: `bun run test:unit tests/unit/lib/insights/predicate.test.ts`, the two component tests under `tests/unit/components/admin/insights/`, and `bun run test:integration` for `analysis-workflow.test.ts`, `insights-api.test.ts`, `insights-session-coverage.test.ts`, `effective-agent.test.ts`, `ship-transition-capture-resilience.test.ts`
- [ ] T029 Extend `tests/e2e/admin/insights-flow.spec.ts` **only** if the gap-warning badge needs browser verification; otherwise rely on the integration/component coverage above (E2E ~5s each; Constitution §III)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. T002 → T003 → T004 (sequential). **BLOCKS all user stories.**
- **US1 (Phase 3)**: depends on Foundational. Provides the single-source predicate consumed by US2/US3/US4.
- **US2 (Phase 4)**: depends on Foundational + US1/T006 (count helper + anti-join).
- **US3 (Phase 5)**: depends on Foundational + US1/T006 (effective-agent rule; predicate already drops the shipped join).
- **US4 (Phase 6)**: depends on Foundational; T023 must match T014's refusal enum; T026 depends on US2/T013.
- **Polish (Phase 7)**: depends on all desired stories.

### Critical Cross-Story Notes

- **Single-source predicate (P-2)**: T006 is the lynchpin — US2/US3/US4 build on it. Do T006 before any consumer.
- **Refusal-code enum must agree** across T014 (`preflight.ts`), T023 (`use-insights-preflight.ts`), T025 (`run-analysis-button.tsx`).
- **`trigger/route.ts`** is touched by T007 (import rename) then T015 (logic) — sequential, same file.
- **`preflight.ts`** is touched by T007 (import rename) then T014 (logic) — sequential, same file.
- **`status/route.ts`** is touched by T012 (schema) then T013 (logic) — sequential, same file.
- **`repository.ts`** is touched by T007 (re-export) then T021 (serializer) — sequential, same file.
- **Workflow (T026)** completes US2 marking and US4 counts end-to-end; it depends on T013.

### MVP Scope

**User Story 1 (Phase 1 + 2 + 3)** is the MVP — it fixes the core defect (only the earliest session per shipped ticket was analyzed) by enumerating all sessions of all tickets across all projects.

---

## Parallel Opportunities

- **Foundational**: none — T002→T003→T004 are strictly sequential.
- **US1**: T007 and T008 run in parallel after T006 (different files).
- **US2**: tests T009/T010/T011 in parallel; impl T014 parallel with T012 (different files); T013 follows T012; T015 follows T014.
- **US3**: T016 and T017 in parallel; T018 standalone.
- **US4**: tests T019/T020 in parallel; impl T021/T022/T023 in parallel; then T024 (after T021), T025 (after T023), T026 (after T013).
- **Cross-story**: once Foundational completes, US1→(US2, US3, US4) can be pipelined; US3 and US4 are largely independent of US2 except the shared refusal enum (T023↔T014) and the workflow (T026↔T013).

### Parallel Example: User Story 2 tests

```bash
# Launch US2 test authoring together (different files):
Task: "Extend tests/integration/admin/analysis-workflow.test.ts (marker writes, FAILED no-op)"
Task: "Create tests/integration/admin/insights-session-coverage.test.ts (no gap/no overlap, boundary, pruned gap)"
Task: "Extend tests/integration/admin/insights-api.test.ts (marker-driven preflight + enumeration)"
```

### Parallel Example: User Story 4 hooks/serializer

```bash
# Launch US4 thread-through edits together (different files):
Task: "Add expectedSessionsCount to ReportListEntry/toListEntry in app/lib/insights/repository.ts"
Task: "Add expectedSessionsCount to app/lib/hooks/queries/use-insights-reports.ts"
Task: "Rename field + refusal enum in app/lib/hooks/queries/use-insights-preflight.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational: schema + migration + generate).
2. Complete Phase 3 (US1): rewrite predicate, fix importers, switch enumeration.
3. **STOP & VALIDATE**: predicate unit tests prove all sessions of every ticket (no dedup, all projects) are enumerated.

### Incremental Delivery

1. Foundational → ready.
2. US1 → all-sessions enumeration (MVP) → validate → demo.
3. US2 → once-and-only-once markers + gate → validate.
4. US3 → non-shipped download route → validate.
5. US4 → analyzed-vs-expected UI + workflow counts → validate end-to-end.
6. Polish → type-check, lint, targeted suites, optional E2E.

### Independent Test Criteria (recap)

- **US1**: multi-session FULL ticket → all sessions enumerated; multi-project corpus; no dedup.
- **US2**: two consecutive runs → each session analyzed exactly once incl. boundary; failed run leaves sessions eligible.
- **US3**: non-shipped (rolled-back) ticket → sessions enumerated and raw-native fetchable.
- **US4**: pruned-transcript period → report shows analyzed < expected with visible gap; fully-readable → analyzed == expected.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Verify each test FAILS before implementing its story.
- Commit after each task or logical group; run `bun run type-check` && `bun run lint` before committing; `bunx prisma generate` after any `schema.prisma` change.
- No hardcoded hex/rgb colors; no dynamically-constructed Tailwind class names; shadcn/ui + Radix only.
- All test files above are REAL existing paths to extend/rewrite except `tests/integration/admin/insights-session-coverage.test.ts` (NEW, justified in research.md).
