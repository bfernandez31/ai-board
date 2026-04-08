# Feature Specification: Project Onboarding — Setup Page, API, and Job Tracking

**Feature Branch**: `AIB-574-project-onboarding-setup`
**Created**: 2026-04-08
**Status**: Draft
**Input**: AIB-574 — Project onboarding: setup page, API, and job tracking

## Auto-Resolved Decisions

1. **Decision**: Setup page access restricted to project owners only (not members) for dispatch; members can view status
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (0.9) — ticket explicitly states owner-only for dispatch; viewing status extended to members for transparency
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Members cannot initiate setup, reducing flexibility for teams
     2. Prevents accidental or unauthorized configuration changes on shared projects
   - **Reviewer Notes**: Confirm that member read-access to setup status is sufficient for team workflows

2. **Decision**: Credential verification happens at dispatch time (not pre-validated on page load)
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (0.9) — ticket specifies live credential check per agent selection, blocking dispatch if missing
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Users see credential status inline before clicking "Initialize" — no wasted workflow runs
     2. Credentials could be revoked between page load and dispatch; dispatch-time check is the authoritative guard
   - **Reviewer Notes**: Inline credential indicator is a UX convenience; the dispatch endpoint must independently verify credentials

3. **Decision**: Workflow stub returns COMPLETED with empty artifact summary (no real file generation)
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (0.9) — ticket explicitly scopes this as app-layer only; real workflow logic deferred to follow-up ticket
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Full end-to-end app flow can be validated without workflow complexity
     2. Artifact summary will be empty until real workflow is implemented
   - **Reviewer Notes**: Ensure the completed-state UI gracefully handles an empty artifact list

4. **Decision**: Config sync triggered automatically on workflow COMPLETED callback (not user-initiated)
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (0.9) — ticket states config sync fires on COMPLETED callback using owner's GitHub token
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Seamless transition from setup to board without extra user action
     2. If config sync fails after workflow completes, user may need manual intervention
   - **Reviewer Notes**: Verify error handling when config sync fails post-completion (edge case for real workflow)

5. **Decision**: Duplicate dispatch prevention uses PENDING/RUNNING status guard (409 rejection)
   - **Policy Applied**: CONSERVATIVE
   - **Confidence**: High (0.9) — ticket explicitly requires 409 for concurrent runs
   - **Fallback Triggered?**: No
   - **Trade-offs**:
     1. Prevents resource waste from parallel workflow runs
     2. Users must wait for current run to complete or fail before retrying
   - **Reviewer Notes**: Ensure stale PENDING/RUNNING jobs (e.g., from crashed workflows) have a timeout/cleanup mechanism

## User Scenarios & Testing

### User Story 1 - First-Time Project Setup (Priority: P1)

A project owner imports an external GitHub repository that lacks AI Board configuration files. After import, they are directed to a setup page where they select their preferred agent CLI, verify their credentials are configured, and launch the onboarding process. They see real-time progress and are redirected to the project board upon completion.

**Why this priority**: This is the core happy path that eliminates the 404 dead-end. Without it, imported projects without config files are unusable.

**Independent Test**: Can be fully tested by importing a repo without `.ai-board/config.yml`, completing the setup flow, and verifying the redirect to the project board.

**Acceptance Scenarios**:

1. **Given** a project owner has just imported a repository without `.ai-board/config.yml`, **When** they follow the post-import redirect, **Then** they land on the setup page showing agent selection options
2. **Given** the owner is on the setup page with a valid credential for their selected agent, **When** they click "Initialize Project", **Then** a setup job is created and the onboarding workflow is dispatched
3. **Given** a setup job is running, **When** the owner views the setup page, **Then** they see a progress indicator with elapsed time that updates automatically
4. **Given** the workflow completes successfully, **When** the setup page polls for status, **Then** the page displays a success message and a link to the project board
5. **Given** the workflow completes successfully, **When** config sync runs, **Then** the project's configuration is populated and future visits bypass setup

---

### User Story 2 - Credential Validation Before Setup (Priority: P1)

A project owner selects an agent CLI on the setup page but does not have the required credential configured. The system blocks initialization and provides guidance on how to add the missing credential.

**Why this priority**: Prevents failed workflow runs due to missing credentials, which would waste time and create a confusing experience.

**Independent Test**: Can be tested by selecting an agent for which no credential is configured and verifying the dispatch button is disabled with guidance shown.

**Acceptance Scenarios**:

