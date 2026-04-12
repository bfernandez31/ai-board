--- 
description: "Task list for Add Gemini CLI as AI Agent feature implementation"
---

# Tasks: Add Gemini CLI as AI Agent (Google Provider)

**Input**: Design documents from `/specs/AIB-613-copy-of-add/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [✅] T001 Create Gemini icon asset at `/public/agents/gemini.svg`
- [✅] T002 Add Gemini to project dependencies in `package.json`
- [✅] T003 [P] Configure environment variables for Gemini in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [✅] T004 Extend Prisma schema with Google credential fields in `/prisma/schema.prisma`
- [✅] T005 [P] Add GEMINI enum value to Agent type in `/types/agent.ts`
- [✅] T006 [P] Create Gemini agent metadata in `/lib/agents.ts`
- [✅] T007 [P] Add Gemini event types to telemetry in `/types/telemetry.ts`
- [✅] T008 Create base credential validation utilities in `/lib/credentials.ts`
- [✅] T009 Setup database migration for Gemini support

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Store and Validate Google Credentials (Priority: P1) 🎯 MVP

**Goal**: Enable users to store and validate Google AI Studio API keys or OAuth tokens

**Independent Test**: Store valid Google credentials, verify format validation and encryption, confirm live API verification works

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [✅] T010 [P] [US1] Extend credential tests in `/tests/credentials.test.ts` with Google credential validation tests
- [✅] T011 [P] [US1] Add Google credential encryption tests in `/tests/credentials.test.ts`
- [✅] T012 [P] [US1] Create credential form component tests in `/tests/unit/components/settings/credentials-form.test.tsx`

### Implementation for User Story 1

- [✅] T013 [P] [US1] Add Google credential fields to credential form in `/components/credentials/credential-form.tsx`
- [✅] T014 [P] [US1] Implement Google credential validation in `/lib/ai-credentials/providers/google.ts`
- [✅] T015 [US1] Add Google credential storage endpoint in `/app/api/credentials/route.ts`
- [✅] T016 [P] [US1] Create Google credential validation endpoint in `/app/api/credentials/google/validate/route.ts`
- [ ] T017 [US1] Implement AES-256-GCM encryption for Google credentials in `/lib/credentials.ts`
- [ ] T018 [P] [US1] Add Google credential retrieval endpoint in `/app/api/credentials/google/route.ts`
- [ ] T019 [US1] Add credential validation status tracking in `/lib/credentials.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Select Gemini as Default or Per-Ticket Agent (Priority: P1)

**Goal**: Enable users to select Gemini as their default agent or override per-ticket

**Independent Test**: Select Gemini as default agent, create ticket with Gemini override, verify selection persists and displays correctly

### Tests for User Story 2

- [ ] T020 [P] [US2] Extend agent selector tests in `/tests/agent-selector.test.tsx` with Gemini selection tests
- [ ] T021 [P] [US2] Add agent badge tests in `/tests/ticket/agent-badge.test.tsx` for Gemini icon display
- [ ] T022 [P] [US2] Create workflow availability tests in `/tests/workflows.test.ts`

### Implementation for User Story 2

- [ ] T023 [P] [US2] Add Gemini option to agent selector in `/components/agent-selector.tsx`
- [ ] T024 [P] [US2] Create Gemini icon component in `/components/agents/gemini-icon.tsx`
- [ ] T025 [US2] Add Gemini to agent badge display in `/components/ticket/agent-badge.tsx`
- [ ] T026 [P] [US2] Implement default agent selection endpoint in `/app/api/projects/[id]/agent/route.ts`
- [ ] T027 [US2] Add workflow availability validation for Gemini in `/lib/workflows.ts`
- [ ] T028 [P] [US2] Update agent metadata with supported workflows in `/lib/agents.ts`
- [ ] T029 [US2] Add per-ticket agent override functionality in ticket creation flow

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Execute Workflows with Gemini Agent (Priority: P1)

**Goal**: Enable successful workflow execution with Gemini agent and proper telemetry collection

**Independent Test**: Dispatch speckit.yml workflow with Gemini agent, verify environment variables, telemetry collection, and successful completion

### Tests for User Story 3

- [ ] T030 [P] [US3] Extend workflow dispatch tests in `/tests/workflows.test.ts` with Gemini scenarios
- [ ] T031 [P] [US3] Add telemetry parsing tests in `/tests/telemetry.test.ts` for Gemini events
- [ ] T032 [P] [US3] Create run-agent.sh integration tests for Gemini case

### Implementation for User Story 3

- [ ] T033 [US3] Add GEMINI case to run-agent.sh in `/scripts/run-agent.sh`
- [ ] T034 [US3] Implement Gemini CLI installation check in `/scripts/run-agent.sh`
- [ ] T035 [P] [US3] Add environment variable injection for Gemini in `/scripts/run-agent.sh`
- [ ] T036 [P] [US3] Implement telemetry configuration for Gemini in `/scripts/run-agent.sh`
- [ ] T037 [US3] Add Gemini event parsing in `/lib/telemetry.ts`
- [ ] T038 [P] [US3] Implement token counting logic for Gemini in `/lib/telemetry.ts`
- [ ] T039 [P] [US3] Add tool call tracking for Gemini in `/lib/telemetry.ts`
- [ ] T040 [US3] Extend workflow dispatch API in `/app/api/workflows/route.ts` for Gemini
- [ ] T041 [P] [US3] Add workflow availability checks in `/lib/workflows.ts`
- [ ] T042 [US3] Implement cost estimation logic for Gemini in `/lib/analytics.ts`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - View Gemini Metrics in Analytics Dashboard (Priority: P2)

