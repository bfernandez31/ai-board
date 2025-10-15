# Feature Specification: Job Completion Validation for Stage Transitions

**Feature Branch**: `030-should-not-be`
**Created**: 2025-10-15
**Status**: Draft
**Input**: User description: "should not be possible to move to the next step if the job is not completed for the current task. For exemple you can't move to plan if the job specify is not completed. you can't moove to build if the job plan is not completed. and you can't moove to verify if the job build is not completed. for the other sequential moove BUILD → VERIFY VERIFY → SHIP no need to add restriction."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Failed job handling strategy (should failed jobs block transitions?)
- **Policy Applied**: CONSERVATIVE (fallback from AUTO due to low confidence)
- **Confidence**: Low (0.3) - Feature request contains only neutral technical keywords without clear risk/speed signals
- **Fallback Triggered?**: Yes - AUTO policy detected single neutral keyword ("can't move", "not completed") with netScore +1, triggering confidence score 0.3. Since confidence < 0.5, system fell back to CONSERVATIVE policy to minimize risk.
- **Trade-offs**:
  1. **Impact on scope/quality**: Requires explicit user action to retry failed jobs rather than auto-allowing retries, increasing friction but preventing accidental re-runs
  2. **Impact on timeline/cost**: Additional error handling and retry UI may be needed (out of scope for this feature)
- **Reviewer Notes**: Consider whether failed jobs should auto-allow retry transitions or require explicit "retry" action. Current spec blocks all non-COMPLETED transitions. If users frequently encounter failed workflows, this may need relaxation to PRAGMATIC approach (auto-allow retries for failed jobs).

---

- **Decision**: Cancelled job handling strategy (should cancelled jobs block transitions?)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) - Conservative alignment with failed job handling for consistency
- **Fallback Triggered?**: No - Direct application of CONSERVATIVE policy
- **Trade-offs**:
  1. **Impact on scope/quality**: Treats cancelled jobs same as failed jobs (requires retry), ensuring intentional workflow progression
  2. **Impact on timeline/cost**: No additional cost beyond failed job handling
- **Reviewer Notes**: Cancelled jobs indicate intentional stoppage. Blocking transitions ensures users don't accidentally skip incomplete work. Consider adding "resume" action if this becomes cumbersome.

---

- **Decision**: Job selection when multiple jobs exist for the same stage (which job status to check?)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) - Clear technical requirement with low ambiguity
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Impact on scope/quality**: Using most recent job by `startedAt DESC` ensures system checks the latest workflow attempt, preventing stale job data from blocking transitions
  2. **Impact on timeline/cost**: Single query with ORDER BY and LIMIT 1, minimal performance impact
- **Reviewer Notes**: Most recent job is most relevant for validation. Historical jobs preserved for audit trail but don't affect transition logic.

---

- **Decision**: Race condition handling during job status checks (what happens if job completes during validation?)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.7) - Standard database consistency requirement
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. **Impact on scope/quality**: Read-committed isolation level sufficient (PostgreSQL default), no pessimistic locking needed. Job status updates are atomic and idempotent.
  2. **Impact on timeline/cost**: No additional locking overhead, standard transaction handling
- **Reviewer Notes**: Race conditions between validation and transition are acceptable - worst case is user gets transient error and retries. Job completion is monotonic (PENDING → RUNNING → terminal state) so no risk of data corruption.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Block Transition When Job Not Completed (Priority: P1)

**Scenario**: A developer attempts to move a ticket forward while the automated workflow is still running or has failed.

**Why this priority**: Core safety feature preventing data inconsistency and incomplete work from progressing through the workflow. This is the primary requirement and must work correctly before any other features.

**Independent Test**: Can be fully tested by creating a ticket in SPECIFY stage with a PENDING job, attempting transition to PLAN, and verifying 400 error response. Delivers immediate value by preventing premature transitions.

**Acceptance Scenarios**:

1. **Given** a ticket is in SPECIFY stage with a PENDING job, **When** user attempts to transition to PLAN, **Then** system returns 400 error with message "Cannot transition: workflow is still running"

2. **Given** a ticket is in SPECIFY stage with a RUNNING job, **When** user attempts to transition to PLAN, **Then** system returns 400 error with message "Cannot transition: workflow is still running"

