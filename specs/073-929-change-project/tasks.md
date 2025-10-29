# Tasks: Project Card Redesign

**Feature**: Display last shipped ticket instead of project description
**Input**: Design documents from `/specs/073-929-change-project/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test tasks included per TDD requirement in quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `- [ ] [ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Migration)

**Purpose**: Add deploymentUrl field to database schema

- [ ] T001 Update Prisma schema with deploymentUrl field in prisma/schema.prisma
- [ ] T002 Create and apply database migration: `npx prisma migrate dev --name add_deployment_url`
- [ ] T003 Generate Prisma types: `npx prisma generate`
- [ ] T004 Verify migration in Prisma Studio (visual verification)

**Checkpoint**: Database schema updated with deploymentUrl field

---

## Phase 2: Foundational (Type System & Validation)

**Purpose**: Core type definitions and validation schemas that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 [P] Update ProjectWithCount interface in app/lib/types/project.ts (add githubOwner, githubRepo, deploymentUrl, lastShippedTicket)
- [ ] T006 [P] Create ShippedTicketDisplay interface in app/lib/types/project.ts
- [ ] T007 [P] Update Zod validation schema for deploymentUrl in app/lib/schemas/project.ts (max 500 chars, URL format, nullable)
- [ ] T008 Update getUserProjects query in lib/db/projects.ts (add tickets include with SHIP filter, orderBy updatedAt desc, take 1)
- [ ] T009 Update GET /api/projects response mapping in app/api/projects/route.ts (map all new fields including lastShippedTicket)

**Checkpoint**: Foundation ready - type-safe data flow from database to API established

---

## Phase 3: User Story 1 - View Project Shipping Progress (Priority: P1) 🎯 MVP

**Goal**: Display most recent shipped ticket with relative timestamp and total ticket count on project cards

**Independent Test**: View projects list page and verify shipped ticket information displays correctly with relative time formatting

### Tests for User Story 1 (TDD Required - Write FIRST)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Unit test for formatTimestamp utility in tests/unit/format-timestamp.test.ts (verify existing 21 tests still pass)
- [ ] T011 [P] [US1] Playwright test for shipped ticket display in tests/e2e/project-card.spec.ts (test: displays last shipped ticket with relative time)
- [ ] T012 [P] [US1] Playwright test for no shipped tickets in tests/e2e/project-card.spec.ts (test: displays "No tickets shipped yet" message)
- [ ] T013 [P] [US1] Playwright test for zero tickets in tests/e2e/project-card.spec.ts (test: displays "No tickets yet" message)
- [ ] T014 [P] [US1] Playwright test for long ticket title in tests/e2e/project-card.spec.ts (test: truncates with ellipsis and shows tooltip)
- [ ] T015 [P] [US1] API contract test for lastShippedTicket field in tests/api/projects.spec.ts (verify response schema matches contract)

**Run all tests**: `bun run test:unit && bun run test:e2e` - Expected: RED (tests fail)

### Implementation for User Story 1

- [ ] T016 [US1] Update ProjectCard component in components/projects/project-card.tsx (replace description with shipped ticket display)
- [ ] T017 [US1] Add shipped ticket status section in components/projects/project-card.tsx (CheckCircle icon, title truncation, relative timestamp)
- [ ] T018 [US1] Import formatTimestamp utility in components/projects/project-card.tsx (from @/lib/utils/format-timestamp)
- [ ] T019 [US1] Add conditional rendering for "No tickets shipped yet" state in components/projects/project-card.tsx
- [ ] T020 [US1] Add total ticket count display in components/projects/project-card.tsx ("· N total")
- [ ] T021 [US1] Add CSS for text truncation with ellipsis in components/projects/project-card.tsx

**Checkpoint**: User Story 1 fully functional - Run tests: `bun test` - Expected: GREEN

---

## Phase 4: User Story 2 - Quick Access to Deployment URL (Priority: P2)

**Goal**: Display deployment URL with copy-to-clipboard functionality on project cards

**Independent Test**: Add deployment URL to a project and verify copy functionality works with visual feedback

### Tests for User Story 2 (TDD Required - Write FIRST)

- [ ] T022 [P] [US2] Unit test for useCopyToClipboard hook in tests/unit/useCopyToClipboard.test.ts (test: copies text to clipboard)
- [ ] T023 [P] [US2] Unit test for isCopied state reset in tests/unit/useCopyToClipboard.test.ts (test: resets after 2 seconds)
- [ ] T024 [P] [US2] Playwright test for deployment URL display in tests/e2e/project-card.spec.ts (test: displays deployment URL with copy button)
- [ ] T025 [P] [US2] Playwright test for copy functionality in tests/e2e/project-card.spec.ts (test: copies to clipboard and shows check icon)
- [ ] T026 [P] [US2] Playwright test for missing deployment URL in tests/e2e/project-card.spec.ts (test: hides deployment section when null)
- [ ] T027 [P] [US2] API contract test for deploymentUrl field in tests/api/projects.spec.ts (verify nullable URL field)

