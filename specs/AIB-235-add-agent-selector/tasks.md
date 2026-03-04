# Tasks: Add Agent Selector UI on Tickets and Project Settings

**Input**: Design documents from `/specs/AIB-235-add-agent-selector/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md specifies component tests (Vitest + RTL) and unit tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the agent utility module that all UI components depend on

- [x] T001 [P] Create agent utility functions (getAgentIcon, getAgentLabel, getAgentDescription) in app/lib/utils/agent-icons.ts mirroring app/lib/utils/policy-icons.ts
- [x] T002 [P] Create unit tests for agent utility functions in tests/unit/agent-icons.test.ts

**Checkpoint**: Agent utility functions available for all components

---

## Phase 2: User Story 1 — Project Owner Configures Default Agent in Settings (Priority: P1) 🎯 MVP

**Goal**: Project owners can change the project-level default agent in settings. The card mirrors ClarificationPolicyCard.

**Independent Test**: Navigate to project settings, change default agent dropdown, verify selection persists after page refresh.

### Tests for User Story 1

- [x] T003 [P] [US1] Create component test for DefaultAgentCard in tests/unit/components/default-agent-card.test.tsx — test rendering current agent, dropdown change triggers PATCH, read-only for non-owners

### Implementation for User Story 1

- [x] T004 [P] [US1] Create DefaultAgentCard component in components/settings/default-agent-card.tsx mirroring components/settings/clarification-policy-card.tsx — card with Select dropdown, PATCH /api/projects/:id on change, router.refresh()
- [x] T005 [US1] Add DefaultAgentCard to project settings page in app/projects/[projectId]/settings/page.tsx alongside existing ClarificationPolicyCard

**Checkpoint**: Project settings shows agent selector card; owners can change default agent

---

## Phase 3: User Story 2 — User Selects Agent During Ticket Creation (Priority: P1)

**Goal**: New ticket modal includes an agent dropdown pre-populated with project default. Leaving default = null (inherit); explicit change = saved value.

**Independent Test**: Open new ticket modal, verify agent dropdown shows project default, change agent, create ticket, confirm correct agent saved.

### Implementation for User Story 2

- [x] T006 [US2] Add agent Select field to new ticket modal in components/board/new-ticket-modal.tsx — mirror the clarification policy select pattern (lines 289-335), use "project-default" sentinel value, pass agent to POST body

**Checkpoint**: New ticket creation includes agent selection

---

## Phase 4: User Story 3 — User Edits Agent on INBOX Ticket (Priority: P2)

**Goal**: Ticket detail modal shows current agent with badge + "Edit Agent" button (INBOX only). AgentEditDialog allows changing agent.

**Independent Test**: Open INBOX ticket, change agent via edit dialog, save, confirm update persists. Verify non-INBOX tickets show read-only badge.

### Tests for User Story 3

- [x] T007 [P] [US3] Create component test for AgentEditDialog in tests/unit/components/agent-edit-dialog.test.tsx — test rendering current selection, save triggers callback, cancel closes dialog

### Implementation for User Story 3

- [x] T008 [P] [US3] Create AgentEditDialog component in components/tickets/agent-edit-dialog.tsx mirroring PolicyEditDialog — Select with agent options, save/cancel buttons, loading state
- [x] T009 [US3] Add AgentBadge display + "Edit Agent" button (INBOX only) + AgentEditDialog to components/board/ticket-detail-modal.tsx — mirror PolicyBadge + PolicyEditDialog pattern, show effective agent with inherited indicator

**Checkpoint**: Ticket detail modal shows agent and allows editing in INBOX stage

---

## Phase 5: User Story 4 — User Sees Agent Badge on Board Ticket Cards (Priority: P2)

**Goal**: Each ticket card on the kanban board shows a small badge indicating the assigned agent. Inherited agents use muted styling with "(default)" suffix.

**Independent Test**: View board with tickets assigned to different agents, verify each card shows correct agent label with proper styling.

### Implementation for User Story 4

- [x] T010 [US4] Add agent badge to ticket card header row in components/board/ticket-card.tsx — show effective agent (ticket.agent ?? project.defaultAgent), use muted styling + "(default)" for inherited, normal styling for explicit

**Checkpoint**: Kanban board shows agent badges on all ticket cards

---

## Phase 6: User Story 5 — User Selects Agent in Quick-Impl Modal (Priority: P3)

**Goal**: Quick-impl confirmation modal includes agent dropdown defaulting to project default. Selected agent passed back via onConfirm.

**Independent Test**: Drag INBOX ticket to BUILD, verify quick-impl modal shows agent dropdown, select agent, confirm ticket created with chosen agent.

### Implementation for User Story 5

- [x] T011 [US5] Extend QuickImplModal in components/board/quick-impl-modal.tsx — add defaultAgent prop, agent Select between content sections and warning box, pass selected agent via onConfirm callback
- [x] T012 [US5] Update parent components that trigger QuickImplModal to pass defaultAgent prop and handle returned agent in transition API call

**Checkpoint**: Quick-impl flow includes agent selection

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cross-cutting improvements

- [x] T013 Run type-check (bun run type-check) and fix any TypeScript errors across all new and modified files
- [x] T014 Run linter (bun run lint) and fix any lint errors across all new and modified files
- [x] T015 Run unit tests (bun run test:unit) and verify all new and existing tests pass
- [x] T016 Run quickstart.md validation checklist — verify all items pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on T001 (agent utility)
- **US2 (Phase 3)**: Depends on T001 (agent utility)
- **US3 (Phase 4)**: Depends on T001 (agent utility)
- **US4 (Phase 5)**: Depends on T001 (agent utility)
- **US5 (Phase 6)**: Depends on T001 (agent utility)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — no dependencies on other stories
- **US2 (P1)**: Independent — no dependencies on other stories
- **US3 (P2)**: Independent — no dependencies on other stories
- **US4 (P2)**: Independent — no dependencies on other stories
- **US5 (P3)**: Independent — no dependencies on other stories

### Within Each User Story

- Tests written first (where applicable)
- Component creation before integration into existing pages
- Single-file tasks before multi-file integration tasks

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 and T004 can run in parallel (test + component, different files)
- T007 and T008 can run in parallel (test + component, different files)
- All user stories (Phases 2-6) can run in parallel after Phase 1 completes
- US1, US2, US3, US4, US5 operate on different files (except ticket-detail-modal shared by US3)

---

## Parallel Example: User Story 3

```bash
# Launch test + component in parallel (different files):
Task: "Create component test for AgentEditDialog in tests/unit/components/agent-edit-dialog.test.tsx"
Task: "Create AgentEditDialog component in components/tickets/agent-edit-dialog.tsx"

