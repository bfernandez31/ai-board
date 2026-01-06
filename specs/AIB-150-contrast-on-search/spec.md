# Feature Specification: Contrast on Search Closed Ticket

**Feature Branch**: `AIB-150-contrast-on-search`
**Created**: 2026-01-06
**Status**: Draft
**Input**: User description: "closed ticket have contraste issu in the dropdown search ticket. And on click on the ticket the closed one are not show on the modal"

## Auto-Resolved Decisions

- **Decision**: Improve contrast for closed tickets in search dropdown when selected
- **Policy Applied**: AUTO (resolved as PRAGMATIC based on internal UI polish context)
- **Confidence**: High (score 0.9) - Clear UI accessibility issue with straightforward fix
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Visual consistency with non-selected closed ticket styling may slightly change
  2. Minimal development effort for significant accessibility improvement
- **Reviewer Notes**: Verify WCAG contrast ratios for selected closed ticket items meet AA standards (4.5:1 for normal text)

---

- **Decision**: Fetch closed tickets separately for modal access from search
- **Policy Applied**: AUTO (resolved as PRAGMATIC based on internal feature context)
- **Confidence**: High (score 0.9) - Closed tickets should be viewable via search for reference purposes
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Additional API call or query modification needed to include closed tickets
  2. Read-only modal already handles closed ticket display (implemented in AIB-148)
- **Reviewer Notes**: Verify closed tickets open in read-only modal mode with comments disabled (existing behavior from AIB-148)

## User Scenarios & Testing

### User Story 1 - View Closed Ticket Details via Search (Priority: P1)

A user searches for a previously closed ticket to reference its details, comments, or documentation for a new related task.

**Why this priority**: Users need to access historical ticket information for context, especially when working on related features or investigating past decisions.

**Independent Test**: Can be fully tested by closing a ticket, searching for it, clicking on the result, and verifying the modal opens with full ticket details in read-only mode.

**Acceptance Scenarios**:

1. **Given** a closed ticket exists in the project, **When** the user searches for it by key or title, **Then** the ticket appears in the dropdown with a "Closed" badge and muted styling
2. **Given** a closed ticket appears in search results, **When** the user clicks on it, **Then** the ticket detail modal opens displaying the ticket in read-only mode
3. **Given** a closed ticket modal is open, **When** the user views the details tab, **Then** the title, description, and documentation buttons are accessible for reading

---

### User Story 2 - Readable Closed Ticket in Search Dropdown (Priority: P1)

A user can clearly distinguish and read closed tickets in the search dropdown, even when the ticket is highlighted/selected.

**Why this priority**: Accessibility and usability - users must be able to read ticket information regardless of selection state.

**Independent Test**: Can be tested by typing a search query that returns closed tickets and using keyboard navigation to select them, verifying text remains readable.

**Acceptance Scenarios**:

1. **Given** closed tickets appear in search results, **When** the user views the dropdown, **Then** closed tickets are visually distinguishable with sufficient contrast for readability
2. **Given** a closed ticket in search results, **When** the user hovers over or selects it with keyboard, **Then** the ticket key, title, and "Closed" badge remain readable with adequate contrast
3. **Given** a closed ticket is keyboard-selected (highlighted), **When** the user views the selected item, **Then** all text elements meet WCAG AA contrast requirements (4.5:1 minimum)

---

### Edge Cases

- What happens when searching returns only closed tickets? All results should be viewable and clickable, opening in read-only modal mode
- What happens when a user clicks a closed ticket while another modal is open? Standard modal behavior applies - the new modal replaces the current one
- What happens when the closed ticket was recently closed (transition race condition)? Search API includes latest state; modal should display current CLOSED state

## Requirements

### Functional Requirements

- **FR-001**: System MUST display closed tickets in search results with visible "Closed" badge and muted styling
- **FR-002**: System MUST maintain readable text contrast for closed tickets in all states (default, hover, selected)
- **FR-003**: System MUST open the ticket detail modal when a user clicks on a closed ticket in search results
- **FR-004**: System MUST display closed ticket modal in read-only mode consistent with existing CLOSED stage behavior
- **FR-005**: Closed ticket styling in selected state MUST meet WCAG AA contrast requirements (4.5:1 for text)

### Key Entities

- **Ticket**: Existing entity with `stage` field that can be `CLOSED`; search results include closed tickets
- **SearchResult**: Includes `id`, `ticketKey`, `title`, and `stage` fields; used for dropdown display and navigation

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can successfully open any closed ticket from search results (100% of attempts)
- **SC-002**: Text contrast in selected closed ticket items meets WCAG AA standard (4.5:1 ratio minimum)
- **SC-003**: All closed ticket search-to-modal flows complete without errors
- **SC-004**: Users can read closed ticket details in the modal including title, description, and documentation
