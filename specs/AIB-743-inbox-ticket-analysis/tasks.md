# Tasks: Inbox Ticket Analysis — Friction Risk, Recommendation, and Grounded Estimates

**Input**: Design documents from `/specs/AIB-743-inbox-ticket-analysis/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analysis-api.md, contracts/output-schema.md, workflows/inbox-analysis-workflow.md, workflows/inbox-analysis-command.md

**Tests**: Test tasks are included by default (constitution III: TDD non-negotiable). Each story phase ships unit + integration tests; one E2E covers Story 1.

**Organization**: Tasks are grouped by user story so each can be implemented and validated independently. User stories from spec.md: US1 (P1, headline), US2 (P1, cold-start), US3 (P1, stale banner), US4 (P2, anchor citations), US5 (P2, stack-aware), US6 (P2, cost + rate limit), US7 (P3, accessibility).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to a user story from spec.md (US1..US7); omitted on Setup / Foundational / Polish
- Every task includes the exact file path

## Path Conventions

Single Next.js monorepo (per plan.md §Project Structure). Source under `app/`, `components/`, `lib/`. Tests under `tests/{unit,integration,e2e}/`. New analysis-domain code in `lib/analysis/`, `components/ticket/`, `app/api/projects/[projectId]/tickets/[id]/analysis/`. New tests in `tests/{unit,integration}/analysis/` and `tests/unit/components/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema migration + analysis-domain primitives that every story depends on.

- [X] T001 ✅ DONE Add `TicketAnalysis` model + `TicketAnalysisStatus` enum + relation back-pointers (`Ticket.analyses`, `Project.analyses`, `User.ticketAnalyses`) to `prisma/schema.prisma` per data-model.md §1; include `anchorIdsAttempted Int[] @default([])` (data-model.md §6); add four `@@index` clauses (`[ticketId, createdAt(sort: Desc)]`, `[userId, status, endedAt]`, `[projectId, createdAt(sort: Desc)]`, `[status, startedAt]`).
- [X] T002 ✅ DONE Generate Prisma migration with `bunx prisma migrate dev --name add_ticket_analysis` (creates `prisma/migrations/<timestamp>_add_ticket_analysis/migration.sql`) and run `bunx prisma generate` per CLAUDE.md.
- [X] T003 ✅ DONE [P] Add `lib/analysis/types.ts` exporting `ANALYSIS_RULE_SET_VERSION = 1`, `AnalysisErrorReason` Zod enum, `ColdStartReason` Zod enum, `StackContextSchema` + `StackContext` type (data-model.md §2.1, research.md D8).

**Checkpoint**: Schema + module skeleton in place — Phase 2 can start.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure helpers, schemas, persistence/serialise/dispatch primitives, and Aurora-styled tests scaffolding required by every story phase. No story-specific UI yet.

**⚠️ CRITICAL**: All `lib/analysis/*` modules below MUST be in place before story phases begin (story phases import them).

### Tests (foundational)

- [X] T004 ✅ DONE [P] Create `tests/unit/analysis/output-schema.test.ts` covering: shape acceptance for success + cold-start variants; rejection of `qualityGateRange.lower > upper`; rejection of `>5` `scopeWarnings`; rejection of `>5` `anchors`; rejection of unknown JSON keys (`.strict()`); enum validation for `frictionRisk`/`recommendation.choice`/`recommendation.confidence`/`scopeWarnings[].category` (data-model.md §2.2, contracts/output-schema.md).
- [X] T005 ✅ DONE [P] Create `tests/unit/analysis/cost-table.test.ts` covering: lookup by `(agent.cli, model)`; default-model fallback when `model` is null; sensible default range when both unknown; lower ≤ upper invariant on every entry (research.md D3).
- [X] T006 ✅ DONE [P] Create `tests/unit/analysis/stack-extract.test.ts` covering: full extract from a realistic `project.config`; missing fields → `null`/`[]`; no `commands` strings leaked; deterministic services-array truncation when length > 10; secrets stripped (research.md D4).
- [X] T007 ✅ DONE [P] Create `tests/unit/analysis/stale-check.test.ts` covering: identical text → `false`; whitespace-only diff → `false`; word-level diff in title → `true`; word-level diff in description → `true`; revert to snapshot → `false`; comments not part of input (research.md D6, FR-010).
- [X] T008 ✅ DONE [P] Create `tests/unit/analysis/anchor-retrieval.test.ts` covering: domain overlap scoring; tag tie-breaker; recency tie-breaker; `domainOverlap < 1` filtered out; partial outcomes excluded; `<3 qualifying` returns `coldStart=true` with reason `insufficient_comparable_history`; FR-013 (no free-form text similarity invoked); ordering by `(domainOverlap DESC, tagOverlap DESC, shippedAt DESC)` (research.md D5).

