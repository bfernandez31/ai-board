# Feature Specification: Fix Rollback to Plan from Verify

**Feature Branch**: `AIB-76-fix-rollback-to`
**Created**: 2025-11-24
**Status**: Draft
**Input**: User description: "Fix rollback to plan from verify - the ticket was correctly moved to PLAN, but no changes was done on the commit history. All the implementation is still present"

## Auto-Resolved Decisions

### Decision 1: Workflow-Based Git Reset vs API-Inline Reset

- **Decision**: Git reset operations will be executed via a GitHub workflow rather than inline in the API endpoint
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score: 0.9) - Aligns with existing architecture patterns where all git operations occur in workflows, not API routes
- **Fallback Triggered?**: No - clear architectural precedent exists
- **Trade-offs**:
  1. Slightly more complex (requires workflow dispatch) but maintains separation of concerns
  2. Async nature means brief delay before git reset completes, but provides better error handling and logging
- **Reviewer Notes**: Verify that the workflow dispatch mechanism properly handles the git reset job creation in the database

### Decision 2: Commit Identification Strategy

- **Decision**: Use the job history to identify the last PLAN-phase commit by finding commits before the BUILD job was created
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score: 0.6) - Job history reliably tracks workflow phases, but depends on consistent job recording
- **Fallback Triggered?**: No - existing job tracking provides sufficient data
- **Trade-offs**:
  1. Requires accurate job history; if jobs are missing, fallback to branch creation commit
  2. Simple approach that doesn't require additional metadata storage
- **Reviewer Notes**: Ensure edge case handling when job history is incomplete or corrupted

### Decision 3: Spec File Preservation Method

- **Decision**: Use git stash/unstash pattern to preserve `.specify/` folder contents during hard reset, then restore
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score: 0.9) - Standard git pattern that ensures no data loss of specification files
- **Fallback Triggered?**: No - well-established git workflow pattern
- **Trade-offs**:
  1. Slightly more complex than selective reset but guarantees spec preservation
  2. Small risk if stash operation fails, mitigated by pre-backup step
- **Reviewer Notes**: Validate that the stash/restore sequence handles all file types in `.specify/` folder including nested directories

### Decision 4: Error Recovery Behavior

- **Decision**: If git reset fails, mark the job as FAILED, preserve original branch state, and notify user via job status
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score: 0.9) - Data integrity requires rollback of partial operations
- **Fallback Triggered?**: No - standard error handling pattern
- **Trade-offs**:
  1. User must manually intervene on failure, but prevents data corruption
  2. Branch remains in VERIFY-stage state if reset fails, requiring manual cleanup
- **Reviewer Notes**: Ensure error messages provide actionable guidance for manual recovery

## User Scenarios & Testing

### User Story 1 - Complete Rollback with Git Reset (Priority: P1)

A developer realizes during VERIFY stage that the implementation approach needs to change. They drag the ticket from VERIFY to PLAN column. The system moves the ticket to PLAN stage AND resets the git branch to remove all implementation commits while preserving the specification documents.

**Why this priority**: This is the core functionality that is currently broken. Without this, rollback only partially works (database update without git reset).

**Independent Test**: Can be fully tested by triggering a VERIFY→PLAN rollback and verifying the git branch no longer contains implementation commits while `.specify/` folder files remain intact.

**Acceptance Scenarios**:

1. **Given** a FULL workflow ticket in VERIFY stage with completed verification job, **When** user drags ticket to PLAN column and confirms rollback, **Then** system dispatches a git reset workflow job, resets branch to pre-BUILD state, and preserves all files in the feature's spec folder
2. **Given** a successful rollback, **When** user inspects the git branch, **Then** all implementation commits from BUILD phase are removed and only SPECIFY/PLAN phase commits remain
3. **Given** a successful rollback, **When** user inspects the spec folder, **Then** all files in `.specify/[branch]/` are intact and unchanged

---

### User Story 2 - Rollback with Failed Git Reset Recovery (Priority: P2)

