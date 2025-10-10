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
   → [NEEDS CLARIFICATION: Polling interval for real-time updates not specified]
   → [NEEDS CLARIFICATION: Should status display for all job types or only recent/active jobs?]
   → [NEEDS CLARIFICATION: Should completed/failed job status persist on ticket or fade after time?]
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

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a user viewing the ticket board, I want to see the current status of automated jobs running on each ticket in real-time, so that I understand what work is being performed and when it completes.

The current ticket card displays static metadata (PLAN, BUILD, VERIFY message/tool counts) that doesn't reflect actual job execution status. Users cannot tell if a specification is being drafted, if work is in progress, or if a job has failed.

### Acceptance Scenarios

1. **Given** a ticket has no active or recent jobs, **When** I view the ticket card, **Then** I see a clean card with only the ticket ID, title, and SONNET badge (no job status displayed)

2. **Given** a ticket has a job in RUNNING status (e.g., drafting specifications), **When** I view the ticket card, **Then** I see an animated visual indicator (e.g., a sheet of paper with a quill/pen writing) showing work is in progress

3. **Given** a job status changes from PENDING to RUNNING, **When** I am viewing the board, **Then** the ticket card updates automatically to show the running animation without requiring page refresh

4. **Given** a job completes successfully (COMPLETED status), **When** I view the ticket card, **Then** I see a success indicator [NEEDS CLARIFICATION: Should this persist indefinitely or fade after a duration?]

5. **Given** a job fails (FAILED status), **When** I view the ticket card, **Then** I see an error/failure indicator [NEEDS CLARIFICATION: How long should failure status remain visible?]

6. **Given** multiple jobs exist for a ticket (historical and current), **When** I view the ticket card, **Then** I see status for [NEEDS CLARIFICATION: only the most recent job, or all active jobs, or jobs from the last N hours?]

7. **Given** the metadata section (MESSAGES/TOOLS PER AGENT) is removed from the ticket card, **When** I view any ticket, **Then** I see a cleaner design focused on ticket title and job status only

### Edge Cases

- What happens when a job is in CANCELLED status? [NEEDS CLARIFICATION: Should this be displayed differently from FAILED?]
- What happens when job status updates occur very rapidly (e.g., PENDING → RUNNING → COMPLETED within seconds)? [NEEDS CLARIFICATION: Should there be minimum display time for each status?]
- What happens when the user has multiple browser tabs open and a job completes? Should all tabs update?
- What happens when network connectivity is lost during real-time updates? [NEEDS CLARIFICATION: Should there be a "connection lost" indicator?]
- What happens when a ticket has never had any jobs? (Already covered in scenario 1)

---

## Requirements *(mandatory)*

### Functional Requirements

**Display Requirements**
- **FR-001**: System MUST display current job status on ticket cards for tickets with active or recent jobs
- **FR-002**: System MUST remove the existing metadata section (PLAN/BUILD/VERIFY message/tool counts) from all ticket cards
- **FR-003**: System MUST show animated visual indicators when a job is in RUNNING status
- **FR-004**: System MUST display distinct visual states for each job status: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
- **FR-005**: Ticket cards MUST maintain a clean, uncluttered appearance when displaying job status

**Real-Time Update Requirements**
- **FR-006**: System MUST automatically update ticket card job status without requiring user to refresh the page
- **FR-007**: System MUST poll or listen for job status changes at [NEEDS CLARIFICATION: interval/method not specified - every 2s, 5s, 10s? Or WebSocket/SSE?]
- **FR-008**: Status updates MUST be reflected across all open browser tabs/windows viewing the same board

**Animation Requirements**
- **FR-009**: System MUST display a smooth, continuous animation for RUNNING status (e.g., writing quill/pen motion)
- **FR-010**: Animations MUST NOT impact board scrolling or interaction performance
- **FR-011**: Animations MUST be visually subtle and professional (not distracting)

**Data Requirements**
- **FR-012**: System MUST determine which job(s) to display per ticket when multiple jobs exist [NEEDS CLARIFICATION: show most recent? show all active? show jobs from last 24 hours?]
- **FR-013**: System MUST handle tickets with no jobs gracefully (show clean card with no status indicator)

**Testing Requirements**
- **FR-014**: All existing E2E tests MUST be updated to reflect the new ticket card design (removal of metadata section)
- **FR-015**: New tests MUST verify real-time status updates for all job statuses
- **FR-016**: New tests MUST verify animations render correctly for RUNNING status

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
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous (except where marked)
- [ ] Success criteria are measurable (pending clarifications on polling interval, display duration, job filtering)
- [x] Scope is clearly bounded (ticket card UI redesign, real-time status display)
- [x] Dependencies and assumptions identified (existing Job and Ticket models, existing job status tracking)

**Remaining Clarifications Needed**:
1. Polling interval/mechanism for real-time updates (FR-007)
2. Job filtering strategy when multiple jobs exist (FR-012)
3. Display duration for terminal statuses (COMPLETED, FAILED) - scenarios 4, 5
4. Minimum display time for rapid status changes (edge case)
5. Network connectivity handling (edge case)
6. Visual distinction between FAILED and CANCELLED statuses (edge case)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (6 clarification points identified)
- [x] User scenarios defined
- [x] Requirements generated (16 functional requirements)
- [x] Entities identified (Ticket, Job, JobStatus)
- [ ] Review checklist passed (pending clarifications)

---