**Run tests**: `bun run test:unit && bun run test:e2e` - Expected: RED (tests fail)

### Implementation for User Story 2

- [ ] T028 [P] [US2] Create useCopyToClipboard hook in app/lib/hooks/useCopyToClipboard.ts (clipboard API, toast notification, isCopied state)
- [ ] T029 [US2] Add deployment URL section to ProjectCard in components/projects/project-card.tsx (conditional render, clickable link)
- [ ] T030 [US2] Add copy button with icon toggle in components/projects/project-card.tsx (Copy → Check icon, 2s timeout)
- [ ] T031 [US2] Add handleCopyUrl click handler in components/projects/project-card.tsx (stopPropagation to prevent card navigation)
- [ ] T032 [US2] Import lucide-react icons (Copy, Check) in components/projects/project-card.tsx
- [ ] T033 [US2] Add URL hostname display logic in components/projects/project-card.tsx (parse URL, show domain only)

**Checkpoint**: User Stories 1 AND 2 both work independently - Run tests: `bun test` - Expected: GREEN

---

## Phase 5: User Story 3 - Navigate to GitHub Repository (Priority: P3)

**Goal**: Display GitHub repository link with icon on project cards for quick access

**Independent Test**: Verify GitHub link displays and opens in new tab without triggering card navigation

### Tests for User Story 3 (TDD Required - Write FIRST)

- [ ] T034 [P] [US3] Playwright test for GitHub link display in tests/e2e/project-card.spec.ts (test: displays owner/repo with icon)
- [ ] T035 [P] [US3] Playwright test for GitHub link href in tests/e2e/project-card.spec.ts (test: correct URL format)
- [ ] T036 [P] [US3] Playwright test for GitHub link target in tests/e2e/project-card.spec.ts (test: opens in new tab)
- [ ] T037 [P] [US3] Playwright test for GitHub link click prevention in tests/e2e/project-card.spec.ts (test: does not navigate to board)

**Run tests**: `bun run test:e2e` - Expected: RED (tests fail)

### Implementation for User Story 3

- [ ] T038 [US3] Add GitHub link section to ProjectCard in components/projects/project-card.tsx (Github icon from lucide-react)
- [ ] T039 [US3] Format GitHub URL in components/projects/project-card.tsx (https://github.com/{owner}/{repo})
- [ ] T040 [US3] Add handleGitHubClick handler in components/projects/project-card.tsx (stopPropagation to prevent card navigation)
- [ ] T041 [US3] Add target="_blank" and rel="noopener" attributes in components/projects/project-card.tsx
- [ ] T042 [US3] Add data-testid attributes for GitHub elements in components/projects/project-card.tsx

**Checkpoint**: All user stories (US1, US2, US3) independently functional - Run tests: `bun test` - Expected: GREEN

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T043 [P] Add Tooltip component for long text display in components/projects/project-card.tsx (shadcn/ui)
- [ ] T044 [P] Add responsive CSS for card layout in components/projects/project-card.tsx (handle various screen sizes)
- [ ] T045 [P] Verify Catppuccin theme colors maintained in components/projects/project-card.tsx
- [ ] T046 Update test data helper functions in tests/helpers/db-setup.ts (createTestProject with deploymentUrl support)
- [ ] T047 Performance validation: Run curl with timing for GET /api/projects (verify <100ms p95)
- [ ] T048 Verify Prisma query uses existing indexes (explain analyze for tickets query)
- [ ] T049 Run full test suite: `bun test` (all tests GREEN)
- [ ] T050 Run type check: `bun run type-check` (no errors)
- [ ] T051 Run linter: `bun run lint` (no errors)
- [ ] T052 Manual testing per quickstart.md scenarios (all 8 test scenarios pass)
- [ ] T053 Update CLAUDE.md if new patterns introduced (document useCopyToClipboard hook)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independently testable)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independently testable)

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Implementation tasks follow logical order (hook → component update)
3. Story complete when all tests GREEN

### Parallel Opportunities

