# Tasks: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Input**: Design documents from `/specs/AIB-471-project-import-oauth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Included — plan.md defines a Testing Strategy with specific test files per user story.

**Organization**: Tasks grouped by user story. US1 contains the bulk of implementation; US2–US5 add incremental tests for specific scenarios.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: OAuth scope upgrade and server-side helpers that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 Update GitHub OAuth scope from `read:user user:email` to `read:user user:email repo` in lib/auth.ts
- [x] T002 [P] Create lib/github/user-client.ts with `getGitHubAccessToken`, `hasRepoScope`, `createUserGitHubClient`, and `requireRepoScope` functions
- [x] T003 [P] Add optional `accessToken?: string` parameter to `syncProjectConfig()` in lib/config-sync.ts to enable user-token config fetch

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 1 — Import a Repository with Existing Config (Priority: P1) 🎯 MVP

**Goal**: Users can click "Import Project", browse repos, select one with `.ai-board/config.yml`, and land on the project board with config auto-loaded.

**Independent Test**: Import a repo with valid `.ai-board/config.yml` → project appears on dashboard with config loaded, user redirected to `/projects/{id}`.

### Tests for User Story 1

- [x] T004 [P] [US1] Unit tests for getGitHubAccessToken, hasRepoScope, createUserGitHubClient in tests/unit/lib/github/user-client.test.ts
- [x] T005 [P] [US1] Unit tests for import request Zod validation schema in tests/unit/lib/validations/import-project.test.ts

### Implementation for User Story 1

- [x] T006 [P] [US1] Create GET /api/github/auth-status endpoint — check Account exists + scope includes repo — in app/api/github/auth-status/route.ts
- [x] T007 [P] [US1] Create GET /api/github/orgs endpoint — list user orgs via octokit.orgs.listForAuthenticatedUser — in app/api/github/orgs/route.ts
- [x] T008 [US1] Create GET /api/github/repos endpoint — repo listing with pagination, search (GitHub Search API), org filter, sort, isAlreadyImported/hasAdminAccess flags — in app/api/github/repos/route.ts
- [x] T009 [US1] Create POST /api/projects/import endpoint — Zod validation, admin rights check, quota enforcement, serializable transaction, config sync, redirect logic — in app/api/projects/import/route.ts
- [x] T010 [P] [US1] Create ReauthPrompt component — aurora-styled card with explanation and signIn("github") button — in components/projects/reauth-prompt.tsx
- [x] T011 [P] [US1] Create RepoPickerItem component — repo row with name, description, visibility badge, push date, owner avatar, disabled states — in components/projects/repo-picker-item.tsx
- [x] T012 [US1] Create RepoPicker component — debounced search, org filter dropdown, pagination, loading/empty/error states, TanStack Query — in components/projects/repo-picker.tsx
- [x] T013 [US1] Create ImportProjectModal component — auth check → reauth or picker → confirm with optional name/description edit → POST import → redirect — in components/projects/import-project-modal.tsx
- [x] T014 [US1] Enable Import Project button and wire ImportProjectModal in components/projects/empty-projects-state.tsx and app/projects/page.tsx

### Integration Tests for User Story 1

- [ ] T015 [P] [US1] Integration test: POST /api/projects/import creates project with config sync, returns redirectTo /projects/{id} in tests/integration/projects/import.test.ts
- [ ] T016 [P] [US1] Integration test: POST /api/projects/import 403 when user lacks admin access in tests/integration/projects/import.test.ts
- [ ] T017 [P] [US1] Integration test: POST /api/projects/import 403 when subscription quota exceeded in tests/integration/projects/import.test.ts
- [ ] T018 [P] [US1] Integration test: GET /api/github/repos returns paginated repos with isAlreadyImported flags in tests/integration/github/repos.test.ts

### Component Tests for User Story 1

- [ ] T019 [P] [US1] Component test: RepoPickerItem shows repo details and disabled when no admin access in tests/unit/components/projects/repo-picker-item.test.tsx
- [ ] T020 [P] [US1] Component test: ImportProjectModal shows picker when user has repo scope in tests/unit/components/projects/import-project-modal.test.tsx

**Checkpoint**: Core import flow fully functional — user can import a repo with config and see it on the dashboard

---

## Phase 3: User Story 2 — Import a Repository Without Config (Priority: P1)

**Goal**: Users can import a repo lacking `.ai-board/config.yml` and get redirected to the setup wizard.

**Independent Test**: Import a repo without config → project created, user redirected to `/projects/{id}/setup`.

- [ ] T021 [US2] Integration test: POST /api/projects/import without config returns redirectTo /projects/{id}/setup in tests/integration/projects/import.test.ts

**Checkpoint**: Both import paths (with and without config) are fully tested

---

## Phase 4: User Story 3 — OAuth Scope Upgrade for Existing Users (Priority: P2)

**Goal**: Existing users whose GitHub token lacks `repo` scope see a clear re-authorization prompt and can upgrade seamlessly.

**Independent Test**: Simulate user session with token lacking `repo` scope → re-auth prompt appears with explanation and authorize button.

### Tests for User Story 3

- [ ] T022 [P] [US3] Integration test: GET /api/github/auth-status returns hasRepoScope: false for token without repo scope in tests/integration/github/auth-status.test.ts
- [ ] T023 [P] [US3] Integration test: GET /api/github/repos returns 403 MISSING_SCOPE when token lacks repo scope in tests/integration/github/repos.test.ts
- [ ] T024 [P] [US3] Component test: ReauthPrompt renders scope explanation and re-authorize button in tests/unit/components/projects/reauth-prompt.test.tsx
- [ ] T025 [US3] Component test: ImportProjectModal shows ReauthPrompt when hasRepoScope is false in tests/unit/components/projects/import-project-modal.test.tsx

