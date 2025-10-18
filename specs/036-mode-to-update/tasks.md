# Tasks: Documentation Edit Mode

**Input**: Design documents from `/specs/036-mode-to-update/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: E2E tests are included and must be written BEFORE implementation per TDD requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Web app structure: `app/`, `components/`, `tests/`
- All paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment for git operations

- [X] T001 Install remark dependencies: `npm install remark@^15.0.1 remark-parse@^11.0.0`
- [X] T002 Create GitHub personal access token with 'repo' scope and add to `.env.local` as `GITHUB_TOKEN`
- [X] T003 [P] Create directory `app/lib/git/` for git operation modules
- [X] T004 [P] Create directory `app/lib/hooks/mutations/` for TanStack Query mutations (if not exists)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core git operations, validation, and schema infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Create Zod validation schema in `app/lib/schemas/documentation.ts` (editDocumentationSchema with ticketId, docType enum, content max 1MB, optional commitMessage)
- [X] T006 [P] Create markdown validation function in `app/lib/git/validate.ts` using remark (validateMarkdown returns {valid, error?})
- [X] T007 Create git operations module in `app/lib/git/operations.ts` with commitAndPush function using @octokit/rest GitHub API
- [X] T008 [P] Create permission guard utility in `components/ticket/edit-permission-guard.tsx` (canEdit function checking stage vs docType)
- [X] T009 Update query keys in `app/lib/query-keys.ts` to include documentation cache keys (queryKeys.documentation(projectId, ticketId, docType))

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Edit Specification in SPECIFY Stage (Priority: P1) 🎯 MVP

**Goal**: Allow users to edit spec.md file when ticket is in SPECIFY stage with auto-commit and push to feature branch

**Independent Test**: Open ticket in SPECIFY stage, click Edit on spec.md viewer, modify markdown content, save, verify commit appears on feature branch and updated content displays in viewer

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] E2E test for edit mode toggle in `tests/e2e/documentation-editor.spec.ts` (verify Edit button appears for spec.md in SPECIFY stage)
- [X] T011 [P] [US1] E2E test for save success in `tests/e2e/documentation-editor.spec.ts` (modify content, save, verify updated content displays)
- [X] T012 [P] [US1] E2E test for cancel operation in `tests/e2e/documentation-editor.spec.ts` (modify content, cancel, verify original content remains)
- [X] T013 [P] [US1] E2E test for permission denial in `tests/e2e/documentation-editor.spec.ts` (verify Edit button hidden for spec.md when ticket NOT in SPECIFY stage)
- [X] T014 [P] [US1] API contract test in `tests/api/documentation-edit.spec.ts` (POST /api/projects/:id/docs returns 200 with valid request for spec.md)
- [X] T015 [P] [US1] API contract test for 403 permission error in `tests/api/documentation-edit.spec.ts` (wrong stage returns PERMISSION_DENIED)

### Implementation for User Story 1

- [X] T016 Create POST API route in `app/api/projects/[projectId]/docs/route.ts` with authentication, validation, permission checks, markdown validation, and git commit/push using @octokit/rest
- [X] T017 [US1] Create TanStack Query mutation hook in `app/lib/hooks/mutations/useEditDocumentation.ts` with optimistic updates, error rollback, and cache invalidation
- [X] T018 [US1] Create DocumentationEditor component in `components/ticket/documentation-editor.tsx` with textarea, save/cancel buttons, dirty state tracking, beforeunload warning
- [X] T019 [US1] Update DocumentationViewer component in `components/ticket/documentation-viewer.tsx` to add Edit button (conditionally shown based on canEdit permission) and toggle between viewer/editor modes
- [X] T020 [US1] Add error handling and user feedback (toast notifications) for save success/failure in DocumentationEditor component
- [X] T021 [US1] Add unsaved changes confirmation dialog when closing modal with dirty content in DocumentationEditor component

**Checkpoint**: At this point, User Story 1 should be fully functional - users can edit spec.md in SPECIFY stage with git commits

---

## Phase 4: User Story 2 - Edit Plan and Tasks in PLAN Stage (Priority: P2)

**Goal**: Allow users to edit plan.md and tasks.md files when ticket is in PLAN stage

**Independent Test**: Open ticket in PLAN stage, click Edit on plan.md viewer, modify content, save, verify commit to branch; repeat for tasks.md

### Tests for User Story 2

- [ ] T022 [P] [US2] E2E test for editing plan.md in PLAN stage in `tests/e2e/documentation-editor.spec.ts` (verify Edit button appears, save works)
- [ ] T023 [P] [US2] E2E test for editing tasks.md in PLAN stage in `tests/e2e/documentation-editor.spec.ts` (verify Edit button appears, save works)
- [ ] T024 [P] [US2] E2E test for permission denial in `tests/e2e/documentation-editor.spec.ts` (verify Edit button hidden for plan/tasks when ticket in SPECIFY stage)
- [ ] T025 [P] [US2] API contract test for plan.md edit in `tests/api/documentation-edit.spec.ts` (POST with docType=plan in PLAN stage returns 200)
- [ ] T026 [P] [US2] API contract test for tasks.md edit in `tests/api/documentation-edit.spec.ts` (POST with docType=tasks in PLAN stage returns 200)

### Implementation for User Story 2

- [ ] T027 [US2] Verify API route `app/api/projects/[projectId]/docs/route.ts` handles plan and tasks docTypes (should already work from US1, add explicit tests if needed)
- [ ] T028 [US2] Update edit permission guard in `components/ticket/edit-permission-guard.tsx` to allow plan and tasks editing in PLAN stage
- [ ] T029 [US2] Add Edit buttons for plan.md and tasks.md sections in DocumentationViewer component (conditionally shown for PLAN stage)
- [ ] T030 [US2] Test integration: verify editing plan.md and tasks.md works end-to-end with git commits

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can edit all doc types based on stage

---

## Phase 5: User Story 3 - View Commit History and Change Tracking (Priority: P3)

**Goal**: Display commit history for documentation files with timestamps, authors, and ability to view diffs

**Independent Test**: Make several edits to spec.md, click "View History" button, verify commit list displays with correct authors and timestamps, click a commit to view diff

### Tests for User Story 3

- [ ] T031 [P] [US3] E2E test for commit history display in `tests/e2e/documentation-viewer.spec.ts` (verify "View History" button appears, commit list shows)
- [ ] T032 [P] [US3] E2E test for diff viewing in `tests/e2e/documentation-viewer.spec.ts` (click commit, verify diff displays)
- [ ] T033 [P] [US3] E2E test for multi-user attribution in `tests/e2e/documentation-viewer.spec.ts` (verify different authors shown correctly)
- [ ] T034 [P] [US3] API contract test for GET /api/projects/:id/docs/history in `tests/api/documentation-history.spec.ts` (returns commit list with sha, author, timestamp)

### Implementation for User Story 3

- [ ] T035 [P] [US3] Create GET API route in `app/api/projects/[projectId]/docs/history/route.ts` to fetch commit history using @octokit/rest (octokit.repos.listCommits with path filter)
- [ ] T036 [P] [US3] Create TanStack Query hook in `app/lib/hooks/queries/useDocumentationHistory.ts` for fetching commit history
- [ ] T037 [US3] Create CommitHistoryViewer component in `components/ticket/commit-history-viewer.tsx` with commit list display (timestamps, authors, messages)
- [ ] T038 [US3] Create DiffViewer component in `components/ticket/diff-viewer.tsx` to display commit diffs using GitHub API compare endpoint
- [ ] T039 [US3] Add "View History" button to DocumentationViewer component with modal/drawer to show CommitHistoryViewer
- [ ] T040 [US3] Integrate DiffViewer to show when user clicks on a commit in the history list

**Checkpoint**: All user stories should now be independently functional - full edit and history viewing capabilities

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and finalization

- [ ] T041 [P] Add loading indicators for all async operations (save, fetch history, fetch diff) in UI components
- [ ] T042 [P] Add comprehensive error messages for all error scenarios (BRANCH_NOT_FOUND, MERGE_CONFLICT, NETWORK_ERROR, TIMEOUT, VALIDATION_ERROR, PERMISSION_DENIED)
- [ ] T043 [P] Implement rate limiting middleware (10 requests/minute per user) for POST /api/projects/:id/docs endpoint
- [ ] T044 [P] Add telemetry/logging for git operations (commit success/failure, push duration, error types) in git/operations.ts
- [ ] T045 Validate all E2E tests pass with TEST_MODE environment variable
- [ ] T046 Manual testing: Test save operation with network failure simulation (verify error handling)
- [ ] T047 Manual testing: Test concurrent edits scenario (two users editing same file, verify 409 MERGE_CONFLICT response)
- [ ] T048 [P] Code cleanup: Remove console.logs, add TypeScript strict mode compliance checks
- [ ] T049 [P] Documentation: Update CLAUDE.md with new feature details (edit mode, git operations, API endpoints)
- [ ] T050 Run quickstart.md validation (execute all quickstart steps to verify accuracy)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses infrastructure from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Separate feature (history viewing), independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD requirement)
- API routes before frontend hooks
- Hooks before UI components
- Core components before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# All setup tasks can run in parallel:
Task T003: "Create directory app/lib/git/"
Task T004: "Create directory app/lib/hooks/mutations/"
```

