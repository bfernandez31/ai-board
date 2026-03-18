# Research: AIB-299 Add Keyboard Shortcuts

## R1: Keyboard Event Handling in React

**Decision**: Use a custom `useKeyboardShortcuts` hook with `useEffect` + global `keydown` listener on `document`.

**Rationale**:
- Global listener captures keys regardless of which element has focus
- `useEffect` cleanup properly removes the listener on unmount
- Aligns with existing patterns (ticket-detail-modal already uses global keydown for Cmd+1/2/3/4)
- `keydown` preferred over `keypress` (deprecated) or `keyup` (delayed feel)

**Alternatives considered**:
- Per-element `onKeyDown` handlers: Too fragile, requires focus management
- Third-party libraries (react-hotkeys-hook): Unnecessary dependency for simple shortcuts

## R2: Input Focus Detection (Suppression)

**Decision**: Check `event.target` against `INPUT`, `TEXTAREA`, `SELECT` tags and `contentEditable` attribute.

**Rationale**:
- Standard pattern for keyboard shortcut libraries
- Prevents shortcuts from firing while user is typing
- `document.activeElement` could also work but `event.target` is more direct

**Implementation**:
```typescript
function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
```

## R3: Desktop Detection via CSS Media Query

**Decision**: Use `window.matchMedia('(hover: hover)')` via `useSyncExternalStore` (same pattern as `useReducedMotion`).

**Rationale**:
- Spec mandates `(hover: hover)` media query (auto-resolved decision)
- `useSyncExternalStore` is the established pattern in this codebase (`use-reduced-motion.ts`)
- SSR-safe with `getServerSnapshot` returning `false` (no shortcuts on server)
- Reactive to device changes (e.g., tablet keyboard attach/detach)

**Alternatives considered**:
- `navigator.maxTouchPoints`: Less reliable, doesn't detect keyboard presence
- User-agent sniffing: Fragile and deprecated approach

## R4: Ticket Detail Modal Scope Boundary

**Decision**: Check if ticket detail modal is open via a prop/state passed to the hook, and suppress all shortcuts except Escape when true.

**Rationale**:
- Spec requires shortcuts inactive inside ticket detail modal (FR-014)
- The modal already has its own keyboard handlers (Cmd+1/2/3/4)
- Board component already tracks `isModalOpen` state — pass it to the hook

## R5: Column Scrolling

**Decision**: Use `element.scrollIntoView({ behavior: 'smooth', inline: 'center' })` targeting `[data-column=STAGE]` elements.

**Rationale**:
- Stage columns already have `data-column={stage}` attributes
- `scrollIntoView` is native, well-supported, and handles edge cases
- `inline: 'center'` centers the column horizontally in the viewport
- `behavior: 'smooth'` matches spec requirement for smooth scrolling

## R6: Search Input Focus

**Decision**: Use `document.querySelector` to find the search input and call `.focus()` on it.

**Rationale**:
- The search input lives in the Header component, separate from the Board component tree
- Passing refs across distant components would require context or prop drilling
- A simple DOM query is pragmatic and low-coupling
- The search input can be targeted via a `data-testid` or id attribute

## R7: New Ticket Modal via Keyboard

**Decision**: Add a separate NewTicketModal instance at the Board level, controlled by new state (`isNewTicketModalOpen`).

**Rationale**:
- The existing NewTicketButton manages its own modal internally
- Lifting that state would require refactoring the button component
- Adding a parallel modal instance at Board level is simpler and isolated
- Both the button and keyboard shortcut trigger the same modal component

## R8: Help Overlay Component

**Decision**: Create a new `KeyboardShortcutsDialog` component using shadcn/ui `Dialog`.

**Rationale**:
- Consistent with existing modal patterns in the codebase
- Dialog handles Escape-to-close and click-outside natively
- Two-column table layout for Key | Action display
- Toggle behavior via the `?` shortcut

## R9: First-Visit Auto-Show

**Decision**: Use localStorage with key `shortcuts-hint-dismissed`, checked on mount with SSR-safe guard.

**Rationale**:
- Matches the pattern in `push-opt-in-prompt.tsx` (localStorage + `typeof window` check)
- Spec explicitly names the key `shortcuts-hint-dismissed`
- Graceful degradation: wrap in try-catch for private browsing mode

## R10: Help Icon in Board Header

**Decision**: Add a `?` icon button in the board area (not the global header) that triggers the help overlay.

**Rationale**:
- Keeps the shortcut help co-located with the board where shortcuts are active
- Uses `Keyboard` icon from lucide-react with tooltip
- Hidden on mobile via `(hover: hover)` media query (same as shortcuts)
