# Feature Specification: Health Dashboard - Workflow health-scan.yml

**Feature Branch**: `AIB-377-copy-of-health`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Generic GitHub workflow that executes project health scans triggered by the ai-board API when a user clicks 'Run Scan' on a Health Dashboard card"

## Auto-Resolved Decisions

- **Decision**: Workflow authentication for status callbacks uses existing WORKFLOW_API_TOKEN bearer pattern (same as speckit.yml job callbacks)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — security keyword signals dominate; existing pattern well-established
- **Fallback Triggered?**: No — AUTO resolved directly to CONSERVATIVE with high confidence (netScore +9, 0 conflicting buckets)
- **Trade-offs**:
  1. Reuses proven auth pattern; no new attack surface
  2. No additional setup cost for operators
- **Reviewer Notes**: Verify WORKFLOW_API_TOKEN secret is available in the health-scan.yml workflow context

---

- **Decision**: Full git history clone (fetch-depth: 0) for incremental scan support between baseCommit and headCommit
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — incremental scanning requires commit range diffing; shallow clone would break this
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Full clone is slower and uses more disk, but required for correct incremental scans
  2. Consistent with speckit.yml clone pattern (fetch-depth: 0)
- **Reviewer Notes**: For very large repositories, clone time may be significant; acceptable trade-off for scan correctness

---

- **Decision**: Ticket creation uses QUICK workflow type for all auto-generated health tickets (no spec/plan phase needed for remediation)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — remediation tickets are well-scoped by the scan report; full workflow would add unnecessary overhead
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Faster remediation cycle; issues go directly to BUILD
  2. Complex issues may need manual spec refinement after ticket creation
- **Reviewer Notes**: Verify that QUICK workflow tickets in INBOX stage can be manually promoted to FULL workflow if needed

---

- **Decision**: On scan failure, all partial results are discarded (no partial score updates to HealthScore)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — partial data could mislead users about project health; integrity over availability
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users see no stale/partial data after failures; clean state maintained
  2. A failed scan provides no score improvement even if partial analysis succeeded
- **Reviewer Notes**: The errorMessage field captures failure details so users can understand what went wrong

---

- **Decision**: Scan commands are mapped 1:1 to scanType values — no dynamic command construction
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — security concern: dynamic command construction from workflow inputs risks injection
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Explicit mapping prevents any command injection via scanType input
  2. Adding a new scan type requires updating the workflow mapping
- **Reviewer Notes**: Command mapping must use a static lookup (e.g., case/switch), never string interpolation from inputs

## User Scenarios & Testing

### User Story 1 - Execute a Health Scan via Workflow (Priority: P1)

A project owner clicks "Run Scan" on a Health Dashboard card (e.g., Security). The ai-board API creates a HealthScan record in PENDING status and dispatches the health-scan.yml workflow. The workflow clones the target repository, updates the scan to RUNNING, executes the appropriate scan command, and reports results back to the API with a score, issues found, and a structured report. The HealthScore for the project is recalculated.

**Why this priority**: This is the core functionality — without the workflow executing scans and reporting results, the entire Health Dashboard is non-functional.

**Independent Test**: Can be fully tested by dispatching the workflow with valid inputs for any scan type and verifying the HealthScan transitions through PENDING → RUNNING → COMPLETED with a valid score and report.

**Acceptance Scenarios**:

1. **Given** a HealthScan record exists in PENDING status with scanType SECURITY, **When** the health-scan.yml workflow runs, **Then** the scan transitions to RUNNING, executes the security scan command, and updates to COMPLETED with a score (0-100), an issues count, and a structured JSON report.
2. **Given** a HealthScan record exists in PENDING status with scanType COMPLIANCE, **When** the workflow runs, **Then** the scan executes the compliance scan command and completes with results.
3. **Given** a HealthScan record exists in PENDING status with scanType TESTS, **When** the workflow runs, **Then** the scan executes the tests scan command and completes with results.
4. **Given** a HealthScan record exists in PENDING status with scanType SPEC_SYNC, **When** the workflow runs, **Then** the scan executes the spec sync scan command and completes with results.

---

### User Story 2 - Automatic Ticket Creation from Scan Results (Priority: P1)

After a scan completes, the workflow parses the structured report and creates remediation tickets in ai-board. Each ticket is created in INBOX stage with QUICK workflow type, with appropriate grouping based on the scan type: by severity for security, by violated principle for compliance, per unfixable test for tests, and per desynchronized spec for spec sync.

