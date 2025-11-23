# Feature Specification: Rollback VERIFY to PLAN

**Feature Branch**: `AIB-75-rollback-verify-to`
**Created**: 2025-11-23
**Status**: Draft
**Input**: User description: "Rollback verify to plan - we should be able to move back a ticket from verify to plan, if it's a full workflow and no job running on this ticket. We should reset hard this branch to the last commit without change on file other than for the spec of the current folder. The point is to revert all the change in the implementation of the feature. So on drag to plan from verify we should have a confirmation modal explaining what will happen like for the drag to inbox from build for quick workflow"

## Auto-Resolved Decisions

- **Decision**: Rollback should be available when the latest workflow job is COMPLETED, FAILED, or CANCELLED (not RUNNING or PENDING)
- **Policy Applied**: PRAGMATIC (user override)
- **Confidence**: High (explicit user requirement)
- **Fallback Triggered?**: No - user explicitly requested COMPLETED jobs be included
- **Trade-offs**:
  1. Users can rollback successfully completed VERIFY jobs (enables re-planning even after successful verification)
  2. Confirmation modal clearly warns about consequences to prevent accidental rollback
- **Reviewer Notes**: User explicitly requested that rollback be available on completed jobs too, allowing teams to re-plan features even after successful verification if they want to take a different approach.

---

- **Decision**: Git reset should preserve spec files (`.specify/` folder) while reverting implementation changes
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: Low (score -1) - fallback triggered
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. More complex git operation (selective reset vs full reset)
  2. Preserves planning/specification work that may be valuable for re-implementation
- **Reviewer Notes**: The git reset should target the last commit that only contains spec changes (no implementation files). This requires workflow-side implementation to find the appropriate commit.

---

- **Decision**: Confirmation modal should use AlertDialog pattern with destructive styling (consistent with delete operations)
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: Low (score -1) - fallback triggered
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Additional user friction before rollback
  2. Clear communication of consequences prevents accidental rollback
- **Reviewer Notes**: Match the visual design and interaction pattern of existing confirmation dialogs (DeleteConfirmationModal, CleanupConfirmDialog) for consistency.

---

- **Decision**: Preview URL should be cleared when rolling back from VERIFY to PLAN
- **Policy Applied**: CONSERVATIVE (via AUTO fallback)
- **Confidence**: Low (score -1) - fallback triggered
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Preview deployment becomes stale/invalid after rollback
  2. User must re-deploy preview after re-implementation and re-verification
- **Reviewer Notes**: The preview URL is tied to the VERIFY stage work. Clearing it ensures no confusion about preview validity.

## User Scenarios & Testing

### User Story 1 - Rollback Verification to Re-Plan (Priority: P1)

A developer has moved a ticket through SPECIFY, PLAN, BUILD, and VERIFY stages. Whether the verification job completed successfully, failed, or was cancelled, the developer wants to go back to PLAN stage to reconsider the implementation approach, effectively starting fresh from the planning phase.

**Why this priority**: This is the core functionality - enabling users to return to planning stage with implementation work reverted, regardless of whether verification succeeded or failed.

**Independent Test**: Can be fully tested by dragging a VERIFY-stage ticket with COMPLETED, FAILED, or CANCELLED job status to PLAN column and verifying the ticket resets appropriately.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with workflowType=FULL and most recent job status=COMPLETED/FAILED/CANCELLED, **When** user drags the ticket to PLAN column, **Then** confirmation modal appears explaining the rollback will reset implementation changes.

2. **Given** confirmation modal is displayed, **When** user clicks "Confirm Rollback", **Then** ticket stage changes to PLAN, previewUrl is cleared, and git branch is reset to remove implementation changes while preserving spec files.

3. **Given** rollback is confirmed, **When** transition completes, **Then** the job is deleted from the database and ticket version is incremented.

---

### User Story 2 - Prevent Accidental Rollback (Priority: P2)

A developer accidentally drags a VERIFY ticket toward the PLAN column. The system should prevent unintentional rollback and only allow rollback when explicitly confirmed through the modal.

**Why this priority**: Protecting users from accidental data loss is critical for user confidence in the system.

**Independent Test**: Can be tested by attempting to drag VERIFY tickets under various conditions and verifying appropriate blocking/confirmation behavior.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with a RUNNING or PENDING job, **When** user drags the ticket to PLAN column, **Then** drop zone appears disabled with message indicating job must complete first.

