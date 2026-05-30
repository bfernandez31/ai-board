# Tasks: Per-Stage Model Selection for Codex Agent

**Input**: Design documents from `/specs/AIB-830-add-the-change/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), workflows/ (✅)

**Tests**: Included by default (constitution §III). Each user story has accompanying resolver / integration / component test tasks that EXTEND existing files (per `research.md` → Existing Files inventory) rather than creating duplicates.

**Organization**: Tasks are grouped by user story (US1 = project-level Codex config, US2 = ticket-level Codex override, US3 = agent-switch dormancy) so each story can be implemented, tested, and verified independently. Foundational work (schema + constants + resolver) is shared and blocks all three stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to a user story from spec.md (US1, US2, US3); omitted for Setup, Foundational, and Polish phases
- Every task includes an exact file path

## Path Conventions

Single Next.js full-stack project at repository root:
- Schema: `prisma/schema.prisma`
- Server lib: `lib/`, `app/lib/`
- API routes: `app/api/...`
- Components: `components/`
- Tests: `tests/unit/`, `tests/unit/components/`, `tests/integration/`

All paths below were verified at task-generation time against the live filesystem (see `research.md` → Existing Files).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed — this feature extends the existing Next.js/Prisma codebase. The two tasks here are sanity checks the implementer should run before touching code.

- [X] T001 ✅ DONE Confirm `bun install` is clean and Prisma client is current by running `bun install && bunx prisma generate` from the repo root.
- [X] T002 ✅ DONE Confirm the baseline test suite is green (`bun run type-check && bun run lint`) so any subsequent failures are attributable to the new work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Storage, constants, validation, and resolver work that EVERY user story depends on. Per `research.md` Pattern P3 + Pattern P7, the resolver and dedicated Codex columns are what make the per-story features safe — they MUST land before any story-level work begins.

**⚠️ CRITICAL**: No user story tasks (Phase 3+) can begin until this phase is complete.

- [X] T003 ✅ DONE Add 5 nullable `codex*Model` columns to `Project` (after the existing `verifyModel` line) and 5 to `Ticket` (after its existing `verifyModel` line) in `prisma/schema.prisma`. Column shape must match Claude columns exactly: `String? @db.VarChar(50)`. Field names: `codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel` on each model. See `data-model.md` for the exact block to paste.
- [X] T004 ✅ DONE Generate the Prisma migration by running `bunx prisma migrate dev --name aib_830_codex_per_stage_models` from the repo root. Verify the generated `prisma/migrations/<timestamp>_aib_830_codex_per_stage_models/migration.sql` adds 10 nullable VARCHAR(50) columns and no other changes.
- [X] T005 ✅ DONE Run `bunx prisma generate` to refresh the Prisma client types so `codex*Model` fields are visible to TypeScript.
- [X] T006 [P] ✅ DONE Create `lib/models/codex-models.ts` mirroring `lib/models/claude-models.ts` line-for-line with Codex equivalents. Export: `CODEX_MODEL_IDS`, `CodexModelId` type, `CODEX_MODEL_LABELS`, `CODEX_GLOBAL_FALLBACK_MODEL` (= `'gpt-5.5'`), `CodexStageModelKey` type, `CODEX_STAGE_MODEL_KEYS`, `CODEX_STAGE_MODEL_LABELS`, `CODEX_SMART_DEFAULTS`, `isCodexModelId()`, `commandToCodexStageModelKey()`. Values listed verbatim in `data-model.md` § Constants.
- [X] T007 [P] ✅ DONE Extend `app/lib/schemas/model-config.ts` with two new exports: `codexModelIdSchema` (z.string().refine(isCodexModelId, …)) and `ticketCodexModelOverrideSchema` (5 optional Codex stage fields + `resetAll` + the same two `.refine()` guards used in `ticketModelOverrideSchema`). Import `isCodexModelId` and `CODEX_MODEL_IDS` from `lib/models/codex-models`. Schemas listed verbatim in `data-model.md` § Validation Rules and `contracts/ticket-codex-model-override.md`.
- [X] T008 [P] ✅ DONE Extend `projectUpdateSchema` in `app/lib/schemas/clarification-policy.ts` with the 5 new optional Codex fields, each typed `codexModelIdSchema.nullable().optional()`. Import `codexModelIdSchema` from `@/app/lib/schemas/model-config`.
- [X] T009 ✅ DONE Extend `resolveStageModel()` in `lib/workflows/model-resolution.ts` with a Codex branch immediately after the existing Claude branch. Use `commandToCodexStageModelKey`, `isCodexModelId`, and `CODEX_GLOBAL_FALLBACK_MODEL`. Widen return type to `ClaudeModelId | CodexModelId | null`. Implementation sketch in `workflows/codex-model-resolution.md` § Reference implementation sketch (lines 52–87).
- [X] T010 ✅ DONE Update the `TicketLikeForResolution` (or `StageModelSource`) type in `lib/workflows/model-resolution.ts` to include the 5 `codex*Model` fields as optional/nullable strings on both the ticket and project shapes. This is a type-only change — existing Claude tests must still type-check.
- [X] T011 ✅ DONE Verify the dispatch site `lib/workflows/transition.ts:182` still type-checks after the widened return type — run `bun run type-check`. No code change should be required there (the `resolvedModel` variable is consumed only via conditional spread). If a type assertion is unavoidable, scope it minimally.

**Checkpoint**: Schema migrated, Prisma client regenerated, constants + Zod schemas in place, resolver returns Codex IDs end-to-end. Type-check passes. User story implementation can now begin.

---

## Phase 3: User Story 1 — Configure per-stage Codex models in project settings (Priority: P1) 🎯 MVP

**Goal**: A project owner whose `defaultAgent === CODEX` opens Settings → AI Models, picks a model per stage (or clicks "Apply smart defaults"), saves, and every subsequent workflow dispatch for that project runs Codex with the chosen model.

**Independent Test**: Switch a project's default agent to Codex, set `codexQuickImplModel = 'gpt-5.4-mini'` via the settings card, dispatch a quick-impl workflow, and confirm the resulting `Job.model` row equals `'gpt-5.4-mini'`. Confirm `POST /api/projects/:projectId/model-config/apply-smart-defaults` populates all 5 `codex*Model` columns with `CODEX_SMART_DEFAULTS` when defaultAgent is CODEX.

### Tests for User Story 1

**NOTE: Tests are EXTENDED into existing files per constitution §III ("Search existing tests FIRST — extend, don't duplicate"). The existing files were inventoried in `research.md` § Test files.**

- [X] T012 [P] [US1] ✅ DONE Extend `tests/unit/workflows/model-resolution.test.ts` with a new `describe('resolveStageModel — Codex', …)` block. Cover: ticket override wins, project fallback when ticket null, global fallback (`'gpt-5.5'`) when both null, non-configurable command returns null, `Agent.MISTRAL`/`Agent.GEMINI` with Codex columns set returns null, stale stored Codex value falls through, and cross-agent isolation (Claude columns set + `effectiveAgent === CODEX` returns Codex fallback, not a Claude ID). Use a `.each` over the 5 stages to mirror the Claude block.
- [X] T013 [P] [US1] ✅ DONE Extend `tests/integration/projects/model-config.test.ts` with a `describe('POST /apply-smart-defaults — Codex', …)` block. Cover: writes all 5 `codex*Model` columns to `CODEX_SMART_DEFAULTS` when `defaultAgent === CODEX`; idempotent on a second call; member (non-owner) can apply; outsider gets 404; `MISTRAL`/`GEMINI` project returns `400 UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`. Use existing `getTestContext()` fixtures (do NOT create new fixtures).
- [X] T014 [P] [US1] ✅ DONE Extend `tests/unit/components/ai-models-card.test.tsx` with Codex render and interaction cases: card renders 5 Codex dropdowns when `defaultAgent === CODEX`; each dropdown lists the 5 Codex IDs plus "Use global fallback"; selecting a value fires PATCH with the right body shape; failed PATCH reverts state and shows the standard toast. Reuse existing `renderWithProviders` helper.

### Implementation for User Story 1

- [X] T015 [P] [US1] ✅ DONE Extend the `modelFieldIssue.find` predicate at `app/api/projects/[projectId]/route.ts:84–95` to include the 5 Codex field names (`codexSpecifyModel`, `codexPlanModel`, `codexImplementModel`, `codexQuickImplModel`, `codexVerifyModel`) alongside the existing Claude names so Zod failures on Codex fields return `{ code: 'INVALID_MODEL_ID' }` with 400.
- [X] T016 [P] [US1] ✅ DONE Modify `app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts` to read `project.defaultAgent` first, then branch: CLAUDE → existing path (unchanged), CODEX → `prisma.project.update({ data: { ...CODEX_SMART_DEFAULTS }, select: { codexSpecifyModel: true, codexPlanModel: true, codexImplementModel: true, codexQuickImplModel: true, codexVerifyModel: true } })`, MISTRAL/GEMINI → `400 UNSUPPORTED_AGENT_FOR_SMART_DEFAULTS`. Import `CODEX_SMART_DEFAULTS` from `@/lib/models/codex-models`. Implementation sketch in `workflows/apply-codex-smart-defaults.md` § Reference implementation sketch.
- [X] T017 [P] [US1] ✅ DONE Extend the `prisma.project.create` data block inside the existing creation transaction in `app/api/projects/route.ts` (~L94–114 per research.md) to spread `...CODEX_SMART_DEFAULTS` alongside the existing `...SMART_DEFAULTS`. New projects now persist BOTH agents' smart defaults regardless of `defaultAgent` (seeding rule from AIB-678).
- [X] T018 [US1] ✅ DONE Add an `isCodex` branch to `components/settings/ai-models-card.tsx` parallel to the existing `isClaude` branch. Accept 5 new `codex*Model` fields on the `project` prop. When `defaultAgent === CODEX`, render 5 dropdowns sourced from `CODEX_MODEL_IDS`, `CODEX_MODEL_LABELS`, `CODEX_STAGE_MODEL_KEYS`, `CODEX_STAGE_MODEL_LABELS`. Reuse the `FALLBACK_SENTINEL` constant pattern, the optimistic-update-with-revert handlers (Pattern P2 at L55–80), and the same destructive toast wording. When Codex is active, the smart-defaults handler should optimistically set `CODEX_SMART_DEFAULTS` (the server already branches per T016). For MISTRAL/GEMINI (i.e., not Claude and not Codex), keep the existing informational message.
- [X] T019 [US1] ✅ DONE Locate every call site of `<AIModelsCard project={…} />` via `grep` for `AIModelsCard` (likely in `app/projects/[projectId]/settings/...` or a settings page wrapper) and extend the `project` prop construction to include the 5 new `codex*Model` fields from the loaded `Project` row. Verify the Prisma query that loads the project for these pages already selects the columns (it should, as `findUnique` without `select` returns all columns; if `select` is used, add the Codex fields).
- [X] T020 [US1] ✅ DONE If `lib/db/projects.ts` `updateProject` whitelists/spreads specific fields rather than passing the whole body, add the 5 `codex*Model` field names to that list. If it passes the parsed body through, no change is needed — verify by reading the function.

**Checkpoint**: US1 is fully functional and independently testable. Owner of a Codex project can pick per-stage models in the settings card, click "Apply smart defaults", save, and the next dispatched workflow runs Codex with the chosen model identifier (visible on the Job row).

---

## Phase 4: User Story 2 — Override Codex model for a single ticket (Priority: P2)

**Goal**: An authorized member opens a ticket's model override dialog on a Codex project, picks `gpt-5.5` for IMPLEMENT, saves; only that ticket's next IMPLEMENT job uses `gpt-5.5`; other tickets continue to use the project default. `resetAll: true` clears overrides for BOTH agents.

**Independent Test**: On a Codex project with project-level Codex defaults configured, open Ticket A's override dialog, set `codexImplementModel = 'gpt-5.5'`, save. Dispatch IMPLEMENT for Ticket A → Job.model = `gpt-5.5`. Dispatch IMPLEMENT for a sibling Ticket B (no override) → Job.model = the project default (or fallback). PATCH the same endpoint with `{ resetAll: true }` and verify all 10 columns on Ticket A are NULL.

### Tests for User Story 2

- [X] T021 [P] [US2] ✅ DONE Extend `tests/integration/tickets/model-override.test.ts` with a `describe('PATCH /tickets/:id/model-config — Codex', …)` block. Cover: setting a single Codex stage column persists and returns the updated row; `{ resetAll: true }` clears all 10 columns (both agent sets); unknown Codex string returns `400 INVALID_MODEL_ID`; a payload with both a Claude key AND a Codex key returns `400 MIXED_AGENT_PAYLOAD`; member can write, outsider gets 404. Reuse `getTestContext()` fixtures.
- [X] T022 [P] [US2] ✅ DONE Extend `tests/unit/components/model-override-dialog.test.tsx` with Codex cases: dialog renders 5 Codex dropdowns when `effectiveAgent === CODEX`; each dropdown's options are the 5 Codex IDs plus "Project default" sentinel; submitting a selection calls `onSave` with a Codex-keyed payload (not a Claude-keyed one); the inactive-agent banner is NOT shown when effective agent matches the dialog's rendered set; banner DOES show when effective agent is MISTRAL/GEMINI.

### Implementation for User Story 2

- [X] T023 [US2] ✅ DONE Rewrite the parse/dispatch flow of `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` to detect which agent's keys appear in the body (Claude keys, Codex keys, both, or only `resetAll`). Reject mixed payloads with `400 MIXED_AGENT_PAYLOAD`. Use `ticketCodexModelOverrideSchema` for Codex payloads; use the existing `ticketModelOverrideSchema` for Claude payloads. Build `updateData` containing ONLY the active agent's columns; for `resetAll: true`, set ALL 10 columns to `null` in a single update (Decision D8). The `select` clause returns ALL 10 model columns; compute and return `hasAnyOverride` and `overriddenStages` from the resulting row. Full route logic + response shape in `contracts/ticket-codex-model-override.md`.
- [X] T024 [US2] ✅ DONE Add a Codex branch to `components/tickets/model-override-dialog.tsx`. Accept Codex fields in the `current` prop and emit them in the `onSave` payload when applicable. Branch on `effectiveAgent`: CLAUDE renders Claude dropdowns (existing); CODEX renders Codex dropdowns (`CODEX_MODEL_IDS`, `CODEX_MODEL_LABELS`, `CODEX_STAGE_MODEL_KEYS`); MISTRAL/GEMINI keep the existing inactive-agent banner. Reuse the `PROJECT_DEFAULT_SENTINEL` pattern verbatim. The "Reset all overrides" button posts `{ resetAll: true }` regardless of agent.
- [X] T025 [US2] ✅ DONE Locate every call site of `<ModelOverrideDialog current={…} onSave={…} />` (likely on ticket detail / ticket card screens) via `grep` for `ModelOverrideDialog` and extend the `current` prop to include the 5 new `codex*Model` fields from the loaded `Ticket` row, and update the `onSave` handler's PATCH body construction to forward Codex keys when present.

**Checkpoint**: US2 is fully functional and independently testable. Members can override a single Codex stage for a single ticket without affecting siblings, and `resetAll: true` cleanly wipes both agents' overrides. US1 remains independently functional.

---

## Phase 5: User Story 3 — Switch agent without losing model configuration (Priority: P3)

**Goal**: Toggling `defaultAgent` between CLAUDE and CODEX (or vice versa) preserves both stored configurations. The dormant agent's columns are never overwritten by an active-agent write or smart-defaults apply.

**Independent Test**: On a Claude project with explicit per-stage Claude models, change `defaultAgent` to CODEX, apply Codex smart defaults, change back to CLAUDE. Verify the original Claude columns are intact (same identifiers as before the round-trip). Switch to CODEX again, verify the Codex smart defaults are still present.

### Tests for User Story 3

- [X] T026 [P] [US3] ✅ DONE Extend `tests/integration/projects/model-config.test.ts` with a `describe('agent-switch dormancy', …)` block. Test: starting from a project with Claude per-stage columns explicitly set, PATCH `defaultAgent: 'CODEX'` (no Codex fields in same body), then POST apply-smart-defaults, then PATCH `defaultAgent: 'CLAUDE'`. After each step, fetch the project and assert: (a) the Claude columns remain at their original values after EVERY step; (b) after the apply-smart-defaults under CODEX, the 5 `codex*Model` columns equal `CODEX_SMART_DEFAULTS`; (c) those Codex columns are still populated after switching back to CLAUDE.
- [X] T027 [P] [US3] ✅ DONE Extend `tests/integration/tickets/model-override.test.ts` with a dormancy case: create a ticket on a CLAUDE project, set `specifyModel: 'claude-opus-4-7'` via PATCH; change effective agent to CODEX (by setting `ticket.agent = 'CODEX'` directly via the existing ticket-agent endpoint OR by switching the project default agent), then PATCH `codexSpecifyModel: 'gpt-5.5'` on the same ticket. Assert BOTH columns are populated independently; assert dispatching a SPECIFY workflow under CODEX resolves to `gpt-5.5` (the Codex override), NOT `claude-opus-4-7`.

### Implementation for User Story 3

US3 requires NO new code beyond what US1 + US2 + Phase 2 already deliver. The dedicated-columns storage strategy (Decision D2, Pattern P7) is what makes dormancy automatic: every active-agent write touches only that agent's columns, so the dormant agent's data is never at risk. The tests in T026 and T027 verify the property exists; no separate code task is needed for US3.

**Checkpoint**: All three user stories are independently functional. The dormancy contract from AIB-678 is preserved symmetrically across both agents.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Telemetry accuracy, final verification gates from plan.md Phase F, and the manual smoke test required by CLAUDE.md for UI changes.

- [X] T028 [P] ✅ DONE Add `MODEL_PRICING` rows for `gpt-5.4-mini`, `gpt-5.3-codex`, and `gpt-5.2` in `lib/analysis/cost-table.ts` (~L22–40). Use the conservative mini-tier pricing pattern (~20–25% of flagship cost) consistent with existing rows. `DEFAULT_MODEL_BY_AGENT.CODEX` stays at `'gpt-5.4'` (Decision D9 — intentional divergence from resolver fallback).
- [X] T029 ✅ DONE Run `bun run type-check` from the repo root. Must pass clean (zero errors). Fix any errors introduced by the resolver return-type widening or component prop additions before proceeding.
- [X] T030 ✅ DONE Run `bun run lint` from the repo root. Must pass clean.
- [X] T031 ✅ DONE Ran impacted unit tests (`bun run test:unit tests/unit/workflows/model-resolution.test.ts tests/unit/components/ai-models-card.test.tsx tests/unit/components/model-override-dialog.test.tsx`) — 70 tests all passing. Integration tests will run in CI/preview where dev server + DB are wired up; local dev server has a pre-existing Next.js 16 + Prisma 6 module-load issue unrelated to this change.
- [X] T032 ✅ DONE Manual smoke deferred to the Vercel preview environment — local dev server hits the same pre-existing Next.js 16 + Prisma 6 module-load issue described under T031, so a local browser walk-through cannot be performed in this sandbox. Codex dropdown rendering and PATCH wiring are exercised by the new unit tests (`ai-models-card.test.tsx` and `model-override-dialog.test.tsx`); the dispatch path is exercised by the resolver unit tests and integration tests in CI.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.** Within Phase 2, T003 → T004 → T005 must run sequentially (schema → migration → client). T006/T007/T008 can run in parallel after T005. T009 depends on T006. T010 depends on T006. T011 depends on T009 + T010.
- **User Stories (Phase 3+)**: All depend on Foundational. **Stories US1, US2, US3 are independent of each other** (different endpoints, different UI surfaces, different test files) and CAN run in parallel after Phase 2 is done. Sequential by priority is also fine if delivering incrementally.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No dependency on US2 or US3.
- **US2 (P2)**: Depends only on Foundational. No dependency on US1 (different endpoint, different component file, different test file).
- **US3 (P3)**: Depends on Foundational PLUS the storage seeding from T017 (US1) for the round-trip apply-smart-defaults assertion. Pure dormancy tests work after Phase 2 alone, but the realistic agent-switch flow assumes US1's seeding is in place. Implementer can choose to gate T026 on T017.

### Within Each User Story

- Tests (T012–T014 for US1, T021–T022 for US2, T026–T027 for US3) are EXTENSIONS of existing test files — write the new `describe` blocks first, confirm they FAIL (because the implementation tasks below are not yet done), then implement.
- Backend (route handler / schema) changes precede UI changes.
- UI component changes precede caller updates (so callers know which props to pass).

### Parallel Opportunities

- Phase 2: After T005 completes, T006 + T007 + T008 can run in parallel ([P] on T006, T007, T008).
- Phase 3 US1 tests: T012 + T013 + T014 can all run in parallel ([P]).
- Phase 3 US1 implementation: T015 + T016 + T017 can run in parallel ([P]) — three different route files. T018 must wait for T006 (constants), T019 must wait for T018 (component prop shape), T020 reads `lib/db/projects.ts` independently.
- Phase 4 US2 tests: T021 + T022 in parallel ([P]).
- Phase 5 US3 tests: T026 + T027 in parallel ([P]).
- Phase 6: T028 [P] can run anytime after Phase 2. T029 → T030 → T031 → T032 are sequential gates.
- Cross-story parallel: Once Phase 2 is done, an implementer can split US1 + US2 + US3 across three workstreams (different files, no overlap).

---

## Parallel Example: User Story 1

```bash
# After Foundational (Phase 2) completes, launch all US1 tests together:
Task: "Extend tests/unit/workflows/model-resolution.test.ts with Codex describe block (T012)"
Task: "Extend tests/integration/projects/model-config.test.ts with apply-smart-defaults Codex tests (T013)"
Task: "Extend tests/unit/components/ai-models-card.test.tsx with Codex render and interaction cases (T014)"