**Why this priority**: Ticket creation is the actionable output of health scans — without it, scan results have no remediation path.

**Independent Test**: Can be tested by providing a scan report with known issues and verifying the correct number of tickets are created with proper titles, descriptions, and grouping.

**Acceptance Scenarios**:

1. **Given** a security scan finds 3 high-severity and 2 medium-severity issues, **When** the scan completes, **Then** 2 tickets are created: one grouping the 3 high-severity issues (with affected files and lines) and one grouping the 2 medium-severity issues.
2. **Given** a compliance scan identifies violations of 2 distinct constitution principles, **When** the scan completes, **Then** 2 tickets are created, each listing the files and lines violating that principle.
3. **Given** a tests scan finds 1 unfixable test (after auto-fix attempts), **When** the scan completes, **Then** 1 ticket is created describing the failing test and why auto-fix was not possible.
4. **Given** a spec sync scan detects 3 desynchronized specs, **When** the scan completes, **Then** 3 tickets are created, each describing the drift found and the affected files.
5. **Given** a scan completes with zero issues, **When** the report is parsed, **Then** no tickets are created.

---

### User Story 3 - Incremental Scanning (Priority: P2)

When a scan type has been run before on a project, subsequent scans only analyze changes between the previous scan's head commit and the current HEAD. This reduces scan time and focuses results on new/changed code.

**Why this priority**: Incremental scanning is an optimization that improves scan speed and relevance, but full scans still provide complete coverage.

**Independent Test**: Can be tested by running a scan, making changes, then running a second scan and verifying only changes between the two commits are analyzed.

**Acceptance Scenarios**:

1. **Given** no previous scan of type SECURITY exists for a project, **When** the workflow runs with baseCommit null, **Then** a full scan of the entire repository is performed.
2. **Given** a previous SECURITY scan completed with headCommit "abc123...", **When** a new security scan is triggered, **Then** the workflow receives baseCommit="abc123..." and headCommit=current HEAD, and only analyzes changes in that range.

---

### User Story 4 - Health Score Recalculation (Priority: P2)

After each successful scan, the project's global health score is recalculated from the latest scores of all scan types that have been run. The global score uses proportional weighting across available module scores.

**Why this priority**: Score recalculation ensures the dashboard always reflects the latest health state, but depends on scans completing first.

**Independent Test**: Can be tested by completing a scan and verifying the HealthScore record is upserted with the correct module sub-score and recalculated global score.

**Acceptance Scenarios**:

1. **Given** a project has no previous scans, **When** a security scan completes with score 85, **Then** the HealthScore is created with securityScore=85 and globalScore=85.
2. **Given** a project has securityScore=80 and complianceScore=90, **When** a new security scan completes with score 70, **Then** securityScore is updated to 70 and globalScore is recalculated as the average of available scores.

---

### User Story 5 - Scan Failure Handling (Priority: P2)

When a scan encounters an error (command failure, timeout, unexpected output), the workflow captures the error and updates the HealthScan to FAILED status with a descriptive error message. No score or ticket changes are made.

**Why this priority**: Graceful failure handling prevents the system from entering an inconsistent state, but is not part of the happy path.

**Independent Test**: Can be tested by triggering a scan that is expected to fail (e.g., invalid repository) and verifying the scan transitions to FAILED with an error message.

**Acceptance Scenarios**:

1. **Given** a scan is in RUNNING status, **When** the scan command fails with an error, **Then** the HealthScan is updated to FAILED with the error message, and no HealthScore changes occur.
2. **Given** a scan is in RUNNING status, **When** the workflow encounters a dispatch or network error, **Then** the HealthScan is updated to FAILED with a descriptive error message.

---

### User Story 6 - Telemetry Recording (Priority: P3)

The workflow records telemetry data (tokens used, cost, duration, model) on the HealthScan record, following the same pattern as existing job telemetry. This enables cost tracking and performance monitoring for health scans.

**Why this priority**: Telemetry is valuable for operational monitoring but does not affect core scan functionality.

**Independent Test**: Can be tested by running a scan and verifying that durationMs, tokensUsed, and costUsd fields are populated on the completed HealthScan record.

**Acceptance Scenarios**:

1. **Given** a scan completes successfully, **When** the workflow reports results, **Then** durationMs, tokensUsed, and costUsd are recorded on the HealthScan.
2. **Given** a scan fails, **When** the workflow reports failure, **Then** durationMs is still recorded (reflecting time spent before failure).

