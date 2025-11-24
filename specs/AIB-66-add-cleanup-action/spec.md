# Feature Specification: Add Cleanup Action in Burger Menu

**Feature Branch**: `AIB-66-add-cleanup-action`
**Created**: 2025-11-24
**Status**: Draft
**Input**: User description: "Add cleanup action in the burger menu. On mobile, if we are in a project, the burger menu should include an entry to trigger the cleanup workflow."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Menu item placement within burger menu
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) - net score -1 with no conflicting buckets
- **Fallback Triggered?**: Yes — Low confidence triggered CONSERVATIVE fallback
- **Trade-offs**:
  1. Menu item placed in project-specific section for clear context association
  2. Requires confirmation dialog to prevent accidental triggers
- **Reviewer Notes**: Verify placement feels natural alongside existing project specs link

---

- **Decision**: Confirmation required before triggering cleanup
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (based on existing pattern)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Extra tap required provides safety against accidental cleanup triggers
  2. Consistent with desktop experience using CleanupConfirmDialog
- **Reviewer Notes**: Reuses existing CleanupConfirmDialog component for consistency

---

- **Decision**: Menu item visibility conditions
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Only shows when user is authenticated and within a project context
  2. Simplifies implementation by not requiring additional permission checks
- **Reviewer Notes**: Menu item hidden when projectId is not available (not on a project page)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trigger Cleanup from Mobile Burger Menu (Priority: P1)

A project owner or member on a mobile device wants to trigger the cleanup workflow without switching to desktop. They open the burger menu while viewing a project board and tap "Clean Project" to initiate the cleanup process.

**Why this priority**: This is the core functionality requested - enabling cleanup access on mobile devices within a project context.

**Independent Test**: Can be fully tested by navigating to a project board on mobile, opening the burger menu, and verifying the cleanup action appears and functions correctly.

**Acceptance Scenarios**:

1. **Given** a user is on a project board page on mobile, **When** they tap the hamburger menu icon, **Then** they see a "Clean Project" option with a Sparkles icon in the project section of the menu.

2. **Given** a user has opened the burger menu on a project page, **When** they tap "Clean Project", **Then** the CleanupConfirmDialog opens with cleanup information.

3. **Given** the CleanupConfirmDialog is open, **When** the user confirms the cleanup, **Then** the cleanup workflow is triggered and a success toast appears.

4. **Given** the CleanupConfirmDialog is open, **When** the user cancels or closes the dialog, **Then** the dialog closes without triggering cleanup and the menu closes.

---

### User Story 2 - Menu Hides Cleanup When Not in Project (Priority: P2)

A user navigating to non-project pages (e.g., home page, projects list) should not see the cleanup option in the burger menu since cleanup is project-specific.

**Why this priority**: Ensures clean UX by only showing relevant actions in context.

**Independent Test**: Can be fully tested by navigating to non-project pages and verifying the cleanup option is absent from the burger menu.

**Acceptance Scenarios**:

1. **Given** a user is on the projects list page, **When** they open the burger menu, **Then** the "Clean Project" option is not visible.

2. **Given** a user is on a project board page, **When** they navigate away and open the burger menu, **Then** the "Clean Project" option is only shown when within a project context.

---

### User Story 3 - Unauthenticated User Cannot See Cleanup (Priority: P3)

An unauthenticated user viewing a project (if publicly accessible) should not see cleanup options since cleanup requires authentication.

**Why this priority**: Security consideration - cleanup actions require authenticated access.

**Independent Test**: Can be tested by viewing a project page without authentication and verifying no cleanup option appears.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user is viewing a project page, **When** they open the burger menu, **Then** the "Clean Project" option is not visible.

---

### Edge Cases

- What happens when cleanup is already in progress? The CleanupConfirmDialog handles this by showing appropriate messaging.
- What happens if the cleanup API call fails? Toast notification displays error message, user can retry.
- What happens on tablet devices (between mobile and desktop)? Uses the existing responsive breakpoint (md); tablets narrower than md breakpoint will see the burger menu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Clean Project" menu item in the mobile burger menu when user is within a project context and authenticated.
- **FR-002**: System MUST hide the "Clean Project" menu item when user is not within a project context (no projectId available).
- **FR-003**: System MUST open the CleanupConfirmDialog when user taps the "Clean Project" menu item.
- **FR-004**: System MUST close the mobile menu sheet when the cleanup action is initiated or canceled.
- **FR-005**: System MUST use the existing cleanup workflow API endpoint (POST `/api/projects/{projectId}/clean`).
- **FR-006**: System MUST display the Sparkles icon next to "Clean Project" for visual consistency with the desktop ProjectMenu.
- **FR-007**: System MUST pass the projectId to the CleanupConfirmDialog component for proper API calls.

### Key Entities *(include if feature involves data)*

- **MobileMenu Component**: Extended to accept projectId prop and render cleanup action when in project context.
- **CleanupConfirmDialog**: Existing component, reused without modification.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users on mobile devices can trigger cleanup workflow from burger menu within 3 taps (menu icon → Clean Project → confirm).
- **SC-002**: 100% visual consistency with desktop cleanup trigger (same icon, same confirmation dialog).
- **SC-003**: Cleanup action only appears in appropriate context (authenticated user on project page).
- **SC-004**: No additional API endpoints required - reuses existing cleanup infrastructure.
