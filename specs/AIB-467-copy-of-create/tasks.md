# Tasks: Profile Settings Page (AIB-467)

**Input**: Design documents from `/specs/AIB-467-copy-of-create/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Included — plan.md explicitly defines integration, component, and navigation tests.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies or schema changes required. This phase creates the API endpoint that all user stories depend on.

- [ ] T001 Create GET endpoint with auth, Prisma query (User + Account + Subscription), GitHub API username resolution, and ProfileResponse shape in `app/api/settings/profile/route.ts`

**Checkpoint**: API endpoint is functional and returns profile data for authenticated users.

---

## Phase 2: User Story 1 — View Profile Information (Priority: P1) — MVP

**Goal**: Authenticated users can view all profile fields (avatar, name, email, GitHub link, registration date, plan) on a single read-only page at `/settings/profile`.

**Independent Test**: Navigate to `/settings/profile` as an authenticated user and verify all six profile fields display correctly, including fallbacks for missing data.

### Tests for User Story 1

- [ ] T002 [P] [US1] Integration tests for profile API (full profile, FREE default, GitHub API failure, 401 unauth, name fallback) in `tests/integration/settings/profile-api.test.ts`
- [ ] T003 [P] [US1] Component tests for profile page (all fields rendered, initials fallback, null email, loading skeleton, GitHub link href, plan billing link) in `tests/unit/components/settings/profile-page.test.tsx`

### Implementation for User Story 1

- [ ] T004 [US1] Create profile settings page component with React Query data fetching, loading skeleton, aurora theme styling, avatar with initials fallback, and all six profile fields in `app/settings/profile/page.tsx`

**Checkpoint**: User Story 1 is fully functional — users can visit `/settings/profile` and see all account information with graceful fallbacks.

---

## Phase 3: User Story 2 — Navigate to Profile from Settings Menu (Priority: P2)

**Goal**: "Profile" appears as the first item in settings navigation on both mobile and desktop menus, linking to `/settings/profile`.

**Independent Test**: Open the user menu (desktop) and mobile menu and verify "Profile" is the first settings item, above Billing/Tokens/Credentials.

### Tests for User Story 2

- [ ] T005 [P] [US2] Navigation tests verifying Profile is first settings item in both UserMenu and MobileMenu in `tests/unit/components/navigation-profile-link.test.tsx`

### Implementation for User Story 2

- [ ] T006 [P] [US2] Add Profile link (User icon, `/settings/profile`) as first settings item in `components/auth/user-menu.tsx`
- [ ] T007 [P] [US2] Add Profile link (User icon, `/settings/profile`) as first settings item with `onClick={() => setOpen(false)}` in `components/layout/mobile-menu.tsx`

**Checkpoint**: User Story 2 is complete — Profile is discoverable from all navigation entry points.

---

## Phase 4: User Story 3 — Responsive Profile Page (Priority: P3)

**Goal**: Profile page layout adapts to mobile, tablet, and desktop viewports without horizontal scrolling.

**Independent Test**: View `/settings/profile` at viewport widths 320px, 768px, and 1920px and verify usable layout without horizontal overflow.

### Implementation for User Story 3

- [ ] T008 [US3] Verify and refine responsive layout in `app/settings/profile/page.tsx` — ensure mobile-first stacking, `max-w-4xl` centering on desktop, no horizontal scroll at 320px viewport

**Checkpoint**: Profile page is fully responsive across all breakpoints.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T009 Run `bun run type-check` and `bun run lint` to verify no type or lint errors
- [ ] T010 Run all profile-related tests (`bun run test:unit tests/unit/components/settings/profile-page.test.tsx`, `bun run test:unit tests/unit/components/navigation-profile-link.test.tsx`, `bun run test:integration tests/integration/settings/profile-api.test.ts`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup/API)**: No dependencies — start immediately
- **Phase 2 (US1 — Profile Page)**: Depends on Phase 1 (page calls API)
- **Phase 3 (US2 — Navigation)**: Depends on Phase 1 only (nav links to route, not API)
- **Phase 4 (US3 — Responsive)**: Depends on Phase 2 (refines the page created in US1)
- **Phase 5 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (View Profile)**: Depends on API endpoint (T001) — core MVP
- **US2 (Navigation)**: Independent of US1 implementation — only needs the route to exist
- **US3 (Responsive)**: Depends on US1 (refines the page component)

### Within Each User Story

- Tests written before/alongside implementation
- API before page component
- Page component before responsive refinement

### Parallel Opportunities

```
Phase 1: T001 (API endpoint)
         │
         ├──► Phase 2: T002 [P] + T003 [P] (US1 tests in parallel)
         │              │
         │              └──► T004 (US1 page implementation)
         │
         └──► Phase 3: T005 [P] + T006 [P] + T007 [P] (US2 tests + nav updates all in parallel)
                        │
Phase 2 done ──────────► Phase 4: T008 (US3 responsive refinement)
                                   │
                                   └──► Phase 5: T009 + T010 (validation)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001: API endpoint
2. Complete T002–T003: US1 tests
3. Complete T004: Profile page
4. **STOP and VALIDATE**: Test US1 independently at `/settings/profile`

### Incremental Delivery

1. T001 (API) → Foundation ready
2. T002–T004 (US1) → Profile page functional (MVP!)
3. T005–T007 (US2) → Profile discoverable via navigation
4. T008 (US3) → Responsive polish
5. T009–T010 → Final validation

### Parallel Execution Strategy

After T001 completes, US1 and US2 can proceed in parallel:
- **Worker A**: T002 → T003 → T004 (profile page)
- **Worker B**: T005 → T006 + T007 (navigation)
- **After both**: T008 → T009 → T010

---

## Notes

- No schema changes — all data from existing User, Account, Subscription models
- No new dependencies — uses existing shadcn/ui, React Query, lucide-react
- GitHub username resolved server-side via `GET https://api.github.com/user/{id}` with stored access_token
- Failure to fetch GitHub username is non-fatal — returns null, UI degrades gracefully
- Missing subscription defaults to FREE plan
- Avatar uses shadcn/ui Avatar with initials fallback pattern from existing components