**Checkpoint**: Scope upgrade flow verified — existing users can re-authorize and proceed to import

---

## Phase 5: User Story 4 — Duplicate Repo Import Prevention (Priority: P2)

**Goal**: System blocks import of already-linked repos and clearly identifies the existing project.

**Independent Test**: Attempt to import a repo already linked to a project → 409 error with existing project info; picker shows repo as already imported.

- [ ] T026 [P] [US4] Integration test: POST /api/projects/import returns 409 with existingProjectId on duplicate githubOwner+githubRepo in tests/integration/projects/import.test.ts
- [ ] T027 [US4] Component test: RepoPickerItem renders disabled state with tooltip when isAlreadyImported is true in tests/unit/components/projects/repo-picker-item.test.tsx

**Checkpoint**: Duplicate prevention verified at both API and UI levels

---

## Phase 6: User Story 5 — Repo Picker Filtering and Pagination (Priority: P3)

**Goal**: Users with many repos can efficiently find repos via search, org filter, and pagination.

**Independent Test**: Load picker for user with repos across multiple orgs → search filters by name, org dropdown filters by org, pagination loads additional pages.

- [ ] T028 [P] [US5] Integration test: GET /api/github/repos with q param uses GitHub Search API and returns filtered results in tests/integration/github/repos.test.ts
- [ ] T029 [P] [US5] Integration test: GET /api/github/repos with org param filters to organization repos in tests/integration/github/repos.test.ts
- [ ] T030 [US5] Component test: RepoPicker search input filters results and org dropdown filters by org in tests/unit/components/projects/repo-picker.test.tsx

**Checkpoint**: All filtering, search, and pagination scenarios verified

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [ ] T031 Run `bun run type-check` and `bun run lint` across all new and modified files
- [ ] T032 Run quickstart.md validation steps (type-check, lint, unit tests, integration tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 (Phase 2)**: Depends on Foundational completion. Contains all core implementation.
- **US2 (Phase 3)**: Depends on US1 completion (shares import endpoint).
- **US3 (Phase 4)**: Can start after US1 (reauth prompt + auth-status built in US1).
- **US4 (Phase 5)**: Can start after US1 (duplicate detection built in US1).
- **US5 (Phase 6)**: Can start after US1 (search/filter/pagination built in US1).
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependencies on other stories. **This is the MVP.**
- **US2 (P1)**: After US1 — tests the no-config path already implemented in US1's import endpoint.
- **US3 (P2)**: After US1 — tests the reauth flow already implemented in US1's modal and auth-status endpoint.
- **US4 (P2)**: After US1 — tests the duplicate detection already implemented in US1's repos + import endpoints.
- **US5 (P3)**: After US1 — tests the search/filter/pagination already implemented in US1's repos endpoint and picker.

### Within User Story 1 (Core Implementation)

1. Unit tests (T004, T005) can run in parallel
2. API endpoints: auth-status (T006) and orgs (T007) in parallel → repos (T008) → import (T009)
3. UI components: reauth-prompt (T010) and repo-picker-item (T011) in parallel → repo-picker (T012) → import-modal (T013) → wire button (T014)
4. Integration tests (T015–T018) and component tests (T019–T020) can all run in parallel after implementation

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel (different files)
- **Phase 2**: T004+T005 parallel; T006+T007 parallel; T010+T011 parallel; all integration/component tests parallel
- **Phases 3–6**: US2, US3, US4, US5 test phases can run in parallel after US1 completes

---

## Parallel Example: User Story 1

```
# Parallel batch 1 (unit tests + independent endpoints + independent components):
Task T004: Unit tests for user-client in tests/unit/lib/github/user-client.test.ts
Task T005: Unit tests for import validation in tests/unit/lib/validations/import-project.test.ts
Task T006: GET /api/github/auth-status/route.ts
Task T007: GET /api/github/orgs/route.ts
Task T010: ReauthPrompt in components/projects/reauth-prompt.tsx
Task T011: RepoPickerItem in components/projects/repo-picker-item.tsx

# Sequential batch 2 (depends on batch 1):
Task T008: GET /api/github/repos/route.ts
Task T012: RepoPicker in components/projects/repo-picker.tsx

# Sequential batch 3 (depends on batch 2):
Task T009: POST /api/projects/import/route.ts
Task T013: ImportProjectModal in components/projects/import-project-modal.tsx

# Sequential batch 4 (depends on batch 3):
Task T014: Wire Import button in empty-projects-state.tsx and projects/page.tsx

# Parallel batch 5 (all tests after implementation):
Tasks T015–T020: All integration and component tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (OAuth scope + helpers)
2. Complete Phase 2: User Story 1 (all APIs + all UI + tests)
3. **STOP and VALIDATE**: Import a repo with config → verify project created + config loaded + redirect works
4. Deploy/demo if ready

### Incremental Delivery

1. Foundational → Foundation ready
2. US1 → Full import flow works → **MVP!**
3. US2 → No-config path verified
4. US3 → Existing user re-auth verified
5. US4 → Duplicate prevention verified
6. US5 → Search/filter/pagination verified
7. Polish → Type-check, lint, full test suite

### Key Architecture Notes

- **No schema migration** — Project and Account models already have all required fields
- **No new dependencies** — Octokit, NextAuth, Zod, TanStack Query, shadcn/ui Dialog all already installed
- **Existing patterns reused** — Quota enforcement from POST /api/projects, config sync from lib/config-sync.ts, key generation from existing project creation
- **User token vs server token** — New `createUserGitHubClient()` uses user's OAuth token (not `GITHUB_TOKEN`) to access private/org repos
