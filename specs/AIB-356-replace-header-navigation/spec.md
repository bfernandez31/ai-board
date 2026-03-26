# Feature Specification: Replace Header Navigation with Icon Rail Sidebar + Command Palette

**Feature Branch**: `AIB-356-replace-header-navigation`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "Replace header navigation with collapsible icon rail sidebar + Cmd+K command palette"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy fallback to CONSERVATIVE due to low confidence score
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1, absScore: 1) — only neutral feature context signal detected (+1), no conflicting buckets
- **Fallback Triggered?**: Yes — confidence 0.3 < 0.5 threshold, promoted to CONSERVATIVE
- **Trade-offs**:
  1. CONSERVATIVE approach ensures thorough accessibility, keyboard navigation, and responsive behavior are fully specified
  2. Slightly more detailed spec but no scope increase — feature description was already comprehensive
- **Reviewer Notes**: Feature description is unusually detailed with clear acceptance criteria. CONSERVATIVE fallback adds rigor to edge cases but all decisions align with the provided description.

---

- **Decision**: Icon rail width fixed at 48px with no expand/collapse toggle
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly stated in feature description ("not expandable into a full sidebar for now — icon-only rail")
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Minimal horizontal space consumption (48px) preserves board usability
  2. Future expandability deferred — icon-only keeps scope tight
- **Reviewer Notes**: The "for now" language suggests future expansion is anticipated. Current spec scopes to icon-only rail only.

---

- **Decision**: Command palette fuzzy matching uses client-side filtering for navigation items and server-side search for tickets
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — navigation items are a fixed list (4 items), ticket search already exists via server API
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Reuses existing ticket search API rather than building new search infrastructure
  2. Client-side fuzzy match for navigation is instantaneous; ticket search inherits existing debounce behavior
- **Reviewer Notes**: Verify that the existing ticket search API response shape is compatible with command palette result display.

---

- **Decision**: Existing keyboard shortcuts (N, S, /, 1-6, ?) continue to work when command palette is closed; Cmd+K is a new addition
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — acceptance criteria explicitly require no regression on existing shortcuts
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. No conflict between Cmd+K and existing shortcuts (existing shortcuts use single keys without modifiers)
  2. When command palette is open, single-key shortcuts must be suppressed to allow typing in the search input
- **Reviewer Notes**: Ensure the command palette input captures focus and prevents shortcut firing while open.

---

- **Decision**: Search bar in header becomes a visual trigger for the command palette (click opens palette) rather than an inline search field
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicitly described: "Search bar click opens the command palette instead of inline search"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users lose the ability to see inline search results without the palette overlay — palette provides richer experience
  2. The visual search bar serves as a discoverability affordance for the command palette
- **Reviewer Notes**: Ensure the search bar displays a keyboard shortcut hint (Cmd+K / Ctrl+K) so users learn the shortcut.

---

- **Decision**: Specs link (external GitHub URL) removed from header along with other navigation icons
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — the feature description says "remove the icon buttons (Specs, Analytics, Activity) from the header" but Specs links to an external GitHub URL rather than an internal page
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent header cleanup — all navigation icons removed as specified
  2. Specs access via external link is still available through the Settings page or can be added to the command palette in a future iteration
- **Reviewer Notes**: Confirm that removing the Specs shortcut from the header is acceptable. The link goes to GitHub (`https://github.com/{owner}/{repo}/tree/main/specs/specifications`) and is not a standard in-app navigation item.

---

- **Decision**: Command palette behavior when another modal is already open
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — not addressed in the feature description; CONSERVATIVE approach prevents unexpected modal stacking
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preventing Cmd+K when a modal is open avoids z-index conflicts and focus trap issues
  2. Users must close the current modal before using the command palette — minor friction
- **Reviewer Notes**: Validate whether the command palette should layer on top of modals or require them to be closed first.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Desktop Navigation via Icon Rail (Priority: P1)

A user visits their project board on a desktop browser (1024px or wider). On the left side of the screen, they see a narrow vertical icon rail containing navigation icons for Board, Activity, and Analytics, with Settings anchored at the bottom. The currently active page's icon is visually highlighted. Hovering over any icon reveals a tooltip with the page name. Clicking an icon navigates to that page.

**Why this priority**: The icon rail is the primary navigation mechanism replacing the header icons. Without it, users lose access to key pages on desktop.

**Independent Test**: Can be fully tested by navigating between Board, Activity, Analytics, and Settings pages using only the sidebar icons and verifying correct page loads and active state indication.

**Acceptance Scenarios**:

1. **Given** a user is on the project board page on a 1280px-wide screen, **When** the page loads, **Then** a 48px-wide icon rail is visible on the left side containing Board, Activity, Analytics icons grouped together and Settings anchored at the bottom
2. **Given** a user is on the project board page, **When** they hover over the Activity icon in the rail, **Then** a tooltip displays "Activity"
3. **Given** a user is on the project board page, **When** they click the Analytics icon in the rail, **Then** they are navigated to the Analytics page and the Analytics icon becomes visually highlighted
4. **Given** a user is on a desktop screen narrower than 1024px, **When** the page loads, **Then** the icon rail is not visible

