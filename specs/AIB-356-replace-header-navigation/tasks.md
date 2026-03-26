# Tasks: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Input**: Design documents from `/specs/AIB-356-replace-header-navigation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-contracts.md, quickstart.md

**Tests**: Included per plan.md Testing Strategy section (constitution gate III: Test-Driven Development).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and generate shared UI primitives

- [ ] T001 Install cmdk dependency via `bun add cmdk`
- [ ] T002 Add shadcn/ui Command component via `bunx shadcn@latest add command` generating components/ui/command.tsx
- [ ] T003 [P] Create components/navigation/ directory and define shared NavigationItem type and NAVIGATION_ITEMS constant in components/navigation/nav-items.ts
- [ ] T004 [P] Define CommandPaletteResult union types (CommandPaletteNavigationResult, CommandPaletteTicketResult) in components/navigation/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Project layout that all user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create project layout with CSS Grid at app/projects/[projectId]/layout.tsx rendering sidebar slot and children with `lg:grid lg:grid-cols-[48px_1fr]` responsive breakpoint
- [ ] T006 Add command palette open state management in project layout, passing open/onOpenChange to child components via context or props

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Desktop Navigation via Icon Rail (Priority: P1) MVP

**Goal**: Users can navigate between Board, Activity, Analytics, and Settings pages using a 48px icon rail sidebar visible on desktop (>=1024px)

**Independent Test**: Navigate between all 4 project pages using sidebar icons; verify correct page loads and active state highlighting

### Tests for User Story 1

- [ ] T007 [P] [US1] Write component test for icon rail rendering 4 navigation icons with correct labels in tests/unit/components/icon-rail-sidebar.test.tsx
- [ ] T008 [P] [US1] Write component test for active icon highlighting based on pathname in tests/unit/components/icon-rail-sidebar.test.tsx
- [ ] T009 [P] [US1] Write component test for tooltip display on hover and settings icon anchored at bottom in tests/unit/components/icon-rail-sidebar.test.tsx

### Implementation for User Story 1

- [ ] T010 [US1] Create IconRailSidebar component with nav landmark, 4 navigation icons, active state via usePathname(), tooltips via shadcn Tooltip, and views/bottom group layout in components/navigation/icon-rail-sidebar.tsx
- [ ] T011 [US1] Wire IconRailSidebar into project layout at app/projects/[projectId]/layout.tsx with `hidden lg:flex` responsive visibility
- [ ] T012 [US1] Verify tests pass for icon rail component

**Checkpoint**: Icon rail sidebar is fully functional and testable on desktop viewports

---

## Phase 4: User Story 2 - Command Palette for Search and Navigation (Priority: P1)

**Goal**: Users can press Cmd+K/Ctrl+K or click the search trigger to open a modal command palette with grouped navigation and ticket search results, keyboard-navigable

**Independent Test**: Press Cmd+K, type a query, navigate results with arrow keys, press Enter to confirm navigation

### Tests for User Story 2

- [ ] T013 [P] [US2] Write component test for command palette open/close via Cmd+K and Escape, empty state, and input clearing on open in tests/unit/components/command-palette.test.tsx
- [ ] T014 [P] [US2] Write component test for navigation fuzzy filtering and ticket result grouping under "Navigation" and "Tickets" headings in tests/unit/components/command-palette.test.tsx
- [ ] T015 [P] [US2] Write component test for keyboard navigation (ArrowDown/ArrowUp/Enter) and modal stacking prevention in tests/unit/components/command-palette.test.tsx
- [ ] T016 [P] [US2] Write component test for search trigger rendering with search icon, placeholder, and platform-specific shortcut badge in tests/unit/components/search-trigger.test.tsx

### Implementation for User Story 2

