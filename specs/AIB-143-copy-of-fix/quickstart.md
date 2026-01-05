# Quickstart: Fix Command Autocomplete Behavior and Dropdown Positioning

**Branch**: `AIB-143-copy-of-fix` | **Date**: 2026-01-05

## Implementation Overview

Three bug fixes in the `MentionInput` component:

1. **Command autocomplete closes after selection** - Track completed command positions
2. **Command autocomplete closes on space** - Add space detection matching @ and # behavior
3. **Viewport-aware dropdown positioning** - Calculate boundaries before rendering

## Files to Modify

| File | Changes |
|------|---------|
| `components/comments/mention-input.tsx` | All three fixes |
| `tests/unit/components/mention-input.test.tsx` | New tests for fixes |

## Implementation Steps

### Step 1: Add State for Completed Command Position

```typescript
// In MentionInput component, add new state
const [completedCommandPosition, setCompletedCommandPosition] = useState<number | null>(null);
```

### Step 2: Fix handleSelectCommand

```typescript
// Update handleSelectCommand to track completed position
const handleSelectCommand = (command: AIBoardCommand) => {
  if (!textareaRef.current || triggerPosition === null) return;

  // ... existing insertion logic ...

  // Track that command was selected at this trigger position
  setCompletedCommandPosition(triggerPosition);

  // Close autocomplete
  setAutocompleteType('none');
  setSearchQuery('');
  setTriggerPosition(null);

  // ... cursor positioning ...
};
```

### Step 3: Add Space Detection for Commands

```typescript
// In handleInputChange, add space check for command autocomplete
// Around line 265, after extracting query
const query = textBeforeCursor.substring(lastSlashIndex + 1);

// Add space check (matching @ and # behavior)
if (!query.includes(' ')) {
  // Check if command was already selected at this position
  if (completedCommandPosition !== lastSlashIndex) {
    setTriggerPosition(lastSlashIndex);
    setSearchQuery(query);
    setAutocompleteType('command');
    setSelectedIndex(0);
    return;
  }
}
```

### Step 4: Implement Viewport-Aware Positioning

```typescript
// Add new helper function
const calculateViewportAwarePosition = useCallback((
  coords: { top: number; left: number },
  textareaRect: DOMRect
) => {
  const dropdownWidth = 320;  // w-80
  const dropdownHeight = 200; // max-h-[200px]

  const absoluteLeft = textareaRect.left + coords.left;
  const absoluteTop = textareaRect.top + coords.top + 24;

  let left = coords.left;
  let top = coords.top + 24;

  // Adjust horizontal if overflowing right
  if (absoluteLeft + dropdownWidth > window.innerWidth) {
    left = Math.max(0, window.innerWidth - textareaRect.left - dropdownWidth - 16);
  }

  // Adjust vertical if overflowing bottom
  if (absoluteTop + dropdownHeight > window.innerHeight) {
    top = coords.top - dropdownHeight - 8;
  }

  return { top, left };
}, []);

// Update the positioning useEffect
useEffect(() => {
  if (isAutocompleteOpen && textareaRef.current && triggerPosition !== null) {
    const coords = getCaretCoordinates(textareaRef.current, triggerPosition);
    const textareaRect = textareaRef.current.getBoundingClientRect();
    const position = calculateViewportAwarePosition(coords, textareaRect);
    setAutocompletePosition(position);
  }
}, [isAutocompleteOpen, triggerPosition, getCaretCoordinates, calculateViewportAwarePosition]);
```

### Step 5: Reset Completed Position on New Input

```typescript
// In handleInputChange, reset when no command trigger found
// At the end of the function (around line 319)
if (autocompleteType !== 'command') {
  setCompletedCommandPosition(null);
}
```

## Testing Commands

```bash
# Run unit tests
bun run test:unit

# Run specific test file
bun run test:unit tests/unit/components/mention-input.test.tsx

# Type check
bun run type-check
```

## Acceptance Verification

1. Type `@ai-board /` → Select command → Continue typing → Autocomplete should NOT reopen
2. Type `@ai-board /` → Type space → Autocomplete should close
3. Trigger autocomplete near modal edges → Dropdown should remain visible
