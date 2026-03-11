# Tasks: Legal Pages - Terms of Service & Privacy Policy

**Input**: Design documents from `/specs/AIB-255-copy-of-legal/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pages.md, quickstart.md

**Tests**: Included — plan.md specifies integration tests and component tests.

**Organization**: Tasks grouped by user story. Footer is foundational (blocks US1/US2/US3 acceptance scenarios).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Create directory structure for legal pages

- [ ] T001 Create legal page directories at app/legal/terms/ and app/legal/privacy/

---

## Phase 2: Foundational (Footer Component & Layout)

**Purpose**: Global Footer component that MUST be complete before user stories can be fully tested (US1/US2 scenario 3 requires footer links, US4 is the footer itself)

**⚠️ CRITICAL**: US1, US2, and US4 acceptance scenarios depend on the footer being present

- [ ] T002 Create Footer component with legal links (Terms of Service → /legal/terms, Privacy Policy → /legal/privacy) and copyright notice in components/layout/footer.tsx
- [ ] T003 Add Footer to root layout after {children} and before Toaster in app/layout.tsx

**Checkpoint**: Footer visible on all pages — US4 core functionality delivered

---

## Phase 3: User Story 1 - View Terms of Service (Priority: P1) 🎯 MVP

**Goal**: Unauthenticated visitors can read the Terms of Service at /legal/terms

**Independent Test**: Navigate to /legal/terms without auth → verify all required content sections (Conditions of Use, Limitation of Liability, BYOK API Cost Responsibility, AI-Generated Code Responsibility) are visible with effective date

### Implementation for User Story 1

- [ ] T004 [US1] Create Terms of Service page as Server Component with metadata export and all FR-003 sections (Conditions of Use, Limitation of Liability, BYOK API Cost Responsibility, AI-Generated Code Responsibility) plus effective date (FR-008) in app/legal/terms/page.tsx

**Checkpoint**: Terms of Service page accessible at /legal/terms, footer links navigate to it

---

## Phase 4: User Story 2 - View Privacy Policy (Priority: P1)

**Goal**: Unauthenticated visitors can read the Privacy Policy at /legal/privacy

**Independent Test**: Navigate to /legal/privacy without auth → verify all required content sections (Data Collected, Cookies Used, No Data Resale, GDPR Rights) are visible with effective date

### Implementation for User Story 2

- [ ] T005 [P] [US2] Create Privacy Policy page as Server Component with metadata export and all FR-004 sections (Data Collected, Cookies Used, No Data Resale, GDPR Rights) plus effective date (FR-008) in app/legal/privacy/page.tsx

**Checkpoint**: Privacy Policy page accessible at /legal/privacy, footer links navigate to it

---

## Phase 5: User Story 3 - Legal Links on Sign-In Page (Priority: P1)

**Goal**: New users see consent notice with legal links before signing in

**Independent Test**: Navigate to /auth/signin without auth → verify consent text "By signing in, you agree to our Terms of Service and Privacy Policy" with functional links to both legal pages

### Implementation for User Story 3

- [ ] T006 [US3] Add consent notice with Terms of Service and Privacy Policy links below OAuth buttons in app/auth/signin/page.tsx

**Checkpoint**: Sign-in page shows consent links, both navigate to correct legal pages

---

## Phase 6: User Story 4 - Footer with Legal Links (Priority: P2)

**Goal**: All pages (public and authenticated) display a responsive footer with legal links

**Independent Test**: Visit landing page, sign-in page, and dashboard → verify footer with legal links is present and responsive on all pages

*Note: Core footer implementation completed in Phase 2 (Foundational). This phase covers responsive verification and cross-page consistency.*

- [ ] T007 [US4] Verify Footer responsive behavior (vertical stack on mobile, horizontal on desktop) and adjust Tailwind breakpoints if needed in components/layout/footer.tsx

**Checkpoint**: Footer visible and responsive on all pages across device sizes

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests and final verification across all user stories

### Tests

- [ ] T008 [P] Create Footer component test verifying both legal links render with correct hrefs in tests/unit/components/footer.test.tsx
- [ ] T009 [P] Create legal page integration tests verifying /legal/terms and /legal/privacy return 200 with all required content sections in tests/integration/legal/pages.test.ts
- [ ] T010 Run type-check and lint to verify no TypeScript or ESLint errors across all new and modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (footer must exist for scenario 3)
- **US2 (Phase 4)**: Depends on Phase 2 — can run in PARALLEL with Phase 3
- **US3 (Phase 5)**: Depends on Phase 2 — can run in PARALLEL with Phases 3-4
- **US4 (Phase 6)**: Depends on Phases 2-5 (needs all pages to verify footer presence)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational → independent of other stories
- **US2 (P1)**: After Foundational → independent of other stories, PARALLEL with US1
- **US3 (P1)**: After Foundational → independent of other stories, PARALLEL with US1/US2
- **US4 (P2)**: After Foundational → footer already built, verify across pages after content exists

### Parallel Opportunities

- T004 (US1) and T005 (US2) can run in parallel (different files, no dependencies)
- T006 (US3) can run in parallel with T004 and T005 (different file)
- T008 and T009 can run in parallel (different test files)

---

## Parallel Example: User Stories 1, 2, 3

```bash
# After Phase 2 (Foundational) completes, launch all P1 stories in parallel:
Task: "T004 [US1] Create Terms of Service page in app/legal/terms/page.tsx"
Task: "T005 [US2] Create Privacy Policy page in app/legal/privacy/page.tsx"
Task: "T006 [US3] Add consent notice in app/auth/signin/page.tsx"

# After all stories complete, launch tests in parallel:
Task: "T008 Footer component test in tests/unit/components/footer.test.tsx"
Task: "T009 Legal page integration tests in tests/integration/legal/pages.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (directory structure)
2. Complete Phase 2: Foundational (Footer + layout)
3. Complete Phase 3: User Story 1 (Terms of Service page)
4. **STOP and VALIDATE**: Verify /legal/terms loads with all sections, footer links work
5. Deploy/demo if ready — Terms of Service is live

### Incremental Delivery

1. Setup + Foundational → Footer on all pages ✓
2. Add US1 (Terms) → /legal/terms accessible ✓ → **MVP!**
3. Add US2 (Privacy) → /legal/privacy accessible ✓
4. Add US3 (Consent) → Sign-in page has legal links ✓
5. Add US4 (Verify footer) → Responsive footer on all pages ✓
6. Polish → Tests pass, type-check clean ✓

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially (Phases 1-2)
2. Launch US1, US2, US3 in parallel (Phases 3-5, all different files)
3. Verify US4 (Phase 6)
4. Run tests in parallel (Phase 7)

---

## Notes

- No new npm packages required
- No database migrations or Prisma changes
- No environment variables needed
- All legal pages are static Server Components (no data fetching)
- Footer is a Client Component (uses next/link for client-side navigation)
- Legal content is MVP-grade (not reviewed by legal counsel)
- Styling uses existing Catppuccin Mocha palette and Tailwind utilities
