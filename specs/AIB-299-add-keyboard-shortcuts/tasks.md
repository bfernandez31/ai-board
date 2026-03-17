# Tasks: Add Keyboard Shortcuts on Board

**Input**: Design documents from `/specs/AIB-299-add-keyboard-shortcuts/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Included — plan.md explicitly defines test tasks (Tasks 7, 8) with detailed test plans.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create foundational hooks and add data attributes needed by all user stories

- [x] T001 [P] Create `useHoverCapability` hook using `useSyncExternalStore` + `matchMedia('(hover: hover)')` pattern from `useReducedMotion` in `lib/hooks/use-hover-capability.ts`
- [x] T002 [P] Add `data-testid="ticket-search-input"` attribute to the search `<Input>` element in `components/search/ticket-search.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core keyboard shortcut hook that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Create `useKeyboardShortcuts` hook with global `keydown` listener, `isEditableElement` guard, and shortcut map (`N`, `S`, `/`, `1`–`6`, `?`) in `lib/hooks/use-keyboard-shortcuts.ts`

**Checkpoint**: Foundation ready — hooks exist, board integration can begin

---

## Phase 3: User Story 1 — Quick Ticket Creation via Keyboard (Priority: P1) 🎯 MVP

**Goal**: Pressing `N` on the board opens the new ticket creation modal instantly

**Independent Test**: Press `N` on the board page → new ticket modal opens. Press `N` while typing in an input → nothing happens.

### Tests for User Story 1

