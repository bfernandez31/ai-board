# Feature Specification: Ticket Search in Header

**Feature Branch**: `AIB-115-copy-of-recherche`
**Created**: 2025-12-20
**Status**: Draft
**Input**: User description: "Add a search input in the header center for searching tickets by key, title, or description. Display results in a dropdown showing matching ticket titles. On click, open the ticket modal. Add relevant tests."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Search scope limited to current project's tickets only (not cross-project search)
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: High - This is the standard pattern for project-based applications and aligns with existing authorization model
- **Fallback Triggered?**: Yes - Net score (-1) resulted in low confidence, promoting to CONSERVATIVE
- **Trade-offs**:
  1. Scope limited to single project; users cannot search across all their projects in one query
  2. Simpler implementation aligns with existing project-scoped API patterns
- **Reviewer Notes**: Consider whether cross-project search is a future requirement; current approach matches existing data access patterns

---

- **Decision**: Search is client-side filtering of already-loaded tickets (no new server endpoint)
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: High - Board already loads all project tickets; typical project has <500 tickets
- **Fallback Triggered?**: Yes - Conservative approach avoids new API complexity
- **Trade-offs**:
  1. No server round-trip means instant results; however, initial page load includes all tickets
  2. For very large projects (1000+ tickets), may need server-side search in future
- **Reviewer Notes**: Monitor performance for large projects; server-side pagination may be needed at scale

---

- **Decision**: Minimum search query length is 1 character
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: Medium - Enables searching by short ticket keys (e.g., "A-1")
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Single character may return many results; mitigated by result limit
  2. Better discoverability for short ticket keys
- **Reviewer Notes**: If performance issues arise, increase minimum to 2 characters

---

- **Decision**: Maximum 10 results displayed in dropdown
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: High - Standard UX pattern; prevents overwhelming users
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Users may need to refine search if desired ticket not in top 10
  2. Keeps dropdown manageable and performant
- **Reviewer Notes**: Consider adding "Show all X results" link if many matches exist

---

- **Decision**: Search matching is case-insensitive substring match
- **Policy Applied**: AUTO (fallback to CONSERVATIVE)
- **Confidence**: High - Most intuitive for users; aligns with common search expectations
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. May return more results than exact matching
  2. More forgiving for user input errors
- **Reviewer Notes**: Acceptable for current scale; fuzzy search could be added later

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Ticket Lookup by Key (Priority: P1)

A user remembers a ticket key (e.g., "AIB-42") and wants to quickly navigate to it without scrolling through the board columns.

**Why this priority**: This is the primary use case - users frequently reference tickets by key in conversations, documents, or memory. Direct key lookup saves significant navigation time.

**Independent Test**: Can be fully tested by typing a known ticket key in the search input and verifying the ticket appears in dropdown and opens on click.

**Acceptance Scenarios**:

1. **Given** user is on the project board, **When** user types "AIB-42" in the search input, **Then** ticket AIB-42 appears in the dropdown (if it exists)
2. **Given** search results are displayed, **When** user clicks on a ticket result, **Then** the ticket detail modal opens showing that ticket's information
3. **Given** user types a partial key like "AIB-4", **When** results load, **Then** all tickets with keys containing "AIB-4" are shown (e.g., AIB-4, AIB-40, AIB-42)

---

### User Story 2 - Search by Title Keywords (Priority: P2)

A user wants to find a ticket about a specific feature but doesn't remember the exact ticket key. They search by keywords from the title.

**Why this priority**: Title-based search is the second most common use case when users remember the topic but not the key.

**Independent Test**: Can be fully tested by typing a keyword that exists in a ticket title and verifying matching tickets appear.

**Acceptance Scenarios**:

1. **Given** a ticket exists with title "Add dark mode toggle", **When** user types "dark mode" in search, **Then** the ticket appears in results
2. **Given** multiple tickets have "button" in their titles, **When** user types "button", **Then** all matching tickets are shown (up to limit of 10)
3. **Given** search input has text, **When** user clears the input, **Then** the dropdown closes and no results are shown