- [ ] T017 [US2] Create CommandPalette component with CommandDialog, global Cmd+K/Ctrl+K listener, "Navigation" group (static items with cmdk filtering), "Tickets" group (async via useTicketSearch), keyboard navigation, modal stacking check, and state reset on open in components/navigation/command-palette.tsx
- [ ] T018 [US2] Create SearchTrigger component as styled button with search icon, "Search..." placeholder, and platform-detected shortcut badge (Cmd+K / Ctrl+K) in components/navigation/search-trigger.tsx
- [ ] T019 [US2] Wire CommandPalette into project layout at app/projects/[projectId]/layout.tsx with projectId from route params
- [ ] T020 [US2] Add custom event listener for 'open-command-palette' in CommandPalette component to support board integration
- [ ] T021 [US2] Verify tests pass for command palette and search trigger components

**Checkpoint**: Command palette is fully functional with search, navigation, and keyboard support

---

## Phase 5: User Story 3 - Simplified Header (Priority: P2)

**Goal**: Header displays only project name, search trigger with Cmd+K badge, notification bell, and user avatar. Navigation icons (Specs, Analytics, Activity) and inline TicketSearch are removed.

**Independent Test**: Verify header no longer contains Specs, Analytics, or Activity icon buttons and that SearchTrigger is present with keyboard shortcut hint

### Implementation for User Story 3

- [ ] T022 [US3] Remove FileText (Specs), BarChart3 (Analytics), and Activity icon links from desktop header in components/layout/header.tsx
- [ ] T023 [US3] Replace TicketSearch component with SearchTrigger in header, connecting onClick to open command palette in components/layout/header.tsx
- [ ] T024 [US3] Remove isBoardPage check for search visibility so SearchTrigger shows on all project pages in components/layout/header.tsx
- [ ] T025 [US3] Pass command palette open handler from project layout to header via SearchTrigger onClick prop

**Checkpoint**: Header is simplified with search trigger replacing inline search and navigation icons

---

## Phase 6: User Story 4 - Mobile Navigation Unchanged (Priority: P2)

**Goal**: On screens <1024px, icon rail is hidden and hamburger menu provides access to Board, Activity, Analytics, and Settings with no behavior changes

**Independent Test**: At <1024px viewport, verify hamburger menu contains all navigation items and icon rail is not visible

### Implementation for User Story 4

- [ ] T026 [US4] Remove Specs (FileText) external link from mobile hamburger menu in components/layout/mobile-menu.tsx
- [ ] T027 [US4] Add Board navigation link with LayoutDashboard icon to mobile menu in components/layout/mobile-menu.tsx
- [ ] T028 [US4] Verify icon rail has `hidden lg:flex` class ensuring it does not render below 1024px

**Checkpoint**: Mobile navigation is unchanged with all items accessible via hamburger menu

---

## Phase 7: User Story 5 - Keyboard Shortcuts Coexistence (Priority: P3)

**Goal**: Existing shortcuts (N, ?, S, /, 1-6) work when palette is closed; single-key shortcuts are suppressed when palette is open

**Independent Test**: Press N to create ticket (palette closed), then Cmd+K and verify N types in search input instead

### Tests for User Story 5

- [ ] T029 [P] [US5] Write integration test for S/slash shortcut opening command palette instead of old search in tests/integration/navigation/keyboard-shortcuts.test.ts
- [ ] T030 [P] [US5] Write integration test for Cmd+K opening palette and single-key shortcuts suppressed while open in tests/integration/navigation/keyboard-shortcuts.test.ts
- [ ] T031 [P] [US5] Write integration test for N, 1-6, ? shortcuts still working when palette is closed in tests/integration/navigation/keyboard-shortcuts.test.ts

### Implementation for User Story 5

- [ ] T032 [US5] Update onFocusSearch callback in components/board/board.tsx to dispatch 'open-command-palette' custom event instead of focusing old search input
- [ ] T033 [US5] Verify existing useKeyboardShortcuts hook already guards against meta keys and input focus — no modification needed per research.md
- [ ] T034 [US5] Verify integration tests pass for keyboard shortcut coexistence

**Checkpoint**: All keyboard shortcuts work correctly with and without command palette open

---

## Phase 8: User Story 6 - Board Space Preservation (Priority: P3)