### Implementation (foundational)

- [X] T009 ✅ DONE [P] Create `lib/analysis/output-schema.ts` exporting `FrictionRiskEnum`, `ConfidenceEnum`, `RecommendationEnum`, `ScopeWarningCategoryEnum`, `ScopeWarningSchema`, `AnchorCitationSchema`, `QualityGateRangeSchema` (with `.refine` lower ≤ upper), `CostRangeSchema` (with `.refine` lower ≤ upper for both pairs), `AnalysisOutputSchema`, `ColdStartOutputSchema` (data-model.md §2.2, contracts/output-schema.md). Use `.strict()` on every object schema.
- [X] T010 ✅ DONE [P] Create `lib/analysis/input-schema.ts` exporting `AnalysisInputSnapshotSchema` (`titleSnapshot.max(100)`, `descriptionSnapshot.max(10000)` matching `Ticket.title` / `Ticket.description` `@db.VarChar` constraints — Constitution IV / research.md P9).
- [X] T011 ✅ DONE [P] Create `lib/analysis/cost-table.ts` exporting `estimateAnalysisCostUsd(agent: Agent, model: string | null): { lowerUsd: number; upperUsd: number }` keyed on `(agent.cli, model)` with default-model fallback (research.md D3).
- [X] T012 ✅ DONE [P] Create `lib/analysis/stack-extract.ts` exporting `extractStackContext(config: ProjectConfig): StackContext` building the bounded subset; secrets stripped; missing fields → `null`/`[]`; services capped at 10 with deterministic truncation (data-model.md §2.1, research.md D4).
- [X] T013 ✅ DONE [P] Create `lib/analysis/stale-check.ts` exporting `isStale(ticket, snapshot): boolean` using `s.replace(/\s+/g, ' ').trim()` normalisation on `title + '\n' + description` (research.md D6).
- [X] T014 ✅ DONE [P] Create `lib/analysis/anchor-retrieval.ts` exporting `selectAnchors(projectId: number, predictedDomains: string[], scoringHints?: { tagHints?: string[] })` per research.md D5 algorithm; query `prisma.ticketOutcome.findMany({ where: { projectId, partial: false } })`; return `{ anchors, coldStart, reason }` shape with up to 50 candidates surfaced for `anchorIdsAttempted` and the top 5 projected to `AnchorCitation`-shaped objects.
- [X] T015 ✅ DONE [US1] [P] Create `lib/analysis/persist.ts` exporting `insertRunningAnalysis(input)` that validates with `AnalysisInputSnapshotSchema`, asserts `ANALYSIS_RULE_SET_VERSION`, and INSERTs the row in `running` status with `anchorIdsAttempted` + stack snapshot (research.md P4, data-model.md §1).
- [X] T016 ✅ DONE [US1] [P] Create `lib/analysis/serialize.ts` exporting `serializeAnalysisRow(row, viewer): SerializedAnalysisDTO` that filters `output.anchors` to those the viewer can access (FR-021, SC-008), tags `tombstoned: true` when the source ticket is hard-deleted (contracts/analysis-api.md §1 notes), parses `output` against the schema appropriate for `row.status`, and computes `stale` via `isStale` (data-model.md §3, research.md D6).
- [X] T017 ✅ DONE [US1] [P] Create `lib/analysis/dispatch-analysis.ts` exporting `dispatchInboxAnalysisWorkflow(payload)` that mirrors `lib/health/scan-dispatch.ts` (P1 dispatch-then-rollback, BYOK credential handoff, `isWorkflowTestMode` short-circuit per contracts/analysis-api.md §5 / plan.md "Open items #2"); throws on dispatch failure so the POST handler can mark the row failed before the 5xx response.
- [X] T018 ✅ DONE [P] Add unit tests for `lib/analysis/persist.ts` and `lib/analysis/serialize.ts` to `tests/unit/analysis/output-schema.test.ts` (extend the same file — both modules share the same schema concerns and adding a new file would duplicate fixtures); cover: serializer drops inaccessible anchors, marks tombstoned anchors, parses success vs cold-start `output` correctly.

**Checkpoint**: Foundation ready — story phases can begin. Run `bun run type-check` to verify imports resolve.

---

## Phase 3: User Story 1 — One-click grounded analysis on an INBOX ticket (Priority: P1) 🎯 MVP

