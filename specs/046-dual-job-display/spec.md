# Feature Specification: Dual Job Display

**Feature Branch**: `046-dual-job-display`
**Created**: 2025-10-23
**Status**: Draft
**Input**: User description: "Dual Job Display - Display two types of jobs on ticket cards with contextual labels and strict display rules to prevent masking critical errors"

## Auto-Resolved Decisions

- **Decision**: No clarifications needed - the feature requirements are fully specified with clear display rules, label mappings, and filtering logic
- **Policy Applied**: AUTO
- **Confidence**: High (score: 0.9) - Feature has explicit technical specifications including SQL-like WHERE clauses, label mapping table, and stage-based visibility rules
- **Fallback Triggered?**: No - requirements are unambiguous with concrete examples
- **Trade-offs**:
  1. Complexity: Dual job display adds visual complexity to ticket cards but improves transparency of concurrent workflow and AI-BOARD operations
  2. Performance: Two database queries per ticket instead of one, but mitigated by existing indexes on ticketId, status, and startedAt columns
- **Reviewer Notes**: Validate that contextual label logic (WRITING/CODING/ASSISTING) aligns with user expectations during workflow operations

## User Scenarios & Testing

### User Story 1 - View Workflow Job Status (Priority: P1)

Users need to see the current state of automated workflow jobs (specify, plan, implement, quick-impl) on their ticket cards to understand when the system is actively working on a feature specification, plan, or implementation.

**Why this priority**: Core functionality - every ticket that goes through automated workflows needs workflow job visibility. This is the foundation upon which AI-BOARD visibility is built.

**Independent Test**: Can be fully tested by creating a ticket, triggering a workflow (e.g., drag to SPECIFY), and verifying the workflow job indicator appears with the correct label (WRITING/CODING) and updates in real-time as the job progresses.

**Acceptance Scenarios**:

1. **Given** a ticket with no jobs, **When** I drag it to SPECIFY column, **Then** I see a workflow job indicator showing "WRITING" status for the specification job
2. **Given** a ticket in PLAN stage with a running plan job, **When** I view the ticket card, **Then** I see "WRITING" status for the planning job
3. **Given** a ticket in BUILD stage with a running implement job, **When** I view the ticket card, **Then** I see "CODING" status for the implementation job
4. **Given** a ticket in INBOX with a running quick-impl job, **When** I view the ticket card, **Then** I see "CODING" status for the quick implementation job
5. **Given** a ticket with a completed workflow job, **When** I view the ticket card, **Then** I see "COMPLETED" status (not contextual label)
6. **Given** a ticket with a failed workflow job, **When** I view the ticket card, **Then** I see "FAILED" status prominently displayed to prevent error masking

---

### User Story 2 - View AI-BOARD Assistance Status (Priority: P2)

Users need to see when the AI-BOARD system user is actively assisting on a ticket through comments, but only when that assistance is relevant to the current ticket stage (to avoid showing stale AI-BOARD jobs from previous stages).

**Why this priority**: Secondary to core workflow visibility, but critical for understanding when AI-BOARD is actively helping. Stage-filtered visibility prevents confusion from showing outdated AI-BOARD jobs.

**Independent Test**: Can be fully tested by creating a ticket in SPECIFY stage, mentioning @ai-board in a comment, and verifying the AI-BOARD job indicator appears showing "ASSISTING" status only when command matches current stage (e.g., "comment-specify" shown in SPECIFY, but hidden when ticket moves to PLAN).

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY stage with a running "comment-specify" AI-BOARD job, **When** I view the ticket card, **Then** I see "ASSISTING" status for the AI-BOARD job alongside the workflow job
2. **Given** a ticket in PLAN stage with an old "comment-specify" AI-BOARD job, **When** I view the ticket card, **Then** I do NOT see the AI-BOARD job (stage mismatch)
3. **Given** a ticket in PLAN stage with a running "comment-plan" AI-BOARD job, **When** I view the ticket card, **Then** I see "ASSISTING" status for the AI-BOARD job
4. **Given** a ticket with a completed AI-BOARD job matching current stage, **When** I view the ticket card, **Then** I see "COMPLETED" status for the AI-BOARD job
5. **Given** a ticket in BUILD stage with no AI-BOARD jobs, **When** I view the ticket card, **Then** I see only the workflow job indicator
6. **Given** a ticket in SPECIFY stage with a failed "comment-specify" AI-BOARD job, **When** I view the ticket card, **Then** I see "FAILED" status for the AI-BOARD job to indicate assistance error

---

### User Story 3 - Distinguish Job Types Visually (Priority: P3)

Users need to visually distinguish between workflow automation jobs and AI-BOARD assistance jobs at a glance, so they can quickly understand what type of activity is happening on a ticket.

**Why this priority**: Polish feature that enhances UX but not strictly required for functionality. Users can understand job states even without visual distinction.

**Independent Test**: Can be fully tested by creating two tickets - one with a workflow job and one with an AI-BOARD job - and verifying each displays with distinct icons/colors (Cog icon for workflow, MessageSquare icon for AI-BOARD).

**Acceptance Scenarios**:

1. **Given** a ticket with a running workflow job, **When** I view the ticket card, **Then** I see a Cog icon with blue color indicating "Workflow" job type
2. **Given** a ticket with a running AI-BOARD job, **When** I view the ticket card, **Then** I see a MessageSquare icon with purple color indicating "AI-BOARD" job type
3. **Given** a ticket with both workflow and AI-BOARD jobs running, **When** I view the ticket card, **Then** I see two distinct job indicators with different icons and colors
4. **Given** a ticket with completed jobs of both types, **When** I view the ticket card, **Then** job type visual distinction remains visible in completed state