- **Phase 1 (Setup)**: T002 depends on T001, T003 depends on T002, T004 depends on T003 (sequential)
- **Phase 2 (Foundational)**: T005, T006, T007 can run in parallel; T008, T009 can run in parallel after types
- **User Story Tests**: All test tasks within a story marked [P] can run in parallel
- **User Story 1**: T010-T015 (6 test tasks) can run in parallel
- **User Story 2**: T022-T027 (6 test tasks) can run in parallel; T028 and T029 can run in parallel
- **User Story 3**: T034-T037 (4 test tasks) can run in parallel
- **Phase 6 (Polish)**: T043, T044, T045 can run in parallel; T046 independent; T047, T048 can run in parallel
- **Different user stories can be worked on in parallel by different team members after Foundational phase**

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (6 parallel tasks):
Task T010: "Unit test for formatTimestamp utility in tests/unit/format-timestamp.test.ts"
Task T011: "Playwright test for shipped ticket display in tests/e2e/project-card.spec.ts"
Task T012: "Playwright test for no shipped tickets in tests/e2e/project-card.spec.ts"
Task T013: "Playwright test for zero tickets in tests/e2e/project-card.spec.ts"
Task T014: "Playwright test for long ticket title in tests/e2e/project-card.spec.ts"
Task T015: "API contract test for lastShippedTicket field in tests/api/projects.spec.ts"
```

---

## Parallel Example: User Story 2 Implementation

```bash
# Launch hook and component tasks in parallel (2 parallel tasks):
Task T028: "Create useCopyToClipboard hook in app/lib/hooks/useCopyToClipboard.ts"
Task T029: "Add deployment URL section to ProjectCard in components/projects/project-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (database migration)
2. Complete Phase 2: Foundational (type system & API updates)
3. Complete Phase 3: User Story 1 (shipped ticket display)
4. **STOP and VALIDATE**: Run `bun test` - all tests GREEN
5. **Manual Testing**: Verify shipped ticket displays correctly
6. Deploy/demo if ready - **THIS IS THE MVP!**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (database + types + API)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: shipped ticket display)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP + deployment URL)
4. Add User Story 3 → Test independently → Deploy/Demo (MVP + deployment + GitHub link)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (requires Foundational phase complete first):

1. Team completes Setup + Foundational together (blocking work)
2. Once Foundational is done:
   - Developer A: User Story 1 (tests T010-T015, implementation T016-T021)
   - Developer B: User Story 2 (tests T022-T027, implementation T028-T033)
   - Developer C: User Story 3 (tests T034-T037, implementation T038-T042)
3. Stories complete and integrate independently
4. Team converges on Phase 6: Polish

---

## Notes

- **TDD Workflow**: Tests written FIRST for each user story (must FAIL before implementation)
- **Hybrid Testing Strategy**: Vitest for utilities (formatTimestamp, useCopyToClipboard), Playwright for components and API
- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Each user story should be independently completable and testable**
- **Verify tests fail before implementing (RED → GREEN → REFACTOR)**
- **Commit after each task or logical group**
- **Stop at any checkpoint to validate story independently**
- **Performance target**: <100ms p95 for GET /api/projects (verify with curl timing)
- **Type safety**: Maintained across all layers (DB → API → UI)
- **Existing tests**: Must continue to pass throughout implementation

---

## Summary Statistics

- **Total Tasks**: 53 tasks
- **Setup Phase**: 4 tasks
- **Foundational Phase**: 5 tasks (BLOCKING)
- **User Story 1 (P1 - MVP)**: 12 tasks (6 tests + 6 implementation)
- **User Story 2 (P2)**: 12 tasks (6 tests + 6 implementation)
- **User Story 3 (P3)**: 9 tasks (4 tests + 5 implementation)
- **Polish Phase**: 11 tasks
- **Parallel Opportunities**: 32 tasks marked [P] (60% parallelizable within constraints)
- **Estimated Time**: 2-3 hours with TDD workflow (per quickstart.md)

---

## Rollback Plan

If issues arise during implementation:

1. **Revert database migration**:
   ```bash
   npx prisma migrate resolve --rolled-back add_deployment_url
   ```

2. **Revert code changes**:
   ```bash
   git checkout main -- components/projects/project-card.tsx
   git checkout main -- app/api/projects/route.ts
   git checkout main -- lib/db/projects.ts
   git checkout main -- app/lib/types/project.ts
   git checkout main -- app/lib/hooks/useCopyToClipboard.ts
   ```

3. **Clean up test files**:
   ```bash
   git checkout main -- tests/
   ```

---

## Quickstart.md Validation Scenarios

Final validation must cover all 8 scenarios from quickstart.md:

1. ✅ Project with shipped tickets - displays last shipped with relative time
2. ✅ Project with tickets but none shipped - displays "No tickets shipped yet · N total"
3. ✅ Project with zero tickets - displays "No tickets yet"
4. ✅ Long ticket title - truncated with ellipsis + tooltip
5. ✅ Deployment URL configured - displays with copy button
6. ✅ No deployment URL - section hidden
7. ✅ GitHub repository - displays "owner/repo" link, opens in new tab
8. ✅ Card click navigation - preserved except for URL/copy/GitHub clicks