# Then sequential integration:
Task: "Add AgentBadge + Edit Agent button to components/board/ticket-detail-modal.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (agent utility)
2. Complete Phase 2: User Story 1 (settings card)
3. **STOP and VALIDATE**: Test settings card independently
4. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup → Agent utility ready
2. Add US1 (Settings card) → Test independently → MVP!
3. Add US2 (New ticket modal) → Test independently
4. Add US3 (Ticket detail edit) → Test independently
5. Add US4 (Board badges) → Test independently
6. Add US5 (Quick-impl modal) → Test independently
7. Polish → Type-check, lint, full test suite

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Phase 1 (Setup) sequentially
2. Once Setup is done, user stories can run in parallel:
   - Parallel task 1: US1 (settings card) — components/settings/
   - Parallel task 2: US2 (new ticket modal) — components/board/new-ticket-modal.tsx
   - Parallel task 3: US3 (ticket detail edit) — components/tickets/ + components/board/ticket-detail-modal.tsx
   - Parallel task 4: US4 (board badges) — components/board/ticket-card.tsx
   - Parallel task 5: US5 (quick-impl modal) — components/board/quick-impl-modal.tsx
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All UI-only — backend complete from AIB-228 (no schema/API changes)
- Mirror clarification policy UI pattern exactly per plan.md design decisions
- Agent utility (agent-icons.ts) is the single shared dependency for all stories
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
