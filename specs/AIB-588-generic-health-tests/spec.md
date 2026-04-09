# Feature Specification: Generic Health Tests: Make TESTS Scan Work on Any Project

**Feature Branch**: `AIB-588-generic-health-tests`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Generic health tests: make TESTS scan work on any project"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO policy evaluation fell back to a conservative resolution stance for this ticket because the request mixes internal-tooling speed signals with cross-project reliability requirements.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (score 0) — reliability and portability signals pushed toward CONSERVATIVE while internal-tooling context pushed toward PRAGMATIC, creating conflicting buckets
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5, so ambiguity was resolved conservatively
- **Trade-offs**:
  1. The specification prioritizes predictable scan behavior across repositories over the fastest possible narrow fix
  2. Additional configuration requirements increase setup expectations slightly, but reduce hard failures and hidden repository-specific assumptions
- **Reviewer Notes**: Confirm that portability across external repositories is more important than preserving any ai-board-only shortcuts in the current TESTS scan

---

- **Decision**: When a repository does not expose a usable automated test command, the TESTS scan will complete as skipped with an explicit reason instead of failing as an execution error.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 0 with fallback) — the ticket explicitly calls for graceful fallback, and conservative handling favors transparent non-destructive outcomes
- **Fallback Triggered?**: Yes — inherited from the ticket-level AUTO fallback
- **Trade-offs**:
  1. Skipping avoids false-negative scan failures for repositories that are not test-ready
  2. Teams must review skip reasons to distinguish intentional no-test projects from incomplete configuration
- **Reviewer Notes**: Validate the skip messaging format so operators can immediately tell whether the project lacks tests, lacks configuration, or could not be classified

---

- **Decision**: Shared project configuration will be expanded to describe how a repository runs tests, quality checks, and end-to-end detection, and the TESTS scan will consume that configuration rather than repository-local custom orchestration assets.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 0 with fallback) — the problem statement clearly identifies missing configuration as the portability gap
- **Fallback Triggered?**: Yes — inherited from the ticket-level AUTO fallback
- **Trade-offs**:
  1. Centralizing scan inputs reduces project-specific duplication and enables consistent orchestration across stacks
  2. Detection must be accurate enough for varied ecosystems, which increases the rigor expected from stack classification
- **Reviewer Notes**: Confirm that generated configuration remains understandable and editable by project owners when automatic detection is incomplete

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a TESTS Scan on an External Project Without Custom Orchestration (Priority: P1)

A project owner or operator triggers a TESTS health scan for a repository managed by ai-board, and the scan executes successfully even when that repository does not contain repository-local health-test orchestration. The scan uses shared platform behavior plus the repository's detected configuration to decide how to run tests and report results.

**Why this priority**: This is the primary problem in the ticket. Without it, TESTS scans remain limited to ai-board itself and cannot serve external repositories.

**Independent Test**: Can be fully tested by running a TESTS scan against a repository that has automated tests but no custom repository-local test orchestrator and confirming the scan completes with a score and findings instead of a missing-orchestration failure.

**Acceptance Scenarios**:

1. **Given** a managed repository with automated tests and no repository-local health-test orchestrator, **When** a TESTS health scan is triggered, **Then** the scan runs through the shared platform orchestrator and produces a valid test-scan result
2. **Given** a managed repository that defines how tests should run in shared project configuration, **When** the TESTS scan starts, **Then** the scan uses that configured test command rather than an ai-board-specific default
3. **Given** the first test run reports failures, **When** the TESTS scan continues, **Then** it attempts the existing automated fix-and-retest loop up to the permitted retry limit before producing the final result

---

### User Story 2 - Generate Reusable Test Configuration During Stack Detection (Priority: P2)

When a project is prepared for ai-board workflows, stack detection identifies the repository's testing and quality-check capabilities and records them in shared project configuration. Later health scans can use that configuration consistently without requiring project-specific customizations.

**Why this priority**: The shared orchestrator only becomes portable if repositories advertise the commands and testing characteristics it needs to run safely.