1. **Given** the owner selects "Claude Code" but has no Anthropic credential configured, **When** the page checks credential status, **Then** the "Initialize Project" button is disabled and a message explains how to add the credential
2. **Given** the owner selects "Codex" but has no OpenAI credential configured, **When** the page checks credential status, **Then** the button is disabled with appropriate guidance
3. **Given** the owner switches agent selection to one with a valid credential, **When** the credential check updates, **Then** the "Initialize Project" button becomes enabled

---

### User Story 3 - Setup Failure and Retry (Priority: P2)

A setup workflow fails during execution. The owner sees an error message with details and can retry with a fresh workflow run.

**Why this priority**: Failure recovery is essential for a robust experience but is secondary to the happy path.

**Independent Test**: Can be tested by simulating a workflow failure callback and verifying the error display and retry functionality.

**Acceptance Scenarios**:

1. **Given** a running setup job receives a FAILED callback, **When** the setup page polls for status, **Then** an error message is displayed with details from the workflow logs
2. **Given** a failed setup job is shown, **When** the owner clicks "Retry", **Then** a new setup job is created and a fresh workflow is dispatched
3. **Given** a previous job failed, **When** the owner retries, **Then** the new job runs independently (the failed job is not modified)

---

### User Story 4 - Already-Configured Project Bypass (Priority: P2)

A project that already has its configuration synced should never show the setup page. Users who navigate to the setup URL are redirected to the project board.

**Why this priority**: Prevents confusion for projects that are already configured.

**Independent Test**: Can be tested by navigating to `/projects/{id}/setup` for a project with configuration already synced and verifying redirect to the board.

**Acceptance Scenarios**:

1. **Given** a project with configuration already synced, **When** any user navigates to the setup page, **Then** they are redirected to the project board
2. **Given** a project with configuration already synced, **When** a dispatch request is sent to the setup API, **Then** the request is rejected with a conflict status

---

### User Story 5 - Concurrent Dispatch Prevention (Priority: P2)

When a setup job is already in progress (PENDING or RUNNING), additional dispatch attempts are blocked to prevent duplicate workflow runs.

**Why this priority**: Prevents resource waste and potential race conditions from parallel onboarding runs.

**Independent Test**: Can be tested by dispatching a setup job and immediately attempting a second dispatch, verifying the rejection.

**Acceptance Scenarios**:

1. **Given** a setup job with PENDING status exists, **When** the owner attempts to dispatch another, **Then** the request is rejected with a conflict status
2. **Given** a setup job with RUNNING status exists, **When** the owner attempts to dispatch another, **Then** the request is rejected with a conflict status
3. **Given** a previous job COMPLETED or FAILED, **When** the owner dispatches a new job, **Then** the dispatch succeeds

---

### User Story 6 - Page Refresh During Setup (Priority: P3)

An owner refreshes the setup page while a job is running. The page correctly resumes showing the current job state.

**Why this priority**: UX polish — ensures state persistence across page loads.

**Independent Test**: Can be tested by starting a setup job, refreshing the browser, and verifying the running state is displayed.

**Acceptance Scenarios**:

1. **Given** a setup job is RUNNING, **When** the owner refreshes the page, **Then** the running state with elapsed time is displayed immediately
2. **Given** a setup job COMPLETED while the page was closed, **When** the owner returns to the setup page, **Then** they see the success state with a link to the board

---

### Edge Cases

- What happens when the workflow callback arrives but the setup page is not open? The job status is updated in the database; the next time the page is loaded, the correct state is shown.
- What happens if the owner's credential is revoked between page load and dispatch? The dispatch endpoint independently verifies the credential and returns an error with guidance.
- What happens if config sync fails after the workflow reports COMPLETED? The job shows as completed but the project remains on the setup page (configuration not marked as synced). The owner should see guidance or the ability to retry sync.
- What happens when a non-owner member navigates to the setup page? They receive an access-denied response.
- What happens if a PENDING/RUNNING job becomes stale (workflow never calls back)? A timeout mechanism should eventually mark it as FAILED so the owner can retry.

## Requirements

### Functional Requirements

