# Feature Specification: Health Dashboard - Workflow health-scan.yml

**Feature Branch**: `AIB-372-health-dashboard-workflow`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Generic GitHub workflow executing project health scans, triggered by ai-board API when user clicks 'Run Scan' on a Health Dashboard card. Single workflow handles 4 scan types via scanType parameter."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Workflow authentication model

- **Decision**: The workflow authenticates back to the ai-board API using the existing `WORKFLOW_API_TOKEN` secret (same pattern as speckit.yml), calling the existing `PATCH /api/projects/:projectId/health/scans/:scanId/status` endpoint for status updates
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 10) — security/compliance keywords dominate
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Reuses proven auth pattern, no new secrets required
  2. No additional flexibility for per-scan auth granularity (acceptable for v1)
- **Reviewer Notes**: Verify `WORKFLOW_API_TOKEN` secret is available in the workflow environment

### Decision 2: Ticket creation mechanism

- **Decision**: The workflow creates tickets by calling the existing ai-board API (`POST /api/projects/:projectId/tickets`) with workflow QUICK type and INBOX stage, rather than directly inserting into the database. Each ticket includes a descriptive title, grouped issue details in the description, and references the originating scan
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 10) — ticket creation must go through proper API validation and authorization
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. API-based creation ensures all business rules (validation, numbering) are respected
  2. Multiple API calls per scan (one per ticket group) — acceptable given low ticket count per scan
- **Reviewer Notes**: Confirm the ticket creation endpoint supports workflow token auth. Verify ticket description format matches what QUICK workflow expects

### Decision 3: HealthScore global recalculation strategy

- **Decision**: After a scan completes, the workflow updates the individual module score via the existing status PATCH endpoint, which already handles HealthScore upsert and global score recalculation (using `calculateGlobalScore` from `lib/health/score-calculator.ts`). No additional recalculation step is needed in the workflow itself
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 10) — data integrity requires using existing server-side calculation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Single source of truth for score calculation (server-side only)
  2. Workflow does not need to understand scoring algorithm
- **Reviewer Notes**: Verify the PATCH status endpoint correctly recalculates global score on COMPLETED transitions

### Decision 4: Scan command execution model

- **Decision**: The workflow invokes Claude Code (or Codex based on agent input) with ai-board health commands (`health-security`, `health-compliance`, `health-tests`, `health-spec-sync`) that produce structured JSON reports to stdout. The workflow captures this output, parses it, and uses the report data for status updates and ticket creation. These commands are defined in `.claude/commands/` of the ai-board plugin
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 10) — follows existing speckit.yml agent execution pattern
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Consistent with existing workflow patterns, proven execution model
  2. Commands must be created separately (out of scope for this ticket — they are the scan logic itself)
- **Reviewer Notes**: The health scan commands themselves are NOT part of this workflow ticket. This ticket covers the workflow orchestration only. Command implementation is a separate concern

### Decision 5: Error handling and partial failure behavior

- **Decision**: If the scan command fails, the workflow marks the HealthScan as FAILED with the error message. If ticket creation fails for one group, the workflow logs the error but continues creating remaining tickets, then marks the scan as COMPLETED (since the scan itself succeeded). The scan report is always saved regardless of ticket creation outcome
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 10) — conservative approach preserves scan data even on partial failure
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Scan results are never lost due to downstream ticket creation failures
  2. Users may need to manually check if all expected tickets were created
- **Reviewer Notes**: Consider adding a warning in the scan report when ticket creation partially fails

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute a Full Health Scan (Priority: P1)

A project owner clicks "Run Scan" on a module card (e.g., Security) in the Health Dashboard. The system triggers the health-scan workflow, which clones the target repository, runs the appropriate scan command, and reports results back to the dashboard in real time.

**Why this priority**: This is the core value proposition — without scan execution, the Health Dashboard has no data to display. Every other feature depends on scans completing successfully.

**Independent Test**: Can be fully tested by triggering a scan via the API, verifying the workflow executes, and confirming the HealthScan record transitions through PENDING → RUNNING → COMPLETED with a valid score and report.

**Acceptance Scenarios**:

1. **Given** a project with a configured repository, **When** a SECURITY scan is triggered, **Then** the workflow clones the repository, executes the security scan command, and updates the HealthScan to COMPLETED with a score (0-100), issue count, and structured report
2. **Given** a project with a configured repository, **When** a COMPLIANCE scan is triggered, **Then** the workflow executes the compliance scan command and updates the HealthScan with compliance-specific report data
3. **Given** a project with a configured repository, **When** a TESTS scan is triggered, **Then** the workflow executes the tests scan command and updates the HealthScan with auto-fixed and non-fixable test issues
4. **Given** a project with a configured repository, **When** a SPEC_SYNC scan is triggered, **Then** the workflow executes the spec sync command and updates the HealthScan with per-spec sync status

