# Feature Specification: Persist Comparison Data to Database via Workflow

**Feature Branch**: `AIB-328-persist-comparison-data`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "Persist comparison data to database via workflow"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether the JSON file format should be a strict contract or loosely coupled to the database persistence function
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 7) — reliability and backward-compatibility signals dominate
- **Fallback Triggered?**: No — HIGH confidence, zero conflicting signal buckets
- **Trade-offs**:
  1. Strict contract means any future changes to the persistence function signature require updating the JSON schema, but prevents silent data loss
  2. Slightly more upfront validation work, but guarantees data integrity across the command → workflow → API boundary
- **Reviewer Notes**: Verify that the JSON schema exactly mirrors what `persistGeneratedComparisonArtifacts()` expects; any drift will cause silent failures

---

- **Decision**: Whether the workflow should retry the POST call on transient failure
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 7)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. No retry keeps the workflow simpler and faster; comparison markdown (primary artifact) is always available
  2. A single failed POST means the comparison won't appear in the dashboard until the next comparison run — acceptable given markdown is the primary artifact
- **Reviewer Notes**: If persistence reliability becomes critical in the future, consider adding a single retry with short timeout

---

- **Decision**: Whether the new POST endpoint requires project-level access verification in addition to workflow token auth
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 7)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Workflow token auth alone is sufficient since only automated workflows call this endpoint, and they already have the token
  2. Adding project access verification would be redundant (workflows are trusted) and would complicate the call from the workflow
- **Reviewer Notes**: Confirm that workflow token authentication is the standard pattern for all workflow-to-API communication; no session-based auth needed

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comparison Data Automatically Appears in Dashboard (Priority: P1)

A team member runs the `/compare` command on a ticket to compare implementations. After the command completes, the comparison results automatically appear in the comparison dashboard without any manual data entry or additional steps.

**Why this priority**: This is the core value of the feature — bridging the gap between markdown report generation and the database-backed dashboard. Without this, the dashboard remains empty.

**Independent Test**: Can be fully tested by running a `/compare` command on a ticket with multiple implementations and verifying that the comparison record, participants, metrics, decision points, and compliance data appear in the database and are retrievable via existing GET endpoints.

**Acceptance Scenarios**:

1. **Given** a ticket with at least two comparable implementations, **When** the `/compare` command runs successfully, **Then** a structured JSON file is written alongside the markdown report in the comparisons directory
2. **Given** a JSON comparison data file exists after the command completes, **When** the workflow processes the result, **Then** the data is sent to the persistence endpoint and a comparison record is created in the database
3. **Given** a comparison record is persisted, **When** a user visits the comparison dashboard, **Then** the comparison appears with all participants, metrics, rankings, decision points, and compliance assessments

---

### User Story 2 - Markdown Report Generation Remains Unaffected (Priority: P1)

The existing `/compare` command continues to produce its markdown report exactly as before. The JSON file generation is an additive, non-breaking enhancement.

**Why this priority**: Backward compatibility is a hard constraint — the markdown report is the primary artifact and must never be disrupted.

**Independent Test**: Run the `/compare` command and verify the markdown report is identical in structure and content to reports generated before this feature was added.

**Acceptance Scenarios**:

1. **Given** the `/compare` command is invoked, **When** it completes, **Then** the markdown report is generated with the same content and format as before this feature
2. **Given** the JSON file generation fails for any reason, **When** the command continues, **Then** the markdown report is still produced and the command exits successfully

---

### User Story 3 - Graceful Degradation on Persistence Failure (Priority: P2)

If the database persistence step fails (JSON write failure, network error, API error), the overall workflow still succeeds. The markdown report remains the authoritative artifact.

**Why this priority**: Resilience ensures that the new database persistence layer never blocks the existing comparison workflow.

**Independent Test**: Simulate a persistence failure (e.g., invalid endpoint, timeout) and verify the workflow completes successfully with the markdown report intact.

**Acceptance Scenarios**:

1. **Given** the `/compare` command completes but JSON file writing fails, **When** the workflow continues, **Then** it proceeds without attempting the POST call and logs the failure
2. **Given** a valid JSON file exists but the POST endpoint returns an error, **When** the workflow processes the result, **Then** it logs the error and marks the workflow as successful
3. **Given** the POST endpoint is unreachable, **When** the workflow attempts the call, **Then** it times out gracefully and the workflow completes

---

### Edge Cases

- What happens when the comparison involves only one ticket (no participants)? The JSON should still be written with an empty participants array, and persistence should handle this gracefully.
- What happens when the JSON file is malformed or incomplete? The POST endpoint should validate the payload and return a clear error; the workflow logs the error and continues.
- What happens when a comparison for the same tickets already exists in the database? The system should create a new comparison record (comparisons are point-in-time snapshots, not deduplicated).
- What happens when the comparison data references ticket IDs that no longer exist? The persistence layer should validate referenced entities exist and return an appropriate error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `/compare` command MUST write a structured JSON data file in the same directory as the markdown report after report generation completes
- **FR-002**: The JSON data file MUST contain all information needed to populate a comparison record: source ticket metadata, participant ticket metadata, code metrics per ticket, decision points, constitution compliance per ticket per principle, rankings with scores and rationales, winner ticket, summary, recommendation, key differentiators, and the markdown filename
- **FR-003**: The JSON data file structure MUST match the input expected by the existing comparison persistence function
- **FR-004**: If JSON file writing fails, the `/compare` command MUST still complete successfully with the markdown report as the primary output
- **FR-005**: The workflow MUST check for the existence of the JSON data file after the `/compare` command completes
- **FR-006**: If the JSON data file exists, the workflow MUST send its contents to the comparison persistence endpoint
- **FR-007**: If the JSON data file does not exist or the persistence call fails, the workflow MUST still complete successfully
- **FR-008**: A new endpoint MUST accept comparison data, validate the payload, and persist it to the database using the existing persistence function
- **FR-009**: The new endpoint MUST be authenticated via workflow token (same mechanism used for job status updates)
- **FR-010**: The new endpoint MUST return the created comparison record identifier on success
- **FR-011**: The new endpoint MUST return appropriate error responses for invalid payloads, missing referenced entities, and server errors
- **FR-012**: The workflow MUST log the outcome of the persistence attempt (success or failure with reason) for observability

### Key Entities

- **Comparison Data File**: A structured JSON file containing all comparison results, written alongside the markdown report. Ephemeral — needed only for the workflow persistence step, not long-term storage.
- **Comparison Record**: The database representation of a comparison, including source ticket, participants, metrics snapshots, decision points, compliance assessments, rankings, and summary. Created by the persistence endpoint from the JSON data.
- **Workflow Persistence Step**: A new step in the assist workflow that reads the JSON file and forwards it to the API. Isolated from the comparison command — failures here do not affect command success.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a successful `/compare` run, the comparison data appears in the database and is retrievable via existing dashboard endpoints within the same workflow execution
- **SC-002**: The markdown report output of `/compare` is byte-identical to pre-feature behavior (no regressions)
- **SC-003**: When JSON file generation fails, the `/compare` command still exits with a success status and produces the markdown report
- **SC-004**: When the persistence POST call fails, the workflow still completes with a success status
- **SC-005**: The persistence endpoint processes valid comparison data and creates a complete database record (all related entities: participants, metrics, decision points, compliance assessments) in a single operation
- **SC-006**: 100% of comparison data fields from the JSON file are preserved in the database record without data loss or truncation
