# Feature Specification: Real-Time Job Status Updates with Visual Indicators

**Feature Branch**: `020-9179-real-time`
**Created**: 2025-10-10
**Status**: Draft
**Input**: User description: "#9179 real-time update
add real-time update on job status. and display this state on the ticket. You can remove the metadate part of the ticket-card. Need to have something clean and nice. With an animation will be nice when job is running. for example You could display a sheet of paper with a pen or quill writing on it, moving, to signify that the drafting of the specifications is in progress. Do not forget to adapt the current test."

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature identified: Real-time job status display on tickets
2. Extract key concepts from description
   → Actors: Users viewing tickets
   → Actions: Display job status, show animations, remove metadata section
   → Data: Job status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
   → Constraints: Must be real-time, clean UI, animated during execution
3. For each unclear aspect:
   → [RESOLVED: WebSocket connection for real-time updates]
   → [RESOLVED: Display most recent active job; fallback to most recent terminal job]
   → [RESOLVED: Terminal statuses persist indefinitely until new job starts]
4. Fill User Scenarios & Testing section
   → User flow identified: User views ticket, sees job status update in real-time
5. Generate Functional Requirements
   → Each requirement testable
6. Identify Key Entities
   → Ticket (existing), Job (existing)
7. Run Review Checklist
   → WARN "Spec has uncertainties - marked with [NEEDS CLARIFICATION]"
8. Return: SUCCESS (spec ready for planning after clarifications)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-10
- Q: What real-time update mechanism should be used for job status changes? → A: WebSocket connection
- Q: When multiple jobs exist for a ticket, which job status should be displayed on the ticket card? → A: Most recent active job (show most recent PENDING or RUNNING job; if none, show most recent terminal job)
- Q: How long should terminal job statuses (COMPLETED/FAILED/CANCELLED) remain visible on ticket cards? → A: Persist indefinitely (remains visible until a new job starts)
- Q: Should there be minimum display time for each status to prevent users missing rapid status changes? → A: 500ms minimum per status (brief hold to ensure status registers visually)
- Q: Should CANCELLED status be displayed differently from FAILED status? → A: Distinct styling (FAILED uses error red, CANCELLED uses neutral gray for clearer distinction)

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user viewing the ticket board, I want to see the current status of automated jobs running on each ticket in real-time, so that I understand what work is being performed and when it completes.

The current ticket card displays static metadata (PLAN, BUILD, VERIFY message/tool counts) that doesn't reflect actual job execution status. Users cannot tell if a specification is being drafted, if work is in progress, or if a job has failed.

### Acceptance Scenarios

1. **Given** a ticket has no active or recent jobs, **When** I view the ticket card, **Then** I see a clean card with only the ticket ID, title, and SONNET badge (no job status displayed)

2. **Given** a ticket has a job in RUNNING status (e.g., drafting specifications), **When** I view the ticket card, **Then** I see an animated visual indicator (e.g., a sheet of paper with a quill/pen writing) showing work is in progress

3. **Given** a job status changes from PENDING to RUNNING, **When** I am viewing the board, **Then** the ticket card updates automatically to show the running animation without requiring page refresh

4. **Given** a job completes successfully (COMPLETED status), **When** I view the ticket card, **Then** I see a success indicator that persists indefinitely until a new job starts

5. **Given** a job fails (FAILED status), **When** I view the ticket card, **Then** I see an error/failure indicator that persists indefinitely until a new job starts

6. **Given** multiple jobs exist for a ticket (historical and current), **When** I view the ticket card, **Then** I see status for the most recent active job (PENDING or RUNNING status takes priority; if no active jobs, show most recent terminal job: COMPLETED/FAILED/CANCELLED)

7. **Given** the metadata section (MESSAGES/TOOLS PER AGENT) is removed from the ticket card, **When** I view any ticket, **Then** I see a cleaner design focused on ticket title and job status only

### Edge Cases

- What happens when a job is in CANCELLED status? CANCELLED status MUST use distinct neutral gray styling to differentiate from FAILED status (which uses error red), clearly indicating intentional termination vs. error condition
- What happens when job status updates occur very rapidly (e.g., PENDING → RUNNING → COMPLETED within seconds)? Each status MUST display for a minimum of 500ms to ensure users can visually register the state change (prevents flickering or missed transitions)
- What happens when the user has multiple browser tabs open and a job completes? Should all tabs update? (Yes - covered by FR-008: all open tabs must reflect updates)
- What happens when network connectivity is lost during real-time updates? [NEEDS CLARIFICATION: Should there be a "connection lost" indicator?]
- What happens when a ticket has never had any jobs? (Already covered in scenario 1: clean card with no status indicator)

