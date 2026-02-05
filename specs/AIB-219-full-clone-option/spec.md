# Feature Specification: Full Clone Option for Ticket Duplication

**Feature Branch**: `AIB-219-full-clone-option`
**Created**: 2026-02-05
**Status**: Draft
**Input**: User description: Add a "Full clone" option to ticket duplication that preserves stage, jobs, and creates a new branch from source

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Title prefix for cloned tickets
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Feature description explicitly specifies "Clone of " prefix
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear distinction between "Copy of " (simple) and "Clone of " (full clone) tickets
  2. No additional user configuration needed
- **Reviewer Notes**: Verify that "Clone of " prefix is acceptable for the target locale

---

- **Decision**: Branch creation mechanism (API vs workflow)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - GitHub API direct call is the safest approach for immediate branch creation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Direct API call provides synchronous feedback and error handling
  2. No workflow dispatch required, reducing complexity
- **Reviewer Notes**: Ensure GitHub token permissions include branch creation via API

---

- **Decision**: Job duplication scope - copy all jobs vs only completed jobs
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (0.9) - Feature description explicitly states "all jobs" with complete data
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Full history preservation enables accurate comparison of alternative implementations
  2. May result in large data copies for tickets with many jobs
- **Reviewer Notes**: Consider impact on database size for high-volume projects

---

- **Decision**: Error handling when source branch doesn't exist
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: Medium (0.7) - Conservative approach prevents silent failures
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Explicit error prevents orphaned tickets without valid branches
  2. User must have a valid branch before using full clone
- **Reviewer Notes**: Full clone requires source ticket to have a valid branch

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Clone for Alternative Implementation (Priority: P1)

A user wants to test an alternative implementation approach for a ticket that's already in PLAN or BUILD stage. They need to preserve all context (jobs, logs, telemetry) while creating a separate branch to try a different approach.

**Why this priority**: Core value proposition - enables A/B testing of implementations without losing original work.

**Independent Test**: Can be fully tested by clicking Full Clone on a ticket in PLAN stage and verifying the new ticket has all jobs copied and a new branch exists.

**Acceptance Scenarios**:

1. **Given** a ticket in PLAN stage with 3 jobs, **When** user clicks Duplicate dropdown and selects "Full clone", **Then** a new ticket is created with the same stage, all 3 jobs copied with full telemetry data, and a new branch created from source branch
2. **Given** a ticket in BUILD stage with branch "087-feature-name", **When** full clone is performed, **Then** new ticket has branch "219-feature-name" (using new ticket number) pointing to same commit as source
3. **Given** a cloned ticket, **When** user views job details, **Then** all telemetry fields (tokens, cost, duration, tools) are visible and match the source ticket's jobs

---

### User Story 2 - Simple Copy Preservation (Priority: P2)

A user wants to duplicate a ticket the traditional way - creating a fresh copy in INBOX without any jobs or branch. The existing behavior must remain accessible.

**Why this priority**: Non-regression - existing workflow must continue working.

**Independent Test**: Can be fully tested by clicking "Simple copy" option and verifying ticket lands in INBOX without jobs or branch.

**Acceptance Scenarios**:

1. **Given** a ticket in any stage, **When** user clicks Duplicate dropdown and selects "Simple copy", **Then** a new ticket is created in INBOX stage with "Copy of " prefix, no jobs, and no branch
2. **Given** a ticket in VERIFY stage, **When** simple copy is selected, **Then** behavior is identical to current duplicate functionality

---

### User Story 3 - Full Clone Availability Control (Priority: P3)

Full clone should only be available for tickets that have meaningful work to clone (SPECIFY, PLAN, BUILD, VERIFY stages). Tickets in INBOX have no branch or jobs, and SHIP tickets represent completed work.

**Why this priority**: UX polish - prevents confusing options.

