# Feature Specification: Drag and Drop Ticket to Trash

**Feature Branch**: `084-1500-drag-and`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "#1500 Drag and drop a ticket to trash. The feature should be available on all stages except the SHIP stages. In drag-and-drop mode, a trash zone should be present at the bottom. When a ticket is dropped into it, a confirmation modal should appear. Upon confirmation, the ticket should be deleted, along with its associated Git branch and any linked pull requests (PRs). The confirmation message should vary depending on the ticket's stage to clearly inform the user about what will be lost. Additionally, similar to other drag-and-drop interactions, dragging a ticket to the trash should be disabled if a job is pending or running on that ticket."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Visual position of trash zone in drag-and-drop mode
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8) - Based on existing drag-and-drop patterns and established UX conventions for trash zones
- **Fallback Triggered?**: No - AUTO policy with high confidence from UX pattern signals
- **Trade-offs**:
  1. Fixed bottom position provides consistent, discoverable affordance without requiring new navigation patterns
  2. Additional screen real estate required (minimal ~60-80px) but only shown during active drag operations
- **Reviewer Notes**: Validate that bottom position works well on various screen sizes (mobile, tablet, desktop). Consider whether trash zone should be within the board scroll container or fixed to viewport.

---

- **Decision**: Definition of "linked pull requests" for deletion scope
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.6) - Based on typical GitHub workflow patterns and project conventions
- **Fallback Triggered?**: No - Clear project context suggests standard GitHub PR workflow
- **Trade-offs**:
  1. Interpreting "linked PRs" as PRs where `head` branch matches ticket branch (standard GitHub convention)
  2. Does not attempt to find PRs linked by description/comments (avoids complex parsing and API overhead)
  3. Focus on direct branch-to-PR relationship ensures predictable, fast deletion
- **Reviewer Notes**: Confirm this interpretation aligns with team's GitHub workflow. Verify if any custom PR linking patterns (e.g., PR description templates) need consideration.

---

- **Decision**: Handling of orphaned GitHub artifacts when deletion partially fails
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - Security and data integrity signals strongly favor fail-safe approach
- **Fallback Triggered?**: No - AUTO policy with high confidence from security/reliability signals
- **Trade-offs**:
  1. Ticket deletion only commits if all GitHub cleanup succeeds (transactional integrity)
  2. Prevents database-GitHub inconsistency but may leave failed deletions in pending state
  3. Requires retry mechanism or manual cleanup for GitHub API failures
- **Reviewer Notes**: Validate error handling strategy. Consider whether audit log for failed deletions is needed. Verify if GitHub rate limits could cause failures during bulk operations.

---

- **Decision**: Confirmation modal detail level for different stages
- **Policy Applied**: AUTO → PRAGMATIC
- **Confidence**: Medium (0.7) - Balances user clarity with implementation simplicity
- **Fallback Triggered?**: No - AUTO policy with medium confidence from UX clarity signals
- **Trade-offs**:
  1. Stage-specific messages inform users about spec.md (SPECIFY), plan.md (PLAN), implementation (BUILD), preview deployments (VERIFY)
  2. Avoids overwhelming users with exhaustive file lists; focuses on key artifacts
  3. Generic fallback for INBOX stage (no workflow artifacts yet)
- **Reviewer Notes**: Review confirmation message wording for clarity. Verify each stage message accurately reflects what users will lose. Consider adding preview of branch name in modal.

---

- **Decision**: Trash zone visibility during drag operations with pending/running jobs
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.8) - Consistency with existing job validation patterns
- **Fallback Triggered?**: No - AUTO policy with high confidence from consistency signals
- **Trade-offs**:
  1. Trash zone appears during drag but shows disabled state for tickets with active jobs
  2. Maintains drag-and-drop visual consistency across all operations
  3. Requires additional visual affordance (e.g., strikethrough, opacity reduction) to indicate disabled state
- **Reviewer Notes**: Confirm disabled state visual treatment matches existing drag-and-drop patterns for invalid transitions. Validate tooltip/feedback mechanism for explaining why trash is disabled.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete INBOX Ticket (Priority: P1)

Users need to remove tickets from the board that are no longer needed, duplicate, or created by mistake. This is the most common deletion scenario as INBOX tickets have no workflow artifacts (branches, specs, PRs).

