# Tasks: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/contracts/command-palette.openapi.yaml`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/quickstart.md`

**Tests**: Include automated test tasks because `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/spec.md` requires coverage for rail visibility, responsive behavior, command-palette keyboard flow, grouped results, header simplification, and mobile navigation stability.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared typed contracts and metadata that every later phase depends on.

- [ ] T001 Define command-palette query validation and response types in `/home/runner/work/ai-board/ai-board/target/lib/schemas/command-palette.ts` and `/home/runner/work/ai-board/ai-board/target/lib/types.ts`
- [ ] T002 [P] Create project destination metadata and pathname matching helpers in `/home/runner/work/ai-board/ai-board/target/components/navigation/project-destinations.ts`
- [ ] T003 [P] Implement deterministic destination and ticket ranking helpers in `/home/runner/work/ai-board/ai-board/target/lib/search/command-palette-ranking.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the reusable shell, rail, and data-fetch plumbing that block all user stories.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T004 Create the fixed-width desktop rail component and tooltip wrapper in `/home/runner/work/ai-board/ai-board/target/components/navigation/desktop-project-rail.tsx` and `/home/runner/work/ai-board/ai-board/target/components/navigation/project-rail-tooltips.tsx`
- [ ] T005 Create the shared responsive project shell in `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx`
- [ ] T006 [P] Wrap the supported project pages with the shared shell in `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx`, `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/activity/page.tsx`, `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/analytics/page.tsx`, and `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/settings/page.tsx`
- [ ] T007 [P] Add command-palette query keys and client fetch hook in `/home/runner/work/ai-board/ai-board/target/lib/query-keys.ts` and `/home/runner/work/ai-board/ai-board/target/lib/hooks/queries/use-command-palette.ts`

**Checkpoint**: Shared navigation infrastructure is ready and user stories can proceed.

---

## Phase 3: User Story 1 - Navigate Project Views from the Rail (Priority: P1) 🎯 MVP

**Goal**: Deliver a persistent desktop icon rail that opens Board, Activity, Analytics, and Settings while preserving active-state feedback and icon-only behavior.

**Independent Test**: Open a project at `>=1024px`, verify the rail is visible, use it to reach all four destinations, and confirm the active destination plus hover/focus labels render correctly.

### Tests for User Story 1

- [ ] T008 [P] [US1] Extend rail active-state and tooltip coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/navigation-utils.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/header.test.tsx`
- [ ] T009 [P] [US1] Add desktop rail navigation and viewport behavior coverage in `/home/runner/work/ai-board/ai-board/target/tests/e2e/project-navigation-shell.spec.ts`

### Implementation for User Story 1

- [ ] T010 [US1] Implement grouped rail rendering, active destination styling, and footer-anchored Settings placement in `/home/runner/work/ai-board/ai-board/target/components/navigation/desktop-project-rail.tsx`
- [ ] T011 [P] [US1] Wire hover and focus labels for rail icons in `/home/runner/work/ai-board/ai-board/target/components/navigation/project-rail-tooltips.tsx`
- [ ] T012 [US1] Apply the desktop rail layout without shrinking board usability below the planned 56px offset in `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx` and `/home/runner/work/ai-board/ai-board/target/app/projects/[projectId]/board/page.tsx`

**Checkpoint**: User Story 1 is independently functional and validates the MVP desktop navigation redesign.

---

## Phase 4: User Story 2 - Open Navigation and Ticket Search from the Command Palette (Priority: P2)

**Goal**: Add a project-wide command palette that opens from keyboard or header trigger and returns grouped destination and ticket results with deterministic ranking.

**Independent Test**: Open any project page, trigger the palette with `Cmd+K` or `Ctrl+K`, search for a destination and a ticket, navigate results with the keyboard, and verify Enter and Escape behavior.

### Tests for User Story 2