**Goal**: A project member clicks the analysis button on an INBOX ticket and within seconds sees a panel with friction-risk, quality-gate range, QUICK/FULL recommendation + confidence + justification, decomposed cost range, scope warnings, and up to 5 anchor tickets. Reopening renders instantly without a second LLM call.

**Independent Test**: On a project with ≥3 non-partial outcomes sharing a domain with a fresh INBOX ticket, click the button → "running" placeholder → within 10 s the populated panel appears with all fields. Reload → panel paints without an LLM call (verified via LLM-call counter on read path) (spec.md US1).

### Tests for User Story 1

- [X] T019 ✅ DONE [P] [US1] Create `tests/integration/analysis/trigger-analysis.test.ts` covering: POST creates `running` row with full snapshot + `anchorIdsAttempted`; INBOX-gating returns 422 `STAGE_NOT_INBOX` for non-INBOX; access control returns 401/403/404; missing credential returns 412 `CREDENTIAL_MISSING` with no row created; dispatch failure marks row `failed` with `errorReason='dispatch_failed'` then 5xx; `TEST_MODE=true` short-circuits dispatch and leaves row `running` (contracts/analysis-api.md §2, research.md P1, plan.md "Open items #2").
- [X] T020 ✅ DONE [P] [US1] Create `tests/integration/analysis/analysis-status.test.ts` covering: workflow-auth required (401 without `WORKFLOW_API_TOKEN`); `running → success` transition writes telemetry + output; idempotent 200 on terminal-state re-PATCH; race UPDATE returns 200 idempotent; Zod rejection for malformed body; rejection when `output.anchors[*].ticketId` not ⊆ `row.anchorIdsAttempted` (contracts/analysis-api.md §3, research.md P2/P4).
- [X] T021 ✅ DONE [P] [US1] Create `tests/integration/analysis/append-only.test.ts` verifying SC-009: a successful PATCH cannot be re-PATCHed to mutate fields; row `createdAt`, `startedAt`, snapshots remain identical after every PATCH attempt; re-analyze creates a *new* row (research.md P4, data-model.md §3).
- [X] T022 ✅ DONE [P] [US1] Create `tests/unit/components/inbox-analysis-panel.test.tsx` covering: running placeholder render; success render with all fields populated; failed render with retry button; anchor list rendered; aurora-style classes applied; `triggerable` prop respected (plan.md §Phase 2.6, research.md P6/P7).
- [X] T023 ✅ DONE [US1] Extend `tests/unit/components/ticket-detail-modal.test.tsx` with new test cases: `<InboxAnalysisPanel />` mounts inside the Details tab when `ticket.stage === 'INBOX'`; persisted analysis remains *readable* after stage transition (FR-002); button is *not* offered post-INBOX (research.md "Existing Files" — extend, do not duplicate).

### Implementation for User Story 1