**Why this priority**: Core functionality that delivers immediate value. INBOX tickets are frequently created for exploration and triage, so easy deletion is essential for board hygiene.

**Independent Test**: Can be fully tested by creating an INBOX ticket, dragging it to the trash zone, confirming deletion, and verifying it no longer appears on the board or in the database.

**Acceptance Scenarios**:

1. **Given** a user has an INBOX ticket with no running jobs, **When** they drag the ticket to the trash zone and confirm deletion, **Then** the ticket is permanently deleted from the database and no longer appears on the board.

2. **Given** a user drags an INBOX ticket to the trash zone, **When** they view the confirmation modal, **Then** they see a message indicating "This ticket has no workflow artifacts and will be permanently deleted."

3. **Given** a user has an INBOX ticket with a pending or running job, **When** they attempt to drag it, **Then** the trash zone appears but is visually disabled and displays a tooltip explaining "Cannot delete ticket while job is in progress."

---

### User Story 2 - Delete Ticket with Workflow Artifacts (Priority: P2)

Users need to delete tickets that have progressed through the workflow (SPECIFY, PLAN, BUILD, VERIFY), which involves cleaning up associated Git branches, specification files, and pull requests.

**Why this priority**: Critical for maintaining repository hygiene and preventing orphaned branches/PRs. Second priority because it's less frequent than INBOX deletions but essential for long-term project health.

**Independent Test**: Can be tested by creating a ticket with a Git branch, spec files, and a PR, then dragging to trash, confirming deletion, and verifying all artifacts are removed from GitHub and the database.

**Acceptance Scenarios**:

1. **Given** a user has a SPECIFY stage ticket with a branch and spec.md, **When** they drag it to trash and confirm deletion, **Then** the ticket, branch, and spec.md are deleted from both database and GitHub.

2. **Given** a user has a BUILD stage ticket with a branch and an open PR, **When** they drag it to trash and confirm deletion, **Then** the ticket, branch, and PR are closed/deleted from GitHub.

3. **Given** a user drags a VERIFY stage ticket to trash, **When** they view the confirmation modal, **Then** they see a stage-specific message listing: "Branch: [branch-name], Preview deployment (if active), PR: [#number] (if exists), Workflow artifacts: spec.md, plan.md, tasks.md."

4. **Given** GitHub API fails to delete a branch during ticket deletion, **When** the deletion transaction occurs, **Then** the ticket remains in the database and an error message informs the user "Failed to delete GitHub artifacts. Please try again."

---

### User Story 3 - Trash Zone Visual Feedback (Priority: P3)

Users need clear visual feedback during drag operations to understand where they can drop tickets for deletion and whether deletion is available for the dragged ticket.

**Why this priority**: Enhances user experience and prevents errors, but the feature is still functional without sophisticated visual feedback. Third priority because it's polish that improves usability but isn't essential for core functionality.

**Independent Test**: Can be tested by dragging various tickets (with/without jobs, different stages) and observing trash zone appearance, enabled/disabled states, and tooltip messages.

**Acceptance Scenarios**:

1. **Given** a user starts dragging any ticket (except from SHIP stage), **When** the drag operation begins, **Then** a trash zone appears at the bottom of the board with a trash icon and label "Delete Ticket."

2. **Given** a user drags a ticket with a pending or running job over the trash zone, **When** they hover over the zone, **Then** the trash zone shows a disabled state (reduced opacity, strikethrough) and displays a tooltip: "Cannot delete ticket while job is in progress."

3. **Given** a user drags a ticket from the SHIP stage, **When** the drag operation begins, **Then** the trash zone does not appear (SHIP tickets cannot be deleted).

4. **Given** a user is not dragging any ticket, **When** they view the board, **Then** the trash zone is not visible (only appears during active drag operations).

---

### Edge Cases

- What happens when a ticket's branch no longer exists in GitHub but the database record has a branch value?
  - System should attempt deletion but gracefully handle 404 errors from GitHub API
  - Ticket deletion should still succeed if branch is already gone (idempotent operation)

- What happens when a user drops a ticket on the trash zone but cancels the confirmation modal?
  - Ticket returns to its original stage position (no changes to database)
  - No GitHub operations are performed

