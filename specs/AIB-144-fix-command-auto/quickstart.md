# Implementation Quickstart: Command Autocomplete Fix

**Feature**: AIB-144 Fix Command Autocomplete Behavior and Dropdown Positioning

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `components/comments/mention-input.tsx` | MODIFY | Add space-closes logic and boundary detection |
| `tests/unit/components/mention-input.test.tsx` | CREATE | Test autocomplete behavior |

## Implementation Steps

### Step 1: Add Space-Closes Logic for Commands

**File**: `components/comments/mention-input.tsx`
**Location**: Lines 264-270 (command trigger logic)

```diff
 if (aiBoardMentionPattern.test(textBeforeSlash)) {
   const query = textBeforeCursor.substring(lastSlashIndex + 1);
+  if (!query.includes(' ')) {
     setTriggerPosition(lastSlashIndex);
     setSearchQuery(query);
     setAutocompleteType('command');
     setSelectedIndex(0);
     return;
+  }
 }
```

### Step 2: Add Boundary Detection Function

**File**: `components/comments/mention-input.tsx`
**Location**: After `getCaretCoordinates` function (line 226)

```typescript
/**
 * Calculate bounded position to keep dropdown within viewport
 */
const calculateBoundedPosition = useCallback((
  coords: { top: number; left: number },
  textareaRect: DOMRect
): { top: number; left: number } => {
  const dropdownWidth = 320; // w-80
  const dropdownHeight = 200; // max-h-[200px]
  const lineHeight = 24;
  const buffer = 16;

  // Calculate absolute viewport position
  const absoluteTop = textareaRect.top + coords.top + lineHeight;
  const absoluteLeft = textareaRect.left + coords.left;

  let top = coords.top + lineHeight;
  let left = coords.left;

  // Check right edge overflow
  if (absoluteLeft + dropdownWidth > window.innerWidth - buffer) {
    left = Math.max(0, window.innerWidth - textareaRect.left - dropdownWidth - buffer);
  }

  // Check bottom edge overflow - flip above if needed
  if (absoluteTop + dropdownHeight > window.innerHeight - buffer) {
    const topAbove = coords.top - dropdownHeight - 8;
    if (textareaRect.top + topAbove > 0) {
      top = topAbove;
    }
  }

  return { top, left };
}, []);
```

### Step 3: Update Position Calculation

**File**: `components/comments/mention-input.tsx`
**Location**: Lines 480-490 (useEffect for position)

```diff
 useEffect(() => {
   if (isAutocompleteOpen && textareaRef.current && triggerPosition !== null) {
     const coords = getCaretCoordinates(textareaRef.current, triggerPosition);
+    const rect = textareaRef.current.getBoundingClientRect();
+    const boundedPosition = calculateBoundedPosition(coords, rect);
-    setAutocompletePosition({
-      top: coords.top + 24,
-      left: coords.left,
-    });
+    setAutocompletePosition(boundedPosition);
   }
-}, [isAutocompleteOpen, triggerPosition, getCaretCoordinates]);
+}, [isAutocompleteOpen, triggerPosition, getCaretCoordinates, calculateBoundedPosition]);
```

### Step 4: Create Component Tests

**File**: `tests/unit/components/mention-input.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, fireEvent } from '@/tests/utils/component-test-utils';
import { MentionInput } from '@/components/comments/mention-input';

const mockProjectMembers = [
  { id: 'ai-board', name: 'AI-BOARD', email: 'ai-board@system.local' },
  { id: 'user-1', name: 'Test User', email: 'test@example.com' },
];

describe('MentionInput - Command Autocomplete', () => {
  describe('Space closes dropdown', () => {
    it('should close command dropdown when space is typed after /', async () => {
      // Test implementation
    });

    it('should close command dropdown when space is typed after partial command', async () => {
      // Test implementation
    });
  });

  describe('Selection behavior', () => {
    it('should not re-trigger autocomplete after command selection', async () => {
      // Test implementation
    });
  });
});
```

## Verification

```bash
# Run component tests
bun run test:unit -- --grep "MentionInput"

# Run all autocomplete tests
bun run test:unit -- --grep "autocomplete"

# Type check
bun run type-check
```

## Definition of Done

- [ ] Space after `/` closes command dropdown
- [ ] Space after partial command (e.g., `/com `) closes dropdown
- [ ] Dropdown stays within viewport horizontally
- [ ] Dropdown flips above cursor when near bottom edge
- [ ] All existing tests pass
- [ ] New tests cover space-closes and positioning behavior