- **FR-001**: System MUST redirect users to the setup page when they import a project that lacks configuration files
- **FR-002**: Setup page MUST present agent CLI selection with exactly two options (Claude Code and Codex)
- **FR-003**: System MUST verify that the owner has a valid credential for the selected agent's provider before allowing dispatch
- **FR-004**: System MUST display credential status inline when the owner changes agent selection, with guidance when missing
- **FR-005**: System MUST create a setup job record and dispatch the onboarding workflow when the owner clicks "Initialize Project"
- **FR-006**: System MUST reject dispatch attempts when a setup job is already PENDING or RUNNING (conflict response)
- **FR-007**: System MUST reject dispatch attempts when the project is already configured (conflict response)
- **FR-008**: Setup page MUST poll for job status updates at a regular interval matching existing polling patterns
- **FR-009**: Setup page MUST display elapsed time during a running job
- **FR-010**: System MUST update the setup job status when the workflow calls back with state transitions (PENDING to RUNNING to COMPLETED or FAILED)
- **FR-011**: System MUST trigger configuration sync automatically when a setup job completes successfully
- **FR-012**: Setup page MUST redirect to the project board after successful completion and config sync
- **FR-013**: Setup page MUST display error details and a "Retry" button when a job fails
- **FR-014**: Retry MUST create a fresh setup job and workflow run (not reuse the failed job)
- **FR-015**: System MUST restrict setup dispatch to project owners only; members may view setup status
- **FR-016**: System MUST redirect already-configured projects away from the setup page to the project board
- **FR-017**: Setup page MUST correctly restore state on page refresh by reading the latest job status
- **FR-018**: Workflow callback endpoint MUST authenticate via a shared workflow token (not user session)
- **FR-019**: System MUST persist error details in the job's logs field when a workflow reports failure

### Key Entities

- **ProjectSetupJob**: Represents a single onboarding attempt for a project. Tracks the agent selected, current status (PENDING, RUNNING, COMPLETED, FAILED), workflow run identifier, timing information, error logs, and an artifact summary listing files created by the workflow. Each project can have multiple setup jobs (retry history), with the most recent determining the project's setup state.
- **Project (extended)**: The existing project entity gains a derived setup status based on its latest ProjectSetupJob. Projects with a configuration sync timestamp are considered fully configured and bypass the setup flow entirely.

### Internal Processes

- **Onboard Workflow Dispatch**: Triggered when a project owner clicks "Initialize Project" on the setup page after selecting an agent and passing credential verification.
  - **Input**: Project identifier, setup job identifier, target GitHub repository (owner/repo format), selected agent CLI
  - **Phases**:
    1. Job record created with PENDING status
    2. Workflow dispatched to the CI/CD system
    3. Workflow calls back RUNNING when it begins execution
    4. Workflow performs onboarding tasks (stub: brief delay, no real work)
    5. Workflow calls back COMPLETED with artifact summary (stub: empty list)
  - **Output**: Updated job status, artifact summary (populated by real workflow in follow-up), config sync triggered on completion
  - **Error behavior**: On workflow failure, status set to FAILED with error details persisted in logs. Job is not retried automatically; owner must explicitly retry via the setup page, which creates a new job.

- **Workflow Status Callback**: Triggered by the onboarding workflow at each phase transition via authenticated API call.
  - **Input**: Job identifier, new status, optional logs/error details, optional artifact summary
  - **Phases**:
    1. Authenticate the request via workflow token
    2. Validate the status transition (PENDING to RUNNING to COMPLETED/FAILED)
    3. Update the job record with new status and metadata
    4. On COMPLETED: trigger config sync using the project owner's GitHub token
    5. On FAILED: persist error details for display on the setup page
  - **Output**: Updated job record; on completion, the project's configuration is synced from the repository
  - **Error behavior**: Invalid status transitions are rejected. Config sync failure after COMPLETED does not revert the job status — the job remains COMPLETED but the project stays in setup state (configuration not marked as synced).

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of imported projects without configuration files land on a functional setup page (zero 404 errors on the setup route)
- **SC-002**: Users can complete the setup flow (agent selection through board redirect) in under 60 seconds when the workflow succeeds
- **SC-003**: Setup page reflects current job state within 5 seconds of any status change (including page refresh)
- **SC-004**: Zero duplicate workflow runs — concurrent dispatch attempts are consistently blocked
- **SC-005**: Failed setup attempts display actionable error information and allow retry within a single interaction (no page navigation required)
- **SC-006**: Already-configured projects redirect away from the setup page in under 1 second with no user intervention

## Assumptions

- The onboarding workflow stub will be replaced by a full implementation in a follow-up ticket; this spec covers only the app-layer infrastructure
- The existing config sync mechanism is reliable and does not require modification for this feature
- Credential verification uses the existing credential storage and lookup infrastructure without changes
- The workflow callback authentication uses the same shared token pattern as other workflow callbacks in the system
- Stale job cleanup (for workflows that never call back) will follow the same timeout pattern used by health scans
