# Feature Specification: Full Clone Option for Ticket Duplication

**Feature Branch**: `AIB-217-full-clone-option`
**Created**: 2026-02-04
**Status**: Draft
**Input**: User description: "Full clone option for ticket duplication"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Branch creation approach - use server-side GitHub API call within the clone endpoint
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - clear technical requirement with industry-standard pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Server-side branch creation ensures atomicity (ticket + branch created together or both fail)
  2. Requires GitHub API permissions on server, but already exists for other features
- **Reviewer Notes**: Verify GitHub token has branch creation permissions for target repositories

---

- **Decision**: Job data copying strategy - deep copy all fields including telemetry
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - user explicitly requested complete job history with telemetry
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves full audit trail for alternative implementation testing
  2. Increases database storage per clone, but this is acceptable for the testing use case
- **Reviewer Notes**: Ensure cloned job IDs are new (auto-increment) while preserving all other data

---

- **Decision**: Title prefix for cloned tickets - use "Clone of " to distinguish from simple "Copy of "
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - user explicitly suggested this distinction in requirements
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clear visual distinction between simple copies and full clones
  2. Consistent with existing "Copy of " convention for simple duplicates
- **Reviewer Notes**: Title truncation must account for "Clone of " prefix (9 chars including space)

---

- **Decision**: Dropdown menu behavior - use shadcn/ui DropdownMenu component
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) - constitution mandates shadcn/ui for UI primitives
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with codebase patterns and accessibility standards
  2. Leverages existing component library
- **Reviewer Notes**: Ensure dropdown positioning works within modal context

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Clone for Alternative Implementation Testing (Priority: P1)

A developer wants to test an alternative implementation approach for a ticket currently in BUILD stage. They need to clone the ticket with its full history (jobs, stage, branch) to experiment without affecting the original work.

**Why this priority**: This is the primary use case driving the feature request - enabling alternative implementation testing from any workflow checkpoint.

**Independent Test**: Can be fully tested by cloning a BUILD-stage ticket and verifying the new ticket has its own branch, same stage, and complete job history.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with 3 completed jobs, **When** user clicks Duplicate button and selects "Full clone", **Then** a new ticket is created with the same stage (BUILD), a new branch forked from source, and 3 cloned jobs with all telemetry data.

2. **Given** a ticket in VERIFY stage with branch `123-feature`, **When** user performs full clone, **Then** the new ticket has a branch created from `123-feature` following naming convention `{NEW_TICKET_NUMBER}-{slug}`.

3. **Given** a cloned ticket exists, **When** user views the job history, **Then** all job data is visible including command, status, logs, timestamps, and telemetry (tokens, cost, duration, tools used).

---

### User Story 2 - Simple Copy Preserves Existing Behavior (Priority: P1)

A user wants to duplicate a ticket to start fresh with the same requirements (title, description, attachments) but without any workflow history. The existing behavior must remain available.

**Why this priority**: Must not break existing functionality; simple copy is the safer default for most duplication needs.

**Independent Test**: Can be tested by selecting "Simple copy" and verifying the new ticket is in INBOX with no jobs and no branch.

**Acceptance Scenarios**:

1. **Given** a ticket in PLAN stage with jobs, **When** user selects "Simple copy" from dropdown, **Then** a new ticket is created in INBOX stage with title "Copy of [original]", no branch, and no jobs.

2. **Given** any ticket, **When** user selects "Simple copy", **Then** behavior is identical to current duplication (description, attachments, clarificationPolicy copied; stage reset to INBOX).

---

### User Story 3 - Contextual Availability of Full Clone Option (Priority: P2)

The "Full clone" option should only appear when meaningful - tickets in SPECIFY, PLAN, BUILD, or VERIFY stages that have workflow history worth cloning.

**Why this priority**: Prevents user confusion by hiding irrelevant options; INBOX tickets have nothing to clone, SHIP tickets are completed.

**Independent Test**: Can be tested by checking dropdown options for tickets at each stage.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX stage, **When** user clicks Duplicate button, **Then** dropdown shows only "Simple copy" option (no "Full clone").

2. **Given** a ticket in BUILD stage, **When** user clicks Duplicate button, **Then** dropdown shows both "Simple copy" and "Full clone" options.

3. **Given** a ticket in SHIP stage, **When** user clicks Duplicate button, **Then** dropdown shows only "Simple copy" option.

---

### Edge Cases

- What happens when source branch no longer exists in GitHub? Clone should fail gracefully with clear error message explaining the branch is missing.
- What happens when user lacks GitHub permissions? Clone should fail with appropriate error about insufficient repository permissions.
- What happens with very long job logs? Logs are stored as TEXT in database; clone copies them regardless of length.
- What happens if cloning fails mid-operation? Transaction should roll back both ticket creation and job copying to maintain consistency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST transform the Duplicate button into a dropdown menu with two options: "Simple copy" and "Full clone"
- **FR-002**: System MUST preserve existing simple duplication behavior when "Simple copy" is selected
- **FR-003**: System MUST display "Full clone" option only for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages
- **FR-004**: System MUST hide "Full clone" option for tickets in INBOX or SHIP stages
- **FR-005**: System MUST create a new Git branch from the source ticket's branch when performing full clone
- **FR-006**: System MUST follow existing branch naming convention `{TICKET_NUMBER}-{slug}` for cloned branches
- **FR-007**: System MUST copy all jobs from source ticket with complete data: command, status, branch, commitSha, logs, startedAt, completedAt
- **FR-008**: System MUST copy job telemetry data: inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed
- **FR-009**: System MUST preserve the source ticket's stage in the cloned ticket (not reset to INBOX)
- **FR-010**: System MUST generate a new ticketKey for the cloned ticket following project sequence
- **FR-011**: System MUST prefix cloned ticket title with "Clone of " (distinct from "Copy of " for simple copies)
- **FR-012**: System MUST copy ticket metadata: description, attachments, clarificationPolicy, workflowType
- **FR-013**: System MUST display toast notification with new ticketKey on successful clone
- **FR-014**: System MUST handle branch creation failures gracefully with user-friendly error messages
- **FR-015**: System MUST use database transaction to ensure atomicity of ticket creation and job copying

### Key Entities *(include if feature involves data)*

- **Ticket**: Main entity being duplicated. Full clone preserves stage, creates new branch, copies all metadata.
- **Job**: Workflow execution records. Full clone copies all job records with new ticket reference while preserving all original data including telemetry.
- **Branch**: Git branch in external repository. Full clone creates new branch from source branch via GitHub API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can access both duplication options (simple copy and full clone) within 2 clicks from the ticket detail view
- **SC-002**: Full clone operation completes successfully for 95% of attempts when source branch exists
- **SC-003**: Cloned tickets retain 100% of source job telemetry data for accurate cost/usage tracking
- **SC-004**: Users can distinguish cloned tickets from simple copies by title prefix
- **SC-005**: System provides clear feedback (success toast or error message) within 5 seconds of clone initiation
- **SC-006**: No data loss or orphaned records when clone operation fails mid-process (transaction rollback)
