# Feature Specification: Branch Link in Ticket Details

**Feature Branch**: `033-link-to-branch`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "Link to Branch - je voudrais ajouter dans le detail d'un ticket un lien vers une branche une fois une branche presente dans le ticket. ne devrais plus etre visible une fois que le ticket est dans ship. fait un ajout clean en terme d'ux. le lien doit souvrir dans un autre onglet et afficher la branche dans github"

## Auto-Resolved Decisions

- **Decision**: GitHub URL construction pattern for branch links
- **Policy Applied**: AUTO
- **Confidence**: High (0.8) - Standard GitHub URL patterns are well-established
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using standard GitHub branch URL format `https://github.com/{owner}/{repo}/tree/{branch}` ensures compatibility
  2. Assumes project configuration already contains GitHub owner/repo information
- **Reviewer Notes**: Verify that all projects have githubOwner and githubRepo fields populated

---

- **Decision**: Visual placement of branch link in ticket detail view
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.6) - Common UX pattern for related actions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Placing link near ticket title makes it discoverable but not intrusive
  2. Using icon + text pattern (e.g., branch icon + "View in GitHub") provides clear affordance
- **Reviewer Notes**: UX review should validate visibility and discoverability with actual users

---

- **Decision**: Stage-based visibility logic (hide when stage is SHIP)
- **Policy Applied**: AUTO
- **Confidence**: High (0.9) - User requirement is explicit
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Once ticket reaches SHIP, branch link disappears (may cause confusion if users want to reference branch post-deployment)
  2. Assumes SHIP stage means "merged and deployed" where branch reference is no longer needed
- **Reviewer Notes**: Consider whether users might need branch access in SHIP stage for rollback or audit purposes

## User Scenarios & Testing

### User Story 1 - View Branch in GitHub (Priority: P1)

A project manager reviews a ticket in the BUILD stage and wants to examine the code changes in GitHub to understand the implementation progress.

**Why this priority**: Core functionality - enables users to navigate from ticket to code without manual URL construction.

**Independent Test**: Can be fully tested by creating a ticket with a branch value, viewing the ticket detail, clicking the link, and verifying it opens the correct GitHub branch page in a new tab.

**Acceptance Scenarios**:

1. **Given** a ticket with a branch value set (e.g., "033-link-to-branch"), **When** user views ticket details, **Then** they see a clickable branch link with GitHub icon
2. **Given** user sees branch link in ticket details, **When** user clicks the link, **Then** a new browser tab opens showing the branch in GitHub at `https://github.com/{owner}/{repo}/tree/{branch}`
3. **Given** a ticket in BUILD stage with branch "033-link-to-branch" and project GitHub settings (owner: "myorg", repo: "myrepo"), **When** user clicks branch link, **Then** browser opens `https://github.com/myorg/myrepo/tree/033-link-to-branch`

---

### User Story 2 - Link Visibility Based on Branch State (Priority: P1)

A user views different tickets and expects to see branch links only when branches actually exist for those tickets.

**Why this priority**: Prevents confusion - users shouldn't see broken or empty links.

**Independent Test**: Can be tested by viewing tickets with and without branch values and confirming link presence/absence matches expectations.

**Acceptance Scenarios**:

1. **Given** a ticket with no branch value (branch field is null or empty), **When** user views ticket details, **Then** no branch link is displayed
2. **Given** a ticket with a branch value, **When** user views ticket details, **Then** branch link is visible and functional
3. **Given** a ticket that transitions from having a branch to branch being cleared, **When** user refreshes ticket details, **Then** branch link disappears

---

### User Story 3 - Hide Link for Shipped Tickets (Priority: P2)

A user views a ticket that has been fully deployed (SHIP stage) and no longer needs to reference the development branch.

**Why this priority**: Reduces visual clutter - shipped tickets represent completed work where branch context is less relevant.

**Independent Test**: Can be tested by moving a ticket to SHIP stage and verifying the branch link is no longer displayed.

**Acceptance Scenarios**:

1. **Given** a ticket with a branch value and stage set to SHIP, **When** user views ticket details, **Then** no branch link is displayed
2. **Given** a ticket with a branch in BUILD stage showing branch link, **When** ticket is moved to SHIP stage, **Then** branch link disappears from ticket details
3. **Given** a ticket in VERIFY stage showing branch link, **When** ticket transitions to SHIP, **Then** branch link is no longer visible

---

### Edge Cases

- What happens when branch value contains special characters or spaces that need URL encoding?
- How does system handle malformed GitHub URLs if owner/repo are missing from project configuration?
- What happens if user clicks branch link but GitHub repository is private and they lack access permissions?
- How does link behave if branch has been deleted from GitHub but ticket still references it?
- What happens for tickets that never receive a branch value (e.g., quick fixes made directly on main)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST display a branch link in ticket detail view when ticket.branch field has a non-empty value
- **FR-002**: Branch link MUST NOT be displayed when ticket.branch field is null or empty
- **FR-003**: Branch link MUST NOT be displayed when ticket.stage equals "SHIP"
- **FR-004**: Branch link MUST open in a new browser tab (target="_blank") with rel="noopener noreferrer" for security
- **FR-005**: Branch link URL MUST follow the pattern `https://github.com/{project.githubOwner}/{project.githubRepo}/tree/{ticket.branch}`
- **FR-006**: Branch link MUST URL-encode the branch name to handle special characters
- **FR-007**: Branch link MUST include a visual indicator (icon) that clearly identifies it as a GitHub link
- **FR-008**: Branch link MUST be positioned in a consistent location within ticket details for predictable user experience
- **FR-009**: System MUST handle missing project.githubOwner or project.githubRepo by not displaying the link
- **FR-010**: Branch link text MUST be descriptive (e.g., "View in GitHub" or similar) and not just an icon

### Key Entities

- **Ticket**: Existing entity with `branch` field (string, nullable) that stores Git branch name
- **Project**: Existing entity with `githubOwner` and `githubRepo` fields required to construct GitHub URLs

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can navigate from ticket details to GitHub branch in 2 clicks or less (click ticket, click branch link)
- **SC-002**: Branch link correctly opens GitHub branch page in 100% of test scenarios with valid branch values
- **SC-003**: Zero broken branch links displayed (link only appears when all required data is present)
- **SC-004**: Branch link disappears within 1 second of ticket transitioning to SHIP stage
- **SC-005**: 95% of users can identify and understand the branch link purpose without additional documentation