---

### Edge Cases

- What happens when the target repository is inaccessible or the clone fails? → Scan is marked FAILED with clone error message.
- What happens when the scan command produces invalid/unparseable JSON output? → Scan is marked FAILED with parse error details.
- What happens when the status callback API is unreachable during workflow execution? → Workflow step fails; GitHub Actions shows the failure. Scan remains in its last known status (PENDING or RUNNING).
- What happens when a scan completes but ticket creation partially fails? → Completed issues are created; scan still marked COMPLETED since the report was valid. Partial ticket creation failures are logged but do not roll back the scan status.
- What happens when two workflows for the same scan ID run concurrently? → The API enforces state transitions; the second workflow's status updates will be rejected if the scan has already transitioned to a terminal state.
- What happens when baseCommit SHA no longer exists in the repository (force push/rebase)? → The scan command falls back to a full scan and logs a warning in the report.

## Requirements

### Functional Requirements

- **FR-001**: The workflow MUST accept six inputs: projectId, scanType (SECURITY|COMPLIANCE|SPEC_SYNC|TESTS), githubRepository (owner/repo format), baseCommit (nullable SHA), headCommit (SHA), and healthScanId.
- **FR-002**: The workflow MUST clone the target repository using the same pattern as speckit.yml (actions/checkout with full history).
- **FR-003**: The workflow MUST update the HealthScan status to RUNNING immediately after repository clone, via the existing status callback API.
- **FR-004**: The workflow MUST map scanType to the corresponding scan command using a static lookup: SECURITY→health-security, COMPLIANCE→health-compliance, TESTS→health-tests, SPEC_SYNC→health-spec-sync.
- **FR-005**: The workflow MUST pass baseCommit and headCommit to the scan command to support incremental scanning.
- **FR-006**: The workflow MUST parse the scan command's JSON report output and include it in the COMPLETED status update along with score, issuesFound, and issuesFixed.
- **FR-007**: The workflow MUST create remediation tickets for issues found, grouped according to scan type rules: by severity level for SECURITY, by violated principle for COMPLIANCE, per unfixable test for TESTS, per desynchronized spec for SPEC_SYNC.
- **FR-008**: All auto-created tickets MUST be placed in INBOX stage with QUICK workflow type.
- **FR-009**: The workflow MUST recalculate the project's HealthScore after a successful scan by updating the corresponding module sub-score and recomputing the global score.
- **FR-010**: On any error, the workflow MUST update the HealthScan status to FAILED with a descriptive error message (max 2000 characters).
- **FR-011**: The workflow MUST record telemetry (durationMs, tokensUsed, costUsd) on every scan completion or failure.
- **FR-012**: The workflow MUST authenticate status callback requests using the WORKFLOW_API_TOKEN bearer token.
- **FR-013**: The workflow MUST NOT construct scan commands dynamically from inputs; a static command mapping MUST be used.

### Key Entities

- **HealthScan**: Represents a single scan execution. Tracks type, status lifecycle (PENDING→RUNNING→COMPLETED/FAILED), score, report, commit range, telemetry, and error information. Linked to a Project.
- **HealthScore**: Cached aggregate health scores for a project. Contains per-module sub-scores and a global score recalculated after each completed scan. One-to-one with Project.
- **Remediation Ticket**: Auto-generated ticket created from scan findings. Placed in INBOX with QUICK workflow. Grouped by scan-type-specific rules (severity, principle, test, spec).

## Success Criteria

### Measurable Outcomes

- **SC-001**: All four scan types (Security, Compliance, Tests, Spec Sync) complete successfully when triggered from the Health Dashboard.
- **SC-002**: Scan status transitions are visible in the Health Dashboard within 5 seconds of each state change (PENDING → RUNNING → COMPLETED/FAILED).
- **SC-003**: Remediation tickets appear in the project's INBOX within 30 seconds of scan completion, with accurate issue grouping and descriptions.
- **SC-004**: The project's global health score reflects the latest scan results immediately after completion.
- **SC-005**: Incremental scans (with baseCommit) complete faster than full scans on the same repository.
- **SC-006**: Failed scans display a clear, actionable error message to the user.
- **SC-007**: Telemetry data (duration, tokens, cost) is recorded for 100% of scan executions, including failures.
- **SC-008**: No scan leaves the system in an inconsistent state — every scan reaches a terminal status (COMPLETED or FAILED).
