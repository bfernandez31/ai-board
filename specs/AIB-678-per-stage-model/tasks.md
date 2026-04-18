---
description: "Tasks: Per-stage model configuration for Claude workflows (AIB-678)"
---

# Tasks: Per-Stage Model Configuration for Claude Workflows

**Input**: Design documents from `/specs/AIB-678-per-stage-model/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks included per constitution §III (no explicit opt-out from user).

**Organization**: Tasks are grouped by user story (US1–US4, mapping to spec.md priorities P1/P1/P2/P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — only on Phase 3+ story tasks (US1, US2, US3, US4)
- All file paths are absolute from repo root (`/home/runner/work/ai-board/ai-board/target/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema + generated client are prerequisites for every later phase.

- [ ] T001 Extend `prisma/schema.prisma`: add 5 nullable `String? @db.VarChar(50)` columns (`specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`) on both `Project` (after `defaultBranch`) and `Ticket` (after `agent`), per `data-model.md`.
- [ ] T002 Generate Prisma migration and regenerate client: run `bunx prisma migrate dev --name aib_678_per_stage_model` and `bunx prisma generate`. Verify migration is pure additive (10 new nullable columns, no defaults, no backfill — preserves FR-007/SC-003).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared whitelist + Zod primitives consumed by every user story. **All subsequent phases depend on these.**

- [ ] T003 [P] Create whitelist module at `lib/models/claude-models.ts`: export `CLAUDE_MODEL_IDS` (const tuple of 4 IDs), `ClaudeModelId` type, `CLAUDE_MODEL_LABELS`, `CLAUDE_GLOBAL_FALLBACK_MODEL = 'claude-opus-4-7'`, `StageModelKey` type, `SMART_DEFAULTS` record, and `isClaudeModelId` type guard per `data-model.md` §ClaudeModelWhitelist.
- [ ] T004 [P] Create Zod schema module at `app/lib/schemas/model-config.ts`: export `claudeModelIdSchema = z.string().refine(isClaudeModelId, { message: '…' })` and `ticketModelOverrideSchema` with the 6-field + at-least-one-present refinement defined in `contracts/ticket-model-override.md`.

**Checkpoint**: Whitelist + schemas available. User stories may begin in parallel.

---

## Phase 3: User Story 1 - Configure default model per stage for a project (Priority: P1) 🎯 MVP

**Goal**: Project owner/member can pick a Claude model per stage in Settings; value persists and is exposed by the Project API.

**Independent Test**: Open Settings on a Claude project, change IMPLEMENT to Sonnet 4.6 via the AI Models card, confirm `project.implementModel` is updated and dispatching an IMPLEMENT job (no override) carries Sonnet 4.6.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T005 [P] [US1] Extend `tests/integration/projects/settings.test.ts`: add PATCH cases for each of the 5 new model fields (happy path per stage, isolation between fields, `null` resets a stage, unknown ID → 400 `INVALID_MODEL_ID`, non-member → 404, member allowed). Mirrors existing `defaultAgent` PATCH tests in the same file.
- [ ] T006 [P] [US1] Create `tests/unit/components/ai-models-card.test.tsx`: renders 5 selectors when `project.defaultAgent === 'CLAUDE'` (FR-003); renders informational message when non-Claude (FR-004); selector change triggers PATCH with optimistic update + revert on network failure (FR-005, SC-007); "Apply smart defaults" button visible (wired in US4).

### Implementation for User Story 1