---

### User Story 2 - Command Palette for Search and Navigation (Priority: P1)

A user presses Cmd+K (Mac) or Ctrl+K (Windows/Linux) from any project page. A modal overlay appears with a search input. They can type to search for navigation pages (Board, Activity, Analytics, Settings) or ticket keys/titles. Results are grouped by category and keyboard-navigable. Selecting a result navigates to that page or ticket.

**Why this priority**: The command palette replaces inline search and provides a unified discovery mechanism. It is critical for power users and replaces core header functionality.

**Independent Test**: Can be fully tested by pressing Cmd+K, typing a query, navigating results with arrow keys, and pressing Enter to confirm navigation occurs correctly.

**Acceptance Scenarios**:

1. **Given** a user is on any project page, **When** they press Cmd+K (Mac) or Ctrl+K (Windows/Linux), **Then** a command palette modal overlay appears with a focused search input
2. **Given** the command palette is open, **When** the user types "analy", **Then** the results show "Analytics" under a "Navigation" group heading
3. **Given** the command palette is open, **When** the user types a ticket key like "AIB-12", **Then** matching tickets appear under a "Tickets" group heading
4. **Given** the command palette is open with results displayed, **When** the user presses Arrow Down twice and then Enter, **Then** the second result is selected and the user is navigated to that destination
5. **Given** the command palette is open, **When** the user presses Escape, **Then** the palette closes and focus returns to the page
6. **Given** a user is on a project page, **When** they click the search bar in the header, **Then** the command palette opens (same as Cmd+K)

---

### User Story 3 - Simplified Header (Priority: P2)

After the navigation icons move to the sidebar, the header displays only the project name, a search bar with a Cmd+K hint badge, the notification bell, and the user avatar. The header is cleaner and does not grow as new features are added.

**Why this priority**: Header simplification is a direct consequence of the sidebar and command palette. It delivers visual cleanliness but depends on P1 stories being complete.

**Independent Test**: Can be tested by verifying the header no longer contains Specs, Analytics, or Activity icon buttons, and that the search bar displays a keyboard shortcut hint.

**Acceptance Scenarios**:

1. **Given** a user is on the project board page, **When** the page loads, **Then** the header contains only: project name, search bar with keyboard shortcut hint, notification bell, and user avatar
2. **Given** a user is on the project board page, **When** they inspect the header, **Then** there are no navigation icon buttons for Specs, Analytics, or Activity

---

### User Story 4 - Mobile Navigation Unchanged (Priority: P2)

On screens below 1024px, the icon rail is hidden. The existing mobile hamburger menu continues to provide access to all navigation items (Board, Activity, Analytics, Settings). No changes to mobile navigation behavior.

**Why this priority**: Mobile navigation must not regress. This story ensures the sidebar's responsive behavior does not break existing mobile flows.

**Independent Test**: Can be tested by resizing the browser below 1024px and verifying the hamburger menu contains all navigation items and the icon rail is not visible.

**Acceptance Scenarios**:

1. **Given** a user is on a 768px-wide screen, **When** they open the hamburger menu, **Then** all navigation items (Board, Activity, Analytics, Settings) are accessible
2. **Given** a user is on a 768px-wide screen, **When** the page loads, **Then** no icon rail sidebar is visible

---

### User Story 5 - Keyboard Shortcuts Coexistence (Priority: P3)

All existing keyboard shortcuts (N for new ticket, ? for help, 1-6 for column jump, S or / for search) continue to work when the command palette is closed. When the command palette is open, single-key shortcuts are suppressed so the user can type freely in the search input.

**Why this priority**: Keyboard shortcut regression would frustrate power users. This ensures backward compatibility with the new command palette overlay.

**Independent Test**: Can be tested by pressing N to create a ticket (palette closed), then pressing Cmd+K to open the palette and verifying N types into the search input instead of triggering new ticket creation.

**Acceptance Scenarios**:

1. **Given** the command palette is closed and no input is focused, **When** the user presses N, **Then** the new ticket modal opens
2. **Given** the command palette is open, **When** the user presses N, **Then** the letter "N" is typed into the search input (shortcut is suppressed)
3. **Given** the command palette is closed, **When** the user presses 3, **Then** the board scrolls to the PLAN column

---

### User Story 6 - Board Space Preservation (Priority: P3)

The 48px icon rail does not reduce the usable board area below the threshold required for 6 kanban columns at 1280px viewport width. All 6 columns remain fully usable.

**Why this priority**: Board usability is core to the product. The sidebar must not compromise the primary workspace.

**Independent Test**: Can be tested at 1280px viewport width by verifying all 6 board columns are visible and usable with the icon rail present.

