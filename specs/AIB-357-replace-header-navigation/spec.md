# Feature Specification: Replace Header Navigation with Collapsible Icon Rail Sidebar + Cmd+K Command Palette

**Feature Branch**: `AIB-357-replace-header-navigation`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: User description: "Replace header navigation with collapsible icon rail sidebar + Cmd+K command palette"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat this request as a general user-facing navigation redesign and apply a conservative specification stance because the ticket explicitly set `AUTO`, but the context did not provide strong enough signals to justify a pragmatic shortcut.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1 from neutral user-facing feature context only)
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below 0.5.
- **Trade-offs**:
  1. The specification preserves accessibility, layout protection, and regression coverage requirements instead of describing only the happy path.
  2. It increases implementation and validation expectations slightly, but reduces the risk of navigation regressions across desktop and mobile views.
- **Reviewer Notes**: Confirm that the team wants the stricter interpretation for this UI restructure rather than a faster but less-defined MVP.

- **Decision**: Limit the initial sidebar and command-palette navigation scope to the project destinations explicitly named in the ticket: Board, Activity, Analytics, and Settings.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the requested grouping and acceptance criteria name these destinations directly, while future destinations are described only as motivation for the redesign.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This keeps the feature bounded and testable without blocking on undefined future destinations such as comparisons, archive, or actions.
  2. It means additional destinations will require later specification work before being added to the rail or palette.
- **Reviewer Notes**: Validate that excluding not-yet-shipped destinations from this ticket matches the intended scope.

- **Decision**: Require the command palette shortcut to work on all project pages for signed-in users, while using the header search control as the visible entry point on desktop project pages and keeping mobile navigation in the existing hamburger menu.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the ticket explicitly says the palette opens from anywhere in the project, but only describes a desktop header search affordance and an unchanged mobile menu.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This gives users one consistent project-wide shortcut behavior instead of tying search to a single page.
  2. It preserves current mobile behavior, which avoids introducing a second mobile navigation pattern in the same change.
- **Reviewer Notes**: Confirm that mobile should keep its current navigation entry point and that no separate mobile command-palette trigger is required in this ticket.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate Project Views from the Rail (Priority: P1)

A project member on desktop can move between the main project views by using a persistent icon rail on the left side instead of relying on header icon buttons.

**Why this priority**: The primary value of the feature is making project navigation scalable without consuming header space or reducing the board's working area.

**Independent Test**: Can be fully tested by opening a project on a desktop viewport, confirming the rail is visible, moving between Board, Activity, Analytics, and Settings from the rail, and verifying the active destination is visually indicated.

**Acceptance Scenarios**:

1. **Given** a signed-in user is viewing a project on a desktop viewport, **When** the page loads, **Then** a left-side icon rail is visible with Board, Activity, Analytics, and Settings arranged in the specified groups.
2. **Given** a signed-in user is on one of the supported project pages on desktop, **When** the user selects a rail icon, **Then** the system opens that destination and highlights it as the active page.
3. **Given** a signed-in user focuses or hovers over a rail icon, **When** the interaction occurs, **Then** the system shows the destination name without expanding the rail into a full sidebar.

---

### User Story 2 - Open Navigation and Ticket Search from the Command Palette (Priority: P2)

A project member can use a single command palette to jump to project destinations or find tickets by key or title without depending on the current page layout.

**Why this priority**: The command palette replaces the existing inline ticket search while adding a faster, centralized way to navigate the project.

**Independent Test**: Can be fully tested by opening any project page, using the keyboard shortcut or desktop search control to launch the palette, searching for both a destination and a ticket, and selecting each result with the keyboard.

**Acceptance Scenarios**:

1. **Given** a signed-in user is on any project page, **When** the user presses the platform-specific command-palette shortcut, **Then** the command palette opens and focuses its search input.
2. **Given** the command palette is open, **When** the user types a query matching a destination or ticket, **Then** grouped results for navigation and tickets are shown in the same overlay.
3. **Given** the command palette is open and results are visible, **When** the user uses arrow keys and presses Enter, **Then** the highlighted result is opened.
4. **Given** the command palette is open, **When** the user presses Escape, **Then** the palette closes without changing the current page.

---

### User Story 3 - Keep the Header and Mobile Navigation Clean and Stable (Priority: P3)

A project member sees a simplified project header on desktop, while mobile and tablet users continue to use the existing hamburger navigation without losing access to any current destinations.

**Why this priority**: The redesign only succeeds if it reduces header clutter without creating a responsive regression or breaking established navigation behavior on smaller screens.

**Independent Test**: Can be fully tested by comparing desktop and sub-desktop project layouts, confirming the header no longer contains the old navigation icon buttons, and verifying all project destinations remain available through the existing mobile menu when the rail is hidden.

**Acceptance Scenarios**:

1. **Given** a signed-in user is on a desktop project page, **When** the header is displayed, **Then** it shows the project name, command-palette search entry point, notifications, and user controls without the old header navigation icon row.
2. **Given** a signed-in user is on a viewport below the desktop threshold, **When** the page loads, **Then** the icon rail is hidden and navigation remains available through the existing hamburger menu.
3. **Given** the command palette is closed, **When** the user uses other existing project keyboard shortcuts, **Then** those shortcuts continue to behave as they did before this feature.