---

## Requirements *(mandatory)*

### Functional Requirements

**Display Requirements**
- **FR-001**: System MUST display current job status on ticket cards for tickets with active or recent jobs
- **FR-002**: System MUST remove the existing metadata section (PLAN/BUILD/VERIFY message/tool counts) from all ticket cards
- **FR-003**: System MUST show animated visual indicators when a job is in RUNNING status
- **FR-004**: System MUST display distinct visual states for each job status: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- **FR-005**: System MUST use distinct styling for FAILED (error red) vs. CANCELLED (neutral gray) statuses to clearly communicate error condition vs. intentional termination
- **FR-006**: Ticket cards MUST maintain a clean, uncluttered appearance when displaying job status

**Real-Time Update Requirements**
- **FR-007**: System MUST automatically update ticket card job status without requiring user to refresh the page
- **FR-008**: System MUST use WebSocket connection to receive real-time job status change notifications from the server (push-based updates for lowest latency)
- **FR-009**: Status updates MUST be reflected across all open browser tabs/windows viewing the same board
- **FR-010**: Each status change MUST display for a minimum of 500ms before transitioning to the next status (prevents rapid flickering and ensures visual registration)

**Animation Requirements**
- **FR-011**: System MUST display a smooth, continuous animation for RUNNING status (e.g., writing quill/pen motion)
- **FR-012**: Animations MUST NOT impact board scrolling or interaction performance
- **FR-013**: Animations MUST be visually subtle and professional (not distracting)

**Data Requirements**
- **FR-014**: System MUST display the most recent active job (PENDING or RUNNING) when present; if no active jobs exist, display the most recent terminal job (COMPLETED/FAILED/CANCELLED)
- **FR-015**: System MUST handle tickets with no jobs gracefully (show clean card with no status indicator)
- **FR-016**: Terminal job statuses (COMPLETED/FAILED/CANCELLED) MUST persist indefinitely on the ticket card until replaced by a new job status

**Testing Requirements**
- **FR-017**: All existing E2E tests MUST be updated to reflect the new ticket card design (removal of metadata section)
- **FR-018**: New tests MUST verify real-time status updates for all job statuses
- **FR-019**: New tests MUST verify animations render correctly for RUNNING status
- **FR-020**: New tests MUST verify minimum 500ms display duration for rapid status transitions
- **FR-021**: New tests MUST verify distinct visual styling for FAILED (error red) vs. CANCELLED (neutral gray) statuses

---

### Key Entities *(include if feature involves data)*

- **Ticket**: Represents a work item on the board. Contains id, title, description, stage. Has zero or more associated Jobs. Already exists in the system.

- **Job**: Represents an automated workflow execution (e.g., specification drafting, planning, building). Contains ticketId (foreign key), command, status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED), branch, commitSha, logs, startedAt, completedAt timestamps. Already exists in the system with status tracking capabilities.

- **JobStatus**: Enumeration of possible job states: PENDING (queued for execution), RUNNING (currently executing), COMPLETED (finished successfully), FAILED (finished with error), CANCELLED (terminated by user). Already defined in the system.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (except network connectivity edge case - deferred as low impact)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (WebSocket connection, 500ms minimum display, job filtering rules defined)
- [x] Scope is clearly bounded (ticket card UI redesign, real-time status display)
- [x] Dependencies and assumptions identified (existing Job and Ticket models, existing job status tracking, WebSocket infrastructure)

**Resolved Clarifications**:
1. ✅ Real-time mechanism: WebSocket connection (FR-008)
2. ✅ Job filtering: Most recent active job; fallback to most recent terminal job (FR-014)
3. ✅ Display duration: Terminal statuses persist indefinitely (FR-016)
4. ✅ Minimum display time: 500ms per status (FR-010)
5. ✅ Visual distinction: FAILED (error red) vs. CANCELLED (neutral gray) (FR-005)

**Deferred Clarifications** (Low Impact):
- Network connectivity handling: Can be addressed during planning phase as implementation detail

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved (5 clarifications completed)
- [x] User scenarios defined and updated
- [x] Requirements generated (21 functional requirements)
- [x] Entities identified (Ticket, Job, JobStatus)
- [x] Review checklist passed (ready for planning)

---
