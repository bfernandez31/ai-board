# Feature Specification: Board Real-Time Update on Workflow Stage Transitions

**Feature Branch**: `068-923-update-the`
**Created**: 2025-10-28
**Status**: Draft
**Input**: User description: "#923 Update the board. There is an issue with the real-time update. The ticket can change stages due to transitions that happen in the workflow. However, the board is not automatically updated."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Scope limited to workflow-initiated stage transitions (not manual drag-and-drop)
- **Policy Applied**: INTERACTIVE (legacy TEXT payload)
- **Confidence**: High - Issue description specifically mentions "transitions that happen in the workflow" indicating automated transitions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Impact on scope: Narrower scope focuses fix on automated transitions only; manual transitions already working
  2. Impact on timeline/cost: Faster implementation by not reimplementing existing manual transition functionality
- **Reviewer Notes**: Verify that manual drag-and-drop transitions continue to work correctly after changes

- **Decision**: Use TanStack Query cache invalidation strategy rather than adding new polling endpoint
- **Policy Applied**: INTERACTIVE
- **Confidence**: High - Project already uses TanStack Query v5.90.5 for state management (per CLAUDE.md)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Impact on scope/quality: Leverages existing infrastructure; maintains consistency with current architecture
  2. Impact on timeline/cost: No new API endpoints needed; uses established patterns from useTickets.ts
- **Reviewer Notes**: Ensure cache invalidation timing aligns with job completion polling to avoid race conditions

- **Decision**: Trigger cache invalidation when job status changes to terminal state (COMPLETED/FAILED/CANCELLED)
- **Policy Applied**: INTERACTIVE
- **Confidence**: Medium - Job polling already tracks terminal states (useJobPolling.ts:36); transition API updates stage atomically
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Impact on scope/quality: Prevents unnecessary refetches while jobs are PENDING/RUNNING; ensures update when workflow completes
  2. Impact on timeline/cost: Reuses existing terminal state detection logic
- **Reviewer Notes**: Validate that all workflow completion paths (success/failure/cancellation) correctly update job status before triggering invalidation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Board Updates After Workflow Completion (Priority: P1)

When a user has a ticket in the BUILD stage and the GitHub Actions workflow successfully completes the implementation and transitions the ticket to VERIFY, the board should automatically reflect this change without requiring manual refresh.

**Why this priority**: This is the core issue described in #923. Workflow-initiated transitions are invisible to users, breaking the real-time update promise and causing confusion about ticket status.

**Independent Test**: Can be fully tested by triggering a workflow that transitions a ticket from BUILD to VERIFY and observing the board update automatically without page refresh. Delivers immediate value by fixing the reported bug.

**Acceptance Scenarios**:

1. **Given** a ticket is in BUILD stage with an active workflow job, **When** the workflow completes successfully and transitions the ticket to VERIFY, **Then** the board automatically moves the ticket to the VERIFY column within 2 seconds
2. **Given** a user is viewing the board during a workflow execution, **When** the workflow fails and the job status changes to FAILED, **Then** the board reflects the failure state (ticket remains in current stage, job status shows FAILED)
3. **Given** multiple tickets have active workflows, **When** any workflow completes and transitions its ticket, **Then** only the affected ticket updates on the board (other tickets remain unchanged)

---

### User Story 2 - Board Updates After Quick-Impl Workflow (Priority: P2)

When a user uses the quick-impl workflow (INBOX → BUILD transition), the board should automatically update when the workflow completes and transitions the ticket to VERIFY.

**Why this priority**: Quick-impl workflows also perform automated stage transitions that are currently invisible to users. This is a variation of the same root issue but for a different workflow path.

**Independent Test**: Can be tested independently by dragging a ticket from INBOX to BUILD (triggering quick-impl), then observing the board update after workflow completion. Demonstrates that both workflow types (normal and quick-impl) handle real-time updates correctly.

**Acceptance Scenarios**:

1. **Given** a ticket is transitioned from INBOX to BUILD using quick-impl, **When** the quick-impl workflow completes and moves the ticket to VERIFY, **Then** the board automatically updates to show the ticket in VERIFY
2. **Given** a quick-impl workflow is running, **When** the workflow is cancelled, **Then** the board shows the ticket with CANCELLED job status

---

### User Story 3 - Manual Transitions Continue to Work (Priority: P3)

When a user manually drags a ticket from one stage to another, the board should continue to update immediately using the existing optimistic update mechanism.

**Why this priority**: This is a regression prevention scenario. Manual transitions already work correctly and must continue to work after implementing workflow-initiated updates.

**Independent Test**: Can be tested by manually dragging tickets between stages and verifying immediate visual feedback. Validates that new cache invalidation logic doesn't interfere with existing manual transition behavior.

**Acceptance Scenarios**:

1. **Given** a user manually drags a ticket from INBOX to SPECIFY, **When** the drag completes, **Then** the board updates immediately using optimistic updates (existing behavior)
2. **Given** a user manually transitions a ticket, **When** the backend confirms the transition, **Then** the board reconciles with server state without flickering

---

### Edge Cases

- What happens when a workflow completes but the user's network is offline?
  - Board should update when connection is restored via existing retry logic
  - No data loss - server state is source of truth

- How does the system handle rapid consecutive workflow completions (multiple tickets finishing simultaneously)?
  - TanStack Query deduplicates concurrent refetch requests to same endpoint
  - Single API call fetches all updated tickets, then cache update triggers re-render

- What happens if job polling detects terminal state but transition API hasn't updated ticket stage yet?
  - Cache invalidation triggers refetch, which gets current server state
  - Polling continues until all jobs terminal, ensuring eventual consistency

- How does the system handle workflow rollbacks (BUILD → INBOX)?
  - Rollback transitions follow same pattern: job status changes, cache invalidates, board refetches
  - Ticket appears in INBOX column with reset state

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect when a job status changes to a terminal state (COMPLETED, FAILED, CANCELLED)
- **FR-002**: System MUST invalidate the TanStack Query cache for project tickets when a job reaches terminal state
- **FR-003**: Board MUST automatically refetch ticket data after cache invalidation without user action
- **FR-004**: Board MUST display the updated ticket in the correct stage column after refetch completes
- **FR-005**: System MUST preserve existing manual transition behavior (optimistic updates on drag-and-drop)
- **FR-006**: System MUST handle concurrent workflow completions without duplicate API requests
- **FR-007**: Cache invalidation MUST use the existing query key pattern from `queryKeys.projects.tickets(projectId)`
- **FR-008**: System MUST NOT invalidate cache during non-terminal job status changes (PENDING, RUNNING)

### Key Entities

- **Job**: Tracks workflow execution status
  - Key attributes: id, ticketId, status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED), updatedAt
  - Relationships: Belongs to a Ticket, polled every 2 seconds via useJobPolling hook

- **Ticket**: Represents a work item on the board
  - Key attributes: id, stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP), version, updatedAt
  - Relationships: Has many Jobs, belongs to a Project

- **TanStack Query Cache**: Client-side state management for server data
  - Key attributes: Query key, cached data, stale time, garbage collection time
  - Relationships: Stores tickets by project, invalidated when workflow transitions occur

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a workflow completes and transitions a ticket, the board displays the updated ticket position within 2 seconds (maximum polling interval)
- **SC-002**: Board updates occur without requiring manual page refresh or user interaction
- **SC-003**: Manual drag-and-drop transitions continue to provide immediate optimistic updates (under 100ms perceived latency)
- **SC-004**: System handles 10+ concurrent workflow completions without duplicate API requests or race conditions
- **SC-005**: Users see correct ticket stages 100% of the time after workflow completion (no stale data)