3. **Given** a ticket is in SPECIFY stage with a FAILED job, **When** user attempts to transition to PLAN, **Then** system returns 400 error with message "Cannot transition: previous workflow failed. Please retry the workflow."

4. **Given** a ticket is in SPECIFY stage with a CANCELLED job, **When** user attempts to transition to PLAN, **Then** system returns 400 error with message "Cannot transition: workflow was cancelled. Please retry the workflow."

5. **Given** a ticket is in PLAN stage with a PENDING job, **When** user attempts to transition to BUILD, **Then** system returns 400 error with message "Cannot transition: workflow is still running"

6. **Given** a ticket is in BUILD stage with a RUNNING job, **When** user attempts to transition to VERIFY, **Then** system returns 400 error with message "Cannot transition: workflow is still running"

---

### User Story 2 - Allow Transition When Job Completed (Priority: P1)

**Scenario**: A developer moves a ticket forward after the automated workflow has successfully completed.

**Why this priority**: Essential happy path that must work for the feature to provide any value. Equal priority to P1 because blocking and allowing are two sides of the same validation logic.

**Independent Test**: Can be fully tested by creating a ticket in SPECIFY stage with a COMPLETED job, attempting transition to PLAN, and verifying 200 success response. Delivers value by allowing normal workflow progression.

**Acceptance Scenarios**:

1. **Given** a ticket is in SPECIFY stage with a COMPLETED job, **When** user attempts to transition to PLAN, **Then** system creates a new PENDING job for PLAN command and updates ticket stage to PLAN

2. **Given** a ticket is in PLAN stage with a COMPLETED job, **When** user attempts to transition to BUILD, **Then** system creates a new PENDING job for BUILD command and updates ticket stage to BUILD

3. **Given** a ticket is in BUILD stage with a COMPLETED job, **When** user attempts to transition to VERIFY, **Then** system updates ticket stage to VERIFY without creating a job (manual stage)

---

### User Story 3 - Allow Transitions for Manual Stages (Priority: P2)

**Scenario**: A developer moves a ticket through manual stages (VERIFY, SHIP) without job completion requirements.

**Why this priority**: Important for workflow continuity but lower priority than automated stage validation. Manual stages are less complex and can be implemented after core validation logic.

**Independent Test**: Can be fully tested by creating a ticket in VERIFY stage (no jobs required), attempting transition to SHIP, and verifying 200 success response. Delivers value by preserving existing manual stage behavior.

**Acceptance Scenarios**:

1. **Given** a ticket is in BUILD stage with a COMPLETED job, **When** user transitions to VERIFY, **Then** system allows transition without job validation (VERIFY is manual stage)

2. **Given** a ticket is in VERIFY stage (no jobs exist), **When** user transitions to SHIP, **Then** system allows transition without job validation (SHIP is manual stage)

3. **Given** a ticket is in INBOX stage (no jobs exist), **When** user transitions to SPECIFY, **Then** system allows transition and creates PENDING job for SPECIFY command

---

### User Story 4 - Handle Multiple Jobs for Same Ticket (Priority: P3)

**Scenario**: A developer retries a failed workflow, resulting in multiple jobs for the same ticket, and the system validates against the most recent job.

**Why this priority**: Edge case that will occur in real usage but can be handled with simple query logic. Lower priority because it's a refinement of core validation logic.

**Independent Test**: Can be fully tested by creating a ticket with two jobs (one FAILED, one COMPLETED), attempting transition, and verifying system checks only the most recent job. Delivers value by supporting retry workflows.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY stage has two jobs (first FAILED at 10:00, second COMPLETED at 10:05), **When** user attempts to transition to PLAN, **Then** system validates against the COMPLETED job (most recent) and allows transition

2. **Given** a ticket in SPECIFY stage has two jobs (first COMPLETED at 10:00, second FAILED at 10:05), **When** user attempts to transition to PLAN, **Then** system validates against the FAILED job (most recent) and blocks transition

3. **Given** a ticket in SPECIFY stage has three jobs (FAILED, COMPLETED, RUNNING), **When** user attempts to transition to PLAN, **Then** system validates against the RUNNING job (most recent by startedAt) and blocks transition

