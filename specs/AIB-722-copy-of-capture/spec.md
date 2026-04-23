# Feature Specification: Capture and Display Agent Execution Logs

**Feature Branch**: `AIB-722-copy-of-capture`  
**Created**: 2024-04-23  
**Status**: Draft  
**Input**: User description: "Copy of Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Log storage approach - use hybrid storage (metadata in Postgres, log content in object storage)
- **Policy Applied**: AUTO (scored as CONSERVATIVE due to data retention and scalability signals)
- **Confidence**: High (score: 5, signals: scalability +2, reliability +2, storage constraints +1)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Slightly more complex implementation but prevents database bloat
  2. Requires object storage configuration but provides better scalability
- **Reviewer Notes**: Validate storage provider compatibility and retention policy implementation

- **Decision**: Log retention period - 30 days minimum with automatic pruning
- **Policy Applied**: AUTO (aligned with acceptance criteria)
- **Confidence**: High (score: 4, explicit requirement in acceptance criteria)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Storage cost vs. debugging needs balanced at 30 days
  2. Automatic pruning prevents unbounded storage growth
- **Reviewer Notes**: Confirm 30-day window meets user debugging needs

- **Decision**: Access control - same permissions as other ticket data
- **Policy Applied**: AUTO (aligned with acceptance criteria)
- **Confidence**: High (score: 4, explicit requirement)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing security model
  2. No additional permission complexity needed
- **Reviewer Notes**: Verify permission inheritance works correctly for external projects

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Logs for Failed Job (Priority: P1)

As a project member working on an external repository, I want to view the execution logs for a failed job directly in the ai-board UI so I can diagnose and fix issues without needing access to GitHub Actions.

**Why this priority**: This is the most critical use case as it directly addresses the blocking issue mentioned in the problem statement - users cannot currently debug failed jobs on external repositories.

**Independent Test**: Can be fully tested by simulating a failed job execution, capturing logs, and verifying they are accessible through the UI without GitHub Actions access.

**Acceptance Scenarios**:

1. **Given** a job has failed, **When** I view the job timeline, **Then** I see a condensed error summary inline
2. **Given** a failed job with logs, **When** I click "View full logs", **Then** I see the complete execution log with timestamps and error details
3. **Given** I'm a project member (not owner), **When** I access a failed job, **Then** I can view the logs with the same permissions as other ticket data

---

### User Story 2 - View Logs for Successful Job (Priority: P2)

As a project owner, I want to review the execution logs of successful jobs to understand what actions the agent performed and verify the workflow executed correctly.

**Why this priority**: Important for auditability and understanding agent behavior, but less critical than debugging failures.

**Independent Test**: Can be tested by running a successful job and verifying logs contain all expected information (timestamps, agent messages, tool invocations).

**Acceptance Scenarios**:

1. **Given** a job has completed successfully, **When** I view the job timeline, **Then** I see a summary of key actions taken
2. **Given** a successful job with logs, **When** I view full logs, **Then** I see the complete sequence of agent actions and tool invocations
3. **Given** multiple agent types (Claude, Codex, Mistral, Gemini), **When** I view their logs, **Then** I see normalized formatting for consistent reading experience

---

### User Story 3 - Log Retention and Management (Priority: P3)

As a system administrator, I want logs to be automatically managed so that storage doesn't grow indefinitely while still providing sufficient debugging window.

**Why this priority**: Important for system maintenance but not directly user-facing.

**Independent Test**: Can be tested by verifying old logs are pruned after 30 days while recent logs remain accessible.

**Acceptance Scenarios**:

1. **Given** logs older than 30 days, **When** the automatic pruning runs, **Then** those logs are removed from storage
2. **Given** logs within 30 days, **When** I access them, **Then** they remain available
3. **Given** the pruning process, **When** it encounters errors, **Then** it logs the error but doesn't interrupt the pruning of other logs

---

### Edge Cases

- What happens when log storage is unavailable during job execution? (Should queue for retry)
- How does system handle extremely large log files (>10MB)? (Should implement size limits or chunking)
- What happens when a job is cancelled mid-execution? (Should capture partial logs up to cancellation point)
- How does system handle concurrent log access by multiple users? (Should be read-only and concurrent-safe)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture agent execution logs for all supported agents (Claude Code, Codex, Mistral/vibe, Gemini)
- **FR-002**: System MUST store logs persistently beyond GitHub Actions retention window
- **FR-003**: System MUST display log preview inline in job timeline without requiring click
- **FR-004**: System MUST provide "View full logs" action that opens detailed log view
- **FR-005**: System MUST normalize logs from different agents to consistent readable format
- **FR-006**: System MUST include timestamps, agent messages, tool invocations, errors, and exit status in logs
- **FR-007**: System MUST implement hybrid storage (metadata in database, content in object storage)
- **FR-008**: System MUST retain logs for minimum 30 days with automatic pruning
- **FR-009**: System MUST apply same access control rules to logs as other ticket data
- **FR-010**: System MUST ensure no regression in existing telemetry collection
- **FR-011**: System MUST work identically for self-managed and external projects

### Key Entities

- **JobLog**: Represents the captured execution log for a job
  - Attributes: jobId, agentType, status, timestamp, previewContent, fullLogReference, storageLocation
  - Relationships: Belongs to Job, has many LogEntries

- **LogEntry**: Individual log entries within a JobLog
  - Attributes: sequenceNumber, timestamp, messageType (INFO/ERROR/WARNING/TOOL), content, toolName (if applicable), metadata
  - Relationships: Belongs to JobLog

- **LogStorage**: Tracks physical storage of log content
  - Attributes: logId, storageProvider, storageKey, contentSize, contentHash, expirationDate
  - Relationships: Belongs to JobLog

### Internal Processes

- **Log Capture Process**: Triggered when a job completes (COMPLETED, FAILED, or CANCELLED)
  - **Input**: Job execution context, agent output stream, telemetry data
  - **Phases**:
    1. Collect raw output from agent execution
    2. Parse and normalize output to standard format
    3. Extract key events for preview generation
    4. Store full content in object storage
    5. Store metadata and preview in database
    6. Update job record with log reference
  - **Output**: Persistent JobLog record with preview and full log access
  - **Error behavior**: If storage fails, queue for retry (max 3 attempts), log error to system monitoring

- **Log Pruning Process**: Triggered daily by scheduled job
  - **Input**: Current date, storage configuration
  - **Phases**:
    1. Identify logs older than retention period (30 days)
    2. Delete log content from object storage
    3. Update database records to mark as pruned
    4. Log pruning activity for audit trail
  - **Output**: Reduced storage usage, updated database records
  - **Error behavior**: Continue with next log if individual deletion fails, log errors for investigation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view execution logs for 100% of completed jobs within 5 seconds of job completion
- **SC-002**: 95% of users can diagnose job failures using logs without accessing GitHub Actions (measured via user feedback)
- **SC-003**: Log storage grows at less than 1GB per 1000 jobs (hybrid storage efficiency)
- **SC-004**: Log retrieval time averages under 2 seconds for 90% of requests
- **SC-005**: All supported agent types have logs available in consistent format within 1 sprint of implementation
- **SC-006**: No increase in support tickets related to job debugging after feature deployment
- **SC-007**: Database storage for logs remains under 10% of total database size (hybrid storage effectiveness)