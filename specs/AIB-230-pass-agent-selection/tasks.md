# Tasks: Pass Agent Selection Through Workflow Dispatch Pipeline

**Input**: Design documents from `/specs/AIB-230-pass-agent-selection/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the foundational utility function that all dispatch modifications depend on

- [ ] T001 Add `resolveEffectiveAgent()` utility function in lib/workflows/transition.ts

---

## Phase 2: User Story 1 - Full Workflow Receives Agent Selection (Priority: P1) MVP

**Goal**: When a ticket transitions through the full workflow path (SPECIFY/PLAN/BUILD), the resolved agent value is included in every dispatch payload so the correct CLI is invoked.

**Independent Test**: Transition a ticket with `agent = CODEX` to SPECIFY and verify the dispatched `specifyPayload` JSON includes `"agent": "CODEX"`. Transition a ticket with no agent set and verify fallback to project `defaultAgent`.

### Implementation for User Story 1

- [ ] T002 [US1] Add `agent` field to `specifyPayload` JSON construction in lib/workflows/transition.ts (SPECIFY command dispatch)
- [ ] T003 [US1] Add `agent` field to speckit generic workflow inputs for PLAN and BUILD commands in lib/workflows/transition.ts
- [ ] T004 [US1] Add `agent` field to verify workflow dispatch inputs in lib/workflows/transition.ts

**Checkpoint**: Full workflow path (SPECIFY, PLAN, BUILD, VERIFY dispatch from transition) now passes the resolved agent value.

---

## Phase 3: User Story 2 - Quick-Impl Workflow Receives Agent Selection (Priority: P1)

**Goal**: When a ticket uses the quick-impl path (INBOX -> BUILD), the resolved agent value is included in the `quickImplPayload` JSON.

**Independent Test**: Create a ticket with `agent = CODEX`, trigger quick-impl, and verify `quickImplPayload` JSON includes `"agent": "CODEX"`.

### Implementation for User Story 2

- [ ] T005 [US2] Add `agent` field to `quickImplPayload` JSON construction in lib/workflows/transition.ts

**Checkpoint**: Quick-impl dispatch now includes the resolved agent value.

---

## Phase 4: User Story 3 - Supporting Workflows Receive Agent Selection (Priority: P2)

**Goal**: Verify, cleanup, iterate, and AI-BOARD assist workflows each receive the resolved agent value as a discrete workflow input.

**Independent Test**: Trigger each supporting workflow and verify the dispatch call includes the `agent` input.

### Implementation for User Story 3

- [ ] T006 [P] [US3] Add `agent` to `AIBoardWorkflowInputs` interface and dispatch inputs in app/lib/workflows/dispatch-ai-board.ts
- [ ] T007 [P] [US3] Add `agent` to cleanup dispatch inputs in app/api/projects/[projectId]/clean/route.ts
- [ ] T008 [P] [US3] Add `agent` input declaration to .github/workflows/verify.yml
- [ ] T009 [P] [US3] Add `agent` input declaration to .github/workflows/cleanup.yml
- [ ] T010 [P] [US3] Add `agent` input declaration to .github/workflows/ai-board-assist.yml
- [ ] T011 [P] [US3] Add `agent` input declaration to .github/workflows/iterate.yml
- [ ] T012 [US3] Forward `agent` input from verify.yml to iterate.yml in the `gh workflow run` command in .github/workflows/verify.yml

**Checkpoint**: All supporting workflows (verify, cleanup, ai-board-assist, iterate) now receive and can use the agent value.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end correctness and run quickstart validation

- [ ] T013 Run type-check (`bun run type-check`) and fix any type errors
- [ ] T014 Run linter (`bun run lint`) and fix any lint errors
- [ ] T015 Run quickstart.md validation steps to confirm all dispatch paths include the agent value

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - must complete first (T001 creates `resolveEffectiveAgent()`)
- **User Story 1 (Phase 2)**: Depends on Phase 1 (uses `resolveEffectiveAgent()`)
- **User Story 2 (Phase 3)**: Depends on Phase 1 (uses `resolveEffectiveAgent()`)
- **User Story 3 (Phase 4)**: Depends on Phase 1; T008/T012 depend on each other (verify.yml changes)
- **Polish (Phase 5)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 1 - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Phase 1 - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Phase 1 - No dependencies on other stories (workflow YAML changes are independent of TypeScript changes)

### Parallel Opportunities

- **US1 and US2 can run in parallel** after Phase 1 (T002-T004 and T005 modify the same file but different sections)
- **Within US3**: T006, T007, T008, T009, T010, T011 are all parallelizable (different files)
- T012 depends on T008 (both modify verify.yml)

### Parallel Example: User Story 3

```bash
# Launch all independent US3 tasks together:
Task T006: "Add agent to AIBoardWorkflowInputs in app/lib/workflows/dispatch-ai-board.ts"
Task T007: "Add agent to cleanup dispatch in app/api/projects/[projectId]/clean/route.ts"
Task T008: "Add agent input to .github/workflows/verify.yml"
Task T009: "Add agent input to .github/workflows/cleanup.yml"
Task T010: "Add agent input to .github/workflows/ai-board-assist.yml"
Task T011: "Add agent input to .github/workflows/iterate.yml"

# Then sequentially:
Task T012: "Forward agent in verify.yml -> iterate.yml dispatch" (depends on T008)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (`resolveEffectiveAgent()`)
2. Complete Phase 2: User Story 1 (full workflow path)
3. Complete Phase 3: User Story 2 (quick-impl path)
4. **STOP and VALIDATE**: Core dispatch paths now include agent selection
5. Continue to Phase 4 for supporting workflows

### Incremental Delivery

1. Phase 1 (Setup) -> Foundation ready
2. Phase 2 (US1) -> Full workflow dispatches include agent (MVP core)
3. Phase 3 (US2) -> Quick-impl dispatches include agent (MVP complete)
4. Phase 4 (US3) -> All supporting workflows include agent (feature complete)
5. Phase 5 (Polish) -> Type-check, lint, and validation pass

---

## Notes

- No database schema changes required - `Agent` enum and fields already exist
- No UI changes required - this is purely backend/workflow plumbing
- speckit.yml and quick-impl.yml do NOT need YAML input changes (agent embedded in JSON payloads)
- ai-board-assist.yml reaches exactly 10 inputs after adding `agent` (GitHub Actions maximum)
- The `resolveEffectiveAgent()` function follows the existing pattern used for `clarificationPolicy` resolution