**Goal**: 48px icon rail does not reduce usable board area below 6-column threshold at 1280px viewport

**Independent Test**: At 1280px viewport width, verify all 6 kanban columns are visible and usable with icon rail present

### Implementation for User Story 6

- [ ] T035 [US6] Verify CSS Grid layout at 1280px leaves 1232px for board content (48px sidebar + 1232px content area) in app/projects/[projectId]/layout.tsx
- [ ] T036 [US6] Verify board component does not introduce horizontal overflow with 1232px available width in components/board/board.tsx

**Checkpoint**: Board is fully usable with 6 columns at 1280px with sidebar present

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories

- [ ] T037 Run `bun run type-check` and fix any TypeScript errors across all new and modified files
- [ ] T038 Run `bun run lint` and fix any ESLint issues across all new and modified files
- [ ] T039 Run full test suite `bun run test:unit` and verify all new tests pass
- [ ] T040 Run quickstart.md validation steps (type-check, lint, unit tests, visual verification at 1280px and 768px)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001-T004) - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) - no dependencies on other stories
- **US2 (Phase 4)**: Depends on Foundational (Phase 2) - no dependencies on other stories
- **US3 (Phase 5)**: Depends on US2 (Phase 4) - needs SearchTrigger and command palette open handler
- **US4 (Phase 6)**: Depends on Foundational (Phase 2) - can run in parallel with US1/US2
- **US5 (Phase 7)**: Depends on US2 (Phase 4) - needs command palette component for event integration
- **US6 (Phase 8)**: Depends on US1 (Phase 3) - needs icon rail in layout to verify spacing
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational - independent
- **US2 (P1)**: After Foundational - independent
- **US3 (P2)**: After US2 - needs SearchTrigger component and command palette open handler
- **US4 (P2)**: After Foundational - independent (can parallel with US1/US2)
- **US5 (P3)**: After US2 - needs command palette for keyboard shortcut integration
- **US6 (P3)**: After US1 - needs icon rail layout for space verification

### Within Each User Story

- Tests written FIRST and must FAIL before implementation
- Types/models before components
- Components before integration/wiring
- Verification after implementation

### Parallel Opportunities

- T003 + T004 (shared types, different files)
- T007 + T008 + T009 (icon rail test cases, same file but independent assertions)
- T013 + T014 + T015 + T016 (command palette and search trigger tests, different files)
- T029 + T030 + T031 (keyboard integration tests, same file but independent scenarios)
- US1 + US2 + US4 can execute in parallel after Foundational phase
- US3 + US5 can execute in parallel after US2 completes

---

## Parallel Example: User Stories 1 + 2 + 4

```bash
# After Foundational phase completes, launch in parallel:

# Agent 1: User Story 1 - Icon Rail
Task: T007-T012 (icon rail tests, component, wiring)

# Agent 2: User Story 2 - Command Palette
Task: T013-T021 (palette tests, component, search trigger, wiring)

# Agent 3: User Story 4 - Mobile Navigation
Task: T026-T028 (mobile menu updates)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (install cmdk, add shadcn command, define types)
2. Complete Phase 2: Foundational (project layout with CSS Grid)
3. Complete Phase 3: US1 - Icon Rail Sidebar
4. Complete Phase 4: US2 - Command Palette
5. **STOP and VALIDATE**: Both P1 stories functional independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. US1 (Icon Rail) -> Test independently (MVP Part 1)
3. US2 (Command Palette) -> Test independently (MVP Part 2)
4. US3 (Header Simplification) -> Test independently
5. US4 (Mobile Navigation) -> Test independently
6. US5 (Keyboard Shortcuts) -> Test independently
7. US6 (Board Space) -> Verify
8. Polish -> Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database changes or API modifications needed (purely frontend)
- cmdk provides built-in fuzzy matching — no custom search logic for navigation items
- Existing useTicketSearch hook reused as-is for ticket search in command palette
- Existing useKeyboardShortcuts hook needs no modification per research.md findings
