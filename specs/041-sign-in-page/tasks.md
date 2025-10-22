---
description: "Task list for sign-in page redesign implementation"
---

# Tasks: Sign-In Page Redesign

**Input**: Design documents from `/specs/041-sign-in-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD approach per constitution - E2E tests written BEFORE implementation

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app (Next.js 15 App Router)**: `app/`, `components/`, `lib/`, `tests/e2e/`
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [ ] T001 Install react-icons dependency per research.md: `npm install react-icons`
- [ ] T002 [P] Search for existing auth/signin tests per constitution TDD principle: `Grep` or `Glob` tools in tests/ directory
- [ ] T003 Verify development environment setup: `npm run dev` and navigate to http://localhost:3000

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational tasks required - feature modifies existing components only

**⚠️ CRITICAL**: This phase is N/A for this feature (UI redesign only, no new infrastructure)

**Checkpoint**: No blocking prerequisites - user story implementation can begin immediately after Phase 1

---

## Phase 3: User Story 1 - GitHub OAuth Sign-In (Priority: P1) 🎯 MVP

**Goal**: Users can successfully authenticate using GitHub OAuth with proper OAuth flow and redirect behavior

**Independent Test**: Navigate to /auth/signin, click GitHub button, complete OAuth flow, verify landing on /projects dashboard

### Tests for User Story 1 (TDD - Write FIRST, Verify FAIL)

**NOTE: Write these tests FIRST per constitution TDD principle, ensure they FAIL before implementation**

- [ ] T004 [P] [US1] Create E2E test file tests/e2e/auth-signin.spec.ts if not exists (check T002 search results)
- [ ] T005 [P] [US1] Write test: "GitHub button redirects to OAuth" in tests/e2e/auth-signin.spec.ts
- [ ] T006 [P] [US1] Write test: "Successful OAuth lands on /projects" in tests/e2e/auth-signin.spec.ts
- [ ] T007 [P] [US1] Write test: "callbackUrl preserved through OAuth flow" in tests/e2e/auth-signin.spec.ts
- [ ] T008 [P] [US1] Write test: "Authenticated user auto-redirected from /auth/signin" in tests/e2e/auth-signin.spec.ts
- [ ] T009 [US1] Run tests: `npm run test:e2e` - verify ALL tests FAIL (Red phase)

### Implementation for User Story 1

**Implementation Order**: Tests fail → Implement → Tests pass (TDD Green phase)

- [ ] T010 [US1] Verify existing GitHub OAuth configuration in lib/auth.ts (no changes needed per contracts/README.md)
- [ ] T011 [US1] Verify existing NextAuth.js signIn server action (no changes needed per contracts/README.md)
- [ ] T012 [US1] Update app/auth/signin/page.tsx: Maintain existing GitHub OAuth button (already functional per current implementation)
- [ ] T013 [US1] Run tests: `npm run test:e2e` - verify GitHub OAuth tests PASS (Green phase for US1)

**Checkpoint**: User Story 1 should be fully functional - GitHub OAuth flow works end-to-end

---

## Phase 4: User Story 2 - Visual Consistency with Site Theme (Priority: P2)

**Goal**: Sign-in page matches dark theme and visual design of rest of application

**Independent Test**: Visual inspection of /auth/signin against other pages (landing, dashboard) - verify colors, header, spacing match

### Tests for User Story 2 (TDD - Write FIRST, Verify FAIL)

- [ ] T014 [P] [US2] Write test: "Header visible on sign-in page" in tests/e2e/auth-signin.spec.ts
- [ ] T015 [P] [US2] Write test: "Dark theme background (#1e1e2e)" in tests/e2e/auth-signin.spec.ts
- [ ] T016 [P] [US2] Write test: "Card has violet border (#8B5CF6)" in tests/e2e/auth-signin.spec.ts
- [ ] T017 [P] [US2] Write test: "Responsive layout on mobile viewport" in tests/e2e/auth-signin.spec.ts
- [ ] T018 [US2] Run tests: `npm run test:e2e` - verify US2 tests FAIL (Red phase)

### Implementation for User Story 2

- [ ] T019 [P] [US2] Update app/auth/layout.tsx: Replace `bg-gray-50` with `bg-[#1e1e2e]` per research.md decision #4
- [ ] T020 [P] [US2] Update components/layout/header.tsx: Modify line 76-78 condition to `if (pathname?.startsWith('/auth') && pathname !== '/auth/signin')` per research.md decision #1
- [ ] T021 [US2] Update app/auth/signin/page.tsx: Add Card border `border-[#8B5CF6] border-2` per research.md decision #4
- [ ] T022 [US2] Update app/auth/signin/page.tsx: Make card responsive `w-full max-w-md` + add parent `px-4` per research.md decision #6
- [ ] T023 [US2] Update app/auth/signin/page.tsx: Use Catppuccin theme text colors `text-[hsl(var(--ctp-subtext-0))]` for CardDescription per research.md decision #4
- [ ] T024 [US2] Run tests: `npm run test:e2e` - verify US2 tests PASS (Green phase)

**Checkpoint**: User Stories 1 AND 2 should both work - GitHub OAuth functional + visual theme matches site

---

## Phase 5: User Story 3 - Multiple OAuth Provider Options Display (Priority: P3)

**Goal**: Users see three OAuth provider buttons (GitHub active, GitLab/BitBucket disabled with "Coming soon")

**Independent Test**: View /auth/signin and verify all three provider buttons present, GitHub enabled, GitLab/BitBucket disabled with explanatory text

### Tests for User Story 3 (TDD - Write FIRST, Verify FAIL)

- [ ] T025 [P] [US3] Write test: "Three OAuth provider buttons displayed" in tests/e2e/auth-signin.spec.ts
- [ ] T026 [P] [US3] Write test: "GitHub button enabled, GitLab/BitBucket disabled" in tests/e2e/auth-signin.spec.ts
- [ ] T027 [P] [US3] Write test: "Coming soon text for disabled providers" in tests/e2e/auth-signin.spec.ts
- [ ] T028 [P] [US3] Write test: "GitHub button has proper icon and spacing" in tests/e2e/auth-signin.spec.ts
- [ ] T029 [US3] Run tests: `npm run test:e2e` - verify US3 tests FAIL (Red phase)

### Implementation for User Story 3

- [ ] T030 [US3] Update app/auth/signin/page.tsx: Import `SiGitlab, SiBitbucket` from 'react-icons/si' per research.md decision #3
- [ ] T031 [US3] Update app/auth/signin/page.tsx: Wrap existing GitHub button in CardContent with `space-y-4` className
- [ ] T032 [US3] Update app/auth/signin/page.tsx: Add GitLab button with `variant="outline" disabled` + "Coming soon" text per research.md decision #2
- [ ] T033 [US3] Update app/auth/signin/page.tsx: Add BitBucket button with `variant="outline" disabled` + "Coming soon" text per research.md decision #2
- [ ] T034 [US3] Update app/auth/signin/page.tsx: Apply `opacity-50 cursor-not-allowed` to disabled buttons per research.md decision #2
- [ ] T035 [US3] Run tests: `npm run test:e2e` - verify ALL tests PASS (Green phase for all user stories)

**Checkpoint**: All user stories complete - Full sign-in page redesign functional with visual consistency and three OAuth providers

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T036 [P] Run TypeScript type check: `npm run type-check` - verify no type errors
- [ ] T037 [P] Run ESLint: `npm run lint` - verify no linting errors
- [ ] T038 [P] Run Prettier: `npm run format` - auto-fix formatting issues
- [ ] T039 Manual accessibility audit: Lighthouse on /auth/signin - verify WCAG 2.1 AA compliance (target ≥95 accessibility score)
- [ ] T040 [P] Manual cross-browser testing: Chrome, Firefox, Safari, Edge - verify visual consistency per quickstart.md checklist
- [ ] T041 [P] Manual mobile testing: iOS Safari, Chrome Android - verify responsive design and touch targets ≥44x44px per quickstart.md
- [ ] T042 Manual performance audit: Lighthouse on /auth/signin - verify <2s page load, LCP <2.5s per success criteria SC-002
- [ ] T043 Run full E2E test suite: `npm run test:e2e` - verify all tests pass
- [ ] T044 Validate against quickstart.md checklist: Visual consistency, OAuth providers, responsive design, accessibility
- [ ] T045 Code review self-check: Verify constitution compliance (TypeScript strict, shadcn/ui only, TDD followed, no security risks)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: N/A for this feature (no blocking infrastructure)
- **User Stories (Phase 3-5)**: All depend on Setup (Phase 1) completion
  - User stories CAN proceed in parallel (different files) but RECOMMENDED sequential in priority order for clarity
  - Each story has TDD workflow: Write tests → Verify fail → Implement → Verify pass
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 1 - No dependencies on other stories (GitHub OAuth already works, just verify tests)
- **User Story 2 (P2)**: Depends on Phase 1 - No dependencies on US1 (independent visual updates)
- **User Story 3 (P3)**: Depends on Phase 1 and T031 (CardContent wrapper) - Builds on US2 card structure

### Within Each User Story

**TDD Workflow (MANDATORY per constitution)**:
1. Write ALL tests for the story FIRST (marked [P] can be parallel)
2. Run tests - verify they FAIL (Red phase)
3. Implement code changes (sequential if dependencies, parallel if different files)
4. Run tests - verify they PASS (Green phase)
5. Refactor if needed while keeping tests green

### Parallel Opportunities

**Phase 1 (Setup)**:
- T001 (npm install) is sequential
- T002 (search tests) and T003 (verify dev env) can run in parallel AFTER T001

**User Story Tests** (within each story):
- All test creation tasks marked [P] can run in parallel (same file, different test blocks)
- Example US1: T005, T006, T007, T008 can all be written in parallel

**User Story Implementation** (within each story):
- Tasks marked [P] can run in parallel (different files, no shared state)
- Example US2: T019 (layout.tsx), T020 (header.tsx) can run in parallel
- T021-T023 are sequential (same file: app/auth/signin/page.tsx)

**Cross-Story Parallelization**:
- US1 and US2 can be worked on in parallel by different developers (different files)
- US3 depends on T031 from US2 but could start test writing in parallel

**Phase 6 (Polish)**:
- T036, T037, T038 (type-check, lint, format) can run in parallel
- T040, T041 (cross-browser, mobile testing) can run in parallel
- Manual audits (T039, T042, T044) are sequential (human validation)

---

## Parallel Example: User Story 2

```bash
# Write all tests for User Story 2 together:
Task: "Write test: Header visible on sign-in page in tests/e2e/auth-signin.spec.ts"
Task: "Write test: Dark theme background (#1e1e2e) in tests/e2e/auth-signin.spec.ts"
Task: "Write test: Card has violet border (#8B5CF6) in tests/e2e/auth-signin.spec.ts"
Task: "Write test: Responsive layout on mobile viewport in tests/e2e/auth-signin.spec.ts"

# Then run tests to verify FAIL (Red phase)

# Launch implementation for different files in parallel:
Task: "Update app/auth/layout.tsx: Replace bg-gray-50 with bg-[#1e1e2e]"
Task: "Update components/layout/header.tsx: Modify condition for /auth/signin"

# Sequential for same file (app/auth/signin/page.tsx):
Task: "Update app/auth/signin/page.tsx: Add Card border"
Task: "Update app/auth/signin/page.tsx: Make card responsive"
Task: "Update app/auth/signin/page.tsx: Use Catppuccin theme text colors"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependencies, search existing tests)
2. Complete Phase 3: User Story 1 (GitHub OAuth - already works, add E2E tests)
3. **STOP and VALIDATE**: Run E2E tests, verify GitHub OAuth flow works
4. Deploy/demo if ready (basic auth works, not yet visually polished)

**Rationale**: User Story 1 delivers core authentication functionality. Users can sign in even if page doesn't match theme yet.

### Incremental Delivery (RECOMMENDED)

1. Complete Phase 1: Setup → Dependencies installed
2. Complete Phase 3: User Story 1 → Test independently → Commit (MVP - auth works!)
3. Complete Phase 4: User Story 2 → Test independently → Commit (visual polish complete)
4. Complete Phase 5: User Story 3 → Test independently → Commit (full feature complete)
5. Complete Phase 6: Polish → Final validation → Commit

**Rationale**: Each user story adds incremental value without breaking previous stories. Can stop after any story for early demo/feedback.

### Parallel Team Strategy

With multiple developers (NOT RECOMMENDED for this small feature):

1. Developer A: Complete Phase 1 (Setup)
2. Once Phase 1 done, parallel work:
   - Developer A: User Story 1 (T004-T013)
   - Developer B: User Story 2 tests only (T014-T018)
3. Developer A finishes US1, then:
   - Developer A: User Story 2 implementation (T019-T024)
   - Developer B: User Story 3 tests (T025-T029)
4. Developer A finishes US2, then:
   - Developer A: User Story 3 implementation (T030-T035)
5. Both developers: Phase 6 Polish (different tasks in parallel)

**Rationale**: Minimal parallelization benefit due to small scope (3 files modified). Sequential execution by single developer is simpler and faster.

---

## Notes

- **[P] tasks**: Different files OR different test blocks, no sequential dependencies
- **[Story] label**: Maps task to specific user story for traceability and independent testing
- **TDD Mandatory**: Constitution requires tests BEFORE implementation (Red → Green → Refactor)
- **File Scope**: Only 3 files modified (page.tsx, layout.tsx, header.tsx) - minimal parallelization opportunity
- **Test Scope**: Single E2E test file (tests/e2e/auth-signin.spec.ts) - all tests in same file
- **Constitution Compliance**:
  - TypeScript strict mode (no `any` types)
  - shadcn/ui components only (Button, Card)
  - TDD workflow followed (tests first)
  - No security risks (NextAuth.js handles OAuth)
  - No database changes
- **Commit Strategy**: After each user story phase completes (T013, T024, T035) + final polish (T045)
- **Stop Points**: After any user story phase for validation, demo, or early feedback
- **Dependencies to Add**: react-icons (T001)
- **No New Dependencies**: NextAuth.js v5, shadcn/ui, lucide-react already installed

---

## Task Count Summary

**Total Tasks**: 45

**By Phase**:
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 0 tasks (N/A)
- Phase 3 (US1 - GitHub OAuth): 10 tasks (6 tests + 4 implementation)
- Phase 4 (US2 - Visual Consistency): 11 tasks (5 tests + 6 implementation)
- Phase 5 (US3 - Multiple Providers): 11 tasks (5 tests + 6 implementation)
- Phase 6 (Polish): 10 tasks

**By Type**:
- Setup: 3 tasks
- Tests (E2E): 16 tasks (constitution-mandated TDD)
- Implementation: 16 tasks (code changes)
- Validation: 10 tasks (type-check, lint, manual audits)

**Parallel Opportunities**:
- 24 tasks marked [P] can run in parallel within their context
- Realistic parallelization: 2-3 tasks max (limited by file scope)

**MVP Scope** (User Story 1 only):
- 13 tasks total (Setup + US1)
- Estimated time: 1-1.5 hours

**Full Feature Scope** (All user stories):
- 45 tasks total
- Estimated time: 2-3 hours (per quickstart.md)

**Independent Test Criteria**:
- **US1**: GitHub OAuth flow completes successfully, user lands on /projects
- **US2**: Visual inspection shows dark theme, violet border, header present, responsive layout
- **US3**: All three provider buttons visible, GitHub enabled, GitLab/BitBucket disabled with "Coming soon"