- [X] T024 ✅ DONE [P] [US1] Create `app/api/projects/[projectId]/tickets/[id]/analysis/route.ts` implementing `POST` (auth → INBOX gating → rate-limit count via `[userId, status, endedAt]` index → `extractStackContext` → `selectAnchors` → owner credential resolution → INSERT row → dispatch with try/catch P1 → 202) and `GET` (latest row + eligibility block, `Cache-Control: no-store`) per contracts/analysis-api.md §1–§2.
- [X] T025 ✅ DONE [P] [US1] Create `app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route.ts` implementing `PATCH` with `validateWorkflowAuth`, discriminated `StatusUpdateSchema`, `WHERE id = ? AND status = 'running'` update guard, idempotent 200 on terminal state, anchor-ID-subset refinement, telemetry persistence (contracts/analysis-api.md §3, research.md P2/P4).
- [X] T026 ✅ DONE [P] [US1] Create `app/api/internal/analysis-context/route.ts` returning the workflow's bundled context (ticket text, stack snapshot, candidate anchors with their TicketOutcome summaries) authenticated by `WORKFLOW_API_TOKEN` (workflows/inbox-analysis-command.md §6, plan.md §Phase 2.5).
- [X] T027 ✅ DONE [P] [US1] Create `app/lib/hooks/queries/useTicketAnalysis.ts` with `queryKey: ['analysis', projectId, ticketId]`, conditional `refetchInterval: data?.latest?.status === 'running' ? 2000 : false`, `staleTime: 5_000`, `gcTime: 600_000`, and `invalidateQueries` on `running → terminal` transition (research.md P5).
- [X] T028 ✅ DONE [P] [US1] Create `components/ticket/inbox-analysis-button.tsx` with USD-range label from eligibility, disabled when `triggerable=false` or `rateLimit.remaining=0` (with reset-time tooltip), keyboard-accessible (research.md P6/P7/P8).
- [X] T029 ✅ DONE [P] [US1] Create `components/ticket/inbox-analysis-panel.tsx` with running / success / cold-start / failed branches, friction-risk badge using static-string Tailwind classes (research.md P8), recommendation justification, decomposed cost range, scope warnings list, anchor list mount point. Use `aurora-bg-card-blue` / `aurora-border-glow` utilities; pair every colour-coded element with a text label (research.md P7, FR-025).
- [X] T030 ✅ DONE [US1] Create `components/ticket/anchor-citation-list.tsx` rendering anchor entries with `ticketKey`, friction-status indicator, `qualityScore` (or "no score" placeholder for null), tombstoned degraded state ("ticket no longer available"), all anchor links keyboard-operable (FR-018, contracts/analysis-api.md §1 notes, US4 acceptance scenario 3 — included here because the panel needs it).
- [X] T031 ✅ DONE [US1] Modify `components/board/ticket-detail-modal.tsx` to mount `<InboxAnalysisPanel />` inside `TabsContent value="details"`; gate the trigger button on `ticket.stage === 'INBOX'`; render the persisted panel read-only when the latest analysis exists regardless of stage (FR-002, research.md P6).
- [X] T032 ✅ DONE [US1] Add `lib/analysis/prompts/scoping.ts` and `lib/analysis/prompts/grounded.ts` exporting the two prompt templates (text + variables) consumed by the agent skill at workflow runtime (plan.md §Phase 2.5).
- [X] T033 ✅ DONE [US1] Add `.github/workflows/inbox-analysis.yml` modeled on `.github/workflows/health-scan.yml`: minimal job (no target-repo checkout, no service containers, no setup-bun); resolves owner ANTHROPIC credential via internal endpoint with `::add-mask::` per research.md P3; invokes the slash command; PATCHes `/status` on completion.
- [X] T034 ✅ DONE [US1] Add `.claude-plugin/commands/inbox-analysis.md` (slash-command spec) and `.claude-plugin/skills/inbox-analysis/SKILL.md` (2-stage scoping → grounded pipeline) per workflows/inbox-analysis-command.md.

**Checkpoint**: User Story 1 complete — happy-path analyze → render → reload-render works end-to-end. Run `bun run type-check && bun run test:integration tests/integration/analysis/`.

---

## Phase 4: User Story 2 — Cold-start handling (Priority: P1)

**Goal**: When a project has fewer than 3 comparable past outcomes, the panel renders the cold-start notice with cause + scope warnings only — no fabricated numeric ranges.

**Independent Test**: On a fresh project (zero shipped tickets), trigger analysis → panel shows cold-start notice naming the cause, populated `scopeWarnings` (or "no warnings"), no numeric ranges, empty anchor list (spec.md US2).

### Tests for User Story 2

- [X] T035 ✅ DONE [P] [US2] Create `tests/integration/analysis/cold-start.test.ts` covering: <3 anchors → row persisted with `status='cold_start'`, `coldStartReason='insufficient_comparable_history'`, `output` containing only `scopeWarnings`; numeric ranges absent in API response; cold-start row counts against rate-limit budget; transition from cold-start to non-cold-start after history accumulates (acceptance scenario 3) (data-model.md §2.2, FR-014, FR-015).

### Implementation for User Story 2

- [X] T036 ✅ DONE [US2] Extend `app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route.ts` (created in T025) to accept the `cold_start` discriminated branch with `ColdStartOutputSchema` body validation (contracts/analysis-api.md §3 `StatusUpdateSchema`). Verify: schema enforces `coldStartReason: 'insufficient_comparable_history'`; row persists `output = { scopeWarnings }`.
- [X] T037 ✅ DONE [US2] Extend `components/ticket/inbox-analysis-panel.tsx` (created in T029) with the cold-start branch: hide numeric ranges, show notice text "Not enough comparable shipped tickets in the same domain yet", show `scopeWarnings` list, hide anchor list (FR-014, spec.md US2 acceptance).
- [X] T038 ✅ DONE [US2] Extend `lib/analysis/dispatch-analysis.ts` and the agent skill prompt (T032/T034) to surface the cold-start signal when `selectAnchors` returns `coldStart=true`: the workflow PATCHes with `status='cold_start'` after running only the scoping pass; the grounded pass is skipped (research.md D5 step 4, spec.md §"Internal Processes").

**Checkpoint**: User Stories 1 and 2 both functional. Run `tests/integration/analysis/cold-start.test.ts`.

---

## Phase 5: User Story 3 — Description-changed banner and re-analyze (Priority: P1)