**Independent Test**: Can be fully tested by checking dropdown menu options across all ticket stages.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX stage, **When** user opens Duplicate dropdown, **Then** only "Simple copy" option is visible
2. **Given** a ticket in SHIP stage, **When** user opens Duplicate dropdown, **Then** only "Simple copy" option is visible
3. **Given** a ticket in SPECIFY, PLAN, BUILD, or VERIFY stage, **When** user opens Duplicate dropdown, **Then** both "Simple copy" and "Full clone" options are visible

---

### User Story 4 - Clone Feedback (Priority: P4)

User receives clear feedback after performing either type of duplication, including the new ticket key for easy navigation.

**Why this priority**: User experience enhancement.

**Independent Test**: Can be fully tested by performing clone and verifying toast notification appears.

**Acceptance Scenarios**:

1. **Given** a successful full clone operation, **When** the operation completes, **Then** a toast notification displays "Cloned to {NEW_TICKET_KEY}" with the new ticket key
2. **Given** a full clone failure (e.g., branch creation fails), **When** the error occurs, **Then** user sees an error toast with actionable message

### Edge Cases

- What happens when source branch no longer exists on GitHub? → Full clone fails with error message; user can still use Simple copy
- What happens when source ticket has running jobs? → Running jobs are copied with their current status (job history is point-in-time snapshot)
- What happens when GitHub API rate limit is exceeded? → Graceful error with retry guidance
- What happens when cloning a ticket that was itself cloned? → Works normally; "Clone of Clone of " prefix is acceptable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST transform the Duplicate button into a dropdown menu with "Simple copy" and "Full clone" options
- **FR-002**: System MUST preserve existing simple copy behavior when "Simple copy" is selected (creates ticket in INBOX, "Copy of " prefix, no jobs, no branch)
- **FR-003**: System MUST show "Full clone" option only for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages
- **FR-004**: System MUST hide "Full clone" option for tickets in INBOX or SHIP stages
- **FR-005**: System MUST copy all ticket metadata when performing full clone: title (with "Clone of " prefix), description, attachments, clarificationPolicy, workflowType
- **FR-006**: System MUST preserve the source ticket's stage when performing full clone (not reset to INBOX)
- **FR-007**: System MUST copy all jobs from source ticket with complete data including: command, status, branch, commitSha, logs, startedAt, completedAt
- **FR-008**: System MUST copy all job telemetry data: inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed
- **FR-009**: System MUST create a new Git branch from the source ticket's branch when performing full clone
- **FR-010**: System MUST name the new branch following existing convention: `{TICKET_NUMBER}-{slug}` derived from the new ticket
- **FR-011**: System MUST update copied jobs to reference the new ticket ID
- **FR-012**: System MUST generate a new ticketKey for the cloned ticket (e.g., AIB-219)
- **FR-013**: System MUST display a confirmation toast with the new ticketKey after successful clone
- **FR-014**: System MUST display an error message if full clone fails (e.g., branch creation failure)
- **FR-015**: System MUST require source ticket to have a valid branch for full clone to succeed

### Key Entities *(include if feature involves data)*

- **Ticket**: Core entity being duplicated. Full clone copies stage, metadata, and creates new ticketKey and branch.
- **Job**: Child entity of Ticket. All jobs are copied with complete telemetry data, referencing the new ticket.
- **Branch (GitHub)**: External entity. New branch created from source branch commit via GitHub API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can duplicate tickets using either method (simple copy or full clone) within 5 seconds
- **SC-002**: Full clone preserves 100% of job data including all telemetry fields
- **SC-003**: Cloned branch contains identical commit history as source branch at time of clone
- **SC-004**: Users correctly identify clone type by prefix ("Copy of " vs "Clone of ") 100% of the time
- **SC-005**: Full clone option appears only on eligible stages (SPECIFY/PLAN/BUILD/VERIFY) with zero false positives
- **SC-006**: Error scenarios (missing branch, API failures) display actionable user feedback within 3 seconds