- [ ] T013 [P] [US2] Add grouped command-palette API coverage for auth, query validation, grouping, and empty states in `/home/runner/work/ai-board/ai-board/target/tests/integration/navigation/command-palette.test.ts`
- [ ] T014 [P] [US2] Extend command-palette rendering and keyboard interaction coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/command-autocomplete.test.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/unit/use-keyboard-shortcuts.test.ts`

### Implementation for User Story 2

- [ ] T015 [US2] Implement `GET /api/projects/[projectId]/command-palette` with project access checks and grouped response mapping in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/command-palette/route.ts`
- [ ] T016 [P] [US2] Build the palette trigger, dialog, and grouped result list components in `/home/runner/work/ai-board/ai-board/target/components/search/command-palette-trigger.tsx`, `/home/runner/work/ai-board/ai-board/target/components/search/command-palette.tsx`, and `/home/runner/work/ai-board/ai-board/target/components/search/command-palette-results.tsx`
- [ ] T017 [US2] Integrate project-wide `Meta+K` and `Ctrl+K` handling, focus management, and result selection into `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx` and `/home/runner/work/ai-board/ai-board/target/components/search/command-palette.tsx`
- [ ] T018 [US2] Reuse ticket lookup data and fuzzy ranking logic across `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/command-palette/route.ts`, `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/search/route.ts`, and `/home/runner/work/ai-board/ai-board/target/lib/search/command-palette-ranking.ts`

**Checkpoint**: User Story 2 is independently functional with grouped, keyboard-driven project navigation and ticket search.

---

## Phase 5: User Story 3 - Keep the Header and Mobile Navigation Clean and Stable (Priority: P3)

**Goal**: Simplify the desktop header around the new palette entry point while keeping mobile hamburger navigation and non-palette keyboard shortcuts stable.

**Independent Test**: Compare desktop and sub-desktop project layouts, confirm the desktop header no longer shows the old navigation icon row, verify the rail is hidden below `1024px`, and confirm existing project shortcuts still work when the palette is closed.

### Tests for User Story 3

- [ ] T019 [P] [US3] Extend header simplification and mobile fallback coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/header.test.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ticket-search.test.tsx`
- [ ] T020 [P] [US3] Extend responsive and shortcut-suppression browser coverage in `/home/runner/work/ai-board/ai-board/target/tests/e2e/project-navigation-shell.spec.ts`

### Implementation for User Story 3

- [ ] T021 [US3] Replace desktop header navigation icons and inline ticket search with the palette entry point in `/home/runner/work/ai-board/ai-board/target/components/layout/header.tsx`
- [ ] T022 [US3] Preserve hamburger-only navigation below `1024px` in `/home/runner/work/ai-board/ai-board/target/components/layout/mobile-menu.tsx` and `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx`
- [ ] T023 [US3] Suppress conflicting project shortcuts while the palette is open and preserve existing shortcuts when closed in `/home/runner/work/ai-board/ai-board/target/components/layout/project-shell.tsx` and `/home/runner/work/ai-board/ai-board/target/tests/unit/use-keyboard-shortcuts.test.ts`

**Checkpoint**: User Story 3 completes the responsive cleanup without regressing mobile navigation or shortcut behavior.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full feature against the documented scenarios and repo quality gates.

- [ ] T024 [P] Validate the manual acceptance scenarios documented in `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/quickstart.md`
- [ ] T025 Run `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run type-check`, and `bun run lint` from `/home/runner/work/ai-board/ai-board/target` using the commands listed in `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and establishes the typed schemas, metadata, and ranking helpers.
- **Phase 2: Foundational** depends on Phase 1 and blocks all user stories because the shell, rail primitives, and query plumbing are shared.
- **Phase 3: US1** depends on Phase 2 and delivers the MVP desktop rail.
- **Phase 4: US2** depends on Phase 2 and can proceed after the shared shell and hooks exist.
- **Phase 5: US3** depends on Phases 3 and 4 because header cleanup and shortcut suppression rely on the rail and palette entry point being in place.
- **Phase 6: Polish** depends on the completion of all targeted user stories.

### User Story Dependency Graph

