# Tasks: User Mentions in Comments

**Input**: Design documents from `/specs/043-tag-user-comment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test-Driven Development (TDD) is required per constitution. All E2E tests written BEFORE implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- Web app structure: `app/`, `components/`, `lib/`, `tests/`
- Next.js 15 App Router conventions
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies for mention feature

- [X] T001 Verify shadcn/ui Popover component installed (npx shadcn-ui@latest add popover)
- [X] T002 [P] Create feature branch structure in app/lib/utils/ for mention utilities
- [X] T003 [P] Create feature branch structure in app/lib/hooks/queries/ for TanStack Query hooks
- [X] T004 [P] Create feature branch structure in app/components/comments/ for mention components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core mention parsing and API infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Create mention parser utility in app/lib/utils/mention-parser.ts with parseMentions() and formatMention() functions
- [X] T006 [P] Create TypeScript interfaces for mention types in app/lib/types/mention.ts (User, ParsedMention, ProjectMember, etc.)
- [X] T007 [P] Extend Zod comment schema in app/lib/schemas/comment-validation.ts to validate mention markup format
- [X] T008 Create GET /api/projects/[projectId]/members endpoint in app/api/projects/[projectId]/members/route.ts
- [X] T009 Add project members query key to app/lib/query-keys.ts
- [X] T010 Create useProjectMembers hook in app/lib/hooks/queries/useProjectMembers.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic User Mention Autocomplete (Priority: P1) 🎯 MVP

**Goal**: Enable users to type @ in comment field, see autocomplete with project members, filter by typing, and select user to insert mention

**Independent Test**: Type @ in comment field → see dropdown with users → type "joh" → see filtered users → click user → mention inserted in comment → submit → mention saved and displayed with formatting

### E2E Tests for User Story 1 (TDD - Write FIRST)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] E2E test: Typing @ opens autocomplete dropdown in tests/e2e/mentions.spec.ts
- [X] T012 [P] [US1] E2E test: Typing letters after @ filters user list in tests/e2e/mentions.spec.ts
- [X] T013 [P] [US1] E2E test: Clicking user in dropdown inserts mention in tests/e2e/mentions.spec.ts
- [X] T014 [P] [US1] E2E test: Submitted comment with mention is saved and displayed with formatting in tests/e2e/mentions.spec.ts

### Implementation for User Story 1

- [ ] T015 [P] [US1] Create UserAutocomplete component in app/components/comments/user-autocomplete.tsx (dropdown UI with user list)
- [ ] T016 [P] [US1] Create MentionInput component in app/components/comments/mention-input.tsx (textarea with @ detection and autocomplete trigger)
- [ ] T017 [US1] Implement client-side user filtering logic with useMemo in MentionInput component (case-insensitive substring match)
- [ ] T018 [US1] Implement mention insertion logic in MentionInput (replace @ + query with @[userId:name] markup at cursor position)
- [ ] T019 [US1] Integrate MentionInput into CommentForm component in app/components/comments/comment-form.tsx
- [ ] T020 [US1] Extend POST /api/projects/[projectId]/tickets/[ticketId]/comments endpoint to validate mention markup in app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts
- [ ] T021 [US1] Create MentionDisplay component in app/components/comments/mention-display.tsx (parse content and render mentions as formatted chips)
- [ ] T022 [US1] Extend GET /api/projects/[projectId]/tickets/[ticketId]/comments endpoint to include mentionedUsers map in response
- [ ] T023 [US1] Integrate MentionDisplay into CommentList component in app/components/comments/comment-list.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - typing @ opens autocomplete, clicking user inserts mention, saving comment preserves mention with formatting

---

## Phase 4: User Story 2 - Keyboard Navigation (Priority: P2)

**Goal**: Enable power users to navigate autocomplete using arrow keys and Enter/Escape for faster comment authoring

**Independent Test**: Type @ → dropdown opens → press Down arrow → user highlighted → press Up arrow → previous user highlighted → press Enter → mention inserted → press @ → Escape → dropdown closes

### E2E Tests for User Story 2 (TDD - Write FIRST)

- [X] T024 [P] [US2] E2E test: Arrow Down key highlights next user in tests/e2e/mentions.spec.ts
- [X] T025 [P] [US2] E2E test: Arrow Up key highlights previous user in tests/e2e/mentions.spec.ts
- [X] T026 [P] [US2] E2E test: Enter key selects highlighted user in tests/e2e/mentions.spec.ts
- [X] T027 [P] [US2] E2E test: Escape key closes dropdown without inserting mention in tests/e2e/mentions.spec.ts

### Implementation for User Story 2

- [ ] T028 [US2] Add keyboard event handler (onKeyDown) to MentionInput component in app/components/comments/mention-input.tsx
- [ ] T029 [US2] Add selectedIndex state and arrow key navigation logic to MentionInput component
- [ ] T030 [US2] Add Enter key selection logic to insert highlighted user's mention
- [ ] T031 [US2] Add Escape key handler to close autocomplete dropdown
- [ ] T032 [US2] Add ARIA attributes to UserAutocomplete component for screen reader support in app/components/comments/user-autocomplete.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - mouse and keyboard navigation both functional

---

## Phase 5: User Story 3 - Multiple Mentions (Priority: P3)

**Goal**: Allow users to mention multiple team members in a single comment for coordination scenarios

**Independent Test**: Type @ → select user1 → type text → type @ again → select user2 → submit comment → both mentions saved and displayed correctly

### E2E Tests for User Story 3 (TDD - Write FIRST)

- [X] T033 [P] [US3] E2E test: Typing @ after existing mention opens new autocomplete in tests/e2e/mentions.spec.ts
- [X] T034 [P] [US3] E2E test: Submitting comment with multiple mentions saves all mentions in tests/e2e/mentions.spec.ts
- [X] T035 [P] [US3] E2E test: Viewing comment with multiple mentions displays all mentions formatted in tests/e2e/mentions.spec.ts

### Implementation for User Story 3

- [ ] T036 [US3] Update MentionInput @ detection logic to support multiple mentions in same comment in app/components/comments/mention-input.tsx
- [ ] T037 [US3] Update mention parser to handle multiple mention markup instances in app/lib/utils/mention-parser.ts (already supports via regex global flag, verify)
- [ ] T038 [US3] Update MentionDisplay to render multiple mention segments correctly in app/components/comments/mention-display.tsx
- [ ] T039 [US3] Update server-side mention validation to handle multiple user IDs in app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts

**Checkpoint**: All three user stories should now work independently - single and multiple mentions both supported

---

## Phase 6: User Story 4 - Mention Persistence and Display (Priority: P1)

**Goal**: Ensure mentions remain visible and formatted after page reload, with current user names and deleted user handling

**Independent Test**: Create comment with mention → save → refresh page → mention still formatted → hover over mention → see user details → delete mentioned user → reload → see "[Removed User]"

### E2E Tests for User Story 4 (TDD - Write FIRST)

- [X] T040 [P] [US4] E2E test: Mentions remain formatted after page reload in tests/e2e/mentions.spec.ts
- [X] T041 [P] [US4] E2E test: Hovering over mention shows user details tooltip in tests/e2e/mentions.spec.ts
- [X] T042 [P] [US4] E2E test: Deleted user mention displays "[Removed User]" in tests/e2e/mentions.spec.ts

### Implementation for User Story 4

- [ ] T043 [US4] Add hover tooltip to MentionDisplay chip component showing user details in app/components/comments/mention-display.tsx
- [ ] T044 [US4] Update GET comments endpoint to LEFT JOIN mentionedUsers (handle deleted users) in app/api/projects/[projectId]/tickets/[ticketId]/comments/route.ts
- [ ] T045 [US4] Add conditional rendering in MentionDisplay for deleted users (show "[Removed User]" when user not in mentionedUsers map)
- [ ] T046 [US4] Verify name change handling: mentions auto-update to current name (already handled by user ID resolution, add E2E test)

**Checkpoint**: All four user stories complete - mentions persist, display correctly, and handle edge cases (deleted users, name changes)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

- [ ] T047 [P] Add loading state to autocomplete dropdown while fetching project members
- [ ] T048 [P] Add error handling for failed project members API call (show user-friendly message)
- [ ] T049 [P] Add character count indicator in CommentForm showing remaining characters (2000 limit includes markup)
- [ ] T050 [P] Optimize autocomplete dropdown scroll behavior (highlight should scroll into view)
- [ ] T051 [P] Add mobile responsive styling for autocomplete dropdown in app/components/comments/user-autocomplete.tsx
- [ ] T052 [P] Add unit tests for mention parser utility in tests/unit/mention-parser.test.ts
- [ ] T053 [P] Add API contract tests for GET /api/projects/:id/members endpoint in tests/api/project-members.spec.ts
- [ ] T054 [P] Add API contract tests for POST comments with mention validation in tests/api/comments.spec.ts
- [ ] T055 Verify all E2E tests pass (run npx playwright test tests/e2e/mentions.spec.ts)
- [ ] T056 Run linter and fix any issues (npm run lint)
- [ ] T057 Update quickstart.md with any implementation deviations or learnings
- [ ] T058 Final code review and refactoring pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - MVP target
  - User Story 2 (P2): Can start after Foundational - Independent of US1 (enhances same components)
  - User Story 3 (P3): Can start after Foundational - Independent of US1/US2 (extends same logic)
  - User Story 4 (P1): Can start after Foundational - Independent of others (rendering layer)
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 components but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 logic but independently testable
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (separate rendering concern)

### Within Each User Story

- E2E tests MUST be written and FAIL before implementation (TDD requirement)
- Components can be built in parallel if working on different files
- Integration tasks (extending existing components) come after base components
- Story complete when all E2E tests pass

### Parallel Opportunities

- **Phase 1**: All setup tasks (T001-T004) can run in parallel
- **Phase 2**: Tasks T006, T007, T010 can run in parallel (different files)
- **User Story 1 E2E Tests**: T011-T014 can be written in parallel (different test cases)
- **User Story 1 Components**: T015, T016, T021 can be built in parallel (different component files)
- **User Story 2 E2E Tests**: T024-T027 can be written in parallel
- **User Story 3 E2E Tests**: T033-T035 can be written in parallel
- **User Story 4 E2E Tests**: T040-T042 can be written in parallel
- **Polish Phase**: Most tasks (T047-T054) can run in parallel (different files)
- **Different User Stories**: After Foundational phase, US1, US2, US3, US4 can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all E2E tests for User Story 1 together:
Task: "E2E test: Typing @ opens autocomplete dropdown in tests/e2e/mentions.spec.ts"
Task: "E2E test: Typing letters after @ filters user list in tests/e2e/mentions.spec.ts"
Task: "E2E test: Clicking user in dropdown inserts mention in tests/e2e/mentions.spec.ts"
Task: "E2E test: Submitted comment displays formatted mention in tests/e2e/mentions.spec.ts"

# Launch all base components for User Story 1 together:
Task: "Create UserAutocomplete component in app/components/comments/user-autocomplete.tsx"
Task: "Create MentionInput component in app/components/comments/mention-input.tsx"
Task: "Create MentionDisplay component in app/components/comments/mention-display.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4 Only)

**Why US1 + US4**: User Story 1 provides autocomplete (core feature), User Story 4 ensures persistence and display (essential for usability). Together they form a complete mention system. US2 (keyboard nav) and US3 (multiple mentions) are enhancements.

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T010) - CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T011-T023) - Basic autocomplete
4. Complete Phase 6: User Story 4 (T040-T046) - Persistence and edge cases
5. **STOP and VALIDATE**: Test mentions end-to-end (create, save, reload, delete user)
6. Deploy/demo MVP

### Incremental Delivery

1. **Foundation Ready**: Complete Setup + Foundational → Ready for user stories
2. **MVP (US1 + US4)**: Autocomplete + Persistence → Deploy/Demo (usable mention system)
3. **Enhancement 1 (US2)**: Add keyboard navigation → Deploy/Demo (power user friendly)
4. **Enhancement 2 (US3)**: Add multiple mentions → Deploy/Demo (team coordination)
5. Each increment adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers (after Foundational phase completes):

**Option 1: Feature-focused (Recommended for MVP)**
- Developer A: User Story 1 (autocomplete) + User Story 4 (persistence) → MVP
- Developer B: User Story 2 (keyboard nav) → Enhancement 1
- Developer C: User Story 3 (multiple mentions) → Enhancement 2

**Option 2: Component-focused**
- Developer A: All frontend components (T015-T019, T021, T028-T032, T036-T038)
- Developer B: All API endpoints (T008, T020, T022, T044)
- Developer C: All E2E tests (T011-T014, T024-T027, T033-T035, T040-T042)

**Option 3: Story-by-story (Sequential)**
- Team completes US1 together → Validate independently
- Team completes US4 together → Validate MVP
- Team completes US2 → Validate enhancement
- Team completes US3 → Final validation

---

## Task Count Summary

- **Total Tasks**: 58
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 6 tasks (BLOCKS all user stories)
- **Phase 3 (User Story 1 - P1)**: 13 tasks (4 tests + 9 implementation)
- **Phase 4 (User Story 2 - P2)**: 9 tasks (4 tests + 5 implementation)
- **Phase 5 (User Story 3 - P3)**: 7 tasks (3 tests + 4 implementation)
- **Phase 6 (User Story 4 - P1)**: 7 tasks (3 tests + 4 implementation)
- **Phase 7 (Polish)**: 12 tasks

**Parallel Opportunities**: 31 tasks marked [P] can run in parallel
**Independent Stories**: 4 user stories can be worked on in parallel after Foundational phase

**Suggested MVP Scope**: Phases 1-3 + Phase 6 (Setup + Foundational + US1 + US4) = 30 tasks for complete mention system

---

## Format Validation

✅ All tasks follow strict checklist format:
- Checkbox: `- [ ]`
- Task ID: Sequential (T001-T058)
- [P] marker: 31 tasks marked as parallelizable
- [Story] label: All user story tasks properly labeled (US1, US2, US3, US4)
- Description: Clear action with exact file paths
- File paths: Absolute from repository root using Next.js conventions

✅ All user stories have:
- Goal statement
- Independent test criteria
- E2E tests (TDD approach)
- Implementation tasks
- Checkpoint validation

✅ Organization by user story enables:
- Independent implementation
- Independent testing
- Incremental delivery
- Parallel team execution

---

## Notes

- **TDD Required**: All E2E tests MUST be written first and FAIL before implementation (constitution requirement)
- **Test Discovery**: Search for existing test files before creating new ones (npx grep -r "describe.*comment" tests/)
- **[P] tasks**: Different files, no dependencies - can run concurrently
- **[Story] labels**: Map tasks to user stories for traceability and independent validation
- **Each user story**: Independently completable and testable
- **Commit frequency**: After each task or logical group
- **Checkpoints**: Stop and validate story independently before proceeding
- **Constitution compliance**: TypeScript strict mode, shadcn/ui components, TanStack Query, security validation

**Next Step**: Proceed with `/speckit.implement` to execute tasks in priority order