---

### User Story 2 - Real-Time Status Updates (Priority: P1)

While a scan is running, the Health Dashboard shows the current status (PENDING → RUNNING → COMPLETED/FAILED) through polling. The workflow updates the scan status at each transition point so users can track progress.

**Why this priority**: Without real-time status updates, users have no visibility into scan progress and cannot distinguish between a slow scan and a failed one.

**Independent Test**: Can be tested by triggering a scan and polling the health API to verify status transitions occur in the correct order with appropriate timestamps.

**Acceptance Scenarios**:

1. **Given** a scan has been triggered, **When** the workflow starts executing, **Then** the HealthScan status transitions from PENDING to RUNNING with a `startedAt` timestamp
2. **Given** a scan is RUNNING, **When** the scan command completes successfully, **Then** the HealthScan transitions to COMPLETED with score, report, issuesFound, issuesFixed, `completedAt` timestamp, and telemetry data (duration, tokens, cost)
3. **Given** a scan is RUNNING, **When** the scan command fails, **Then** the HealthScan transitions to FAILED with the error message and `completedAt` timestamp

---

### User Story 3 - Automatic Ticket Generation (Priority: P2)

After a scan completes, the workflow automatically creates tickets in INBOX with QUICK workflow type for issues that need human or AI attention. Tickets are grouped according to scan-type-specific rules to avoid ticket sprawl.

**Why this priority**: Ticket generation bridges the gap between identifying problems and fixing them. Without it, users would need to manually create tickets from scan results.

**Independent Test**: Can be tested by running a scan that produces known issues and verifying the correct number of grouped tickets are created in INBOX with the expected titles and descriptions.

**Acceptance Scenarios**:

1. **Given** a completed SECURITY scan with issues at multiple severity levels, **When** ticket generation runs, **Then** one ticket is created per severity level (high, medium, low), each listing all issues of that severity with file paths and line numbers
2. **Given** a completed COMPLIANCE scan with violations of multiple constitution principles, **When** ticket generation runs, **Then** one ticket is created per violated principle, listing all files and lines in infraction
3. **Given** a completed TESTS scan with non-fixable test failures, **When** ticket generation runs, **Then** one ticket is created per non-fixable test (auto-fixed tests do not generate tickets)
4. **Given** a completed SPEC_SYNC scan with drifted specifications, **When** ticket generation runs, **Then** one ticket is created per drifted spec, describing the drift and affected files
5. **Given** a completed scan with zero issues, **When** ticket generation runs, **Then** no tickets are created

---

### User Story 4 - Incremental Scanning (Priority: P2)

When a scan type has been run before on a project, subsequent scans are incremental — they only analyze changes between the last scanned commit and the current HEAD. First-time scans analyze the entire repository.

**Why this priority**: Incremental scanning reduces scan time and cost significantly for projects that are scanned regularly, making the feature practical for frequent use.

**Independent Test**: Can be tested by running two successive scans and verifying the second scan receives the first scan's headCommit as its baseCommit, and only analyzes the diff.

**Acceptance Scenarios**:

1. **Given** a project with no prior scans of a given type, **When** a scan is triggered, **Then** the workflow receives an empty baseCommit and performs a full repository scan
2. **Given** a project with a prior completed scan, **When** a new scan of the same type is triggered, **Then** the workflow receives the previous scan's headCommit as baseCommit and the current HEAD as headCommit
3. **Given** a baseCommit and headCommit, **When** the scan command executes, **Then** only files changed between those two commits are analyzed

---

### User Story 5 - Telemetry Recording (Priority: P3)

The workflow records standard telemetry (tokens used, cost in USD, duration, model) on the HealthScan record, following the same pattern used by existing job workflows.

**Why this priority**: Telemetry enables cost tracking and performance monitoring for health scans, which is important for billing and optimization but not blocking for core functionality.

**Independent Test**: Can be tested by running a scan and verifying the HealthScan record contains non-null telemetry fields (durationMs, tokensUsed, costUsd).

**Acceptance Scenarios**:

1. **Given** a scan completes (COMPLETED or FAILED), **When** the workflow updates the final status, **Then** the HealthScan record includes durationMs (wall clock time), tokensUsed, and costUsd
2. **Given** a scan completes, **When** telemetry is recorded, **Then** the duration reflects actual workflow execution time from RUNNING to completion

---

### Edge Cases