**Phase 2 (Foundational)**:
```bash
# Independent foundational modules can run in parallel:
Task T005: "Create Zod schema in app/lib/schemas/documentation.ts"
Task T006: "Create markdown validation in app/lib/git/validate.ts"
Task T008: "Create permission guard in components/ticket/edit-permission-guard.tsx"
Task T009: "Update query keys in app/lib/query-keys.ts"
# T007 (git operations) should complete before tests run
```

**User Story 1 Tests** (all [P] marked tests can run together):
```bash
Task T010: "E2E test for edit mode toggle"
Task T011: "E2E test for save success"
Task T012: "E2E test for cancel operation"
Task T013: "E2E test for permission denial"
Task T014: "API contract test for valid request"
Task T015: "API contract test for 403 error"
```

**User Story 2 Tests** (all can run in parallel):
```bash
Task T022: "E2E test for editing plan.md"
Task T023: "E2E test for editing tasks.md"
Task T024: "E2E test for permission denial"
Task T025: "API contract test for plan.md edit"
Task T026: "API contract test for tasks.md edit"
```

**User Story 3 Tests** (all can run in parallel):
```bash
Task T031: "E2E test for commit history display"
Task T032: "E2E test for diff viewing"
Task T033: "E2E test for multi-user attribution"
Task T034: "API contract test for GET history endpoint"
```

