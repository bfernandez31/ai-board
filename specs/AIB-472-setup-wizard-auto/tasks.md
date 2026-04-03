# Tasks: Setup Wizard — Auto-Detection + Questionnaire + File Commit

**Input**: Design documents from `/specs/AIB-472-setup-wizard-auto/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included — plan.md Phase 5 explicitly defines integration and component tests.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — types, dependencies, and shared utilities

- [ ] T001 Install `diff` npm package for file comparison in review step
- [ ] T002 Define all TypeScript interfaces and types in `lib/setup/types.ts` (DetectionResult, DetectedService, ExistingFile, SetupWizardState, StackSelection, ServiceSelection, CommandsSelection, AgentSelection, GeneratedFile, API request/response types)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core library modules that ALL user stories depend on — detection, generation, and commit logic

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement repo auto-detection logic in `lib/setup/detect.ts` — detectRepoStack() with parallel detectors via Promise.allSettled (detectLanguage, detectFramework, detectPackageManager, detectRuntimeVersion, detectServices, detectTestFrameworks, detectCommands, fetchExistingFiles)
- [ ] T004 [P] Implement file generators in `lib/setup/generate.ts` — generateConfigYaml() using js-yaml with validateConfig(), generateClaudeMd() markdown template, generateConstitutionMd() default template
- [ ] T005 [P] Implement atomic multi-file commit helper in `lib/setup/commit.ts` — commitSetupFiles() using GitHub Git Data API (getRef → getCommit → createTree → createCommit → updateRef) with error mapping (SHA_MISMATCH, INSUFFICIENT_PERMISSIONS, BRANCH_PROTECTED)

**Checkpoint**: Core logic ready — API routes and UI can now be built

---

## Phase 3: User Story 1 — Complete Setup Wizard Flow (Priority: P1) MVP

**Goal**: End-to-end setup wizard — user imports repo without config, completes 4-step wizard, files committed atomically, config synced to DB, redirected to board.

**Independent Test**: Import a repo without `.ai-board/config.yml`, complete the wizard, verify files appear in repo and config is stored in database.

### Implementation for User Story 1

- [ ] T006 [US1] Create detect API route in `app/api/projects/[projectId]/setup/detect/route.ts` — POST handler with requireAuth + verifyProjectAccess, createUserGitHubClient, fetch default branch, call detectRepoStack, return DetectResponse
- [ ] T007 [US1] Create commit API route in `app/api/projects/[projectId]/setup/commit/route.ts` — POST handler with requireAuth + verifyProjectAccess, Zod validation (files array, paths, content, defaultBranch), createUserGitHubClient, call commitSetupFiles, call syncProjectConfig on success, return CommitResponse
- [ ] T008 [US1] Create setup page server component in `app/projects/[projectId]/setup/page.tsx` — auth guard (redirect to login), fetch project, redirect to board if config exists, render SetupWizard
- [ ] T009 [US1] Create wizard container client component in `components/setup/setup-wizard.tsx` — useMutation for detection (runs on mount), useState for SetupWizardState, step navigation (next/back), pre-fill from detection results, loading/error states
- [ ] T010 [P] [US1] Create Step 1 Stack form in `components/setup/steps/stack-step.tsx` — Select for language (from config schema Language enum), Select for framework (filtered by language), Select for package manager, Input for runtime version
- [ ] T011 [P] [US1] Create Step 2 Services form in `components/setup/steps/services-step.tsx` — checkbox + version input per service type (PostgreSQL, MySQL, Redis, MongoDB), pre-filled from detection
- [ ] T012 [P] [US1] Create Step 3 Commands form in `components/setup/steps/commands-step.tsx` — text fields for install, build, lint, type_check, test_unit, test_integration, test_e2e, db_setup, db_seed; pre-filled from detected package.json scripts
- [ ] T013 [P] [US1] Create Step 4 Agent form in `components/setup/steps/agent-step.tsx` — radio group for CLI (claude-code/codex), Select for model (curated list from config schema), defaults: claude-code + claude-sonnet-4-6
- [ ] T014 [US1] Create review step in `components/setup/review-step.tsx` — generate file content from wizard state via generate.ts functions, display 3 FilePreview instances, "Commit to repository" button triggers commit mutation, loading state during commit
- [ ] T015 [US1] Create file preview component in `components/setup/file-preview.tsx` — file path header, monospace Textarea for content display, edit toggle (read-only by default), syntax-highlighted appearance
- [ ] T016 [US1] Implement post-commit redirect logic in `components/setup/setup-wizard.tsx` — success message, router.push to `/projects/{projectId}` after commit

**Checkpoint**: Complete wizard flow works end-to-end — user can detect, fill, preview, commit, and land on the board

---

## Phase 4: User Story 2 — Auto-Detection Accuracy (Priority: P2)

**Goal**: Detection correctly identifies language, framework, package manager, services, test frameworks, and commands for repos using supported stacks. Partial failures are graceful.

**Independent Test**: Run detection against repos with known stacks (Node/Express, Python/FastAPI, etc.) and verify output matches expectations.

### Implementation for User Story 2

- [ ] T017 [US2] Add Python detection support in `lib/setup/detect.ts` — detect pyproject.toml/requirements.txt/setup.py for framework (FastAPI, Django, Flask), poetry.lock/Pipfile.lock for package manager, pytest.ini for test framework
- [ ] T018 [P] [US2] Add Go/Rust/Java/Kotlin detection support in `lib/setup/detect.ts` — go.mod for Go deps, Cargo.toml for Rust deps, pom.xml (Maven) / build.gradle (Gradle) for Java/Kotlin
- [ ] T019 [US2] Add warning collection in `lib/setup/detect.ts` — collect warnings for rate limits, partial failures, and unsupported stack fallbacks; include in DetectResponse.warnings array

**Checkpoint**: Detection covers all supported languages with graceful degradation

---

## Phase 5: User Story 3 — File Preview and Inline Editing (Priority: P2)

**Goal**: User sees syntax-highlighted preview of all 3 generated files, can edit content inline, and edits are reflected in committed files.

**Independent Test**: Modify file content in preview, confirm commit, verify committed files match edited content.

### Implementation for User Story 3

- [ ] T020 [US3] Enhance file preview with inline editing in `components/setup/file-preview.tsx` — toggle between read-only and editable mode, propagate edited content up to review step via onChange callback
- [ ] T021 [US3] Wire edited content through commit flow in `components/setup/review-step.tsx` — track editedContent per file in local state, pass edited content (not generated) to commit API

**Checkpoint**: User can edit any file inline before committing; edits are preserved in the committed files

---

## Phase 6: User Story 4 — Existing Files Handling (Priority: P3)

**Goal**: When config files already exist in the repo, wizard shows diff between generated and existing versions. User can skip updating individual files.

**Independent Test**: Run wizard on repo with existing `.ai-board/config.yml`, verify diff is shown and skip option works.

### Implementation for User Story 4

- [ ] T022 [US4] Create file diff component in `components/setup/file-diff.tsx` — side-by-side or unified diff view using `diff` library, line-by-line comparison with add/remove highlighting (green/red semantic tokens)
- [ ] T023 [US4] Add skip toggle per file in `components/setup/file-preview.tsx` — "Skip this file" checkbox, defaults unchecked for new files; when existing file is unchanged, default to checked
- [ ] T024 [US4] Integrate diff view into review step in `components/setup/review-step.tsx` — if existing content present, show toggle between "Preview" and "Diff" views; pass existing content from detection to FilePreview
- [ ] T025 [US4] Handle skipped files in commit flow in `components/setup/review-step.tsx` and `app/api/projects/[projectId]/setup/commit/route.ts` — filter out skipped files before commit; handle case where all files skipped (no commit, redirect to board)

**Checkpoint**: Existing files show diff, user can skip individual files, partial commits work correctly

---

## Phase 7: User Story 5 — Error Handling for Commit Failures (Priority: P3)

**Goal**: Clear, actionable error messages for commit failures (permissions, branch protection, network). Form data and edits preserved for retry.

**Independent Test**: Simulate commit failure (token without write access), verify error message and retry behavior.

### Implementation for User Story 5

- [ ] T026 [US5] Add error message mapping in `lib/setup/commit.ts` — map GitHub API errors to user-friendly messages: 409 → SHA mismatch/concurrent edit, 403 → insufficient permissions with re-auth suggestion, 422 → branch protection with resolution steps
- [ ] T027 [US5] Add error display and retry in `components/setup/review-step.tsx` — show error Alert with actionable message, "Retry" button re-attempts commit, form data and edited content preserved in React state across retries
- [ ] T028 [US5] Add rate limit warning banner in `components/setup/setup-wizard.tsx` — if DetectResponse.warnings is non-empty, show warning banner informing user some detections may be incomplete

**Checkpoint**: All error paths show clear messages, user can retry without losing data

---

## Phase 8: Testing

**Purpose**: Integration tests for APIs, component tests for wizard UI

### Integration Tests

- [ ] T029 [P] Write integration tests for detect API in `tests/integration/setup/detect.test.ts` — test scenarios: successful detection with full results, partial detection (some API calls fail gracefully), 401 without session, 403 for non-member, GitHub API error handling (502)
- [ ] T030 [P] Write integration tests for commit API in `tests/integration/setup/commit.test.ts` — test scenarios: successful atomic commit of 3 files, commit with skipped files, validation errors (empty content, invalid paths), auth/access checks, config sync after commit

### Component Tests

- [ ] T031 [P] Write component tests for wizard steps in `tests/unit/components/setup/setup-wizard.test.tsx` — test scenarios: wizard renders with detection results pre-filled, step navigation (next/back), form validation per step, review step shows generated files, commit button triggers mutation
- [ ] T032 [P] Write component tests for file preview in `tests/unit/components/setup/file-preview.test.tsx` — test scenarios: renders generated content, inline editing updates content, diff view for existing files, skip toggle behavior

**Checkpoint**: ~15 integration tests + ~12 component tests covering all user stories

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T033 [P] Add loading skeleton for detection phase in `components/setup/setup-wizard.tsx` — shimmer UI while GitHub API detection runs
- [ ] T034 [P] Validate generated config.yml via validateConfig() before displaying in review step in `components/setup/review-step.tsx`
- [ ] T035 Run type-check and lint across all new files; fix any errors
- [ ] T036 Run quickstart.md validation — verify all key files exist and wizard flow works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T002 types) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — core end-to-end flow
- **US2 (Phase 4)**: Depends on Phase 2 (T003 detect.ts) — extends detection logic
- **US3 (Phase 5)**: Depends on Phase 3 (T015 file-preview.tsx) — enhances review UI
- **US4 (Phase 6)**: Depends on Phase 3 (T014, T015) — adds diff/skip to review
- **US5 (Phase 7)**: Depends on Phase 3 (T007, T014) — adds error handling to commit flow
- **Testing (Phase 8)**: Depends on Phases 3-7 — tests completed features
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — no other story dependencies
- **US2 (P2)**: Independent of US1 UI — only depends on detection logic (Phase 2)
- **US3 (P2)**: Depends on US1 (file-preview.tsx must exist to enhance)
- **US4 (P3)**: Depends on US1 (review-step.tsx must exist to add diff/skip)
- **US5 (P3)**: Depends on US1 (commit flow must exist to add error handling)

### Within Each User Story

- Models/types before services
- Library logic before API routes
- API routes before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004, T005 can run in parallel (different files in lib/setup/)
- T010, T011, T012, T013 can run in parallel (different step components)
- T017, T018 can run in parallel (different language detectors)
- T029, T030, T031, T032 can run in parallel (different test files)
- US2 can run in parallel with US3 (no shared files)

---

## Parallel Example: User Story 1

```bash
# After foundational phase, launch API routes in parallel:
Task T006: "Create detect API route in app/api/projects/[projectId]/setup/detect/route.ts"
Task T007: "Create commit API route in app/api/projects/[projectId]/setup/commit/route.ts"