**Independent Test**: Can be tested by running stack detection against repositories from different ecosystems and verifying that the resulting project configuration describes the detected test command, testing framework, end-to-end coverage signal, and any applicable quality-check commands.

**Acceptance Scenarios**:

1. **Given** a repository whose package or build metadata defines an automated test command, **When** stack detection runs, **Then** the generated project configuration records that command for later TESTS scans
2. **Given** a repository where test framework signals can be inferred, **When** stack detection runs, **Then** the generated configuration records the framework classification and whether end-to-end tests are present
3. **Given** a repository that exposes linting or type-checking workflows, **When** stack detection runs, **Then** the generated configuration records those quality-check commands when they are applicable

---

### User Story 3 - Preserve Existing ai-board TESTS Behavior While Expanding Compatibility (Priority: P3)

Platform maintainers need the new generic TESTS scan flow to keep working for ai-board itself while also supporting external repositories. Existing fix-loop behavior, scoring expectations, and test-result reporting remain intact so the enhancement is additive rather than a regression.

**Why this priority**: Cross-project compatibility is only valuable if it does not break the current working path for the platform's own repository.

**Independent Test**: Can be tested by running the TESTS health scan on ai-board before and after the change and confirming the same categories of results, retry behavior, and reporting still occur.

**Acceptance Scenarios**:

1. **Given** the ai-board repository is scanned with the TESTS health scan, **When** the new shared orchestration flow is used, **Then** the scan still completes successfully with the same overall behavior as before
2. **Given** a repository has no usable automated test command, **When** a TESTS health scan runs, **Then** the scan result is marked as skipped with a clear reason instead of failing the workflow
3. **Given** a repository's tests cannot be fully auto-fixed within the retry limit, **When** the scan ends, **Then** the final result preserves the original scoring basis and reports remaining non-fixable issues

### Edge Cases

- What happens when a repository has tests but stack detection cannot confidently identify a test command? The project configuration remains incomplete and the TESTS scan returns a skipped result that explains the missing executable test command
- What happens when a repository has multiple possible test entry points? The detected configuration should choose one defensible default and make that choice reviewable by humans
- What happens when framework detection is incomplete but a test command is available? The scan still runs the tests and reports results using the most compatible parsing available, while surfacing any reduced confidence in the result details
- What happens when the automated fix loop causes additional failures? The scan protects the repository from regression and ends with a result that reflects the unsuccessful remediation attempt
- What happens when a repository has unit tests but no end-to-end tests? The scan records that end-to-end coverage is absent rather than treating it as a workflow failure

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The TESTS health scan MUST execute through a shared platform-provided orchestrator that can be used for any managed repository, not only repositories that contain custom scan orchestration
- **FR-002**: The TESTS health scan MUST determine how to run repository tests from shared project configuration rather than from a hardcoded ai-board-specific default
- **FR-003**: The shared project configuration MUST record the primary automated test command whenever stack detection can determine one
- **FR-004**: The shared project configuration MUST record the detected testing framework classification whenever stack detection can determine one
- **FR-005**: The shared project configuration MUST indicate whether end-to-end test coverage is present when stack detection can infer that signal
- **FR-006**: The shared project configuration MUST record applicable quality-check commands for type checking and linting when those commands can be confidently identified
- **FR-007**: When no usable automated test command is available, the TESTS health scan MUST complete as skipped and MUST report a clear reason for the skip
- **FR-008**: When a usable automated test command is available, the TESTS health scan MUST run that command and produce a valid health-scan result without requiring repository-local orchestration assets
- **FR-009**: The TESTS health scan MUST preserve the existing automated remediation loop behavior: initial test execution, retry-based automated fixes for failures, and re-execution up to the allowed limit
- **FR-010**: The TESTS health scan MUST preserve the existing scoring baseline by deriving the reported score from the first test execution rather than from later retries
- **FR-011**: Health-scan workflow routing MUST invoke the shared TESTS orchestrator from the platform-controlled checkout so external repositories do not need to copy platform-owned orchestration assets into their own repositories
- **FR-012**: The updated TESTS scan flow MUST remain compatible with ai-board's own repository so that current scan behavior does not regress
- **FR-013**: TESTS scan results MUST distinguish among successful execution, skipped execution, and failed execution so operators can act on the correct outcome

