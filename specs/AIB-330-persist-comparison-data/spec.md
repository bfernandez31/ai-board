# Feature Specification: Persist comparison data to database via workflow

**Feature Branch**: `AIB-330-persist-comparison-data`  
**Created**: 2026-03-21  
**Status**: Draft  
**Input**: User description: "Persist comparison data to database via workflow"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: The ticket payload explicitly requested `AUTO`, but the feature description mainly describes a user-facing persistence bridge with moderate data-integrity concerns and no strong speed or compliance signals, so unresolved product decisions use a CONSERVATIVE fallback.
- **Policy Applied**: AUTO
- **Confidence**: Low (score: +1 from neutral feature context; no strong internal-speed or sensitive-compliance signals)
- **Fallback Triggered?**: Yes — AUTO must default to CONSERVATIVE when confidence is below 0.5.
- **Trade-offs**:
  1. Preserves safer defaults around artifact consistency, validation, and authorization for workflow-driven writes.
  2. Adds expectations for graceful validation and auditability that a more PRAGMATIC reading could have deferred.
- **Reviewer Notes**: Confirm the fallback is appropriate for a feature that introduces automated persistence into durable comparison records.

- **Decision**: The markdown report remains the system's primary comparison artifact, while the JSON file acts as an ephemeral transfer payload used only to persist a database record for the same comparison run.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicit in the request and necessary to preserve backward compatibility)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Protects existing `/compare` consumers by leaving markdown generation unchanged.
  2. Requires the workflow and persistence path to tolerate JSON generation or delivery failures without changing the primary command outcome.
- **Reviewer Notes**: Validate that downstream consumers treat the persisted record as a companion view of the markdown report rather than a replacement artifact.

- **Decision**: Persistence failures after markdown generation will be logged and surfaced for operators, but they will not mark the compare command or workflow run as failed unless the primary markdown artifact itself fails.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (explicitly required and aligned with graceful degradation)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Maintains availability of the primary comparison workflow even when persistence is temporarily unavailable.
  2. Creates a risk of missing database records, so logging and traceability must make recovery needs obvious.
- **Reviewer Notes**: Confirm whether operations teams need a later reconciliation process for missed persistence attempts.

- **Decision**: The workflow-authenticated persistence endpoint will follow the existing workflow token access pattern instead of introducing end-user session access for generated comparison ingestion.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (explicitly requested and aligned with least-privilege automation boundaries)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limits write access to automation contexts that already manage generated artifacts.
  2. Requires clear request validation because the endpoint accepts structured data that can create durable records.
- **Reviewer Notes**: Validate that the endpoint should remain automation-only and not double as a manual comparison-creation API.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save comparison records during a compare run (Priority: P1)

When a project workflow runs `/compare`, the system preserves the current markdown output and also saves the same comparison result as a durable record that the comparison dashboard can read later.

**Why this priority**: The feature exists to close the gap between generated comparison artifacts and the database-backed UI. Without durable persistence, the dashboard still has no usable data.

**Independent Test**: Can be fully tested by running `/compare` for a ticket with participants and confirming the markdown file still exists while a new comparison record becomes available in the database-backed experience.

**Acceptance Scenarios**:

1. **Given** a `/compare` run completes successfully, **When** the command finishes generating its markdown report, **Then** it also produces a structured comparison JSON payload that describes the same comparison outcome.
2. **Given** the workflow detects a generated comparison JSON payload, **When** it submits the payload to the persistence endpoint, **Then** a new comparison record is created for the related ticket context and can be returned with an identifier.
3. **Given** the comparison dashboard requests persisted comparison data after a successful run, **When** the request is authorized, **Then** the dashboard can read the newly saved comparison record without needing to inspect branch files.

---

### User Story 2 - Preserve existing compare behavior when persistence is unavailable (Priority: P2)

When comparison persistence encounters a problem, users still receive the normal markdown report and the overall compare workflow still completes so the primary artifact is not lost.

**Why this priority**: The request explicitly requires backward compatibility and graceful degradation. A persistence enhancement cannot make the compare workflow less reliable than it is today.

**Independent Test**: Can be fully tested by forcing JSON-generation or persistence failures and confirming the markdown artifact is still produced and the workflow still completes.

**Acceptance Scenarios**:

1. **Given** markdown generation succeeds but JSON generation fails, **When** `/compare` completes, **Then** the command still reports success for the markdown artifact and records that structured persistence was skipped or failed.
2. **Given** the workflow cannot find `comparison-data.json`, **When** the compare step completes, **Then** the workflow skips persistence and still completes successfully.
3. **Given** the persistence endpoint rejects or cannot process the JSON payload, **When** the workflow posts the payload, **Then** the workflow records the failure details and still completes successfully because the markdown report remains available.

---

### User Story 3 - Trust persisted comparison records to match the original report (Priority: P3)

When a project member reviews a persisted comparison in the dashboard, they can trust that it reflects the same winner, rankings, rationale, and provenance that were produced in the original markdown report.

**Why this priority**: Durable storage is only useful if it preserves the comparison outcome accurately enough for later review and auditing.

**Independent Test**: Can be fully tested by comparing a generated markdown report with the persisted record created from the same run and verifying the stored winner, participants, rankings, decision points, and recommendation align.

**Acceptance Scenarios**:

