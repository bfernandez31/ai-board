# Tasks: Add AI Agent Selection to Data Model

**Input**: Design documents from `/specs/AIB-228-add-ai-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md

**Tests**: Spec mentions integration and unit tests (plan.md Step 7, quickstart.md). Tests are included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema & Migration)

**Purpose**: Add Agent enum and fields to Prisma schema, generate migration

- [ ] T001 Add `Agent` enum (CLAUDE, CODEX) and `defaultAgent` field to Project model and `agent` field to Ticket model in prisma/schema.prisma
- [ ] T002 Run Prisma migration and regenerate client (`bunx prisma migrate dev --name add-agent-field && bunx prisma generate`)

---

## Phase 2: Foundational (Validation & Resolution Utilities)

**Purpose**: Core schemas and utilities that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 [P] Create Zod validation schemas (`projectAgentSchema`, `ticketAgentSchema`) in app/lib/schemas/agent.ts mirroring the clarification-policy pattern
- [ ] T004 [P] Create `resolveEffectiveAgent()` utility in app/lib/utils/agent-resolution.ts following the policy-resolution pattern
- [ ] T005 Extend `CreateTicketSchema` and `patchTicketSchema` with optional `agent` field in lib/validations/ticket.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Project Owner Sets Default Agent (Priority: P1) 🎯 MVP

**Goal**: Project owners can set and update `defaultAgent` via the project PATCH endpoint. All projects default to CLAUDE.

**Independent Test**: Update a project's `defaultAgent` to CODEX via API, fetch the project, verify `defaultAgent: "CODEX"` is returned.

### Tests for User Story 1

- [ ] T006 [P] [US1] Write unit tests for `projectAgentSchema` validation (valid values, invalid values) in tests/unit/agent-schema.test.ts

### Implementation for User Story 1

- [ ] T007 [US1] Extend `updateProject()` to accept and persist `defaultAgent` in lib/db/projects.ts
- [ ] T008 [US1] Extend PATCH handler to validate and pass `defaultAgent` to `updateProject()` in app/api/projects/[projectId]/route.ts
- [ ] T009 [US1] Write integration tests for project PATCH with `defaultAgent` (set CODEX, verify persistence, invalid value rejection, non-owner rejection) by extending tests in tests/integration/projects/

**Checkpoint**: Project-level agent configuration is fully functional and testable

---

## Phase 4: User Story 2 — Ticket Inherits Project Default Agent (Priority: P1)

**Goal**: Tickets created without an `agent` field inherit the project's `defaultAgent`. The `resolveEffectiveAgent()` utility correctly resolves ticket → project fallback.

**Independent Test**: Set project `defaultAgent` to CODEX, create a ticket without `agent`, verify ticket `agent` is `null` and `resolveEffectiveAgent()` returns CODEX.

### Tests for User Story 2

- [ ] T010 [P] [US2] Write unit tests for `resolveEffectiveAgent()` (null ticket agent → project default, explicit ticket agent → override, various combinations) in tests/unit/agent-resolution.test.ts

### Implementation for User Story 2

- [ ] T011 [US2] Extend `createTicket()` to accept optional `agent` field in lib/db/tickets.ts
- [ ] T012 [US2] Extend POST handler to validate and pass optional `agent` to `createTicket()` in app/api/projects/[projectId]/tickets/route.ts
- [ ] T013 [US2] Write integration tests for ticket creation with and without `agent` (inherits project default, agent null in response) by extending tests in tests/integration/tickets/

**Checkpoint**: Ticket creation with inheritance is fully functional and testable

---

## Phase 5: User Story 3 — Ticket Creator Overrides Agent (Priority: P2)

**Goal**: Users can set, change, or clear the `agent` field on tickets. Agent is editable only in INBOX stage.

**Independent Test**: Create a ticket with `agent: CODEX`, verify it persists. Update to `agent: null`, verify fallback to project default. Verify update rejected outside INBOX.

### Tests for User Story 3

- [ ] T014 [P] [US3] Write unit tests for `ticketAgentSchema` validation (valid values, null, invalid values) in tests/unit/agent-schema.test.ts (extend existing file from T006)

### Implementation for User Story 3

- [ ] T015 [US3] Extend ticket update logic to handle `agent` field (set, clear to null) in lib/db/tickets.ts
- [ ] T016 [US3] Extend PATCH handler to validate and pass `agent` with INBOX stage restriction in app/api/projects/[projectId]/tickets/[id]/route.ts
- [ ] T017 [US3] Verify `agent` field follows same INBOX-only editability rule as `clarificationPolicy` in lib/utils/field-edit-permissions.ts (extend if needed)
- [ ] T018 [US3] Write integration tests for ticket PATCH with `agent` (set override, clear override, stage restriction, invalid values) by extending tests in tests/integration/tickets/

**Checkpoint**: All user stories are independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T019 Run `bun run type-check` and fix any TypeScript errors
- [ ] T020 Run `bun run lint` and fix any linting errors
- [ ] T021 Run full test suite (`bun run test:unit` and `bun run test:integration`) and verify zero regressions
- [ ] T022 Run quickstart.md validation — verify all steps from specs/AIB-228-add-ai-agent/quickstart.md are satisfied

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma types must exist)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (needs validation schemas)
- **User Story 2 (Phase 4)**: Depends on Phase 2 (needs resolution utility + schemas)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (needs schemas)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — independent of US1 (different endpoints)
- **US3 (P2)**: Can start after Phase 2 — independent of US1/US2 (different endpoint)

### Within Each User Story

- Tests written first (should fail before implementation)
- DB functions before API routes
- Integration tests after implementation

### Parallel Opportunities

- T003 and T004 can run in parallel (different new files)
- US1, US2, US3 can all start in parallel after Phase 2 (different endpoints/files)
- Unit tests T006, T010, T014 can run in parallel (different test files or sections)

---

## Parallel Example: After Phase 2

```bash
# All three user stories can be launched in parallel:
Story 1: T006 → T007 → T008 → T009 (project PATCH endpoint)
Story 2: T010 → T011 → T012 → T013 (ticket POST endpoint)
Story 3: T014 → T015 → T016 → T017 → T018 (ticket PATCH endpoint)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (schemas + resolution utility)
3. Complete Phase 3: User Story 1 (project defaultAgent)
4. **STOP and VALIDATE**: Test project agent configuration independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → MVP!
3. Add US2 → Test independently → Ticket inheritance works
4. Add US3 → Test independently → Full agent override capability
5. Polish → Final validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, all 3 user stories can run in parallel:
   - Parallel task 1: US1 (project PATCH)
   - Parallel task 2: US2 (ticket POST)
   - Parallel task 3: US3 (ticket PATCH)
3. Polish after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Follows identical pattern to existing `clarificationPolicy` — reference that code for all implementations
- No UI changes — data model and API only
