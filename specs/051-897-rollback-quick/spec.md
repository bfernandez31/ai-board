# Feature Specification: Quick Workflow Rollback

**Feature Branch**: `051-897-rollback-quick`
**Created**: 2025-10-24
**Status**: Draft
**Input**: User description: "#897 Rollback quick workflow
If a ticket with a quick workflow fail or are cancel on the stage build, you can drag them back to the inbox stage."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether rollback should be limited to BUILD stage only or allow rollback from any stage
- **Policy Applied**: INTERACTIVE (default for text payload)
- **Confidence**: Medium - Feature description specifically mentions BUILD stage, but rollback is a common recovery pattern that may be needed from other stages
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **BUILD-only scope**: Faster to implement, addresses stated need, simpler validation logic
  2. **Multi-stage scope**: More flexible recovery, future-proof design, requires additional testing
- **Reviewer Notes**: Feature description explicitly mentions "on the stage build", suggesting BUILD-specific behavior. However, FAILED/CANCELLED jobs could occur at any automated stage (SPECIFY, PLAN, BUILD). Implementation should start with BUILD-only rollback and can be extended if needed.

---

- **Decision**: Whether to preserve or reset workflowType when rolling back
- **Policy Applied**: INTERACTIVE
- **Confidence**: Medium - Rollback could either maintain QUICK classification or reset to allow fresh workflow choice
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Preserve QUICK**: User retains original workflow intent, can retry quick-impl after fixes
  2. **Reset to FULL**: User gets fresh start, can choose different workflow path, more flexible recovery
- **Reviewer Notes**: Since rollback is triggered by failure/cancellation, user may want to take a different approach. Consider resetting workflowType to FULL to allow full workflow path as alternative.

---

- **Decision**: Whether to automatically clean up failed jobs and branches or preserve them for debugging
- **Policy Applied**: INTERACTIVE
- **Confidence**: High - Clean state is critical for reliable workflow restart
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Preserve**: User can review failure logs, compare changes, valuable debugging context
  2. **Clean up**: Cleaner state, fewer abandoned branches, simpler mental model, prevents state conflicts
- **Reviewer Notes**: Clean up failed jobs and reset branch to null during rollback. This ensures ticket returns to a pristine INBOX state, preventing any state conflicts when restarting workflow. Failed job information may be available in GitHub Actions logs if needed for debugging.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recover from Failed Quick-Impl (Priority: P1)

A user attempts a quick-impl workflow (INBOX → BUILD) for a simple bug fix, but the automated implementation fails due to unexpected complexity or missing context. The user needs to roll back the ticket to INBOX to restart with the full workflow path (INBOX → SPECIFY → PLAN → BUILD) instead.

**Why this priority**: This is the core recovery mechanism stated in the feature description. Without this, users are stuck with failed tickets and cannot retry with a different approach.

**Independent Test**: Can be fully tested by creating a ticket, transitioning to BUILD with quick-impl, simulating a job failure, then dragging back to INBOX and verifying the ticket can proceed through the normal workflow.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with workflowType=QUICK and a FAILED job, **When** user drags the ticket to INBOX column, **Then** ticket moves to INBOX stage and can be transitioned through normal workflow
2. **Given** a ticket in BUILD stage with workflowType=QUICK and a CANCELLED job, **When** user drags the ticket to INBOX column, **Then** ticket moves to INBOX stage and user can choose either workflow path
3. **Given** a ticket in BUILD stage with workflowType=QUICK and COMPLETED job, **When** user attempts to drag to INBOX column, **Then** transition is blocked (cannot rollback successful work)

---

### User Story 2 - Visual Feedback for Rollback Eligibility (Priority: P2)

When dragging a ticket with a failed quick-impl, users see clear visual feedback indicating that rollback to INBOX is allowed, distinct from the normal workflow progression indicators.

**Why this priority**: Prevents user confusion about which transitions are valid. Users need to understand that rollback is a special recovery action, not a normal workflow step.

**Independent Test**: Can be tested independently by setting up tickets in various states and verifying the UI provides correct visual cues during drag operations without executing actual transitions.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD with FAILED quick-impl job, **When** user starts dragging the ticket, **Then** INBOX column shows rollback-eligible visual indicator (e.g., amber/warning color)
2. **Given** a ticket in BUILD with RUNNING quick-impl job, **When** user starts dragging the ticket, **Then** INBOX column shows disabled/invalid indicator
3. **Given** a ticket in BUILD with COMPLETED quick-impl job, **When** user starts dragging the ticket, **Then** INBOX column shows disabled/invalid indicator

---

### User Story 3 - Rollback State Reset (Priority: P2)

When a ticket is rolled back to INBOX, all stage-related state is reset completely to provide a fresh start.