### Edge Cases

- What happens when a user is on a project page outside the four named destinations? The command palette shortcut must still open, but the rail only needs to highlight one of the explicitly supported destinations when the current page matches that destination.
- What happens when a search query matches both a page name and one or more tickets? The command palette must keep navigation and ticket matches visually separated so users can distinguish intent before selecting a result.
- What happens when there are no ticket matches for a query? The command palette must still remain usable, show any matching navigation results, and clearly communicate that no ticket results were found.
- What happens when the viewport crosses the desktop threshold while a project page is open? The system must update navigation presentation so that only one primary navigation pattern is shown at a time.
- What happens when the command palette is open and another keyboard shortcut is pressed? The command palette must retain focus and prevent conflicting shortcut behavior until it is closed.
- What happens when the board is viewed on a 1280px-wide desktop layout? The navigation change must not reduce the board's effective working area below a level where six columns remain usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST display a persistent icon-only navigation rail on the left side of project pages at desktop viewports of 1024px and wider.
- **FR-002**: The system MUST hide the icon rail on viewports narrower than 1024px.
- **FR-003**: The icon rail MUST include the project destinations Board, Activity, Analytics, and Settings, organized into the groups described in the ticket, with Settings anchored separately at the bottom.
- **FR-004**: The system MUST allow users to reach each rail destination from the rail itself on supported desktop project pages.
- **FR-005**: The system MUST visually indicate which supported destination is currently active.
- **FR-006**: The system MUST show the destination name for each rail icon on hover and keyboard focus.
- **FR-007**: The icon rail MUST remain icon-only for this feature and MUST NOT expand into a wider sidebar state.
- **FR-008**: The system MUST remove the existing project navigation icon buttons from the desktop header once their destinations are available through the rail.
- **FR-009**: The desktop project header MUST provide a visible search entry point that opens the command palette instead of performing inline ticket search inside the header.
- **FR-010**: The system MUST open the command palette from anywhere within a project when the user presses the platform-appropriate keyboard shortcut.
- **FR-011**: The system MUST allow users to open the command palette by selecting the desktop search entry point in the header.
- **FR-012**: The command palette MUST present grouped results for project navigation destinations and ticket search results within the same interaction.
- **FR-013**: The command palette MUST allow ticket search by ticket key and ticket title.
- **FR-014**: The command palette MUST support fuzzy matching so users can find destinations and tickets with partial or approximate queries.
- **FR-015**: The command palette MUST support keyboard navigation for result selection, including moving through results, selecting a result, and closing the palette without selection.
- **FR-016**: The system MUST preserve all current project destinations in the existing mobile hamburger menu when the rail is hidden.
- **FR-017**: The system MUST preserve existing project keyboard shortcuts when the command palette is closed.
- **FR-018**: The system MUST suppress conflicting project keyboard shortcuts while the command palette is open so palette navigation remains predictable.
- **FR-019**: The navigation redesign MUST preserve usable horizontal workspace for the board on desktop, including maintaining a six-column board layout that remains workable at 1280px and wider.
- **FR-020**: The feature MUST be covered by automated validation for desktop rail visibility, responsive hiding behavior, command-palette opening and keyboard control, mixed navigation and ticket search results, header simplification, and unchanged mobile navigation access.

### Key Entities *(include if feature involves data)*

- **Project Navigation Destination**: A project-level place a user can open from navigation controls, including its display name, grouping, and active-state relationship to the current page.
- **Command Palette Result**: A selectable item returned in the command palette, identified as either a navigation destination or a ticket match.
- **Ticket Search Match**: A ticket result discoverable by key or title that allows a user to jump directly to the relevant ticket context from the command palette.

### Assumptions

- This ticket covers only the currently named project destinations and does not add new destinations such as comparisons, archive, or actions.
- The command palette is intended for signed-in project contexts and follows existing project access rules for what destinations and tickets a user can reach.
- The desktop search entry point is expected wherever the simplified project header is shown, while mobile and tablet navigation remain centered on the existing hamburger menu for this iteration.

### Dependencies

- Existing project pages for Board, Activity, Analytics, and Settings must remain available as valid destinations.
- Existing ticket search data must continue to provide ticket key and title matches that the command palette can present to authorized users.
- Existing mobile navigation must continue to support the same project destinations after desktop navigation moves out of the header.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In desktop project views, 100% of users can reach Board, Activity, Analytics, and Settings from the left-side rail without using header navigation icons.
- **SC-002**: In project pages where the palette is available, 100% of users can open it by keyboard shortcut on the first attempt and reach a selected destination or ticket using only the keyboard.
- **SC-003**: In desktop project views, the header shows no redundant project navigation icon row while still exposing project name, search entry point, notifications, and user controls.
- **SC-004**: On viewports below 1024px, 100% of tested project destinations remain reachable through the existing mobile navigation with no missing entries after the desktop rail is hidden.
- **SC-005**: At desktop widths of 1280px and above, users can continue working with a six-column board layout without the navigation redesign obscuring or crowding core board content.