### Key Entities

- **Shared Project Configuration**: The per-repository workflow configuration used by ai-board to understand how a managed project installs dependencies, runs tests, performs quality checks, and exposes relevant environment assumptions
- **Test Capability Profile**: The detected description of a repository's automated testing characteristics, including the primary test command, framework classification, and whether end-to-end coverage is present
- **TESTS Health Scan Result**: The recorded outcome of a TESTS scan, including execution status, score, discovered issues, auto-fixed issues, non-fixable issues, and skip reasoning when the scan does not execute tests

### Internal Processes

- **Stack Detection and Configuration Generation**: Triggered when ai-board inspects or initializes a managed repository so workflow configuration can be created or refreshed
  - **Input**: Repository metadata, project files, declared automation entry points or build targets, and recognizable test or quality-tool signals
  - **Phases**: Inspect repository signals; identify likely test, lint, and type-check entry points; classify the test framework and end-to-end coverage signal; write or update shared project configuration
  - **Output**: A reusable project configuration that downstream workflows can consume consistently across repositories
  - **Error behavior**: Missing or ambiguous signals do not block configuration generation; the process records only defensible defaults and leaves absent values empty rather than inventing unsupported commands

- **Shared TESTS Health Scan Orchestration**: Triggered when a TESTS health scan is dispatched for a managed repository
  - **Input**: Shared project configuration, target repository contents, selected agent type, and the existing health-scan context for result reporting
  - **Phases**: Read repository test configuration; decide whether the scan can execute or must skip; run the initial test pass; calculate the scan score from the first run; invoke the automated fix loop when failures exist; re-run tests until success or retry exhaustion; write the final result
  - **Output**: A completed TESTS health-scan result marked as successful, skipped, or failed, with score and remediation details when applicable
  - **Error behavior**: Missing configuration produces a skipped result with reason; invalid execution or unrecoverable orchestration errors produce a failed scan result; remediation attempts must not leave the repository in a worse state than before the scan

- **Health Scan Workflow Routing**: Triggered when the health-scan workflow maps a TESTS scan request to executable platform behavior
  - **Input**: Scan type, project identity, repository checkout locations, and workflow credentials
  - **Phases**: Prepare platform and target repository workspaces; route TESTS scans to the shared orchestrator; collect scan outputs; normalize result fields for downstream persistence and ticket creation
  - **Output**: Unified workflow outputs that allow scan status updates, reporting, and remediation ticket generation to continue unchanged
  - **Error behavior**: Incorrect routing or missing orchestrator assets fail the workflow early so the problem is visible to maintainers rather than silently masking a broken scan path

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of managed repositories that expose a usable automated test command can complete a TESTS health scan without requiring repository-local custom orchestration
- **SC-002**: 100% of managed repositories that do not expose a usable automated test command receive a TESTS scan result marked as skipped with a human-readable reason
- **SC-003**: The generated shared project configuration captures a test command for at least 90% of repositories in the supported ecosystems that already declare an automated test entry point
- **SC-004**: Existing ai-board TESTS scans continue to complete successfully with no regression in result categories, retry behavior, or score derivation after the generic orchestration flow is introduced
- **SC-005**: For repositories with failing tests, the TESTS scan completes its automated remediation loop within the configured retry limit in 100% of runs
- **SC-006**: Operators can distinguish successful, skipped, and failed TESTS scan outcomes from the recorded result without inspecting raw workflow logs

## Assumptions

- Managed repositories continue to provide or generate a shared ai-board project configuration that workflows can read during health scans
- When multiple possible test commands exist, choosing one primary default is acceptable as long as the selection is reviewable and editable
- The existing remediation and result-reporting model for TESTS scans remains the baseline behavior to preserve unless explicitly changed in a later ticket