- What happens when multiple PRs exist with the same head branch as the ticket?
  - All PRs with matching head branch should be closed/deleted
  - Confirmation modal should indicate count: "2 pull requests will be closed"

- What happens when GitHub API is unreachable or rate-limited during deletion?
  - Deletion operation should fail with clear error message
  - Ticket remains unchanged in database (transactional integrity)
  - User can retry after rate limit window expires

- What happens when a user drags a ticket to trash but the ticket has been deleted by another user?
  - Optimistic UI update should detect 404 error and refresh board state
  - Toast notification informs user: "Ticket no longer exists"

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a trash zone at the bottom of the board only during active drag operations for tickets in stages INBOX, SPECIFY, PLAN, BUILD, and VERIFY.

- **FR-002**: System MUST prevent dragging tickets to trash when a job with status PENDING or RUNNING exists for that ticket.

- **FR-003**: System MUST NOT display the trash zone for tickets in SHIP stage (SHIP tickets cannot be deleted).

- **FR-004**: System MUST show a confirmation modal when a ticket is dropped onto the trash zone, before performing any deletion operations.

- **FR-005**: System MUST display stage-specific confirmation messages that clearly indicate what will be deleted:
  - INBOX: "This ticket has no workflow artifacts and will be permanently deleted."
  - SPECIFY: "Branch: [name], Specification: spec.md"
  - PLAN: "Branch: [name], Planning artifacts: spec.md, plan.md, tasks.md"
  - BUILD: "Branch: [name], Implementation artifacts, Pull request: [#number] (if exists)"
  - VERIFY: "Branch: [name], Preview deployment (if active), Pull request: [#number] (if exists), All workflow artifacts"

- **FR-006**: System MUST delete the ticket from the database only after successfully deleting all associated GitHub artifacts (branch, PRs).

- **FR-007**: System MUST close all pull requests where the head branch matches the ticket's branch name before deleting the branch.

- **FR-008**: System MUST handle GitHub API failures gracefully and preserve ticket data when deletion fails.

- **FR-009**: System MUST show visual feedback when trash zone is disabled (ticket has pending/running job) including reduced opacity and explanatory tooltip.

- **FR-010**: System MUST hide the trash zone immediately after a successful deletion or after the user cancels the confirmation modal.

- **FR-011**: System MUST use the same drag-and-drop sensors and collision detection as existing stage transitions (DndContext with closestCenter).

- **FR-012**: System MUST invalidate board query cache after successful deletion to trigger UI refresh.

### Key Entities

- **Ticket**: The primary entity being deleted, contains stage, branch name, job references, and all metadata to be removed from database.

- **Job**: Related entity that prevents deletion when in PENDING or RUNNING status. System must check job status before allowing trash zone interaction.

- **Git Branch**: Remote GitHub branch associated with ticket, identified by ticket.branch field. Must be deleted via GitHub API.

- **Pull Request**: GitHub PR where head branch matches ticket.branch. All matching PRs must be closed before branch deletion.

- **Workflow Artifacts**: Files stored in specs/[branch-name]/ directory (spec.md, plan.md, tasks.md, assets/) that are deleted when the branch is removed.

- **Preview Deployment**: Active Vercel preview deployment (if ticket.previewUrl exists) that becomes orphaned after deletion. User should be informed in confirmation modal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can delete an INBOX ticket in under 5 seconds (drag + confirm) with zero GitHub API calls.

- **SC-002**: Users can delete a ticket with workflow artifacts (SPECIFY/PLAN/BUILD/VERIFY) in under 10 seconds including all GitHub cleanup operations.

- **SC-003**: 95% of deletion operations complete successfully on first attempt without errors (accounting for GitHub API availability).

- **SC-004**: Zero orphaned branches or PRs remain after successful ticket deletion (verified through GitHub repository audit).

- **SC-005**: Users can immediately understand what will be deleted based on stage-specific confirmation messages (validated through user testing with 90%+ comprehension rate).

- **SC-006**: Trash zone appears within 100ms of drag start and responds to hover/drop interactions without perceptible lag.

- **SC-007**: Failed deletions preserve all ticket data with zero data loss (100% transactional integrity).