**User Story 3 Implementation** (parallel tasks):
```bash
Task T035: "Create GET history API route"
Task T036: "Create useDocumentationHistory hook"
# T037, T038 can run in parallel after T036
```

**Polish Phase** (many parallel opportunities):
```bash
Task T041: "Add loading indicators"
Task T042: "Add error messages"
Task T043: "Implement rate limiting"
Task T044: "Add telemetry/logging"
Task T048: "Code cleanup"
Task T049: "Documentation updates"
```

**Different User Stories** (can be worked in parallel by different developers):
- Developer A: User Story 1
- Developer B: User Story 2
- Developer C: User Story 3

---

## Parallel Example: User Story 1

```bash
# Step 1: Launch all tests together (write tests FIRST, verify they FAIL):
parallel_launch(
  "E2E test for edit mode toggle in tests/e2e/documentation-editor.spec.ts",
  "E2E test for save success in tests/e2e/documentation-editor.spec.ts",
  "E2E test for cancel operation in tests/e2e/documentation-editor.spec.ts",
  "E2E test for permission denial in tests/e2e/documentation-editor.spec.ts",
  "API contract test - valid request in tests/api/documentation-edit.spec.ts",
  "API contract test - 403 error in tests/api/documentation-edit.spec.ts"
)

# Step 2: Implement API route (T016) - SEQUENTIAL

# Step 3: Implement frontend in parallel (after API is ready):
parallel_launch(
  "Create TanStack Query mutation hook in app/lib/hooks/mutations/useEditDocumentation.ts",
  "Create DocumentationEditor component in components/ticket/documentation-editor.tsx"
)

# Step 4: Integration and polish - SEQUENTIAL
# T019: Update DocumentationViewer
# T020: Add error handling
# T021: Add unsaved changes dialog
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependencies, environment config)
2. Complete Phase 2: Foundational (git operations, validation, schemas) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (edit spec.md in SPECIFY stage)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Open ticket in SPECIFY stage
   - Edit spec.md content
   - Save and verify commit appears on branch
   - Cancel and verify no changes committed
   - Test in PLAN stage - verify Edit button hidden
5. Deploy/demo if ready (MVP delivers core editing capability!)

### Incremental Delivery

1. **Setup + Foundational (Phases 1-2)** → Foundation ready ✅
2. **Add User Story 1 (Phase 3)** → Test independently → Deploy/Demo (MVP - spec editing works!) 🎯
3. **Add User Story 2 (Phase 4)** → Test independently → Deploy/Demo (plan/tasks editing now available!)
4. **Add User Story 3 (Phase 5)** → Test independently → Deploy/Demo (full audit trail capability!)
5. **Polish (Phase 6)** → Final production-ready release
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (Phases 1-2)
2. **Once Foundational is done**, split work:
   - **Developer A**: User Story 1 (T010-T021) - Core editing for spec.md
   - **Developer B**: User Story 2 (T022-T030) - Editing for plan/tasks (depends on US1 API but separate UI)
   - **Developer C**: User Story 3 (T031-T040) - Commit history feature (completely independent)
3. Stories complete and integrate independently
4. **Team reunites** for Polish phase (Phase 6)

---

## Notes

- **[P] tasks**: Different files, no dependencies, safe to parallelize
- **[Story] label**: Maps task to specific user story for traceability
- **Independent Testing**: Each user story should be completable and testable without others
- **TDD Required**: All E2E and API contract tests MUST be written first and verified to FAIL before implementation
- **Commit Strategy**: Commit after each task or logical group (e.g., after completing all tests for a story)
- **Checkpoints**: Stop at any checkpoint to validate story independently before proceeding
- **Git Operations**: Use @octokit/rest GitHub API (not local git commands) for serverless compatibility
- **Error Handling**: Implement comprehensive error handling for all failure scenarios (see contracts/api-contract.md)
- **Validation**: Markdown validation with remark, request validation with Zod, permission validation with stage checks
- **Performance**: Target <2s for git operations, <100ms for edit mode toggle
- **Security**: Session-based auth, project ownership validation, stage-based permissions, input sanitization
- **Avoid**: Vague tasks, same file conflicts, cross-story dependencies that break independence