---

### User Story 3 - Search by Description Content (Priority: P3)

A user wants to find a ticket that contains specific details in its description, such as a component name or business requirement.

**Why this priority**: Description search is valuable but less common; most users remember titles better than description details.

**Independent Test**: Can be fully tested by typing text that only exists in a ticket's description and verifying it appears in results.

**Acceptance Scenarios**:

1. **Given** a ticket has "authentication flow" only in its description (not in title or key), **When** user types "authentication", **Then** the ticket appears in results
2. **Given** search matches both title and description of different tickets, **When** results display, **Then** all matching tickets are shown regardless of which field matched

---

### User Story 4 - Keyboard Navigation (Priority: P2)

A user prefers keyboard navigation and wants to navigate search results using arrow keys and select with Enter.

**Why this priority**: Keyboard accessibility is important for power users and accessibility compliance.

**Independent Test**: Can be fully tested by using keyboard-only navigation through search results.

**Acceptance Scenarios**:

1. **Given** search results are displayed, **When** user presses Down Arrow, **Then** the next result is highlighted
2. **Given** a result is highlighted, **When** user presses Enter, **Then** the ticket detail modal opens for that ticket
3. **Given** search input is focused, **When** user presses Escape, **Then** the dropdown closes and search input clears

---

### Edge Cases

- What happens when search query matches no tickets? → Dropdown shows "No results found" message
- What happens when user searches while tickets are loading? → Search input shows loading indicator; results appear once data is ready
- What happens when search input is focused but empty? → Dropdown remains closed (no results to show)
- How does system handle special characters in search? → Characters are matched literally (no regex interpretation)
- What happens on mobile devices? → Search input is accessible; dropdown appears below input without obscuring critical UI
- What happens when user clicks outside the dropdown? → Dropdown closes, but search text remains

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a search input field in the center area of the application header
- **FR-002**: Search input MUST be visible when user is viewing any project page (board, analytics, etc.)
- **FR-003**: System MUST search tickets by matching query against ticketKey, title, and description fields
- **FR-004**: Search matching MUST be case-insensitive
- **FR-005**: Search MUST use substring matching (query can appear anywhere in field)
- **FR-006**: System MUST display matching tickets in a dropdown below the search input
- **FR-007**: Dropdown MUST show ticket key and title for each result
- **FR-008**: Dropdown MUST display a maximum of 10 results
- **FR-009**: Results MUST be ordered by relevance: exact key matches first, then title matches, then description matches
- **FR-010**: Users MUST be able to click a result to open the ticket detail modal
- **FR-011**: Users MUST be able to navigate results using keyboard (Up/Down arrows, Enter to select, Escape to close)
- **FR-012**: Dropdown MUST close when user clicks outside of it
- **FR-013**: Dropdown MUST display "No results found" when query matches no tickets
- **FR-014**: Search input MUST include a placeholder text indicating its purpose (e.g., "Search tickets...")
- **FR-015**: Search input MUST include a search icon for visual clarity
- **FR-016**: Search MUST only search within the current project's tickets (not cross-project)

### Key Entities *(include if feature involves data)*

- **Ticket**: The primary entity being searched. Key searchable attributes: ticketKey (unique identifier like "ABC-123"), title (short description, max 100 chars), description (detailed content, max 2500 chars)
- **Project**: The containing entity that scopes the search. Each ticket belongs to exactly one project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find and open a ticket by key in under 5 seconds (type key → click result → modal opens)
- **SC-002**: Search results appear within 100ms of typing (client-side filtering expectation)
- **SC-003**: 95% of users can successfully find a ticket using search on their first attempt
- **SC-004**: Search feature reduces average navigation time to a specific ticket by at least 50% compared to manual scrolling
- **SC-005**: All interactive elements are keyboard accessible (Tab, Enter, Arrow keys, Escape)
- **SC-006**: Search works consistently across desktop and mobile viewports