# Launch all 4 step components in parallel:
Task T010: "Create Step 1 Stack form in components/setup/steps/stack-step.tsx"
Task T011: "Create Step 2 Services form in components/setup/steps/services-step.tsx"
Task T012: "Create Step 3 Commands form in components/setup/steps/commands-step.tsx"
Task T013: "Create Step 4 Agent form in components/setup/steps/agent-step.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + dependency)
2. Complete Phase 2: Foundational (detect + generate + commit libs)
3. Complete Phase 3: User Story 1 (APIs + page + wizard + steps + review + redirect)
4. **STOP and VALIDATE**: Test the full wizard flow end-to-end
5. Deploy/demo if ready — users can complete setup with basic preview

### Incremental Delivery

1. Setup + Foundational → Core logic ready
2. Add US1 → Test independently → Deploy (MVP — full wizard works!)
3. Add US2 → Enhanced detection accuracy for more stacks
4. Add US3 → Inline editing in file preview
5. Add US4 → Diff view + skip for existing files
6. Add US5 → Polished error handling and retry
7. Testing + Polish → Production-ready

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - **Parallel track A**: US1 (complete wizard flow)
   - **Parallel track B**: US2 (detection enhancements — no UI dependency)
3. Once US1 is done:
   - **Parallel track C**: US3 (file preview editing)
   - **Parallel track D**: US4 (existing file diff/skip)
   - **Parallel track E**: US5 (error handling)
4. Testing phase can start as each story completes

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database schema changes — reuses existing `config`/`configSyncedAt` fields
- All enums reused from `lib/validations/config.ts`
- Config sync via existing `syncProjectConfig()` after commit
- Auth via existing `requireAuth()` + `verifyProjectAccess()`
- GitHub client via existing `createUserGitHubClient()`