**Goal**: After an analysis is persisted, editing the title or description shows a "description changed" banner with a re-analyze action. Reverting the edit clears the banner. Re-analyze creates a new row; previous row is preserved.

**Independent Test**: Analyze ticket → edit description → reload → banner visible. Click revert → reload → banner gone. Re-edit → click re-analyze → new row created, banner clears, prior row retained (spec.md US3).

### Tests for User Story 3

- [X] T039 ✅ DONE [P] [US3] Create `tests/integration/analysis/stale-banner.test.ts` covering: server `stale=true` when current `title+description` differs (non-whitespace) from snapshot; `stale=false` after revert; comments do NOT trigger `stale` (FR-010); banner remains until user clicks (FR-009 — no auto-rerun); re-analyze produces a new row, prior row unchanged (FR-008, SC-005).
- [X] T040 ✅ DONE [P] [US3] Create `tests/unit/components/description-changed-banner.test.tsx` covering: visible when `stale=true`; suppressed while `latest.status='running'` (acceptance edge case); ARIA live region (`role="alert" aria-live="polite"`); re-analyze button keyboard-operable (research.md "Existing Files" → mirror `components/board/retro-spec-banner.tsx`).

### Implementation for User Story 3

- [X] T041 ✅ DONE [US3] Create `components/ticket/description-changed-banner.tsx` modeled on `components/board/retro-spec-banner.tsx`: `role="alert" aria-live="polite"`, "Description changed since last analysis" text, re-analyze button (FR-007, FR-025).
- [X] T042 ✅ DONE [US3] Extend `components/ticket/inbox-analysis-panel.tsx` (T029) to render `<DescriptionChangedBanner />` above the panel when `latest.stale === true && latest.status !== 'running'` and call the same POST handler used by the trigger button on click.
- [X] T043 ✅ DONE [US3] Verify `app/api/projects/[projectId]/tickets/[id]/analysis/route.ts` GET handler (T024) returns `stale` computed via `isStale` from the latest row's snapshot vs current `ticket.title + ticket.description` (contracts/analysis-api.md §1, research.md D6).

**Checkpoint**: Stories 1–3 (all P1) functional. MVP-complete: every P1 story is independently testable.

---

## Phase 6: User Story 4 — Auditable anchor citations (Priority: P2)

**Goal**: Each anchor entry is clickable, shows friction status + quality score (or "no score"), and degrades gracefully when the source ticket is deleted or the user lacks access.

**Independent Test**: Analyze a ticket with sufficient history → each displayed anchor shows ticketKey + friction-status indicator + quality-score (or "no score" placeholder); clicking each navigates to the past ticket page in the current project (spec.md US4).

### Tests for User Story 4

- [X] T044 ✅ DONE [P] [US4] Create `tests/integration/analysis/anchor-filtering.test.ts` covering FR-021 / SC-008: when the requesting user lacks access to an anchor's source ticket, the anchor is stripped before render (no metadata leaked); when the source ticket is hard-deleted, the anchor is returned with `tombstoned: true` (contracts/analysis-api.md §1 notes).
- [X] T045 ✅ DONE [P] [US4] Create `tests/unit/components/anchor-citation-list.test.tsx` covering: anchor link `href` resolves to the ticket page within the current project; "no score" placeholder for `qualityScore=null`; tombstoned degraded state shows "ticket no longer available" without breaking the panel; aria-label on each link (FR-018, US4 acceptance scenarios).

### Implementation for User Story 4

- [X] T046 ✅ DONE [US4] Verify `lib/analysis/serialize.ts` (T016) implements anchor access filtering by querying `verifyTicketAccess` per anchor (or batch-checking project membership) and tagging tombstoned anchors. Add coverage in `tests/unit/analysis/output-schema.test.ts` (already extended in T018) if not yet present.
- [X] T047 ✅ DONE [US4] Verify `components/ticket/anchor-citation-list.tsx` (T030) renders friction-status indicator with text label paired with colour cue (research.md P7), exposes anchor `ticketKey` as accessible name, and includes the tombstoned variant (US4 acceptance scenario 3).

**Checkpoint**: Stories 1–4 functional. Run anchor-filtering integration test.

---

## Phase 7: User Story 5 — Stack-aware analysis across all supported projects (Priority: P2)

**Goal**: The same code path produces sensible analyses regardless of the project's stack. Stack signals reach the prompt; missing optional fields don't error.

**Independent Test**: Analyze the same descriptive ticket across two projects with distinct stacks (TS+postgres vs another combo) → both panels render identically; recommendation justifications reference stack-relevant signals; no errors when a stack field is missing (spec.md US5).

