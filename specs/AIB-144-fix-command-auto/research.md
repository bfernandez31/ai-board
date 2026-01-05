# Research: Command Autocomplete Fix

**Feature**: AIB-144 Fix Command Autocomplete Behavior and Dropdown Positioning

## Research Task 1: Space Closes Command Autocomplete

**Decision**: Add space detection to command autocomplete trigger logic in `handleInputChange`

**Rationale**: The existing code in `mention-input.tsx` lines 282-291 (ticket) and 306-314 (mention) already checks `!query.includes(' ')` to close autocomplete when space is typed. Command autocomplete (lines 258-271) does NOT have this check.

**Implementation**:
```typescript
// Current command trigger (lines 264-271):
if (aiBoardMentionPattern.test(textBeforeSlash)) {
  const query = textBeforeCursor.substring(lastSlashIndex + 1);
  setTriggerPosition(lastSlashIndex);
  setSearchQuery(query);
  setAutocompleteType('command');
  setSelectedIndex(0);
  return;
}

// Fix: Add space check like other autocomplete types:
if (aiBoardMentionPattern.test(textBeforeSlash)) {
  const query = textBeforeCursor.substring(lastSlashIndex + 1);
  if (!query.includes(' ')) {  // <-- ADD THIS CHECK
    setTriggerPosition(lastSlashIndex);
    setSearchQuery(query);
    setAutocompleteType('command');
    setSelectedIndex(0);
    return;
  }
}
```

**Alternatives Considered**:
1. Debounce space key - Rejected (inconsistent with other autocomplete types)
2. Only close on Enter after space - Rejected (breaks consistency)

## Research Task 2: Prevent Re-trigger After Selection

**Decision**: Track whether a command was already inserted to prevent re-triggering

**Rationale**: Current implementation closes autocomplete on selection (line 463-465) and moves cursor past the inserted command (lines 468-474). However, the regex pattern `/@\[[^\]]*AI-BOARD[^\]]*\]\s*$/` at line 263 will still match if user types `/` again after the command.

**Analysis**: The current behavior is actually correct - if user types `@[id:AI-BOARD] /compare ` and then types another `/`, it WON'T trigger because the pattern requires `@[...]AI-BOARD[...]\s*$` (whitespace at end), and after `/compare /` the pattern won't match since there's a `/` after whitespace, not before.

**Implementation**: No change needed for re-trigger prevention. The existing pattern correctly handles this case. Testing should verify this behavior.

## Research Task 3: Dropdown Positioning Within Viewport

**Decision**: Implement boundary detection using `getBoundingClientRect()` with flip-and-shift logic

**Rationale**: Current positioning (lines 480-490) uses fixed offset without checking viewport boundaries. Dropdown can overflow right/bottom edges of modals or viewport.

**Current Limitations**:
- Fixed `top: coords.top + 24` positioning always places dropdown below
- Fixed `left: coords.left` without right-edge detection
- Hardcoded `w-80` (320px) width without responsive adjustment
- No vertical flip when near bottom edge

**Recommended Approach**:
```typescript
// Enhanced positioning calculation
const calculateBoundedPosition = (
  textareaRef: HTMLTextAreaElement,
  coords: { top: number; left: number },
  dropdownWidth: number = 320,
  dropdownHeight: number = 200 // max-h-[200px]
) => {
  const rect = textareaRef.getBoundingClientRect();
  const lineHeight = 24;

  // Calculate absolute positions in viewport coordinates
  let top = rect.top + coords.top + lineHeight;
  let left = rect.left + coords.left;

  // Check right edge overflow
  if (left + dropdownWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - dropdownWidth - 16);
  }

  // Check bottom edge overflow - flip above if needed
  if (top + dropdownHeight > window.innerHeight - 16) {
    // Position above the cursor instead
    const topAbove = rect.top + coords.top - dropdownHeight - 8;
    if (topAbove > 0) {
      top = topAbove;
    }
  }

  // Convert back to relative positioning (subtract textarea rect)
  return {
    top: top - rect.top,
    left: left - rect.left,
  };
};
```

**Alternatives Considered**:
1. Floating UI library - Rejected (adds dependency for simple case)
2. React Portal to body - Rejected (breaks modal stacking context)
3. CSS-only max-width - Partial (doesn't handle vertical flip)

## Research Task 4: Testing Strategy

**Decision**: Extend existing RTL component tests per constitution III

**Rationale**: Constitution mandates Vitest + RTL for interactive UI components. Existing test file `tests/unit/components/command-autocomplete.test.tsx` should be extended.

**Test Cases Required**:

For MentionInput (new test file may be needed):
1. Space after `/` closes command dropdown
2. Space after `/com` (partial command) closes dropdown
3. Typing after command selection does not re-trigger
4. Dropdown repositions when near right edge
5. Dropdown flips above when near bottom edge

For CommandAutocomplete (extend existing):
- Verify dropdown receives correct positioning props

**Implementation Approach**:
- Create `tests/unit/components/mention-input.test.tsx` for autocomplete behavior
- Use mock `getBoundingClientRect` for positioning tests
- Test edge cases documented in spec

## Summary

| Research Task | Decision | Complexity |
|---------------|----------|------------|
| Space closes command | Add `!query.includes(' ')` check | Low |
| Prevent re-trigger | No change needed (already works) | None |
| Viewport positioning | Add boundary detection function | Medium |
| Testing | Extend RTL component tests | Low |