- What happens when the target repository is inaccessible (invalid token, deleted repo)? The scan transitions to FAILED with a clear error message about repository access
- What happens when the scan command produces malformed JSON output? The workflow marks the scan as FAILED with a parsing error message; no tickets are generated
- What happens when the commit referenced by baseCommit no longer exists (force-push, rebase)? The scan falls back to a full scan (treats baseCommit as null) and logs a warning
- What happens when ticket creation hits the project's ticket quota? The workflow logs the quota error, skips remaining ticket creation, and marks the scan as COMPLETED with the report intact
- What happens when multiple scans of the same type are triggered simultaneously? The API already prevents this (409 conflict on duplicate PENDING/RUNNING scans)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a `health-scan.yml` GitHub Actions workflow that accepts inputs: `scan_id`, `project_id`, `scan_type` (SECURITY | COMPLIANCE | TESTS | SPEC_SYNC), `base_commit`, `head_commit`, and `githubRepository` (owner/repo format)
- **FR-002**: System MUST clone the target repository using the `githubRepository` input, following the same checkout pattern used by the speckit workflow (sparse checkout of ai-board plugin, full checkout of target repo)
- **FR-003**: System MUST update the HealthScan status to RUNNING when the workflow begins execution, using the existing PATCH status endpoint with workflow token authentication
- **FR-004**: System MUST execute the appropriate ai-board health command based on `scan_type`: `health-security`, `health-compliance`, `health-tests`, or `health-spec-sync`
- **FR-005**: System MUST pass `base_commit` and `head_commit` to the scan command for incremental analysis; when `base_commit` is empty, the command performs a full repository scan
- **FR-006**: System MUST parse the structured JSON report produced by the scan command and include it in the HealthScan update
- **FR-007**: System MUST update the HealthScan to COMPLETED with score (0-100), issuesFound, issuesFixed, report JSON, and telemetry data (durationMs, tokensUsed, costUsd)
- **FR-008**: System MUST update the HealthScan to FAILED with an error message when the scan command fails or produces invalid output
- **FR-009**: System MUST create tickets in INBOX with QUICK workflow type for each group of issues, following scan-type-specific grouping rules:
  - SECURITY: one ticket per severity level (high, medium, low)
  - COMPLIANCE: one ticket per violated constitution principle
  - TESTS: one ticket per non-fixable test failure (auto-fixed tests are excluded)
  - SPEC_SYNC: one ticket per drifted specification
- **FR-010**: System MUST include relevant details in each generated ticket: issue descriptions, affected file paths and line numbers, severity/category information, and a reference to the originating scan
- **FR-011**: System MUST record the generated ticket keys in the scan report's `generatedTickets` array before saving the final report
- **FR-012**: System MUST NOT create tickets when a scan produces zero issues of the relevant grouping type
- **FR-013**: System MUST record telemetry (durationMs, tokensUsed, costUsd) on the HealthScan record, following the same pattern as existing job workflows
- **FR-014**: System MUST support both Claude and Codex agents via an `agent` workflow input parameter, defaulting to Claude

### Key Entities *(include if feature involves data)*

- **HealthScan**: Existing entity representing a single scan execution. The workflow reads its ID on input and updates its status, score, report, issues, and telemetry fields throughout execution
- **HealthScore**: Existing entity (one per project) storing aggregate module scores. Updated server-side when the PATCH status endpoint receives a COMPLETED transition
- **Ticket**: Existing entity. The workflow creates new tickets via the API for issue groups that require attention
- **GitHub Workflow (health-scan.yml)**: New workflow file orchestrating the scan execution lifecycle: clone → status update → command execution → report parsing → ticket creation → final status update

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 4 scan types (Security, Compliance, Tests, Spec Sync) complete successfully end-to-end from trigger to dashboard update
- **SC-002**: Users see scan status transition from "Pending" to "Running" to "Completed" (or "Failed") in the Health Dashboard within seconds of each transition occurring
- **SC-003**: Generated tickets contain sufficient context (issue description, file paths, line numbers) for the QUICK workflow to fix them without additional human input
- **SC-004**: Incremental scans (with baseCommit) complete faster than full scans on the same repository, as measured by durationMs
- **SC-005**: 100% of scan executions record telemetry data (duration, tokens, cost) regardless of outcome (COMPLETED or FAILED)
- **SC-006**: When a scan fails, the error message displayed in the Health Dashboard is clear enough for a user to understand what went wrong and take corrective action
- **SC-007**: Ticket grouping rules produce the expected number of tickets: at most 3 for Security (one per severity), one per principle for Compliance, one per non-fixable test for Tests, one per drifted spec for Spec Sync