1. **Given** a compare run produces both markdown and JSON artifacts, **When** the persistence flow succeeds, **Then** the saved comparison record contains the same participant set, winner, recommendation, and summary reflected in the markdown report.
2. **Given** a compare run includes metrics, decision points, and constitution compliance findings, **When** the JSON payload is persisted, **Then** those structured details are preserved in a form that supports later dashboard rendering.
3. **Given** the persisted comparison references the full markdown report, **When** a user or operator investigates the saved record, **Then** they can identify which markdown file corresponds to that comparison run.

### Edge Cases

- The compare command generates a markdown report but cannot serialize one or more structured fields into JSON; the command still succeeds and logs that structured persistence data was incomplete or unavailable.
- The workflow finds a stale, malformed, or empty `comparison-data.json` file; it does not create a partial durable record and records the failure for later investigation.
- The workflow posts a JSON payload for a ticket or project that no longer matches an accessible ticket context; the endpoint rejects the write without creating an orphaned comparison record.
- The same compare run is retried by automation after a transient failure; persistence handling avoids creating misleading duplicate records for the same generated artifact unless a distinct comparison run was intentionally produced.
- The persisted record is created successfully but downstream enrichment later changes on related tickets; the saved comparison record still preserves the original comparison outcome and markdown provenance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST preserve the current `/compare` markdown report generation behavior without requiring users to change how they invoke or consume the command.
- **FR-002**: After generating the markdown report, the system MUST attempt to generate a structured comparison JSON artifact in the same comparison artifact directory for that run.
- **FR-003**: The structured comparison JSON artifact MUST contain the source ticket, participant tickets, per-ticket code metrics, decision points, constitution compliance results, ranking details, winning ticket, summary, recommendation, differentiators, and markdown filename required to persist the comparison outcome.
- **FR-004**: The structured comparison JSON artifact MUST use the same field structure expected by the existing comparison persistence service so the workflow can submit it without manual transformation outside the defined contract.
- **FR-005**: If structured JSON generation fails after markdown generation succeeds, the compare command MUST still complete successfully for the markdown artifact and MUST record that structured persistence data was not produced.
- **FR-006**: After the compare command finishes, the workflow MUST check whether the structured comparison JSON artifact exists for the current branch comparison output.
- **FR-007**: If the structured comparison JSON artifact exists, the workflow MUST submit its contents to a project- and ticket-scoped persistence endpoint that creates a durable comparison record.
- **FR-008**: If the structured comparison JSON artifact does not exist, the workflow MUST skip the persistence call and continue successfully.
- **FR-009**: If the persistence call fails for validation, authorization, transport, or service reasons, the workflow MUST log the failure context and continue successfully without marking the compare workflow as failed.
- **FR-010**: The persistence endpoint MUST accept only workflow-token-authenticated requests using the same authentication model as other workflow-initiated update endpoints.
- **FR-011**: The persistence endpoint MUST validate that the target project and ticket context is valid for the submitted comparison payload before creating a durable record.
- **FR-012**: The persistence endpoint MUST invoke the existing comparison artifact persistence service to create the durable comparison record instead of duplicating comparison persistence rules.
- **FR-013**: When persistence succeeds, the endpoint MUST return the identifier of the created comparison record so the workflow can log successful ingestion.
- **FR-014**: The persisted comparison record MUST preserve the same winner, participant set, ranking order, rationale, and markdown provenance generated by the compare run so later dashboard views align with the original report.
- **FR-015**: The persistence flow MUST avoid creating orphaned, partial, or misleading comparison records when the submitted JSON payload is malformed, incomplete, or inconsistent with the target ticket context.
- **FR-016**: The persistence flow MUST support graceful operator diagnosis by recording enough success or failure detail in workflow logs to distinguish between missing JSON output, rejected payloads, and service-side persistence failures.

### Key Entities *(include if feature involves data)*

- **Comparison JSON Artifact**: The ephemeral structured output generated alongside the markdown report for one compare run and used as the workflow handoff payload for durable persistence.
- **Comparison Persistence Request**: The workflow-authenticated submission that associates a generated comparison artifact with a specific project and ticket context and requests creation of a durable comparison record.
- **Persisted Comparison Record**: The durable saved representation of a compare run that the dashboard and other read surfaces can query later without reading branch files directly.
- **Comparison Provenance Link**: The reference data that ties a persisted comparison record back to the original markdown artifact for auditing and traceability.

### Assumptions

- The existing comparison persistence service already enforces the detailed storage rules for durable comparison records, and this feature’s main gap is supplying it with the generated artifact data.
- One structured JSON artifact is generated per compare run in the same comparison directory as the markdown output for that run.
- Comparison persistence is initiated only by automation in the workflow path, not by direct end-user creation from the UI.

### Dependencies

- The compare command continues to produce a successful markdown artifact and has access to the structured data needed to emit a matching JSON payload.
- The workflow can determine the relevant project and ticket context needed to call the persistence endpoint after compare completes.
- The existing comparison persistence service remains available to create durable records once provided with a valid structured payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of successful compare runs still produce the markdown report exactly as before after structured persistence support is added.
- **SC-002**: In acceptance testing, 100% of compare runs that successfully generate a valid structured JSON artifact create a durable comparison record that can be retrieved by the comparison dashboard.
- **SC-003**: In failure-path testing, 100% of scenarios where JSON generation fails after markdown creation still end with a successful compare command outcome for the markdown artifact.
- **SC-004**: In failure-path testing, 100% of workflow persistence failures leave the overall compare workflow in a successful state while producing logs that identify the failure cause category.
- **SC-005**: In audit validation, 100% of persisted comparison records created by this flow match the participant set, winner, and recommendation from the markdown report generated in the same compare run.