A developer triggers a rollback, but the git reset operation fails (network issue, permission error, etc.). The system detects the failure, marks the job as FAILED, and provides clear feedback so the developer can take corrective action.

**Why this priority**: Error handling is critical for data integrity and user trust. Without proper failure handling, users may be left in an inconsistent state.

**Independent Test**: Can be tested by simulating a git reset failure and verifying the job is marked FAILED and the ticket remains in a consistent state.

**Acceptance Scenarios**:

1. **Given** a rollback in progress, **When** the git reset operation fails, **Then** the job is marked as FAILED with an error message describing the issue
2. **Given** a failed git reset, **When** user views the ticket, **Then** ticket stage remains at PLAN (from initial transition) but shows job failure notification
3. **Given** a failed git reset, **When** user reviews the branch, **Then** branch is in original state (no partial reset) and can be manually corrected

---

### User Story 3 - Rollback Preserves Spec Modifications (Priority: P2)

A developer made specification updates during the VERIFY stage (updated plan.md, added clarifications to spec.md). When they rollback to PLAN, these spec modifications are preserved along with original spec files.

**Why this priority**: Spec files represent significant intellectual work that must not be lost during rollback.

**Independent Test**: Can be tested by modifying spec files in VERIFY stage, rolling back, and verifying all spec modifications are retained.

**Acceptance Scenarios**:

1. **Given** spec files modified during VERIFY stage, **When** rollback completes, **Then** all spec modifications are preserved
2. **Given** new files added to spec folder during VERIFY, **When** rollback completes, **Then** new files are retained

---

### Edge Cases

- What happens when the branch has no implementation commits (only spec commits)? → Git reset completes successfully with no changes
- What happens when the spec folder doesn't exist? → Git reset completes, no spec restoration needed
- What happens when the branch was force-pushed or rebased externally? → Job fails with descriptive error about branch state mismatch
- What happens during concurrent rollback attempts? → Existing transition lock prevents concurrent transitions; second attempt waits or fails gracefully
- What happens when the rollback workflow is already running? → API returns 409 Conflict with message about pending rollback job

## Requirements

### Functional Requirements

- **FR-001**: System MUST dispatch a git reset workflow when VERIFY→PLAN rollback transition is confirmed
- **FR-002**: System MUST identify the correct commit to reset to (last commit before BUILD phase began)
- **FR-003**: System MUST preserve all files in the feature's spec folder (`.specify/[branch]/` or `specs/[branch]/`) during git reset
- **FR-004**: System MUST force-push the reset branch to update the remote repository
- **FR-005**: System MUST create a job record for the git reset operation with type 'rollback-reset'
- **FR-006**: System MUST update job status to COMPLETED when git reset succeeds
- **FR-007**: System MUST update job status to FAILED when git reset fails, with descriptive error message
- **FR-008**: System MUST NOT modify the ticket stage during git reset (stage already changed by transition API)
- **FR-009**: System MUST handle the case where no implementation commits exist (no-op reset)
- **FR-010**: System MUST validate that the branch exists before attempting reset
- **FR-011**: System MUST create a backup of spec files before reset operation as safety measure

### Key Entities

- **Job**: Extended to support 'rollback-reset' command type for tracking git reset operations
- **Ticket**: No schema changes; uses existing `branch` and `stage` fields
- **Workflow**: New workflow steps added to speckit.yml for rollback git reset handling

## Success Criteria

### Measurable Outcomes

- **SC-001**: After rollback, 100% of implementation commits (from BUILD phase) are removed from the branch
- **SC-002**: After rollback, 100% of spec folder files are preserved with no content changes
- **SC-003**: Rollback git reset completes within 60 seconds for typical branches
- **SC-004**: Users can re-enter BUILD phase and create new implementation on the reset branch
- **SC-005**: Failed git reset operations are clearly communicated to users within 5 seconds of failure
- **SC-006**: Zero data loss of specification files during any rollback operation
