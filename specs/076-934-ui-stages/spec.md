# Feature Specification: Real-Time UI Stage Synchronization

**Feature Branch**: `076-934-ui-stages`
**Created**: 2025-10-30
**Status**: Draft
**Input**: User description: "#934 ui stages transition - the ticket do not change of stages in the ui. in quick-impl workflow when the ticket change to verify stage it's not the case in the ui. but the job is actually changed. so the ticket is still in build with the job of the verify workflow display. need to fix this. the ticket should move on the correct stages in the ui. The db is good. Same issue for workflow that ship the ticket on deploy. the job is completed so no status change and we have to refresh the page if we want to see the modification of stages in the ui"

## Auto-Resolved Decisions

- **Decision**: Cache invalidation strategy for workflow-initiated stage transitions
- **Policy Applied**: AUTO
- **Confidence**: High (score: +3) - Based on technical context (real-time polling system, workflow architecture) and clear bug reproduction path
- **Fallback Triggered?**: No - Decision is straightforward given existing polling architecture
- **Trade-offs**:
  1. **Scope**: Minimal change to polling hook logic vs. larger refactor to WebSocket/SSE infrastructure
  2. **Performance**: Slight increase in API calls (one additional refetch per workflow-initiated transition) vs. current broken state
- **Reviewer Notes**: Validate that the chosen approach (invalidate on ANY terminal job, not just workflow completion) doesn't cause excessive refetching. Consider monitoring API call frequency after deployment.

---

- **Decision**: Detection mechanism for workflow-initiated transitions
- **Policy Applied**: AUTO
- **Confidence**: High (score: +3) - Technical constraint analysis shows polling hook already has necessary job data (command field)
- **Fallback Triggered?**: No - Clear implementation path exists within current architecture
- **Trade-offs**:
  1. **Complexity**: Enhanced polling logic vs. simpler but less efficient approach (poll tickets endpoint directly)
  2. **Data freshness**: Potential 2-second delay in UI update vs. instant but more costly real-time push
- **Reviewer Notes**: Ensure the command field matching logic is maintainable. If new workflow types are added, they should automatically work with this pattern.

---

- **Decision**: Refetch timing strategy (immediate vs. debounced)
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (score: +1) - Balancing user experience (instant feedback) with API load
- **Fallback Triggered?**: No - Industry standard pattern for optimistic UI updates
- **Trade-offs**:
  1. **User Experience**: Instant UI update (< 2s) vs. potential 4-6s delay with debouncing
  2. **API Load**: Slightly higher request frequency vs. more efficient batching
- **Reviewer Notes**: Monitor API response times and consider implementing request debouncing if polling endpoint latency increases beyond 100ms p95. Current polling architecture already has 2-second interval, so one additional refetch per transition is acceptable.

## User Scenarios & Testing

### User Story 1 - Quick-Impl Workflow Stage Visibility (Priority: P1)

When a user drags a ticket from INBOX to BUILD using quick-implementation mode, the ticket should automatically move to the VERIFY column in the UI once the implementation workflow completes and transitions the ticket to VERIFY stage. The user should see the stage change happen automatically within 2-3 seconds without needing to refresh the page.

**Why this priority**: P1 - Core workflow broken; users cannot track ticket progress without manual page refresh, defeating the purpose of the real-time board UI.

**Independent Test**: Can be fully tested by creating a ticket, dragging it INBOX → BUILD (quick-impl), and observing the automatic transition to VERIFY column when the workflow script calls the transition API. Delivers immediate value by fixing the most common workflow path.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with a running quick-impl job, **When** the workflow completes and transitions the ticket to VERIFY stage (via API call), **Then** the ticket card moves from BUILD column to VERIFY column in the UI within 2 seconds
2. **Given** multiple tickets in different stages with active workflows, **When** any workflow transitions a ticket to a new stage, **Then** only the affected ticket updates its visual position without affecting other tickets
3. **Given** a ticket that has just transitioned to VERIFY, **When** the polling system detects the stage change, **Then** the job status indicator updates to show the new VERIFY workflow job (not the completed BUILD job)

---

### User Story 2 - Auto-Ship Deployment Stage Visibility (Priority: P1)

When production deployment completes and the auto-ship workflow transitions merged tickets from VERIFY to SHIP stage, users viewing the board should see these tickets automatically move to the SHIP column without page refresh. The transition should happen within 2-3 seconds of the deployment completing.

**Why this priority**: P1 - Equal importance to story 1; auto-ship is the final step in the workflow and users need to see deployment status in real-time to know when features are live.

**Independent Test**: Can be tested by simulating a production deployment event with a merged ticket branch. The ticket should move from VERIFY to SHIP column automatically. Delivers value by providing real-time deployment visibility.

**Acceptance Scenarios**:

1. **Given** a ticket in VERIFY stage with its branch merged to main, **When** production deployment succeeds and auto-ship workflow transitions it to SHIP, **Then** the ticket card moves from VERIFY column to SHIP column in the UI within 2 seconds
2. **Given** multiple tickets in VERIFY stage with only some branches merged, **When** auto-ship workflow runs, **Then** only merged tickets move to SHIP column while others remain in VERIFY
3. **Given** a user viewing the board during deployment, **When** auto-ship transitions occur, **Then** the user sees smooth visual transitions without UI flicker or card duplication

