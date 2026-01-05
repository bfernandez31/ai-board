# Research: Fix Command Autocomplete Behavior and Dropdown Positioning

**Branch**: `AIB-143-copy-of-fix` | **Date**: 2026-01-05

## Research Summary

This document captures research findings for the autocomplete bug fixes and positioning improvements.

---

## Issue 1: Command Autocomplete Not Closing After Selection

### Current Behavior Analysis

**File**: `components/comments/mention-input.tsx`

The `handleSelectCommand` function (lines 448-475) correctly:
1. Inserts the selected command into the textarea
2. Adds a space after the command
3. Calls `setAutocompleteType('none')` to close the dropdown
4. Resets `searchQuery` and `triggerPosition`

**Root Cause**: The bug is not in the selection handler but in `handleInputChange` (lines 249-321). After selection, when the user continues typing, the function re-detects the `/` trigger because:
- The `@[...AI-BOARD...]` pattern is still present before the `/`
- There is no tracking of "command already selected at this position"

### Decision: Track completed command positions
- **Rationale**: The simplest fix is to track that a command was selected at a given trigger position, preventing re-triggering
- **Alternatives Considered**:
  1. Clear the AI-BOARD mention after command selection - Rejected: changes expected behavior
  2. Track last successful selection position - Selected: minimal state addition, clear semantics

---

## Issue 2: Command Autocomplete Not Closing on Space

### Current Behavior Analysis

**File**: `components/comments/mention-input.tsx`

For `@` mentions (lines 294-317) and `#` tickets (lines 274-292), the code checks:
```typescript
if (!query.includes(' ')) {
  // Only show autocomplete if query doesn't contain spaces
}
```

For `/` commands (lines 257-272), there is NO space check:
```typescript
const query = textBeforeCursor.substring(lastSlashIndex + 1);
setTriggerPosition(lastSlashIndex);
setSearchQuery(query);
setAutocompleteType('command');
```

**Root Cause**: Missing space detection for command autocomplete.

### Decision: Add consistent space detection for commands
- **Rationale**: Align with existing patterns for `@` and `#` autocomplete
- **Alternatives Considered**:
  1. Different behavior for commands - Rejected: inconsistent UX
  2. Match existing pattern - Selected: consistency with established codebase conventions

---

## Issue 3: Dropdown Positioning Overflow

### Current Behavior Analysis

**File**: `components/comments/mention-input.tsx`

The positioning logic (lines 480-490):
```typescript
setAutocompletePosition({
  top: coords.top + 24, // Add line height
  left: coords.left,
});
```

Uses fixed positioning without viewport boundary awareness:
```typescript
<div
  className="absolute w-80"
  style={{
    zIndex: 9999,
    top: `${autocompletePosition.top}px`,
    left: `${autocompletePosition.left}px`,
  }}
>
```

**Root Cause**: No viewport boundary checks before rendering the dropdown.

### Decision: Implement viewport-aware positioning
- **Rationale**: Standard UI pattern for dropdowns; prevents overflow near edges
- **Alternatives Considered**:
  1. Use Radix UI Popover - Rejected: significant refactor for a positioning fix
  2. CSS-only solution with `max()` - Rejected: doesn't handle all edge cases
  3. JavaScript boundary calculation - Selected: precise control, minimal dependencies

### Implementation Approach

Calculate viewport boundaries and adjust position:
```typescript
const calculateViewportAwarePosition = (
  coords: { top: number; left: number },
  textareaRect: DOMRect,
  dropdownWidth: number = 320,  // w-80 = 20rem = 320px
  dropdownHeight: number = 200  // max-h-[200px]
) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Convert relative coords to absolute viewport position
  const absoluteLeft = textareaRect.left + coords.left;
  const absoluteTop = textareaRect.top + coords.top + 24; // line height offset

  // Adjust horizontal position
  let left = coords.left;
  if (absoluteLeft + dropdownWidth > viewportWidth) {
    left = Math.max(0, coords.left - (absoluteLeft + dropdownWidth - viewportWidth + 16));
  }

  // Adjust vertical position (show above if overflowing)
  let top = coords.top + 24;
  if (absoluteTop + dropdownHeight > viewportHeight) {
    top = coords.top - dropdownHeight - 8; // Position above cursor
  }

  return { top, left };
};
```

---

## Testing Strategy

### Unit Tests (Vitest + RTL)

Extend existing `tests/unit/components/command-autocomplete.test.tsx`:
- Test command selection closes autocomplete
- Test space character closes autocomplete
- Test keyboard Enter closes autocomplete

Create/extend `tests/unit/components/mention-input.test.tsx`:
- Test viewport-aware positioning calculations
- Test positioning adjusts near right edge
- Test positioning adjusts near bottom edge

### Integration Considerations

- Test with all three autocomplete types (mentions, tickets, commands)
- Test in modal context (primary use case)
- Test rapid typing scenarios

---

## Dependencies and Risks

### Dependencies
- No new dependencies required
- Uses existing React hooks and DOM APIs

### Risks
- **Low**: State addition for tracking selection position
- **Medium**: Positioning calculation complexity with scrollable containers
- **Mitigation**: Test in actual modal context; use getBoundingClientRect for accuracy