- [ ] T007 [US1] Extend `app/lib/schemas/clarification-policy.ts`: add `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel` (all `claudeModelIdSchema.nullable().optional()`) to `projectUpdateSchema`, per `contracts/project-model-config.md`.
- [ ] T008 [US1] Extend PATCH handler in `app/api/projects/[projectId]/route.ts`: accept the 5 new fields through the expanded schema, pass through to `prisma.project.update`, return the updated project (including the 5 new columns). Reuse existing `verifyProjectAccess` (FR-018).
- [ ] T009 [US1] Create `components/settings/ai-models-card.tsx`: 5-row card mirroring `components/settings/clarification-policy-card.tsx` (Pattern P2 — PATCH, optimistic local state, revert-on-error, `router.refresh()`). Iterate `CLAUDE_MODEL_IDS` to render Select options (label from `CLAUDE_MODEL_LABELS`). When `project.defaultAgent !== 'CLAUDE'`, render the informational message (FR-004) instead of selectors. Use aurora styling to match sibling cards.
- [ ] T010 [US1] Mount `<AIModelsCard />` in `app/projects/[projectId]/settings/page.tsx` alongside the existing clarification-policy and default-agent cards.

**Checkpoint**: US1 complete — per-project settings round-trip through API and UI.

---

## Phase 4: User Story 2 - Resolve effective model at workflow dispatch (Priority: P1)

**Goal**: At dispatch time, system resolves ticket → project → global fallback, writes `Job.model`, and emits `model` in `workflowInputs` (Claude only).

**Independent Test**: For each layer (fallback only / project only / ticket override) dispatch each of the 5 job types and verify (a) `Job.model` on the created row matches the expected resolution; (b) dispatch input contains the same `model` string; (c) non-Claude agent → no `model` key emitted and `Job.model` is `null`.

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T011 [P] [US2] Create `tests/unit/workflows/model-resolution.test.ts`: pure-function tests for `resolveStageModel`. Cases: ticket > project > fallback for each of the 5 commands; non-configurable commands (iterate, comment-*, health-scan) → `null`; effective agent non-Claude → `null` even if columns set; unknown stored ticket value falls through to project; unknown on both → fallback.
- [ ] T012 [P] [US2] Extend `tests/integration/tickets/transitions.test.ts`: (a) INBOX→SPECIFY-created Job has `model` populated with resolved model from project default; (b) ticket IMPLEMENT override = Haiku wins over project IMPLEMENT = Sonnet → `Job.model = 'claude-haiku-4-5-20251001'`; (c) effective agent Gemini with IMPLEMENT ticket override → `Job.model === null` and `workflowInputs` has no `model` key (FR-015); (d) health-scan command → `Job.model === null` (FR-017); (e) GitHub dispatch failure still deletes the Job row (rollback preserved).

### Implementation for User Story 2

- [ ] T013 [US2] Create `lib/workflows/model-resolution.ts`: export `resolveStageModel(ticket, command, effectiveAgent): ClaudeModelId | null`. Implements the 5-step algorithm in `data-model.md` §Resolution algorithm. Map command → StageModelKey; early-return `null` for non-configurable commands and non-Claude agents; guard both ticket and project values with `isClaudeModelId` (stale fall-through); return `CLAUDE_GLOBAL_FALLBACK_MODEL` when both are unset. Pure function — no DB access.
- [ ] T014 [US2] Extend `lib/workflows/transition.ts`: after `resolveEffectiveAgent` call (~L180), invoke `const resolvedModel = resolveStageModel(ticket, command, effectiveAgent)`. Pass `model: resolvedModel` into both `prisma.job.create` data blocks (~L214 and ~L232). In the three `workflowInputs` objects (~L274–282 quick-impl, ~L290–299 verify, ~L303–312 standard), spread `...(resolvedModel && { model: resolvedModel })`. Preserve dispatch-then-rollback order (Pattern P1).

**Checkpoint**: US2 complete — resolution + Job.model + dispatch payload all wired. Workflow YAMLs ingest the new input in Phase 7.

---

## Phase 5: User Story 3 - Override a single ticket's models (Priority: P2)

**Goal**: Team lead opens a per-ticket model dialog, sets any subset of the 5 stages (or Reset All), sees the "Custom models" badge on the ticket card.