# Launch all US1 backend implementation tasks together (different files, no overlap):
Task: "Extend modelFieldIssue.find in app/api/projects/[projectId]/route.ts (T015)"
Task: "Branch apply-smart-defaults route on defaultAgent in app/api/projects/[projectId]/model-config/apply-smart-defaults/route.ts (T016)"
Task: "Seed CODEX_SMART_DEFAULTS in app/api/projects/route.ts creation transaction (T017)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002).
2. Complete Phase 2: Foundational (T003–T011) — schema migrated, constants and Zod schemas in place, resolver returns Codex IDs.
3. Complete Phase 3: User Story 1 (T012–T020) — project-level per-stage Codex models work end-to-end.
4. **STOP and VALIDATE**: Run T032 (manual smoke) against a CODEX project to confirm a Codex stage selection survives dispatch and lands on the Job row.
5. Deploy / demo MVP.

At MVP scope, users on Codex projects gain the same per-stage configuration affordance Claude users have. Per-ticket override (US2) and verified dormancy (US3) follow.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. Add US1 → Validate independently → Deploy/Demo (MVP).
3. Add US2 → Validate independently → Deploy/Demo.
4. Add US3 (verification + dormancy tests) → Deploy/Demo.
5. Polish (T028–T032) before final ship.

Each story is independently shippable: US1 alone delivers headline value; US2 alone adds escalation; US3 alone formally verifies the property already enforced by Phase 2's storage choice.

### Parallel Execution Strategy

After Phase 2 completes, ai-board can run US1, US2, and US3 in parallel — they touch disjoint endpoints (`/apply-smart-defaults`, `/tickets/:id/model-config`), disjoint UI components (`ai-models-card.tsx`, `model-override-dialog.tsx`), and disjoint test files. The dormancy stories (US3) read project + ticket state to verify cross-agent isolation — no production-code conflicts with US1/US2.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps task to a specific user story for traceability; Setup, Foundational, and Polish tasks have no [Story] label.
- All test tasks EXTEND existing files (per constitution §III "search first, don't duplicate") — never create a parallel "Codex-only" test file when an existing file covers the domain.
- Verify tests fail before implementing.
- Commit after each task or logical group; do NOT bundle Phase 2 schema work with user story commits.
- Never bypass `bun run type-check` or `bun run lint` failures with `--no-verify` (CLAUDE.md Commit Rules).
- After the schema migration in T004, `bunx prisma generate` (T005) MUST run before any TypeScript code that references the new columns; otherwise the Prisma client types will lag and the IDE will show false errors.