- **US1 (P1)**: Starts after Foundational and has no dependency on other user stories.
- **US2 (P2)**: Starts after Foundational and remains independently testable from US1.
- **US3 (P3)**: Starts after US1 and US2 because it finalizes the shared header and responsive behavior around both features.

### Within Each User Story

- Test tasks should be written first and should fail before implementation begins.
- Shared metadata and schema work precede route, shell, and component integration.
- API and ranking logic should land before keyboard-driven palette flows.
- Responsive cleanup should follow the rail and palette implementation, not precede it.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T006` and `T007` can run in parallel after `T004` and `T005`.
- `T008` and `T009` can run in parallel inside US1.
- `T013` and `T014` can run in parallel inside US2.
- `T016` can proceed in parallel with `T015` once the shared schema and ranking helpers exist.
- `T019` and `T020` can run in parallel inside US3.

---

## Parallel Example: User Story 1

```bash
# Parallel test work for US1
Task: "T008 Extend rail active-state and tooltip coverage in tests/unit/navigation-utils.test.ts and tests/unit/components/header.test.tsx"
Task: "T009 Add desktop rail navigation and viewport behavior coverage in tests/e2e/project-navigation-shell.spec.ts"

# Parallel UI work for US1
Task: "T010 Implement grouped rail rendering, active destination styling, and footer-anchored Settings placement in components/navigation/desktop-project-rail.tsx"
Task: "T011 Wire hover and focus labels for rail icons in components/navigation/project-rail-tooltips.tsx"
```

## Parallel Example: User Story 2

```bash
# Parallel test work for US2
Task: "T013 Add grouped command-palette API coverage in tests/integration/navigation/command-palette.test.ts"
Task: "T014 Extend command-palette rendering and keyboard interaction coverage in tests/unit/components/command-autocomplete.test.tsx and tests/unit/use-keyboard-shortcuts.test.ts"

# Parallel implementation work for US2
Task: "T015 Implement GET /api/projects/[projectId]/command-palette in app/api/projects/[projectId]/command-palette/route.ts"
Task: "T016 Build the palette trigger, dialog, and grouped result list components in components/search/command-palette-trigger.tsx, components/search/command-palette.tsx, and components/search/command-palette-results.tsx"
```

## Parallel Example: User Story 3

```bash
# Parallel regression coverage for US3
Task: "T019 Extend header simplification and mobile fallback coverage in tests/unit/components/header.test.tsx and tests/unit/components/ticket-search.test.tsx"
Task: "T020 Extend responsive and shortcut-suppression browser coverage in tests/e2e/project-navigation-shell.spec.ts"

# Parallel implementation work for US3
Task: "T021 Replace desktop header navigation icons and inline ticket search with the palette entry point in components/layout/header.tsx"
Task: "T022 Preserve hamburger-only navigation below 1024px in components/layout/mobile-menu.tsx and components/layout/project-shell.tsx"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for US1.
3. Validate the desktop rail independently before starting the palette.

### Incremental Delivery

1. Ship the shared shell and rail foundation first.
2. Add US1 as the MVP desktop navigation increment.
3. Add US2 to replace inline ticket search with the grouped command palette.
4. Add US3 to simplify the header and lock down responsive regressions.
5. Finish with the full validation pass in Phase 6.

### Parallel Execution Strategy

1. Run Setup sequentially enough to establish shared contracts.
2. Parallelize independent foundational tasks once the rail and shell files exist.
3. After Foundational completes, run US1 and US2 in parallel if capacity allows.
4. Reserve US3 for final integration because it depends on both the rail and palette entry point.

---

## Notes

- Every task follows the required checklist format: checkbox, Task ID, optional `[P]`, required `[US#]` labels for story phases, and exact file paths.
- New files referenced above are expected additions aligned with `/home/runner/work/ai-board/ai-board/target/specs/AIB-357-replace-header-navigation/plan.md`.
- The suggested MVP scope is **User Story 1 only** after Setup and Foundational are complete.