**Goal**: Enable users to view Gemini-specific metrics in the analytics dashboard

**Independent Test**: Run Gemini workflows, view analytics dashboard, verify Gemini data appears in filters and charts

### Tests for User Story 4

- [ ] T043 [P] [US4] Extend analytics dashboard tests in `/tests/analytics.test.tsx` with Gemini filter tests
- [ ] T044 [P] [US4] Add agent filtering tests for dynamic agent enumeration
- [ ] T045 [P] [US4] Create cost estimation tests for Gemini in `/tests/analytics.test.tsx`

### Implementation for User Story 4

- [ ] T046 [P] [US4] Add Gemini to agent filter component in `/components/analytics/agent-filter.tsx`
- [ ] T047 [US4] Make agent filtering dynamic based on Agent enum in `/lib/analytics.ts`
- [ ] T048 [P] [US4] Fix NamedAgent type to include GEMINI in `/types/agent.ts`
- [ ] T049 [P] [US4] Update getAgentLabel() function to support Gemini in `/lib/analytics.ts`
- [ ] T050 [US4] Add Gemini metrics to dashboard charts in `/components/analytics/dashboard.tsx`
- [ ] T051 [P] [US4] Implement cost estimation for Gemini jobs in `/lib/analytics.ts`
- [ ] T052 [P] [US4] Add tool distribution tracking for Gemini in `/components/analytics/dashboard.tsx`

**Checkpoint**: At this point, all user stories should be independently functional

---

## Phase 7: User Story 5 - Complete Project Setup with Gemini (Priority: P2)

**Goal**: Enable new users to see Gemini as an available agent option during onboarding

**Independent Test**: Start project setup, verify Gemini appears in agent selection, complete onboarding with Gemini selected

### Tests for User Story 5

- [ ] T053 [P] [US5] Extend project setup tests in `/tests/setup.test.tsx` with Gemini selection tests
- [ ] T054 [P] [US5] Add agent enumeration tests for dynamic agent list

### Implementation for User Story 5

- [ ] T055 [P] [US5] Add Gemini to project setup agent selection in `/components/setup/setup-page-client.tsx`
- [ ] T056 [US5] Make agent list dynamic or include all agents in `/lib/setup.ts`
- [ ] T057 [P] [US5] Fix Mistral inclusion in setup page in `/components/setup/setup-page-client.tsx`
- [ ] T058 [US5] Ensure default agent selection works with Gemini in `/lib/setup.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T059 [P] Documentation updates for Gemini integration
- [ ] T060 Code cleanup and refactoring across all Gemini components
- [ ] T061 Performance optimization for telemetry processing
- [ ] T062 [P] Additional unit tests for edge cases
- [ ] T063 Security hardening for credential storage
- [ ] T064 Error handling improvements across all components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Depends on US3 for telemetry data
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Depends on US2 for agent selection

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be executed in parallel via ai-board parallel task orchestration

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Extend credential tests in /tests/credentials.test.ts with Google credential validation tests"
Task: "Add Google credential encryption tests in /tests/credentials.test.ts"
Task: "Create credential form component tests in /tests/settings/credentials-form.test.tsx"

# Launch all models/components for User Story 1 together:
Task: "Add Google credential fields to credential form in /components/settings/credentials-form.tsx"
Task: "Implement Google credential validation in /lib/credentials.ts"
Task: "Create Google credential validation endpoint in /app/api/credentials/google/validate/route.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1, 2, 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Credentials)
4. Complete Phase 4: User Story 2 (Agent Selection)
5. Complete Phase 5: User Story 3 (Workflow Execution)
6. **STOP and VALIDATE**: Test all P1 user stories independently
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Stories 1, 2, 3 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 4 → Test independently → Deploy/Demo
4. Add User Story 5 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (Credentials)
   - Parallel task 2: User Story 2 (Agent Selection)
   - Parallel task 3: User Story 3 (Workflow Execution)
3. Then run P2 stories in parallel:
   - Parallel task 4: User Story 4 (Analytics)
   - Parallel task 5: User Story 5 (Project Setup)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Summary

**Total Tasks**: 64
**Parallelizable Tasks**: 42 (65.6%)
**User Story Breakdown**:
- US1 (Credentials): 12 tasks (9 parallelizable)
- US2 (Agent Selection): 9 tasks (7 parallelizable)
- US3 (Workflow Execution): 12 tasks (6 parallelizable)
- US4 (Analytics): 8 tasks (6 parallelizable)
- US5 (Project Setup): 4 tasks (3 parallelizable)

**Independent Test Criteria**:
- US1: Credential storage, validation, and encryption working
- US2: Agent selection, display, and workflow availability working
- US3: Workflow execution with proper telemetry collection working
- US4: Analytics dashboard showing Gemini metrics correctly
- US5: Project setup with Gemini selection working

**Suggested MVP Scope**: User Stories 1, 2, and 3 (P1 priorities) - 33 tasks total