---

### Edge Cases

- **What happens when a job is in PENDING status for more than 5 minutes?**
  - System still blocks transition (PENDING is not terminal state)
  - No automatic timeout or status change (job status managed by GitHub Actions workflow)
  - User must manually investigate or cancel the workflow if stuck

- **What happens when there are no jobs for a ticket?**
  - System allows transition for INBOX → SPECIFY (first transition, no prior job)
  - System allows transition for manual stages (VERIFY, SHIP) where jobs are never created
  - System blocks transition if jobs should exist but are missing (data integrity issue, return 500 error)

- **What happens when job status changes during validation?**
  - Race condition is acceptable (PostgreSQL read-committed isolation)
  - Worst case: User gets transient error and retries
  - Job status changes are atomic and idempotent, no data corruption risk

- **What happens when user attempts to skip multiple stages?**
  - Existing sequential validation (`isValidTransition`) already blocks this
  - Job validation is additional check, only runs if sequential check passes
  - Example: INBOX → BUILD is blocked by sequential validation before job check runs

- **What happens when transitioning backwards (not currently supported)?**
  - Out of scope - current system only supports forward sequential transitions
  - If backwards transitions are added in future, job validation should be skipped (returning to previous state shouldn't require job completion)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST validate job completion status before allowing stage transitions from SPECIFY, PLAN, and BUILD stages

- **FR-002**: System MUST allow transitions only when the most recent job for the current ticket has status COMPLETED

- **FR-003**: System MUST block transitions when the most recent job has status PENDING, RUNNING, FAILED, or CANCELLED

- **FR-004**: System MUST return 400 Bad Request error with descriptive message when transition is blocked due to incomplete job

- **FR-005**: System MUST select the most recent job using `startedAt DESC` ordering when multiple jobs exist for the same ticket

- **FR-006**: System MUST skip job validation for manual stages (VERIFY and SHIP) allowing direct transitions

- **FR-007**: System MUST skip job validation for the initial transition from INBOX to SPECIFY (no prior job exists)

- **FR-008**: System MUST include job status and command in error response to help users understand why transition was blocked

- **FR-009**: System MUST perform job validation after sequential stage validation but before creating new job or updating ticket

- **FR-010**: System MUST use the ticket's current stage to determine which job command to validate against (SPECIFY stage requires completed "specify" job, PLAN stage requires completed "plan" job, etc.)

### Key Entities *(include if feature involves data)*

- **Job**: Represents an automated workflow execution
  - `id`: Unique identifier (integer, auto-increment)
  - `ticketId`: Foreign key to ticket
  - `command`: Workflow command ("specify", "plan", "implement")
  - `status`: Workflow execution status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
  - `startedAt`: Timestamp when job was created (used for ordering multiple jobs)
  - **Relationships**: One ticket can have many jobs (one per stage transition)

- **Ticket**: Represents a work item in the board
  - `id`: Unique identifier
  - `stage`: Current workflow stage (INBOX, SPECIFY, PLAN, BUILD, VERIFY, SHIP)
  - **Relationships**: One ticket has many jobs

- **Stage Transition Rule**: Validation logic for moving between stages
  - Current stage determines which job command to validate
  - Job status determines whether transition is allowed
  - Sequential validation (existing) + job completion validation (new)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users cannot progress tickets from SPECIFY, PLAN, or BUILD stages until the workflow completes (100% of attempts blocked when job status is PENDING/RUNNING/FAILED/CANCELLED)

- **SC-002**: Users receive clear, actionable error messages when transitions are blocked (error message includes job status and suggested action within 200ms response time)

- **SC-003**: Manual stage transitions (BUILD → VERIFY, VERIFY → SHIP) remain unrestricted (100% success rate for valid sequential transitions between manual stages)

- **SC-004**: System maintains data consistency without race conditions (0 orphaned jobs, 0 invalid stage transitions even under concurrent access)

- **SC-005**: Job validation adds minimal latency to transition requests (<50ms additional query time for job status check)

- **SC-006**: Retry workflows are supported correctly (users can retry failed jobs and system validates against most recent job attempt, 100% accuracy)
