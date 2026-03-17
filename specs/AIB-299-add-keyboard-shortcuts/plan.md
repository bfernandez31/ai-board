# Implementation Plan: AIB-299 Add Keyboard Shortcuts

**Branch**: `AIB-299-add-keyboard-shortcuts`
**Spec**: `specs/AIB-299-add-keyboard-shortcuts/spec.md`
**Created**: 2026-03-17

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Scope | Client-side only — no DB, API, or server changes |
| Primary Component | `components/board/board.tsx` (1145 lines) |
| Key Dependencies | shadcn/ui Dialog, lucide-react, existing hooks pattern |
| Media Query | `(hover: hover)` for desktop detection |
| localStorage Key | `shortcuts-hint-dismissed` |
| Existing Patterns | `useReducedMotion` (useSyncExternalStore + matchMedia), push-opt-in localStorage pattern |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code fully typed, no `any` |
| II. Component-Driven | PASS | shadcn/ui Dialog for overlay, feature folder in `components/board/` |
| III. Test-Driven | PASS | Unit tests for hooks, component tests for overlay |
| IV. Security-First | PASS | No user input, no API calls, no secrets |
| V. Database Integrity | N/A | No database changes |
| VI. AI-First | PASS | No documentation files created |

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│ Board (board.tsx)                            │
│  ├── useHoverCapability() → hasHover        │
│  ├── useKeyboardShortcuts({                 │
│  │     enabled: hasHover && !isModalOpen,   │
│  │     onNewTicket, onFocusSearch,          │
│  │     onColumnNav, onToggleHelp            │
│  │   })                                     │
│  ├── <KeyboardShortcutsDialog />            │
│  ├── <NewTicketModal /> (keyboard-triggered)│
│  └── <ShortcutsHelpButton />                │
└─────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Create `useHoverCapability` hook

**File**: `lib/hooks/use-hover-capability.ts` (NEW)

Create a hook following the exact `useReducedMotion` pattern but for `(hover: hover)` media query.

```typescript
// Pattern: useSyncExternalStore with matchMedia('(hover: hover)')
// Returns: boolean (true = device has hover/pointer capability)
// Server snapshot: false (no shortcuts during SSR)
```

**Testing**: Unit test (`tests/unit/use-hover-capability.test.ts`)
- Test returns true when matchMedia matches
- Test returns false on server (getServerSnapshot)
- Test reacts to media query changes

---

### Task 2: Create `useKeyboardShortcuts` hook

**File**: `lib/hooks/use-keyboard-shortcuts.ts` (NEW)

Core keyboard shortcut handler hook.

**Interface**:
```typescript
interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  onNewTicket: () => void;
  onFocusSearch: () => void;
  onColumnNav: (columnIndex: number) => void;
  onToggleHelp: () => void;
}
```