**Independent Test**: Open override dialog on a ticket, set VERIFY to Opus 4.7, save; badge appears with tooltip enumerating "VERIFY"; dispatch a VERIFY job — Opus 4.7 used; other stage dispatches still resolve to project defaults; Reset All clears badge.

### Tests for User Story 3

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T015 [P] [US3] Create `tests/integration/tickets/model-override.test.ts`: PATCH sets a single stage override (VERIFY = Opus 4.7), others remain null; `{ resetAll: true }` nulls all 5; unknown model ID → 400 `INVALID_MODEL_ID`; empty body → 400; non-member → 404; member allowed; ticket with stored overrides survives a PATCH that changes the project's `defaultAgent` (FR-013, SC-010).
- [ ] T016 [P] [US3] Create `tests/unit/components/model-override-dialog.test.tsx`: renders 5 selectors with "Inherit from project default" as first option (FR-010, Pattern P3); non-Claude effective agent renders info message with no selectors (FR-012); "Reset all to project defaults" clears all selections; save disabled when no changes; save failure surfaces error and keeps dialog open.
- [ ] T017 [P] [US3] Create `tests/unit/components/board/ticket-card-model-badge.test.tsx`: no badge when all 5 ticket model columns are null; badge present when any is non-null and tooltip enumerates overridden stages by human-readable name (FR-020); dormant (muted) variant when effective agent is non-Claude but any override exists (FR-021).

### Implementation for User Story 3

- [ ] T018 [P] [US3] Create PATCH handler `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts`: validate body with `ticketModelOverrideSchema`; call `verifyTicketAccess`; if `resetAll === true`, set all 5 columns to `null`; else apply partial update only for present fields; return `{ ticketId, specifyModel, planModel, implementModel, quickImplModel, verifyModel, hasAnyOverride, overriddenStages }` per `contracts/ticket-model-override.md`.
- [ ] T019 [P] [US3] Create `components/tickets/model-override-dialog.tsx`: mirror `components/tickets/agent-edit-dialog.tsx` structure. 5 Select rows over `CLAUDE_MODEL_IDS` with `'project-default'` sentinel as the first option (Pattern P3 — map to `null` on save). "Reset all to project defaults" button (FR-011). Non-Claude branch renders informational message (FR-012). Optimistic save via PATCH to the new endpoint; revert + non-blocking error on failure (Pattern P2).
- [ ] T020 [US3] Extend `components/board/ticket-card.tsx` (around existing agent badge block, L160–172 per research): render "Custom models" badge immediately after the agent badge when any of `ticket.specifyModel | planModel | implementModel | quickImplModel | verifyModel` is non-null. Tooltip lists overridden stages by human-readable name. When effective agent is non-Claude, apply muted variant with dormant-state tooltip suffix (FR-021). Wire a trigger (existing detail modal or new affordance) to open `<ModelOverrideDialog />`.

**Checkpoint**: US3 complete — per-ticket override dialog + badge + endpoint all live.

---

## Phase 6: User Story 4 - Smart defaults for new projects (Priority: P2)

**Goal**: New projects created with the 5 smart-default values persisted; existing-project owners can opt-in via a single Settings action.

**Independent Test**: (a) Create a new project, inspect it — `specifyModel='claude-opus-4-7'`, `planModel='claude-opus-4-7'`, `implementModel='claude-sonnet-4-6'`, `quickImplModel='claude-sonnet-4-6'`, `verifyModel='claude-sonnet-4-6'`. (b) On a null-column (existing) project, POST to apply-smart-defaults — all 5 columns reflect `SMART_DEFAULTS`.

### Tests for User Story 4

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [ ] T021 [P] [US4] Extend `tests/integration/projects/crud.test.ts`: new project created via POST has all 5 `SMART_DEFAULTS` values persisted (SC-004); creation failure (e.g. quota violation) leaves no partial model config (transaction rollback, Pattern P5).
- [ ] T022 [P] [US4] Create `tests/integration/projects/model-config.test.ts`: POST `/api/projects/:id/model-config/apply-smart-defaults` overwrites all 5 columns atomically; idempotent (second call yields identical state); member allowed (FR-018); non-member → 404.

