# Tasks: Create Profile Settings Page

**Input**: Design documents from `/specs/AIB-465-create-profile-settings/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included per testing strategy defined in plan.md (integration + component tests).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project initialization needed — this feature adds to an existing Next.js application with all dependencies already installed.

_No setup tasks required._

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API endpoint that serves as the data source for the profile page UI. Must be complete before US1 page can fetch real data.

**CRITICAL**: US1 page implementation depends on this endpoint being available.

- [x] T001 Create GET /api/settings/profile endpoint with auth, Prisma query (User + Account + Subscription), and GitHub username resolution via GitHub API in `app/api/settings/profile/route.ts` per contract in `contracts/profile-api.md`

**Checkpoint**: API endpoint returns profile data for authenticated users. Can be tested independently via curl/HTTP client.

---

## Phase 3: User Story 1 - View Profile Information (Priority: P1) MVP

**Goal**: Authenticated users can view their account information (avatar, name, email, GitHub link, registration date, plan) on a dedicated `/settings/profile` page.

**Independent Test**: Navigate to `/settings/profile` after sign-in and verify all six profile fields are displayed correctly with proper formatting and fallbacks.

### Tests for User Story 1

- [x] T002 [P] [US1] Create integration test for GET /api/settings/profile endpoint (auth check, correct fields, missing subscription defaults to FREE, GitHub API failure graceful handling) in `tests/integration/settings/profile.test.ts`
- [x] T003 [P] [US1] Create component test for ProfileInfo (renders all fields, handles null name with email fallback, handles null avatar with initials fallback, plan badge with billing link) in `tests/unit/components/profile-info.test.tsx`

### Implementation for User Story 1

- [x] T004 [P] [US1] Create ProfileInfo display component with avatar (using shadcn Avatar + AvatarFallback), field rows (name, email, GitHub link, registration date), and plan badge with billing link in `components/settings/profile-info.tsx`
- [x] T005 [US1] Create profile settings page as client component with TanStack Query data fetching from `/api/settings/profile`, loading/error states, and aurora theme styling following billing page pattern in `app/settings/profile/page.tsx`

**Checkpoint**: Profile page is fully functional at `/settings/profile` with all six fields displayed. Can be tested independently.

---

## Phase 4: User Story 2 - Navigate to Profile from Settings Menu (Priority: P1)

**Goal**: "Profile" appears as the first item in settings navigation menus, making it easily discoverable.

**Independent Test**: Open user dropdown menu (desktop) and mobile menu — verify "Profile" appears first with User icon, linking to `/settings/profile`.

### Implementation for User Story 2

- [x] T006 [P] [US2] Add "Profile" as the first settings menu item (before Billing) with User icon from lucide-react and link to `/settings/profile` in `components/auth/user-menu.tsx`
- [x] T007 [P] [US2] Add "Profile" as the first settings link (before Billing) with User icon from lucide-react and link to `/settings/profile` in `components/layout/mobile-menu.tsx`

**Checkpoint**: Profile is accessible from both desktop and mobile navigation menus as the first settings item.

---

## Phase 5: User Story 3 - Responsive Profile Page (Priority: P2)

**Goal**: Profile page displays correctly on all viewports from 320px to 1920px without horizontal scrolling.

**Independent Test**: View `/settings/profile` on mobile viewport (<768px) — verify single-column layout, readable text, no horizontal scroll.

### Implementation for User Story 3

- [x] T008 [US3] Verify and adjust responsive layout in `components/settings/profile-info.tsx` and `app/settings/profile/page.tsx` — ensure single-column on mobile (<768px), effective space usage on desktop, consistent styling with other settings pages, WCAG AA contrast compliance

**Checkpoint**: Profile page is fully responsive across 320px–1920px viewports.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and quality checks across all user stories.

- [x] T009 Run quickstart.md validation scenarios against the completed implementation
- [x] T010 Verify all tests pass: `bun run test:unit tests/unit/components/profile-info.test.tsx` and `bun run test:integration tests/integration/settings/profile.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — existing project
- **Foundational (Phase 2)**: No dependencies — can start immediately (T001)
- **User Story 1 (Phase 3)**: T002–T003 (tests) can start in parallel with T001; T004 can start in parallel with T001; T005 depends on T001 + T004
- **User Story 2 (Phase 4)**: No dependency on Phase 2 or Phase 3 — T006 and T007 can start immediately in parallel
- **User Story 3 (Phase 5)**: Depends on T004 + T005 being complete (needs existing component/page to verify)
- **Polish (Phase 6)**: Depends on all prior phases being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (T001) for page data fetching
- **User Story 2 (P1)**: Independent — can start immediately (modifies different files)
- **User Story 3 (P2)**: Depends on US1 implementation (T004, T005) being complete

### Within Each User Story

- Tests can be written before or alongside implementation
- Component (T004) before page (T005)
- Page (T005) depends on both API (T001) and component (T004)

### Parallel Opportunities

- T002 + T003 + T004 can all run in parallel (different files, no deps)
- T006 + T007 can run in parallel (different files)
- T006 + T007 can run in parallel with T001 + T004 (independent user story)

---

## Parallel Example: User Story 1 + User Story 2

```bash
# These can all launch together after Phase 2 starts:
# US1 tests (can write against contract before API exists):
Task: T002 "Integration test for profile API in tests/integration/settings/profile.test.ts"
Task: T003 "Component test for ProfileInfo in tests/unit/components/profile-info.test.tsx"

# US1 component (no dependency on API):
Task: T004 "Create ProfileInfo component in components/settings/profile-info.tsx"

# US2 navigation (fully independent):
Task: T006 "Add Profile to user-menu in components/auth/user-menu.tsx"
Task: T007 "Add Profile to mobile-menu in components/layout/mobile-menu.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001 — API endpoint)
2. Complete Phase 3: User Story 1 (T002–T005 — component, page, tests)
3. **STOP and VALIDATE**: Test User Story 1 independently at `/settings/profile`
4. Deploy/demo if ready

### Incremental Delivery

1. T001 (API) + T004 (component) + T005 (page) -> Profile page functional (MVP!)
2. T006 + T007 -> Navigation discoverable
3. T008 -> Responsive verified
4. T002 + T003 + T009 + T010 -> Fully tested and validated

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Start T001 (API) and T006 + T007 (navigation) simultaneously
2. Once T001 is done, start T004 (component) then T005 (page)
3. T002 + T003 (tests) can be written alongside implementation
4. T008 (responsive) after US1 implementation completes
5. T009 + T010 (polish) after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No new dependencies or migrations required
- All data from existing User, Account, Subscription models (read-only)
- Follow billing page pattern for page structure and data fetching
- Use shadcn/ui components exclusively; Tailwind semantic tokens only (no hardcoded colors)
- Aurora theme styling for cards/dialogs per globals.css utilities