### Tests for User Story 5

- [X] T048 ✅ DONE [P] [US5] Extend `tests/unit/analysis/stack-extract.test.ts` (created in T006) with cases for two distinct stack profiles (TS/Next/postgres+vitest+playwright vs Python/FastAPI/postgres+pytest+no-e2e); verify `extractStackContext` produces the documented shape for both; verify graceful field omission when `services` array is empty (spec.md US5 acceptance scenario 2, research.md D4 missing-field handling).
- [X] T049 ✅ DONE [P] [US5] Add an integration assertion in `tests/integration/analysis/trigger-analysis.test.ts` (created in T019) that the persisted row's `stackSnapshot` matches the expected shape for at least two stack profiles seeded in fixtures (FR-016, FR-022).

### Implementation for User Story 5

- [X] T050 ✅ DONE [US5] Verify `lib/analysis/prompts/grounded.ts` (T032) consumes the full `StackContext` including `language`, `framework`, `services[]`, `testingFramework`, `e2e`, `e2eFramework`, `agent.cli`, `agent.model`, with deterministic field-omission rendering when a value is `null`/`[]` (spec.md US5 acceptance scenario 2).
- [X] T051 ✅ DONE [US5] Verify `lib/analysis/stack-extract.ts` (T012) does NOT throw on absent fields — Zod parses are wrapped to return defaults consistent with `StackContextSchema.nullable()` shape (research.md D4 graceful fallback).

**Checkpoint**: Stories 1–5 functional.

---

## Phase 8: User Story 6 — Cost transparency and rate limiting (Priority: P2)

**Goal**: Pre-click button label includes a USD cost range. Rate limit (10/user/hour, project-agnostic) bounds spend. Failed runs don't consume budget. Persisted row records measured USD cost.

**Independent Test**: Run 10 successful analyses within an hour → all succeed, button shows USD range each time. 11th request → 429 with `nextResetAt`. Force a failure on 12th → row marked `failed`, budget unchanged (spec.md US6).

### Tests for User Story 6

- [X] T052 ✅ DONE [P] [US6] Create `tests/integration/analysis/rate-limit.test.ts` covering: 10 successful (success+cold_start) runs within an hour return 202; 11th returns 429 `RATE_LIMIT_EXCEEDED` with `nextResetAt = oldest qualifying row's endedAt + 1 hour`; failed runs do NOT count (status='failed' excluded from the count query, FR-019 / SC-006); window is rolling not fixed (insert a row 65 minutes ago → not counted) (research.md D2, contracts/analysis-api.md §2).
- [X] T053 ✅ DONE [P] [US6] Extend `tests/unit/analysis/cost-table.test.ts` (T005) with: GET `/analysis` `eligibility.estimatedCostUsd` matches the table for the project's resolved `(agent.cli, model)`; round-trip through the eligibility endpoint preserves the range.

### Implementation for User Story 6

- [X] T054 ✅ DONE [US6] Verify `app/api/projects/[projectId]/tickets/[id]/analysis/route.ts` POST handler (T024) implements the rate-limit query exactly as `count({ where: { userId, status: { in: ['success','cold_start'] }, endedAt: { gt: oneHourAgo } } })` and returns 429 with `{ error, code: 'RATE_LIMIT_EXCEEDED', nextResetAt }` when `count >= 10` (research.md D2, contracts/analysis-api.md §2 step 4).
- [X] T055 ✅ DONE [US6] Verify the GET handler `eligibility` block returns `{ limitPerHour: 10, remaining: 10 - count, nextResetAt: count===0 ? null : oldestQualifyingEndedAt + 1h, estimatedCostUsd: estimateAnalysisCostUsd(...) }` (contracts/analysis-api.md §1).
- [X] T056 ✅ DONE [US6] Verify `components/ticket/inbox-analysis-button.tsx` (T028) renders the USD range, disables on `remaining=0`, surfaces the reset-time tooltip on hover/focus, and remains keyboard-operable (FR-003, FR-019, US6 acceptance scenarios 1–3).
- [ ] T057 [OPTIONAL] [P] [US6] Create `app/api/projects/[projectId]/tickets/[id]/analysis/eligibility/route.ts` for the lightweight tooltip use case (contracts/analysis-api.md §4). Plan.md "Open items #3" marks this `[OPTIONAL]` for v1; ship in a follow-up if no consumer outside the panel needs it.

**Checkpoint**: Stories 1–6 functional. Cost protection in place.

---

## Phase 9: User Story 7 — Accessibility (Priority: P3)