- [x] T004 [P] [US1] Unit test `useHoverCapability` hook: matchMedia match/no-match, server snapshot returns false in `tests/unit/use-hover-capability.test.ts`
- [x] T005 [P] [US1] Unit test `useKeyboardShortcuts` hook: `N` fires `onNewTicket`, suppressed in input/textarea/contentEditable, suppressed when `enabled=false`, `preventDefault` called in `tests/unit/use-keyboard-shortcuts.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Integrate `useHoverCapability` and `useKeyboardShortcuts` into board component: add `isNewTicketModalOpen` state, wire `onNewTicket` callback to open `NewTicketModal`, add `<NewTicketModal>` controlled instance in `components/board/board.tsx`

**Checkpoint**: `N` key creates tickets on desktop, suppressed on mobile and in text inputs

---

## Phase 4: User Story 2 — Fast Search Access (Priority: P1)

**Goal**: Pressing `S` or `/` focuses the search input immediately

**Independent Test**: Press `S` or `/` on the board page → search input receives focus.

### Tests for User Story 2

- [ ] T007 [US2] Add tests for `S` and `/` firing `onFocusSearch` callback to existing test file `tests/unit/use-keyboard-shortcuts.test.ts`

### Implementation for User Story 2

- [ ] T008 [US2] Wire `onFocusSearch` callback in board integration to query `[data-testid="ticket-search-input"]` and call `.focus()` in `components/board/board.tsx`

**Checkpoint**: `S` and `/` keys focus the search bar from anywhere on the board

---

## Phase 5: User Story 3 — Column Navigation via Number Keys (Priority: P2)

**Goal**: Pressing `1`–`6` smoothly scrolls the board to the corresponding stage column

**Independent Test**: Press `1` through `6` → board scrolls to INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP columns respectively.

### Tests for User Story 3

- [ ] T009 [US3] Add tests for `1`–`6` firing `onColumnNav` with correct column index to existing test file `tests/unit/use-keyboard-shortcuts.test.ts`

### Implementation for User Story 3

- [ ] T010 [US3] Wire `onColumnNav` callback in board integration with `STAGE_BY_NUMBER` mapping and `scrollIntoView({ behavior: 'smooth', inline: 'center' })` targeting `[data-column=STAGE]` elements in `components/board/board.tsx`

**Checkpoint**: Number keys navigate to columns with smooth scrolling

---

## Phase 6: User Story 4 — Shortcut Help Overlay (Priority: P2)

**Goal**: A help dialog displays all shortcuts, toggled via `?` key or icon button, auto-shown on first visit

**Independent Test**: Press `?` → help overlay appears with all shortcuts listed. Click the keyboard icon → same overlay. First visit → overlay auto-shows.

### Tests for User Story 4

- [ ] T011 [P] [US4] Component test for `KeyboardShortcutsDialog`: renders all shortcuts when open, hidden when closed, calls `onOpenChange` on close, accessible dialog role/heading in `tests/unit/components/keyboard-shortcuts-dialog.test.tsx`
- [ ] T012 [P] [US4] Add test for `?` firing `onToggleHelp` callback to existing test file `tests/unit/use-keyboard-shortcuts.test.ts`

### Implementation for User Story 4

- [ ] T013 [P] [US4] Create `KeyboardShortcutsDialog` component with shadcn/ui Dialog, two-column Key|Action table, `<kbd>` styled keys in `components/board/keyboard-shortcuts-dialog.tsx`
- [ ] T014 [P] [US4] Create `ShortcutsHelpButton` component with `Keyboard` icon from lucide-react, tooltip, hidden when `useHoverCapability()` returns false in `components/board/shortcuts-help-button.tsx`
- [ ] T015 [US4] Integrate help overlay into board: add `isShortcutsHelpOpen` state with first-visit localStorage check (`shortcuts-hint-dismissed`), wire `onToggleHelp`, render `<KeyboardShortcutsDialog>` and `<ShortcutsHelpButton>`, set localStorage on dismiss in `components/board/board.tsx`

**Checkpoint**: Help overlay discoverable via icon and `?` key, auto-shows on first visit

---

## Phase 7: User Story 5 — Escape Key Closes Modals and Overlays (Priority: P3)

**Goal**: Escape key closes the topmost open modal or overlay

**Independent Test**: Open any modal → press Escape → modal closes.

### Implementation for User Story 5

- [ ] T016 [US5] Verify Escape behavior works correctly with shadcn/ui Dialog (native support) for both `NewTicketModal` and `KeyboardShortcutsDialog`, ensure `enabled` flag suppresses shortcuts when any modal is open in `components/board/board.tsx`

**Checkpoint**: Escape correctly closes modals in priority order

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup across all user stories

- [ ] T017 Run `bun run type-check` and fix any TypeScript errors
- [ ] T018 Run `bun run lint` and fix any linting errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 for hook pattern)
- **User Stories (Phases 3–7)**: All depend on Foundational phase completion (T003)
  - US1 (Phase 3): First priority, establishes board integration pattern
  - US2 (Phase 4): Can start after US1 board integration (T006) establishes the pattern in board.tsx
  - US3 (Phase 5): Can start after US1 board integration (T006)
  - US4 (Phase 6): Independent new components (T013, T014 parallel), integration (T015) after US1
  - US5 (Phase 7): Depends on US1 + US4 (both modals must exist)
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only — establishes board integration
- **US2 (P1)**: Depends on US1 (board integration exists in board.tsx)
- **US3 (P2)**: Depends on US1 (board integration exists in board.tsx)
- **US4 (P2)**: Components (T013, T014) can start after Foundational; integration (T015) after US1
- **US5 (P3)**: Depends on US1 + US4 (both modal types must exist to verify Escape)

### Within Each User Story

- Tests written alongside or before implementation
- Hook logic before board integration
- Components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 run in parallel (Phase 1 — different files)
- T004 and T005 run in parallel (US1 tests — different test files)
- T011 and T012 run in parallel (US4 tests — different test files)
- T013 and T014 run in parallel (US4 components — different files)

---

## Parallel Example: User Story 4

```bash
# Launch tests in parallel:
Task: "Component test for KeyboardShortcutsDialog in tests/unit/components/keyboard-shortcuts-dialog.test.tsx"
Task: "Add test for ? key in tests/unit/use-keyboard-shortcuts.test.ts"

# Launch components in parallel:
Task: "Create KeyboardShortcutsDialog in components/board/keyboard-shortcuts-dialog.tsx"
Task: "Create ShortcutsHelpButton in components/board/shortcuts-help-button.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004–T006)
4. **STOP and VALIDATE**: Press `N` on board → modal opens
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Hooks ready
2. Add US1 (Ticket creation) → Test → Deploy (MVP!)
3. Add US2 (Search focus) → Test → Deploy
4. Add US3 (Column nav) → Test → Deploy
5. Add US4 (Help overlay) → Test → Deploy
6. Add US5 (Escape) → Test → Deploy
7. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. After US1 establishes board integration:
   - US2, US3 can proceed (add callbacks to existing integration)
   - US4 components can be built in parallel, integrated after
3. US5 validates after US1 + US4

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This is a **client-side only** feature — no DB, API, or server changes
- All new files go in `lib/hooks/` (hooks) and `components/board/` (UI)
- Only `components/board/board.tsx` and `components/search/ticket-search.tsx` are modified
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
