# Feature Specification: Fix Command Autocomplete Behavior and Dropdown Positioning

**Feature Branch**: `AIB-144-fix-command-auto`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "Fix command auto complete spec/test - Issue with command autocomplete in comments and dropdown positioning"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Command autocomplete should close when a space is typed after the command name, consistent with `@mention` and `#ticket` behavior
- **Policy Applied**: AUTO (inferred PRAGMATIC)
- **Confidence**: High (0.9) - The existing codebase shows consistent behavior for mentions and tickets that should apply to commands
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent UX across all autocomplete types
  2. May require users to re-trigger autocomplete if they accidentally press space
- **Reviewer Notes**: The ticket and mention autocomplete already close on space; this standardizes command behavior

---

- **Decision**: Dropdown positioning should use viewport boundary detection to prevent overflow, reusing the same logic across all three autocomplete types (mentions, tickets, commands)
- **Policy Applied**: AUTO (inferred CONSERVATIVE)
- **Confidence**: High (0.9) - Positioning bugs affect usability; a robust solution prevents edge cases
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more complex positioning logic
  2. Consistent dropdown behavior regardless of modal size or position
- **Reviewer Notes**: The fix should apply to all autocomplete dropdowns since all share the same issue

---

- **Decision**: Tests should use React Testing Library component tests (Vitest + RTL) per project testing guidelines, not E2E Playwright tests
- **Policy Applied**: AUTO (inferred from CLAUDE.md testing guidelines)
- **Confidence**: High (0.9) - CLAUDE.md explicitly states RTL for interactive UI components
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Faster test execution
  2. Focused on specific component behavior rather than full integration
- **Reviewer Notes**: Existing tests in `/tests/unit/components/` follow this pattern

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Command Autocomplete Closes After Selection (Priority: P1)

A user mentions `@ai-board` and types `/compare` to invoke a command. After selecting the command (via Enter or mouse click), the dropdown closes and the command is inserted with a trailing space. If the user continues typing (e.g., arguments), the dropdown should NOT reappear.

**Why this priority**: Core functionality fix - the bug makes command autocomplete unusable when commands are selected and users continue typing.

**Independent Test**: Can be tested by simulating user input in the `MentionInput` component, verifying dropdown state after command selection.

**Acceptance Scenarios**:

1. **Given** a comment input with `@[id:AI-BOARD] /` typed, **When** user selects `/compare` from the dropdown, **Then** the dropdown closes and `/compare ` (with trailing space) is inserted.
2. **Given** a comment input with `@[id:AI-BOARD] /compare ` already typed (command selected with space), **When** user types additional characters, **Then** the command dropdown does NOT reappear.
3. **Given** a comment input with `@[id:AI-BOARD] /` typed, **When** user types a space immediately after the slash, **Then** the dropdown closes (no command selected).

---

### User Story 2 - Dropdown Positioned Within Viewport (Priority: P2)

When the autocomplete dropdown appears near the edge of a modal or viewport, it should reposition to remain fully visible rather than being clipped or overflowing.

**Why this priority**: UX improvement - affects all autocomplete types (mentions, tickets, commands) but doesn't block functionality.

**Independent Test**: Can be tested by rendering the component in a constrained container and verifying dropdown coordinates stay within bounds.

**Acceptance Scenarios**:

1. **Given** a comment input near the right edge of a modal, **When** autocomplete dropdown appears, **Then** the dropdown shifts left to remain fully visible within the modal.
2. **Given** a comment input near the bottom edge of a modal, **When** autocomplete dropdown appears, **Then** the dropdown appears above the cursor instead of below.
3. **Given** a comment input in the center of a modal, **When** autocomplete dropdown appears, **Then** the dropdown appears below the cursor in the default position.

---

### User Story 3 - Space Closes Command Autocomplete (Priority: P1)

When a user types `/` after an `@ai-board` mention and then types a space before selecting a command, the dropdown should close. This matches the behavior of `@mention` and `#ticket` autocomplete.

**Why this priority**: Consistency fix - the current behavior is inconsistent with other autocomplete types.

**Independent Test**: Can be tested by simulating typing `/` followed by space and verifying dropdown closes.

**Acceptance Scenarios**:

1. **Given** a comment input with `@[id:AI-BOARD] /` typed and command dropdown open, **When** user types a space, **Then** the dropdown closes.
2. **Given** a comment input with `@[id:AI-BOARD] /com` typed (partial command), **When** user types a space, **Then** the dropdown closes.

---

### Edge Cases

- What happens when dropdown would overflow both horizontally and vertically? Dropdown repositions to best available space (prioritize vertical adjustment, then horizontal).
- How does the dropdown behave when the modal is resized while dropdown is open? Dropdown should recalculate position on next input event or close.
- What happens when user types `/` not preceded by `@ai-board`? Dropdown should NOT appear (existing behavior, unchanged).
- What happens when there are no matching commands? Dropdown shows "No commands found" message (existing behavior, unchanged).
- What happens when user selects a command then types another `/`? Should not trigger a new autocomplete since there's already a command in the text (unless preceded by new `@ai-board` mention).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST close command autocomplete dropdown when user types a space after the `/` trigger character.
- **FR-002**: System MUST close command autocomplete dropdown when a command is selected (via Enter or mouse click) and cursor moves past the inserted command.
- **FR-003**: System MUST NOT re-trigger command autocomplete when user continues typing after a command has been selected and inserted.
- **FR-004**: System MUST position all autocomplete dropdowns (mentions, tickets, commands) within visible viewport bounds.
- **FR-005**: System MUST shift dropdown horizontally left when it would overflow the right edge of the container.
- **FR-006**: System MUST position dropdown above the cursor when it would overflow the bottom edge of the container.
- **FR-007**: System MUST maintain consistent space-closes-dropdown behavior across all three autocomplete types.

### Key Entities *(include if feature involves data)*

- **AutocompletePosition**: Coordinates (top, left) for dropdown placement, now including boundary detection logic.
- **AutocompleteType**: Enum of 'none' | 'mention' | 'ticket' | 'command' - unchanged but behavior standardized.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Command autocomplete dropdown closes immediately when user types a space after `/`, matching behavior of `@` and `#` autocomplete.
- **SC-002**: After selecting a command, typing additional text does not reopen the command dropdown.
- **SC-003**: Autocomplete dropdowns remain 100% visible within the modal/viewport boundary regardless of cursor position.
- **SC-004**: All existing autocomplete tests continue to pass after changes.
- **SC-005**: New component tests verify space-closes behavior and boundary detection for command autocomplete.