**Acceptance Scenarios**:

1. **Given** a user is on the board page at 1280px viewport width, **When** the icon rail is visible, **Then** all 6 kanban columns are displayed and scrollable without horizontal overflow issues

---

### Edge Cases

- What happens when the user opens the command palette and there are no matching results for their query? The palette displays an empty state message (e.g., "No results found").
- What happens if the user presses Cmd+K while a modal (e.g., ticket detail) is already open? The command palette does not open when another modal is active to prevent focus trap conflicts.
- What happens if the user navigates via the command palette to the page they are already on? The palette closes gracefully without a redundant navigation or page reload.
- What happens when the ticket search returns no results but navigation matches exist? Only the "Navigation" group is shown; the "Tickets" group is hidden.
- What happens on exactly 1024px viewport width? The icon rail is visible (breakpoint is inclusive: >= 1024px).
- What happens when the project context is not available (e.g., on the projects list page)? The icon rail is only shown within project pages; it is not visible on the projects list or settings pages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a 48px-wide vertical icon rail on the left side of the screen on viewports 1024px and wider when the user is within a project context
- **FR-002**: The icon rail MUST contain navigation items for Board, Activity, and Analytics grouped together, with Settings anchored to the bottom of the rail
- **FR-003**: The icon rail MUST visually highlight the currently active page's icon with a distinct background treatment
- **FR-004**: Each icon in the rail MUST display a tooltip with the page name on hover or keyboard focus
- **FR-005**: The icon rail MUST be completely hidden on viewports narrower than 1024px
- **FR-006**: System MUST provide a command palette triggered by Cmd+K (Mac) or Ctrl+K (Windows/Linux) from any project page
- **FR-007**: The command palette MUST also open when the user clicks the search bar in the header
- **FR-008**: The command palette MUST display a modal overlay with a focused search input supporting fuzzy matching across all result types
- **FR-009**: Command palette results MUST be grouped into categories: "Navigation" (project pages) and "Tickets" (matching by key or title)
- **FR-010**: The command palette MUST be fully keyboard-navigable: arrow keys to move between results, Enter to select, Escape to close
- **FR-011**: The header MUST no longer contain individual navigation icon buttons for Specs, Analytics, or Activity
- **FR-012**: The header MUST display: project name, search bar with Cmd+K/Ctrl+K keyboard shortcut hint badge, notification bell, and user avatar
- **FR-013**: The mobile hamburger menu MUST continue to contain all navigation items (Board, Activity, Analytics, Settings) with no change in behavior
- **FR-014**: Existing keyboard shortcuts (N, ?, S, /, 1-6) MUST continue to function when the command palette is closed and no input is focused
- **FR-015**: Single-key keyboard shortcuts MUST be suppressed when the command palette is open to allow uninterrupted text input
- **FR-016**: All 6 kanban board columns MUST remain fully usable at 1280px viewport width with the icon rail visible
- **FR-017**: Navigation items in the icon rail MUST be separated into logical groups using subtle visual dividers
- **FR-018**: The command palette MUST display an empty state when no results match the user's query
- **FR-019**: The command palette MUST NOT open when another modal dialog is already active

### Key Entities *(include if feature involves data)*

- **Navigation Item**: Represents a project page destination (Board, Activity, Analytics, Settings) with an icon, label, route path, and group membership (Views group or Bottom group)
- **Command Palette Result**: A searchable item that is either a navigation page or a ticket, with a category label, display text, optional secondary text (e.g., ticket key), and destination route

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate to any project page (Board, Activity, Analytics, Settings) within 2 clicks or 1 keyboard shortcut from any project page
- **SC-002**: Users can find and open any ticket by key or title within 5 seconds using the command palette
- **SC-003**: All 6 kanban columns remain visible and functional on screens 1280px and wider with the icon rail present
- **SC-004**: 100% of existing keyboard shortcuts (N, ?, S, /, 1-6) continue to function without regression when the command palette is closed
- **SC-005**: Mobile users (screens under 1024px) experience no change in navigation behavior or accessibility
- **SC-006**: Header contains no more than 4 primary elements (project name, search trigger, notifications, user menu), eliminating the growing icon row pattern

## Assumptions

- The existing ticket search API can be reused for command palette ticket search without modification
- The 48px sidebar width is sufficient for icon-only display using standard icon sizes (20-24px)
- The board already handles horizontal overflow with scroll; the 48px sidebar does not introduce new overflow issues at 1280px
- Tooltip behavior follows existing project patterns (shadcn/ui Tooltip component)
- The command palette does not persist search state between opens (each open starts with an empty input)
- The Specs link (external GitHub URL) is removed along with other header navigation icons; if Specs access is still needed, it can be added to the command palette or Settings page in a future iteration
- The icon rail is only rendered within project-scoped pages (not on the projects list, billing, or auth pages)