**Logic**:
1. If `!enabled`, do nothing (don't register listener)
2. On `keydown`:
   - If `isEditableElement(event.target)`, return early
   - Match `event.key` to shortcut map:
     - `n` / `N` → `onNewTicket()`, `preventDefault()`
     - `s` / `S` → `onFocusSearch()`, `preventDefault()`
     - `/` → `onFocusSearch()`, `preventDefault()`
     - `1`-`6` → `onColumnNav(number)`, `preventDefault()`
     - `?` → `onToggleHelp()`, `preventDefault()`
3. Helper `isEditableElement`: check tagName (INPUT/TEXTAREA/SELECT) and `isContentEditable`

**Testing**: Unit test (`tests/unit/use-keyboard-shortcuts.test.ts`)
- Test each shortcut fires correct callback
- Test shortcuts suppressed when input focused
- Test shortcuts suppressed when enabled=false
- Test preventDefault called

---

### Task 3: Create `KeyboardShortcutsDialog` component

**File**: `components/board/keyboard-shortcuts-dialog.tsx` (NEW)

A dialog displaying all available keyboard shortcuts.

**Props**:
```typescript
interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Layout**:
- shadcn/ui `Dialog` with `DialogContent`, `DialogHeader`, `DialogTitle`
- Two-column table: Key (styled as `<kbd>`) | Action
- Shortcuts listed:
  | Key | Action |
  |-----|--------|
  | N | Create new ticket |
  | S or / | Focus search |
  | 1-6 | Jump to column |
  | ? | Toggle this help |
  | Esc | Close modal/overlay |

**Testing**: Component test (`tests/unit/components/keyboard-shortcuts-dialog.test.tsx`)
- Test renders all shortcuts
- Test open/close behavior
- Test accessible structure (dialog role, heading)

---

### Task 4: Create `ShortcutsHelpButton` component

**File**: `components/board/shortcuts-help-button.tsx` (NEW)

A small icon button that opens the shortcuts help dialog.

**Behavior**:
- Renders a `Keyboard` icon from lucide-react
- Tooltip: "Keyboard shortcuts (?)"
- Hidden when `useHoverCapability()` returns false
- Receives `onClick` prop to toggle the dialog

**Placement**: Rendered inside Board component, positioned in the board area (e.g., bottom-right or near stage columns header).

**Testing**: Covered by Task 3 component test + Task 6 integration

---

### Task 5: Integrate into Board component

**File**: `components/board/board.tsx` (MODIFY)

**Changes**:
1. Add imports for new hooks and components
2. Add state:
   ```typescript
   const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
   const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(() => {
     // First-visit auto-show (SSR-safe, try-catch for private browsing)
     if (typeof window === 'undefined') return false;
     try {
       return localStorage.getItem('shortcuts-hint-dismissed') !== 'true';
     } catch { return false; }
   });
   ```
3. Add `useHoverCapability()` call
4. Add `useKeyboardShortcuts()` with callbacks:
   - `onNewTicket`: `setIsNewTicketModalOpen(true)`
   - `onFocusSearch`: `document.querySelector<HTMLInputElement>('[data-testid="ticket-search-input"]')?.focus()`
   - `onColumnNav`: `document.querySelector<HTMLElement>('[data-column=STAGE_NAME]')?.scrollIntoView({ behavior: 'smooth', inline: 'center' })`
   - `onToggleHelp`: toggle `isShortcutsHelpOpen` + set localStorage
   - `enabled`: `hasHover && !isModalOpen && !isShortcutsHelpOpen` (suppress when detail modal or other modals open)
5. Add `<NewTicketModal>` controlled by `isNewTicketModalOpen`
6. Add `<KeyboardShortcutsDialog>` controlled by `isShortcutsHelpOpen`
7. Add `<ShortcutsHelpButton>` with click handler
8. On help dialog close: set `localStorage.setItem('shortcuts-hint-dismissed', 'true')`

**Column mapping for `onColumnNav`**:
```typescript
const STAGE_BY_NUMBER: Record<number, string> = {
  1: 'INBOX', 2: 'SPECIFY', 3: 'PLAN',
  4: 'BUILD', 5: 'VERIFY', 6: 'SHIP',
};
```

---

### Task 6: Add `data-testid` to search input

**File**: `components/search/ticket-search.tsx` (MODIFY)

Add `data-testid="ticket-search-input"` to the search `<Input>` element so `onFocusSearch` can target it via DOM query.

---

### Task 7: Unit tests for hooks

**Files**:
- `tests/unit/use-hover-capability.test.ts` (NEW)
- `tests/unit/use-keyboard-shortcuts.test.ts` (NEW)

**Test plan for `useKeyboardShortcuts`**:
1. Fires `onNewTicket` when `N` pressed (not in input)
2. Fires `onFocusSearch` when `S` pressed
3. Fires `onFocusSearch` when `/` pressed
4. Fires `onColumnNav(1)` through `onColumnNav(6)` for number keys
5. Fires `onToggleHelp` when `?` pressed
6. Does NOT fire any callback when `enabled=false`
7. Does NOT fire any callback when target is an INPUT element
8. Does NOT fire any callback when target is a TEXTAREA element
9. Does NOT fire any callback when target is contentEditable

**Test plan for `useHoverCapability`**:
1. Returns true when matchMedia matches
2. Returns false when matchMedia does not match

---

### Task 8: Component test for `KeyboardShortcutsDialog`

**File**: `tests/unit/components/keyboard-shortcuts-dialog.test.tsx` (NEW)

1. Renders dialog with all shortcut entries when open=true
2. Does not render content when open=false
3. Calls onOpenChange(false) when close button clicked
4. Contains accessible dialog role and heading
5. Displays all 5 shortcut categories (N, S//, 1-6, ?, Esc)

---

### Task 9: Type-check and lint validation

Run `bun run type-check` and `bun run lint` before committing. Fix any issues.

---

## Testing Strategy

| Component | Test Type | Location | Rationale |
|-----------|-----------|----------|-----------|
| `useHoverCapability` | Unit | `tests/unit/` | Pure hook with matchMedia |
| `useKeyboardShortcuts` | Unit | `tests/unit/` | Pure hook with event listeners |
| `KeyboardShortcutsDialog` | Component (RTL) | `tests/unit/components/` | React component with user interaction |
| Board integration | Component/E2E | Existing tests cover board rendering | Keyboard shortcuts are additive; manual testing sufficient for integration |

**Decision tree applied**:
- Hooks are pure functions with side effects → Unit test
- Dialog is a React component → Component test (RTL)
- No new API endpoints → No integration tests needed
- Keyboard events work without real browser → No E2E needed (unit test with fireEvent)

---

## File Change Summary

| File | Action | Size Estimate |
|------|--------|---------------|
| `lib/hooks/use-hover-capability.ts` | CREATE | ~30 lines |
| `lib/hooks/use-keyboard-shortcuts.ts` | CREATE | ~60 lines |
| `components/board/keyboard-shortcuts-dialog.tsx` | CREATE | ~80 lines |
| `components/board/shortcuts-help-button.tsx` | CREATE | ~30 lines |
| `components/board/board.tsx` | MODIFY | +40 lines |
| `components/search/ticket-search.tsx` | MODIFY | +1 line |
| `tests/unit/use-hover-capability.test.ts` | CREATE | ~40 lines |
| `tests/unit/use-keyboard-shortcuts.test.ts` | CREATE | ~120 lines |
| `tests/unit/components/keyboard-shortcuts-dialog.test.tsx` | CREATE | ~80 lines |

**Total**: 4 new source files, 2 modified files, 3 new test files

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shortcut conflicts with browser defaults | `/` triggers Firefox quick-find | `preventDefault()` on matched shortcuts |
| Performance of global keydown listener | Negligible | Single listener, O(1) key lookup |
| Dual NewTicketModal instances | Potential state conflicts | Keyboard modal is independent; only one visible at a time |
| localStorage unavailable | First-visit hint fails silently | Try-catch with graceful fallback |

## Dependencies

- No new npm packages required
- Uses existing: shadcn/ui Dialog, lucide-react icons, React hooks