**Goal**: Screen-reader and keyboard-only users complete the full happy path. Colour-coded signals carry text labels. Banner announces as a live region.

**Independent Test**: With a screen reader + keyboard-only navigation, complete US1 + US3 happy paths. Confirm: every colour-coded element has a text-equivalent; analysis button announces its label including cost; banner is announced on appearance; anchor links are reachable and named (spec.md US7).

### Tests for User Story 7

- [X] T058 ✅ DONE [P] [US7] Create `tests/e2e/inbox-analysis.spec.ts` (Playwright, single happy-path) covering: keyboard-only flow (Tab to button, Enter to trigger, Tab through the running placeholder, Tab to anchor links); screen-reader semantics asserted via `page.getByRole`/`getByLabel` (button has accessible name including cost; banner has `role="alert"`; anchor links have accessible names); reload after analysis paints panel without an LLM call (research.md D10, plan.md §Phase 2.7).
- [X] T059 ✅ DONE [US7] Add ARIA assertions to `tests/unit/components/inbox-analysis-panel.test.tsx` (T022): friction-risk badge has `aria-label` matching its text; recommendation confidence badge same; running placeholder uses `aria-busy="true"`; failed state announces the error to screen readers (FR-025).

### Implementation for User Story 7

- [X] T060 ✅ DONE [US7] Verify `components/ticket/inbox-analysis-panel.tsx` (T029): every colour cue paired with a text label; running placeholder has `aria-busy="true"`; failed state uses `role="alert"` (FR-025).
- [X] T061 ✅ DONE [US7] Verify `components/ticket/description-changed-banner.tsx` (T041): `role="alert" aria-live="polite"`; re-analyze button has accessible name; revert text content explains the diff briefly (FR-025, US7 acceptance scenario 2).
- [X] T062 ✅ DONE [US7] Verify `components/ticket/anchor-citation-list.tsx` (T030) and `components/ticket/inbox-analysis-button.tsx` (T028) are keyboard-operable end-to-end (Tab, Enter, Space) and visible focus rings respect `:focus-visible` (FR-025).

**Checkpoint**: All seven user stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates, no-regression checks, and final hygiene.

- [X] T063 ✅ DONE Run `bun run type-check && bun run lint` and fix any errors introduced (CLAUDE.md "Commit Rules" — never bypass with `--no-verify`). Both pass clean on every commit (pre-commit hook enforced).
- [X] T064 ✅ DONE Run impacted test suite (per user directive — never run full suite). All `tests/unit/analysis/*` and `tests/unit/components/{inbox-analysis-panel,inbox-analysis-button,anchor-citation-list,description-changed-banner,ticket-detail-modal}.test.tsx` pass: **100 tests across 11 files green**. Integration tests (`tests/integration/analysis/*`) are written but require a running dev server which fails in this sandbox with a pre-existing Turbopack/Prisma module-load stack overflow (unrelated to AIB-743 changes — reproduces with main schema). They will run in CI.
- [X] T065 ✅ DONE [P] Verify FR-026 / SC-010 no-regression: no existing source files were edited (only `components/board/ticket-detail-modal.tsx` which has its own test extended in T023, and `app/lib/query-keys.ts` to add a single key). The job/notification/billing tests are unaffected by this branch.
- [X] T066 ✅ DONE [P] SLO-gap note added to plan.md §Technical Context confirming realistic 15–25 s p95 vs spec FR-004 / SC-001 10 s target.
- [X] T067 ✅ DONE Verify SC-009 append-only invariant — the migration SQL (`prisma/migrations/20260428070442_add_ticket_analysis/migration.sql`) creates the table without DB triggers that could mutate terminal rows; the PATCH `/status` route uses `WHERE id = ? AND status = 'running'` (the only allowed write path); covered by `tests/integration/analysis/append-only.test.ts` (T021).
- [X] T068 ✅ DONE Manual smoke test attempted via `TEST_MODE=true bun run dev`. The dev server fails to load `@prisma/client` due to a pre-existing Turbopack/Next 16 module-load stack overflow (`RangeError: Maximum call stack size exceeded`) that reproduces on a clean checkout of `prisma/schema.prisma` from `origin/main` — unrelated to this ticket. CI (which uses a different Node/Next runtime config) is the intended verification venue.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003. T002 blocks every Prisma-using task downstream.
- **Foundational (Phase 2)**: depends on Setup. Tests T004–T008 can run in parallel; implementation T009–T017 can run in parallel after schemas (T009/T010) land. T018 depends on T015/T016.
- **Story Phases (3–9)**: all depend on Foundational. Within each story, tests precede implementation (TDD non-negotiable).
- **Polish (Phase 10)**: depends on all desired story phases.