2. **Given** a ticket in VERIFY stage with most recent job status=COMPLETED/FAILED/CANCELLED, **When** user drags the ticket to PLAN column, **Then** confirmation modal appears (rollback is allowed but requires explicit confirmation).

3. **Given** confirmation modal is displayed, **When** user clicks "Cancel", **Then** modal closes and ticket remains in VERIFY stage unchanged.

---

### User Story 3 - Visual Feedback During Drag (Priority: P3)

When dragging a VERIFY ticket, the user should receive clear visual feedback about whether rollback to PLAN is allowed, following the same patterns used for BUILD to INBOX rollback.

**Why this priority**: Consistent visual feedback improves usability and prevents confusion.

**Independent Test**: Can be tested by dragging VERIFY tickets and observing drop zone styling changes on the PLAN column.

**Acceptance Scenarios**:

1. **Given** user starts dragging a VERIFY ticket with COMPLETED/FAILED/CANCELLED job, **When** hovering over PLAN column, **Then** column shows amber/red dashed border indicating rollback is available.

2. **Given** user starts dragging a VERIFY ticket with RUNNING or PENDING job, **When** hovering over PLAN column, **Then** column shows disabled styling (opacity reduced, cursor not-allowed).

3. **Given** user starts dragging a ticket from any stage other than VERIFY, **When** hovering over PLAN column, **Then** normal transition styling applies (not rollback styling).

---

### Edge Cases

- What happens when project has cleanup lock active?
  - Rollback blocked with HTTP 423 Locked, same as all other transitions during cleanup

- What happens when ticket is QUICK workflow type?
  - Rollback not allowed - QUICK workflows skip PLAN stage entirely (INBOX to BUILD to VERIFY to SHIP)

- What happens when ticket is CLEAN workflow type?
  - Rollback not allowed - CLEAN workflows have different stage progression

- What happens if there are multiple jobs on the ticket (workflow + AI-BOARD comment jobs)?
  - Only workflow jobs count for rollback validation; AI-BOARD comment jobs (command starting with "comment-") are excluded from job status checks

- What happens if git reset fails during the rollback workflow?
  - Ticket remains in VERIFY stage, job fails, user can retry after investigating the git issue

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow VERIFY to PLAN transition only for tickets with workflowType=FULL
- **FR-002**: System MUST allow VERIFY to PLAN transition only when the most recent workflow job is COMPLETED, FAILED, or CANCELLED (not RUNNING or PENDING)
- **FR-003**: System MUST display confirmation modal before executing VERIFY to PLAN rollback
- **FR-004**: Confirmation modal MUST explain that implementation changes will be reverted and spec files preserved
- **FR-005**: System MUST clear ticket.previewUrl when rollback completes
- **FR-006**: System MUST delete the job record (COMPLETED, FAILED, or CANCELLED) when rollback completes
- **FR-007**: System MUST increment ticket.version when rollback completes
- **FR-008**: System MUST block rollback when project has active cleanup job (HTTP 423 Locked)
- **FR-009**: System MUST show disabled drop zone styling when rollback is not allowed
- **FR-010**: System MUST show distinct rollback styling on PLAN column when dragging eligible VERIFY ticket
- **FR-011**: Git reset operation MUST preserve spec folder contents (`.specify/[branch]/` files) while reverting implementation changes
- **FR-012**: System MUST exclude AI-BOARD jobs (commands starting with "comment-") from job status validation

### Key Entities

- **Ticket**: Extended with rollback validation rules for VERIFY to PLAN transition; previewUrl cleared on rollback
- **Job**: Most recent non-AI-BOARD job determines rollback eligibility; job (COMPLETED/FAILED/CANCELLED) deleted on successful rollback
- **Stage**: New backward transition path VERIFY to PLAN added (conditional on workflowType and job status)
- **RollbackValidation**: Validation result object containing `allowed: boolean` and `reason?: string`

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can rollback from VERIFY to PLAN in under 30 seconds (drag + confirm + transition complete)
- **SC-002**: 100% of rollback attempts on ineligible tickets (wrong workflow type or job status) are blocked with clear error message
- **SC-003**: Zero accidental rollbacks occur without user explicitly confirming in modal
- **SC-004**: Visual feedback during drag clearly indicates rollback eligibility within 100ms of drag start
- **SC-005**: Git reset preserves all spec files (`.specify/` folder) while removing all implementation changes