### Implementation for User Story 4

- [ ] T023 [P] [US4] Extend `app/api/projects/route.ts` POST handler: inside the existing `prisma.$transaction` (L94–114), spread `...SMART_DEFAULTS` into the `prisma.project.create` data block so seeding is atomic with creation (Pattern P5, FR-006).
- [ ] T024 [P] [US4] Create POST handler `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts`: `verifyProjectAccess`; execute a single `prisma.project.update` setting all 5 columns to their `SMART_DEFAULTS` values; return `{ specifyModel, planModel, implementModel, quickImplModel, verifyModel }` per `contracts/project-model-config.md`.
- [ ] T025 [US4] Extend `components/settings/ai-models-card.tsx` (from T009): add an "Apply smart defaults" button that POSTs to the new endpoint (optimistic update on the 5 selectors, revert + toast on failure). Make the button visibility always-on (idempotent) or conditional per the card UX decision made in T009.

**Checkpoint**: US4 complete — smart defaults seeded at creation and available as opt-in.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T026 [P] Update `.github/workflows/speckit.yml`: add optional `workflow_dispatch.inputs.model` (type `string`); forward it into the Claude-agent invocation step for SPECIFY/PLAN/IMPLEMENT commands, per `contracts/workflow-dispatch.md`.
- [ ] T027 [P] Update `.github/workflows/quick-impl.yml`: add optional `workflow_dispatch.inputs.model`; forward into the QUICK-IMPL agent invocation.
- [ ] T028 [P] Update `.github/workflows/verify.yml`: add optional `workflow_dispatch.inputs.model`; forward into the VERIFY agent invocation.
- [ ] T029 Run `bun run type-check` and `bun run lint` — fix any errors introduced by the 10 new columns, schema extension, or new modules.
- [ ] T030 Manual smoke pass: dispatch one SPECIFY and one VERIFY on a test project with (a) no overrides, (b) project default only, (c) ticket override — verify `Job.model` values match expected resolution in each case (SC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Must complete first — schema + client are preconditions for every typed reference.
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks all user stories (whitelist/schema are imported everywhere).
- **Phase 3 (US1)**: Depends on Phase 2. MVP.
- **Phase 4 (US2)**: Depends on Phase 2. Runs in parallel with US1 (different files).
- **Phase 5 (US3)**: Depends on Phase 2. May build on US1's `ai-models-card` but does not require it; endpoint, dialog, and badge are independent files.
- **Phase 6 (US4)**: Depends on Phase 2 and — for the UI button (T025) — on T009 from US1. The seeding (T023) and endpoint (T024) tasks are independent.
- **Phase 7 (Polish)**: Depends on US2 (workflow inputs) being complete so YAML forwarding has something to receive.

### Within Each User Story

- Tests authored and failing before implementation.
- Schema extension → API handler → UI (for US1).
- Pure function → transition wiring (for US2).
- Endpoint → dialog → ticket-card badge (for US3).
- Transaction seeding + endpoint → UI button (for US4).

### Parallel Opportunities

- T003 ∥ T004 (different files, both in Phase 2).
- Within US1: T005 ∥ T006 (test files); T007 ∥ T009 (schema + component) once T005/T006 exist.
- Within US2: T011 ∥ T012 (test files).
- Within US3: T015 ∥ T016 ∥ T017 (three independent test files); T018 ∥ T019 (endpoint + dialog); T020 depends on T019.
- Within US4: T021 ∥ T022 (test files); T023 ∥ T024 (creation seed vs new endpoint); T025 depends on T024 and T009.
- Phase 7: T026 ∥ T027 ∥ T028 (three independent YAML files).
- US1, US2, US3, US4 implementation phases can largely proceed in parallel once Phase 2 finishes — the only shared file is `components/settings/ai-models-card.tsx` (T009 created by US1, extended by US4 T025).

---

## Parallel Example: Phase 2 + launching US1 + US2

```bash
# After Phase 1 completes, launch Phase 2 foundational tasks in parallel:
Task: "Create whitelist module lib/models/claude-models.ts (T003)"
Task: "Create Zod schemas app/lib/schemas/model-config.ts (T004)"

# Once Phase 2 completes, launch US1 + US2 tests in parallel:
Task: "Extend tests/integration/projects/settings.test.ts with per-stage PATCH cases (T005)"
Task: "Create tests/unit/components/ai-models-card.test.tsx (T006)"
Task: "Create tests/unit/workflows/model-resolution.test.ts (T011)"
Task: "Extend tests/integration/tickets/transitions.test.ts with Job.model cases (T012)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Together, US1 and US2 constitute the functional MVP: project owners can configure per-stage defaults (US1) AND dispatches use those values (US2). Without US2, US1 is a cosmetic-only change; without US1, US2 never sees a non-fallback resolution.

1. Complete Phase 1 (schema + migration).
2. Complete Phase 2 (whitelist + Zod).
3. Complete Phase 3 (US1) and Phase 4 (US2) — can run in parallel.
4. Run Phase 7 workflow YAML updates (T026–T028) so Claude workflows ingest the new input.
5. **STOP and VALIDATE**: dispatch each of the 5 commands on a test project — confirm `Job.model` matches expected resolution and Claude agent actually uses it.

### Incremental Delivery

1. MVP (US1 + US2 + workflow YAMLs) → ship.
2. Add US3 (ticket override) → ship.
3. Add US4 (smart defaults seeding + opt-in) → ship.
4. Polish pass (T029, T030) after all stories land.

### Parallel Execution Strategy

ai-board can execute US1–US4 implementation phases concurrently after Phase 2:

- Stream 1: US1 (Phase 3) — settings card path.
- Stream 2: US2 (Phase 4) — resolution + transition wiring.
- Stream 3: US3 (Phase 5) — ticket override path.
- Stream 4: US4 (Phase 6) — seed + opt-in, coordinating T025 with US1's T009.

---

## Notes

- **File path validation**: every referenced file either exists today (verified via filesystem for `prisma/schema.prisma`, the three `components/settings/*.tsx` pattern files, `components/tickets/agent-edit-dialog.tsx`, `components/board/ticket-card.tsx`, `lib/workflows/transition.ts`, the `app/api/projects/**` routes, `app/lib/schemas/clarification-policy.ts`, the four integration test files, and the unit-test pattern files) or is explicitly a NEW file per `research.md` §"Existing Files".
- **New test files are justified**: `tests/unit/workflows/model-resolution.test.ts` (no existing `tests/unit/workflows/` directory); `tests/unit/components/ai-models-card.test.tsx` and `tests/unit/components/model-override-dialog.test.tsx` (no existing coverage for these components); `tests/unit/components/board/ticket-card-model-badge.test.tsx` (no existing `ticket-card.test.tsx`, and the badge is a discrete concern); `tests/integration/projects/model-config.test.ts` and `tests/integration/tickets/model-override.test.ts` (dedicated endpoints, no existing coverage).
- **Existing files extended, not duplicated**: `tests/integration/projects/settings.test.ts`, `tests/integration/projects/crud.test.ts`, and `tests/integration/tickets/transitions.test.ts` already own their respective domains and are extended, not replaced.
- **Commit cadence**: commit after each task or logical group; always run `bun run type-check` and `bun run lint` before committing (CLAUDE.md rule — never bypass hooks).
- **Schema regeneration**: after T001/T002, re-run `bunx prisma generate` to refresh TypeScript types used by T008, T013, T014, T018, T023, T024.