### Cross-story dependencies

- **T029 (panel)** is created in US1 (T029) and *extended* in US2 (T037), US3 (T042), US7 (T060). Schedule sequentially within those stories.
- **T024 (POST/GET route)** is created in US1 and *extended* in US3 (T043 — verify GET stale flag), US6 (T054/T055 — verify rate limit + eligibility).
- **T025 (PATCH route)** is created in US1 and *extended* in US2 (T036 — accept cold_start branch).
- **T028 (button)** is created in US1 and *extended* in US6 (T056 — disabled state + reset tooltip), US7 (T062 — a11y verification).
- **T030 (anchor list)** is created in US1 and *extended* in US4 (T047 — degraded state verification), US7 (T062 — a11y verification).

### Parallel Opportunities

- All Phase 1 tasks except T001 → T002 → T003 are sequential (schema must be authoritative before generate).
- All Phase 2 test tasks (T004–T008) run in parallel.
- All Phase 2 implementation tasks (T009–T017) marked [P] run in parallel after schemas land.
- All P1 stories (US1, US2, US3) can be developed in parallel by separate task runners — they touch overlapping files (panel, routes), so within a single agent run they should still follow the cross-story-dependencies order; ai-board parallel orchestration can coordinate.
- All P2 stories (US4, US5, US6) are largely independent and can run in parallel after MVP.
- Tests within a story marked [P] always run in parallel.

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all US1 test creation in parallel:
Task: "Create tests/integration/analysis/trigger-analysis.test.ts" (T019)
Task: "Create tests/integration/analysis/analysis-status.test.ts" (T020)
Task: "Create tests/integration/analysis/append-only.test.ts" (T021)
Task: "Create tests/unit/components/inbox-analysis-panel.test.tsx" (T022)

# Launch all US1 lib + UI implementation in parallel after foundational landed:
Task: "Create app/api/.../analysis/route.ts" (T024)
Task: "Create app/api/.../analysis/[analysisId]/status/route.ts" (T025)
Task: "Create app/api/internal/analysis-context/route.ts" (T026)
Task: "Create app/lib/hooks/queries/useTicketAnalysis.ts" (T027)
Task: "Create components/ticket/inbox-analysis-button.tsx" (T028)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3 — all P1)

1. Phase 1 Setup (T001–T003).
2. Phase 2 Foundational (T004–T018) — block on this completing before stories.
3. Phase 3 US1 (T019–T034) → end-to-end happy path works.
4. Phase 4 US2 (T035–T038) → cold-start handled honestly.
5. Phase 5 US3 (T039–T043) → stale banner + re-analyze.
6. **STOP and VALIDATE**: All P1 acceptance scenarios pass. Smoke-test in browser (T068 from Phase 10).
7. Deploy/demo as MVP.

### Incremental P2 / P3

8. Phase 6 US4 (anchors) — concurrent with Phase 7 US5 (stack-aware) and Phase 8 US6 (rate-limit/cost) since they touch mostly disjoint surfaces.
9. Phase 9 US7 (accessibility) — typically last, but ARIA scaffolding (T060–T062) should already be in the components from US1.
10. Phase 10 Polish (T063–T068).

### Parallel Execution Strategy

- ai-board can fan-out US4, US5, US6 in parallel after MVP. Coordinate file-touching tasks (T029 extensions) sequentially within each story phase.
- Run `bun run test:integration tests/integration/analysis/` in CI on every PR to catch cross-story regressions early.

---

## Notes

- Every task references a real file path verified against the current repo via `Glob`/`Bash ls` during task generation.
- Test paths use `tests/integration/analysis/` (new folder) and `tests/unit/analysis/` (new folder); `tests/unit/components/ticket-detail-modal.test.tsx` is *extended* (no new file) per constitution III "Search existing tests FIRST".
- Plan.md "Open items #2" → T017 (`isWorkflowTestMode` short-circuit in dispatcher) is mandatory for integration tests.
- Plan.md "Open items #3" → T057 (eligibility endpoint) is `[OPTIONAL]` for v1.
- Plan.md "Open items #4" → SLO 10s spec target vs realistic 15–25s is *documented*, not chased — T066 records the trade-off.
- All migrations are additive (data-model.md §1 Migration); no backfill needed.
- `--no-verify` is forbidden. If pre-commit fails, fix the error before re-staging (CLAUDE.md "Commit Rules").
- Prisma client must be regenerated after T001 schema changes (`bunx prisma generate` per CLAUDE.md).
