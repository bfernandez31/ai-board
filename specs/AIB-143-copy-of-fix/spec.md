# Feature Specification: Fix Command Autocomplete Behavior and Dropdown Positioning

**Feature Branch**: `AIB-143-copy-of-fix`
**Created**: 2026-01-05
**Status**: Draft
**Input**: User description: "Fix command autocomplete behavior after selection and improve dropdown positioning in comment modals"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Command autocomplete should close after a command is selected (treating the selection as complete)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE due to clear bug fix)
- **Confidence**: High (0.9) - This is a bug fix with clear expected behavior; autocomplete should not continue filtering after selection
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simpler user experience with predictable behavior
  2. No impact on timeline - straightforward fix
- **Reviewer Notes**: Verify that command selection properly clears the autocomplete state

---

- **Decision**: Command autocomplete should close when a space is typed after the trigger (similar to existing @ and # behavior)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Existing patterns for @ and # autocomplete already check for spaces; this aligns with established codebase conventions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent behavior across all autocomplete types
  2. Minimal code change required
- **Reviewer Notes**: Ensure space detection is consistent with the existing pattern in handleInputChange

---

- **Decision**: Dropdown positioning should use viewport-aware placement to prevent overflow near modal edges
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Standard UI pattern for dropdown positioning; the current implementation uses fixed positioning without boundary awareness
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Better UX with dropdowns always visible
  2. Slightly more complex positioning logic
- **Reviewer Notes**: Test with all three autocomplete types near different modal edges

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Command Autocomplete Dismissal After Selection (Priority: P1)

Users type `@ai-board /` to trigger command autocomplete, select a command, and then the autocomplete should close and not reappear until a new trigger is detected.

**Why this priority**: Core bug fix that directly addresses the primary issue reported. Without this fix, users cannot effectively use command autocomplete.

**Independent Test**: Can be fully tested by selecting a command and verifying the dropdown closes; delivers a working command autocomplete feature.

**Acceptance Scenarios**:

1. **Given** user has typed `@ai-board /` and command autocomplete is visible, **When** user clicks on a command to select it, **Then** the autocomplete closes and the command is inserted
2. **Given** user has typed `@ai-board /` and command autocomplete is visible, **When** user presses Enter to select the highlighted command, **Then** the autocomplete closes and the command is inserted
3. **Given** user has selected a command, **When** user continues typing after the command, **Then** command autocomplete does not reappear until a new `@ai-board /` pattern is detected

---

### User Story 2 - Command Autocomplete Closes on Space (Priority: P1)

When a user types a space after the `/` trigger (before selecting a command), the command autocomplete should close, treating the space as ending the command search.

**Why this priority**: Core bug fix that directly addresses the issue of autocomplete continuing to filter after adding a space.

**Independent Test**: Can be fully tested by typing `/` followed by a space and verifying the dropdown closes.

**Acceptance Scenarios**:

1. **Given** user has typed `@ai-board /` and command autocomplete is visible, **When** user types a space, **Then** the autocomplete closes
2. **Given** user has typed `@ai-board /ver` with autocomplete showing filtered commands, **When** user types a space, **Then** the autocomplete closes

---

### User Story 3 - Viewport-Aware Dropdown Positioning (Priority: P2)

Autocomplete dropdowns (command, user mention, ticket) should remain fully visible within the viewport, adjusting position when near modal edges.

**Why this priority**: Secondary UX improvement that affects usability but does not block core functionality.

**Independent Test**: Can be fully tested by triggering autocomplete near each edge of the modal and verifying the dropdown remains visible.

**Acceptance Scenarios**:

1. **Given** comment textarea is positioned near the right edge of a modal, **When** user triggers autocomplete, **Then** the dropdown repositions to remain within the visible area
2. **Given** comment textarea is positioned near the bottom edge of a modal, **When** user triggers autocomplete, **Then** the dropdown appears above the trigger or adjusts to remain visible
3. **Given** comment textarea is positioned near the left edge of a modal, **When** user triggers autocomplete, **Then** the dropdown repositions to remain within the visible area

---

### Edge Cases

- What happens when the dropdown would overflow both horizontally and vertically? Position should prioritize visibility, adjusting both axes as needed.
- How does system handle rapid typing of trigger and space? Autocomplete should close immediately on space, regardless of typing speed.
- What happens when autocomplete position changes due to window resize while dropdown is open? Dropdown should reposition on resize or close.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST close command autocomplete when a command is selected (via click or Enter key)
- **FR-002**: System MUST close command autocomplete when user types a space after the `/` trigger character
- **FR-003**: System MUST NOT reopen command autocomplete for the same trigger position after selection
- **FR-004**: System MUST calculate dropdown position relative to viewport boundaries before rendering
- **FR-005**: System MUST adjust dropdown position horizontally when it would overflow the right edge of the viewport
- **FR-006**: System MUST adjust dropdown position vertically when it would overflow the bottom edge of the viewport
- **FR-007**: System MUST apply viewport-aware positioning to all autocomplete types (user mentions, tickets, commands)

### Key Entities *(include if feature involves data)*

- **AutocompletePosition**: Represents the calculated position of the dropdown (top, left coordinates) with viewport boundary awareness
- **TriggerPosition**: The cursor position where the trigger character (@ # /) was detected

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select commands without the autocomplete continuing to filter afterward - 100% success rate
- **SC-002**: Command autocomplete closes within 50ms of typing a space after the trigger
- **SC-003**: Dropdowns remain fully visible when triggered within 320 pixels of any modal edge (dropdown width)
- **SC-004**: All three autocomplete types (mentions, tickets, commands) behave consistently regarding dismissal and positioning
