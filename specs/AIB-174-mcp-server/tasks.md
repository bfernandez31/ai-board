# Tasks: MCP Server for AI-Board

**Input**: Design documents from `/specs/AIB-174-mcp-server/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included per plan.md (unit + integration tests specified)

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- MCP server package: `mcp-server/src/`
- Tests: `tests/unit/mcp-server/`, `tests/integration/mcp-server/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and package structure

- [X] T001 Create mcp-server directory structure: mcp-server/src/, mcp-server/src/tools/
- [X] T002 Create mcp-server/package.json with @modelcontextprotocol/sdk and zod dependencies
- [X] T003 [P] Create mcp-server/tsconfig.json extending root config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement config loader with zod schema in mcp-server/src/config.ts
- [X] T005 [P] Create error types and codes enum in mcp-server/src/errors.ts
- [X] T006 Implement API client with fetch, timeout, and auth headers in mcp-server/src/api-client.ts
- [X] T007 [P] Create shared TypeScript interfaces for API responses in mcp-server/src/types.ts
- [X] T008 [P] Create unit test for config loading in tests/unit/mcp-server/config.test.ts
- [X] T009 [P] Create unit test for API client in tests/unit/mcp-server/api-client.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - List and View Projects (Priority: P1) 🎯 MVP

**Goal**: Enable users to discover projects they have access to and view project details

**Independent Test**: Ask Claude "What projects do I have in ai-board?" and receive a list of project names, keys, and ticket counts

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement list_projects tool in mcp-server/src/tools/list-projects.ts
- [X] T011 [P] [US1] Implement get_project tool in mcp-server/src/tools/get-project.ts
- [X] T012 [US1] Create MCP server initialization with stdio transport in mcp-server/src/server.ts
- [X] T013 [US1] Create entry point with config loading and server startup in mcp-server/src/index.ts
- [X] T014 [US1] Register list_projects and get_project tools with zod schemas in mcp-server/src/server.ts
- [X] T015 [P] [US1] Create integration test for list_projects and get_project in tests/integration/mcp-server/projects.test.ts

**Checkpoint**: User Story 1 complete - users can list and view their projects

---

## Phase 4: User Story 2 - View Tickets in a Project (Priority: P2)

**Goal**: Enable users to see tickets in a project, filtered by stage

**Independent Test**: Ask Claude "Show me the INBOX tickets in project ABC" and receive a list of tickets with titles

### Implementation for User Story 2

- [X] T016 [P] [US2] Implement list_tickets tool with stage filter in mcp-server/src/tools/list-tickets.ts
- [X] T017 [P] [US2] Implement get_ticket tool for ticket details in mcp-server/src/tools/get-ticket.ts
- [X] T018 [US2] Register list_tickets and get_ticket tools with zod schemas in mcp-server/src/server.ts
- [X] T019 [P] [US2] Create integration test for list_tickets and get_ticket in tests/integration/mcp-server/tickets.test.ts

**Checkpoint**: User Stories 1 AND 2 complete - users can browse projects and tickets

---

## Phase 5: User Story 3 - Create a Ticket (Priority: P3)

**Goal**: Enable users to create new tickets directly from Claude

**Independent Test**: Ask Claude to create a ticket and verify it appears in the project INBOX

### Implementation for User Story 3

- [X] T020 [US3] Implement create_ticket tool with validation in mcp-server/src/tools/create-ticket.ts
- [X] T021 [US3] Register create_ticket tool with zod schema (title 1-100 chars, description 1-10000 chars) in mcp-server/src/server.ts
- [X] T022 [P] [US3] Create integration test for create_ticket in tests/integration/mcp-server/create-ticket.test.ts

**Checkpoint**: User Stories 1, 2, AND 3 complete - users can browse and create tickets

---

## Phase 6: User Story 4 - Move Ticket to Next Stage (Priority: P4)

**Goal**: Enable users to advance tickets through workflow stages from Claude

**Independent Test**: Ask Claude "Move ticket ABC-42 to SPECIFY stage" and verify the transition occurs

### Implementation for User Story 4

- [X] T023 [US4] Implement move_ticket tool with stage validation in mcp-server/src/tools/move-ticket.ts
- [X] T024 [US4] Register move_ticket tool with zod schema for targetStage in mcp-server/src/server.ts
- [X] T025 [P] [US4] Create integration test for move_ticket including error cases in tests/integration/mcp-server/move-ticket.test.ts

**Checkpoint**: All 4 user stories complete - full MCP server functionality implemented

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and refinements

- [X] T026 [P] Add shebang and bin configuration for CLI execution in mcp-server/src/index.ts
- [X] T027 Verify all error messages follow security guidelines (no token exposure) across all tools
- [X] T028 Run full test suite and validate all 6 MCP tools function correctly
- [X] T029 Build TypeScript and verify dist/ output in mcp-server/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3 → P4)
  - Or user stories can run in parallel after Phase 2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Tool implementation before server registration
- Server registration before integration tests
- Models/types from Phase 2 are shared across all stories

### Parallel Opportunities

- T002, T003: Package setup files (different files)
- T005, T007, T008, T009: Foundation tasks (different files)
- T010, T011: US1 tool implementations (different files)
- T016, T017: US2 tool implementations (different files)
- All user stories can run in parallel after Phase 2 completes

---

## Parallel Example: Foundational Phase

```bash
# Launch foundation tasks in parallel:
Task: "Create error types in mcp-server/src/errors.ts"
Task: "Create TypeScript interfaces in mcp-server/src/types.ts"
Task: "Create unit test for config in tests/unit/mcp-server/config.test.ts"
Task: "Create unit test for API client in tests/unit/mcp-server/api-client.test.ts"
```

## Parallel Example: User Story 1

```bash
# Launch US1 tool implementations in parallel:
Task: "Implement list_projects tool in mcp-server/src/tools/list-projects.ts"
Task: "Implement get_project tool in mcp-server/src/tools/get-project.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (list_projects, get_project)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Users can already discover and view their projects

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → MVP ready (project browsing)
3. Add User Story 2 → Test independently → Ticket viewing added
4. Add User Story 3 → Test independently → Ticket creation added
5. Add User Story 4 → Test independently → Workflow transitions added
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1 (T010-T015)
   - Parallel task 2: User Story 2 (T016-T019)
   - Parallel task 3: User Story 3 (T020-T022)
   - Parallel task 4: User Story 4 (T023-T025)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All tools share the same config and API client from Phase 2
- MCP SDK uses zod for tool input validation (already a project dependency)