**Why this priority**: Ensures clean state management and prevents data corruption or confusing state combinations. Users should get a completely clean slate when rolling back.

**Independent Test**: Can be tested by rolling back a ticket and verifying all database fields are set correctly, then proceeding through both quick-impl and normal workflow to confirm no state conflicts occur.

**Acceptance Scenarios**:

1. **Given** a ticket rolled back to INBOX from failed quick-impl, **When** user checks ticket state, **Then** workflowType is reset to FULL, branch field is null, version is 1, and failed job is deleted
2. **Given** a ticket rolled back to INBOX, **When** user transitions to SPECIFY, **Then** transition creates new job and proceeds through normal workflow without errors
3. **Given** a ticket rolled back to INBOX, **When** user transitions to BUILD (quick-impl), **Then** transition creates new quick-impl job and workflowType is set to QUICK

---

### Edge Cases

- What happens when a user tries to rollback a ticket with a RUNNING job (not FAILED/CANCELLED)?
  - **Expected**: Transition is blocked with error message "Cannot rollback: workflow is still running"

- What happens when a ticket in BUILD has multiple jobs (e.g., failed quick-impl + comment-build jobs)?
  - **Expected**: Rollback validation only checks the workflow job (quick-impl), deletes only the workflow job, ignoring AI-BOARD comment jobs

- What happens when a user tries to rollback a ticket that used the normal workflow (FULL), not quick-impl?
  - **Expected**: Rollback is BLOCKED. Rollback is only available for quick-impl workflows (workflowType=QUICK). Normal workflows must be fixed and retried from their current stage.

- What happens to the GitHub branch when a ticket is rolled back?
  - **Expected**: Branch reference in database is set to null. The actual Git branch may still exist in the repository and requires manual cleanup

- What happens when a ticket is rolled back and then successfully completed on second attempt?
  - **Expected**: Failed job is deleted, new job is created. Ticket proceeds normally with clean state

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow tickets in BUILD stage with workflowType=QUICK to transition back to INBOX stage when the most recent workflow job has status FAILED or CANCELLED
- **FR-002**: System MUST block rollback for tickets with workflowType=FULL (normal workflow)
- **FR-003**: System MUST block rollback transition when the most recent workflow job has status PENDING, RUNNING, or COMPLETED
- **FR-004**: System MUST reset ticket workflowType to FULL when rolling back from BUILD to INBOX
- **FR-005**: System MUST reset the ticket's branch field to null during rollback
- **FR-006**: System MUST delete the failed/cancelled job record when rolling back to INBOX
- **FR-007**: System MUST reset the ticket's version field to 1 during rollback
- **FR-008**: System MUST distinguish between workflow jobs (specify, plan, implement, quick-impl) and AI-BOARD jobs (comment-*) when validating rollback eligibility
- **FR-009**: System MUST allow tickets to proceed through either workflow path (INBOX → SPECIFY or INBOX → BUILD) after rollback
- **FR-010**: Drag-and-drop UI MUST provide visual feedback indicating rollback eligibility during drag operations
- **FR-011**: System MUST validate rollback transitions at API level (cannot bypass via direct API calls)
- **FR-012**: System MUST provide clear error messages when rollback is blocked, explaining why transition is invalid

### Key Entities *(include if feature involves data)*

- **Ticket**: Existing entity with fields: id, stage, workflowType, branch, version, projectId
  - **stage**: Updated from BUILD to INBOX during rollback
  - **workflowType**: Reset from QUICK to FULL during rollback
  - **branch**: Reset to null during rollback
  - **version**: Reset to 1 during rollback

- **Job**: Existing entity with fields: id, ticketId, command, status, startedAt, completedAt
  - **status**: Used to determine rollback eligibility (FAILED/CANCELLED = eligible)
  - **command**: Used to filter workflow jobs from AI-BOARD jobs (exclude "comment-*")
  - **Records**: Failed/cancelled job is deleted during rollback to provide clean state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully rollback tickets from BUILD to INBOX within 3 seconds (drag-and-drop interaction completes)
- **SC-002**: Rollback eligibility validation completes in under 200ms (API response time for validation check)
- **SC-003**: 100% of rollback transitions correctly reset workflowType to FULL, set branch to null, set version to 1, and delete the failed job
- **SC-004**: 100% of invalid rollback attempts (RUNNING/COMPLETED jobs) are blocked with clear error messages
- **SC-005**: Users can successfully restart either workflow path after rollback without state conflicts or errors
- **SC-006**: Rollback operations correctly delete only the failed workflow job, leaving AI-BOARD comment jobs intact
- **SC-007**: Visual feedback for rollback eligibility appears within 100ms of drag start (responsive UI feedback)