---

### Edge Cases

- What happens when a ticket has multiple AI-BOARD jobs across different stages (e.g., "comment-specify" and "comment-plan")? Only the most recent job matching the current stage is displayed.
- What happens when a ticket transitions stages while an AI-BOARD job is running? The AI-BOARD job indicator disappears if the command no longer matches the new stage (e.g., ticket moves from SPECIFY to PLAN while "comment-specify" is running).
- What happens when both workflow and AI-BOARD jobs are in FAILED state simultaneously? Both error indicators are displayed to ensure no critical errors are hidden.
- What happens to job indicators when a ticket is in INBOX stage? Workflow jobs are always shown. AI-BOARD jobs are only shown if command is "comment-inbox" (though this is not a standard pattern in the system).
- What happens when database query returns no jobs for a ticket? No job indicators are displayed on the ticket card (existing behavior preserved).
- What happens when AI-BOARD job is in PENDING state for current stage? The AI-BOARD job indicator displays "PENDING" status with clock icon.
- What happens when workflow job command is unknown/new? Job is still displayed with its raw status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED) without contextual label transformation.

## Requirements

### Functional Requirements

- **FR-001**: System MUST display workflow job status on every ticket card when a workflow job exists for that ticket
- **FR-002**: System MUST display AI-BOARD job status on ticket cards only when the AI-BOARD job command matches the current ticket stage (e.g., "comment-specify" visible only in SPECIFY stage)
- **FR-003**: System MUST retrieve workflow jobs using the filter: `WHERE ticketId = X AND command NOT LIKE 'comment-%' ORDER BY startedAt DESC LIMIT 1`
- **FR-004**: System MUST retrieve AI-BOARD jobs using the filter: `WHERE ticketId = X AND command LIKE 'comment-%' ORDER BY startedAt DESC LIMIT 1`
- **FR-005**: System MUST transform RUNNING status labels based on job command:
  - Commands "specify" and "plan" → display "WRITING"
  - Commands "implement" and "quick-impl" → display "CODING"
  - Commands starting with "comment-" → display "ASSISTING"
- **FR-006**: System MUST display non-RUNNING statuses (PENDING, COMPLETED, FAILED, CANCELLED) without transformation using their actual status values
- **FR-007**: System MUST visually distinguish between workflow jobs (Cog icon, blue color) and AI-BOARD jobs (MessageSquare icon, purple color)
- **FR-008**: System MUST display both workflow and AI-BOARD job indicators simultaneously when both jobs exist and meet their respective visibility criteria
- **FR-009**: System MUST hide AI-BOARD job indicators when the AI-BOARD job command does not match the current ticket stage (strict stage matching: "comment-specify" → SPECIFY, "comment-plan" → PLAN, etc.)
- **FR-010**: System MUST always display workflow jobs regardless of ticket stage when a workflow job exists
- **FR-011**: System MUST display FAILED status indicators prominently without masking or hiding error states for both job types
- **FR-012**: System MUST update job displays in real-time as job statuses change through the existing polling mechanism

### Key Entities

- **Workflow Job**: A job record where the command field does NOT start with "comment-" (e.g., "specify", "plan", "implement", "quick-impl"). Always displayed when it exists for a ticket. Represents automated workflow operations like specification writing, planning, and implementation.

- **AI-BOARD Job**: A job record where the command field starts with "comment-" (e.g., "comment-specify", "comment-plan", "comment-build"). Stage-filtered display based on command suffix matching ticket's current stage. Represents AI-BOARD system user assistance through comment interactions.

- **Job Display State**: The computed visibility and presentation of job indicators on a ticket card. Determined by:
  - Job existence (presence of matching job records)
  - Stage matching (for AI-BOARD jobs only)
  - Status-based label transformation (RUNNING → contextual labels)
  - Job type classification (workflow vs. AI-BOARD)

- **Contextual Status Label**: Transformed display label for RUNNING status jobs:
  - "WRITING" - Displayed during specification and planning operations
  - "CODING" - Displayed during implementation operations
  - "ASSISTING" - Displayed during AI-BOARD comment-based assistance
  - Original status preserved for non-RUNNING states (PENDING, COMPLETED, FAILED, CANCELLED)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can identify the type of activity (specification writing, planning, coding, AI assistance) happening on a ticket within 1 second of viewing the ticket card
- **SC-002**: System displays both workflow and AI-BOARD job indicators simultaneously when both jobs exist, with distinct visual identifiers (different icons and colors)
- **SC-003**: AI-BOARD job indicators disappear within 2 seconds (one polling cycle) when a ticket transitions to a different stage that doesn't match the AI-BOARD job command
- **SC-004**: Error states (FAILED, CANCELLED) are prominently displayed for both job types 100% of the time, preventing any masking of critical errors
- **SC-005**: Job status updates reflect in the UI within 2 seconds (one polling cycle) of job status changes in the database
- **SC-006**: Users see contextual labels (WRITING, CODING, ASSISTING) instead of generic "RUNNING" status 100% of the time for active jobs, improving clarity of what action is being performed
- **SC-007**: Stale AI-BOARD job indicators from previous stages are hidden 100% of the time, reducing confusion about current vs. past assistance
