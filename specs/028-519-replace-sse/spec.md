# Feature Specification: Replace SSE with Client-Side Polling

**Feature Branch**: `028-519-replace-sse`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "#519 Replace SSE with client-side Polling Vercel s serverless functions have critical limitations for SSE Replace SSE with client-side polling Remove the SSE tests and update the existing tests affected by this change"

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature description clear: Replace SSE with polling
2. Extract key concepts from description
   → Actors: Board users viewing job status updates
   → Actions: Poll for job status, display status changes
   → Data: Job status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
   → Constraints: Vercel serverless limitations, maintain existing UX
3. For each unclear aspect:
   → Polling interval: 2 seconds
   → Stop polling terminal state jobs: Yes
   → Error retry strategy: Fixed interval (2s)
   → Polling scope: Single request for all project jobs
4. Fill User Scenarios & Testing section
   → User flows: View job status on board, see updates, handle errors
5. Generate Functional Requirements
   → Each requirement testable
   → Marked ambiguous requirements with clarifications
6. Identify Key Entities
   → Job status, Polling state
7. Run Review Checklist
   → Polling lifecycle: Start on mount, stop on unmount or all jobs terminal
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-14

- Q: What polling interval should the client use to check for job status updates? → A: 2 seconds (aggressive, ~30 requests/min)
- Q: Should the system stop polling for jobs that have reached a terminal state (COMPLETED/FAILED/CANCELLED) to reduce server load? → A: Yes, stop polling terminal jobs
- Q: When a polling request fails due to network error, what retry strategy should the system use? → A: Fixed interval (retry every 2s)
- Q: Should the system poll for all project jobs in a single request, or poll for individual ticket jobs separately? → A: Single request for all project jobs (efficient, one endpoint call)
- Q: When should polling start and stop? → A: Start on mount, stop on unmount or when all jobs terminal

## User Scenarios & Testing

### Primary User Story

When a user views the project board, they see live job status updates for tickets in automation workflows. The system periodically checks for status changes and updates the UI when jobs transition between states (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED), replacing the current push-based SSE approach with a pull-based polling mechanism.

### Acceptance Scenarios

1. **Given** a user is viewing the project board with a ticket in RUNNING state, **When** the job completes successfully, **Then** the board displays COMPLETED status within 2 seconds (polling interval)

2. **Given** a user is viewing the project board with multiple tickets having active jobs, **When** job status updates occur, **Then** all affected tickets display their new statuses

3. **Given** a job has reached a terminal state (COMPLETED/FAILED/CANCELLED), **When** the user continues viewing the board, **Then** the system stops polling for that specific job to reduce server load

4. **Given** the board is open but the user is in a different browser tab, **When** jobs update, **Then** polling continues (no pause on tab visibility changes)

5. **Given** a polling request fails due to network error, **When** the error occurs, **Then** the system retries at the standard 2-second polling interval without exponential backoff

6. **Given** multiple users viewing the same project board, **When** a job updates, **Then** all users see the update independently (no shared broadcast mechanism)

### Edge Cases

- What happens when a user has slow/intermittent network connection? (System continues retrying at 2-second intervals)
- What happens when the board page loses focus (user switches tabs)? (Polling continues without pause)
- What happens when polling encounters rate limiting?
- What happens when jobs update faster than the polling interval?
- How does the system handle stale data (job status changed but poll hasn't occurred yet)?
- What visual indicators show the user that polling is active vs. inactive?

## Requirements

### Functional Requirements

- **FR-001**: System MUST periodically fetch job status updates every 2 seconds

- **FR-002**: System MUST display job status changes for all jobs associated with the current project board

- **FR-003**: Users MUST see the same real-time status update experience as with the current SSE implementation (no degradation in UX)

- **FR-004**: System MUST fetch all project job statuses in a single polling request to minimize network overhead and server load

- **FR-005**: System MUST handle network errors gracefully and retry failed polling requests at the standard 2-second interval (no exponential backoff or retry limits)

- **FR-006**: System MUST start polling when the board component mounts and stop polling when the component unmounts or when all project jobs reach terminal states

- **FR-007**: System MUST remove all SSE-specific infrastructure (EventSource connections, text/event-stream endpoints, broadcast mechanisms)

- **FR-008**: System MUST maintain the existing minimum display duration behavior (prevent status flickering)

- **FR-009**: System MUST support the same job status transitions as current implementation (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED)

- **FR-010**: System MUST stop polling for jobs once they reach a terminal state (COMPLETED, FAILED, or CANCELLED) to reduce server load and network traffic

### Key Entities

- **Job**: Workflow execution tracking entity with status field (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED), command, ticketId, and projectId relationship

- **Polling State**: Client-side state tracking when polling is active (mount to unmount or all jobs terminal), last successful poll timestamp, error state, and which jobs are in terminal states (to exclude from polling)

- **Job Status Update**: Data structure representing current status of all project jobs (aggregated response), returned from a single polling endpoint call

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (5 clarifications resolved)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (2-second polling interval defined)
- [x] Scope is clearly bounded (replacing SSE with polling)
- [x] Dependencies and assumptions identified (Vercel serverless limitations)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved (5 critical clarifications answered)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---

## Additional Context

### Why This Change?

Vercel's serverless function platform has limitations that make Server-Sent Events (SSE) unreliable:
- Serverless functions have execution time limits
- Connection persistence is not guaranteed in serverless environments
- Cold starts can interrupt SSE connections
- Scaling behavior can disconnect clients unexpectedly

### Current SSE Implementation

The existing system uses:
- `/api/sse` endpoint with `text/event-stream` response type
- EventSource browser API for client connections
- In-memory subscriber registry for broadcasting updates
- Keep-alive messages every 15 seconds to prevent timeouts
- SSEProvider React context for connection management
- useJobStatus hook for status display with transition delays

### Testing Impact

The following test files contain SSE-specific tests that will need updating:
- `tests/e2e/real-time/sse-connection.spec.ts` (SSE connection establishment tests)
- `tests/e2e/real-time/sse-job-broadcast.spec.ts` (SSE broadcast tests)
- Multiple board and ticket tests that interact with SSE infrastructure

Tests must verify equivalent functionality with polling mechanism while removing SSE-specific assertions (EventSource ready states, text/event-stream responses, connection establishment).

### Success Metrics

- Users experience the same responsiveness in job status updates
- No visual degradation in status transition smoothness
- System performs reliably on Vercel's serverless platform
- Server load remains manageable under concurrent user load
- All existing E2E tests pass with polling implementation