---

### User Story 3 - Manual Stage Transition Reliability (Priority: P2)

When users manually drag tickets between stages (not workflow-initiated), the UI should remain responsive and correctly reflect the current stage even when workflows are simultaneously running and making their own stage transitions. The system should handle concurrent updates gracefully.

**Why this priority**: P2 - Less common than automated transitions (users typically let workflows handle progression), but important for ensuring system reliability and data consistency.

**Independent Test**: Can be tested by manually dragging a ticket while a workflow is running on another ticket. Both operations should complete successfully without race conditions or UI state corruption.

**Acceptance Scenarios**:

1. **Given** a ticket in BUILD stage with a completed workflow, **When** a user manually drags it back to INBOX (rollback), **Then** the UI reflects the rollback immediately and polling continues to work for other tickets
2. **Given** two tickets with simultaneous stage changes (one manual drag, one workflow transition), **When** both updates complete, **Then** both tickets display in their correct columns with correct job status indicators
3. **Given** a ticket being transitioned by a workflow, **When** the polling system detects the new stage and refetches ticket data, **Then** the TanStack Query cache updates correctly and all components using the cached data re-render with the new stage

---

### Edge Cases

- What happens when a workflow transitions a ticket multiple times in rapid succession (e.g., BUILD → VERIFY → SHIP within 4 seconds)? The polling system should detect each transition and update the UI accordingly without missing intermediate stages or causing visual flickering.
- How does the system handle network latency when the tickets refetch request is delayed? The polling hook should continue working and queue the next refetch once the previous one completes, ensuring eventual consistency.
- What happens if a job transitions to terminal status at the exact moment a user manually drags the same ticket? The version-based optimistic concurrency control in the transition API should prevent race conditions, and the UI should reflect whichever operation succeeded (manual drag or workflow transition).
- What happens when the polling endpoint fails or times out during a workflow-initiated stage transition? The TanStack Query retry logic should automatically retry the request, and the UI should eventually sync once connectivity is restored.

## Requirements

### Functional Requirements

- **FR-001**: System MUST detect when a workflow has transitioned a ticket to a new stage via API call and trigger UI cache invalidation within the existing 2-second polling interval
- **FR-002**: System MUST refetch ticket data from the server when a workflow-initiated stage transition is detected, ensuring the UI displays the correct stage within 2 seconds of the database update
- **FR-003**: System MUST preserve existing polling behavior for job status updates (PENDING → RUNNING → COMPLETED/FAILED/CANCELLED) while adding detection for stage transitions
- **FR-004**: System MUST invalidate the tickets cache when ANY job reaches terminal status, regardless of whether the job represents a workflow completion (specify, plan, implement) or a stage transition side-effect (quick-impl → verify, verify → ship)
- **FR-005**: System MUST handle rapid successive stage transitions (multiple workflows chaining together) without causing excessive API calls or UI flickering, using TanStack Query's built-in request deduplication
- **FR-006**: System MUST maintain backward compatibility with manual stage transitions (user drag-and-drop), ensuring optimistic UI updates still work correctly alongside polling-based updates
- **FR-007**: System MUST display the correct job status indicator for each ticket after a stage transition, showing the NEW job (if created) rather than the COMPLETED previous job

### Key Entities

- **Job**: Represents a workflow execution with status, command type, and associated ticket
  - Key attributes: id, ticketId, status (PENDING/RUNNING/COMPLETED/FAILED/CANCELLED), command (specify/plan/implement/quick-impl/verify/ship), createdAt, completedAt
  - Relationships: Belongs to one Ticket, belongs to one Project
  - Critical for detecting workflow completion and stage transitions

- **Ticket**: Represents a work item moving through workflow stages
  - Key attributes: id, title, stage (INBOX/SPECIFY/PLAN/BUILD/VERIFY/SHIP), branch, workflowType (FULL/QUICK), version
  - Relationships: Has many Jobs, belongs to one Project
  - Polling system must keep ticket stage synchronized with database state

- **TicketsByStage**: Grouped collection of tickets organized by workflow stage
  - Used by board component to render columns
  - Invalidated when polling hook detects terminal job status
  - Refetched via GET /api/projects/:projectId/tickets endpoint

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users see ticket stage changes in the UI within 3 seconds of workflow-initiated database updates (measured from API call timestamp to UI render)
- **SC-002**: Ticket stage synchronization works correctly for 100% of workflow-initiated transitions (quick-impl → verify, verify → ship) without requiring manual page refresh
- **SC-003**: System maintains current polling performance characteristics (2-second interval, < 100ms p95 response time for polling endpoint) while adding stage transition detection
- **SC-004**: Zero instances of ticket cards appearing in incorrect columns after workflow completion (measured via E2E test suite)
- **SC-005**: Users can successfully perform manual drag-and-drop stage transitions while workflows are running on other tickets, with both operations completing without errors (verified via concurrent operation tests)
