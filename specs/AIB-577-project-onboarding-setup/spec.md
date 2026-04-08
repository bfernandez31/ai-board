# Feature Specification: Project Onboarding Setup Page, API, and Job Tracking

**Feature Branch**: `AIB-577-project-onboarding-setup`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Project onboarding: setup page, API, and job tracking (plan updated)"

## Auto-Resolved Decisions

### Decision 1: Scope Limited to App Layer Only

- **Decision**: The onboarding workflow dispatched by this feature is a stub that simply callbacks COMPLETED. Real workflow logic (stack detection, LLM generation, file commits) is deferred to a follow-up ticket. This feature validates the full dispatch-callback-sync pipeline without workflow complexity.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — credential handling and auth patterns push toward conservative
- **Fallback Triggered?**: No — CONSERVATIVE was the natural recommendation
- **Trade-offs**:
  1. Users get a functional setup flow immediately but must wait for the real workflow to generate meaningful config files
  2. Two-ticket approach adds coordination overhead but enables independent testing of app and workflow layers
- **Reviewer Notes**: Verify that the stub workflow's callback sequence (PENDING → RUNNING → COMPLETED) matches the real workflow's expected behavior so no app-layer changes are needed later

### Decision 2: Setup Status Derived from Latest Job (Not Stored on Project)

- **Decision**: `setupStatus` is derived by querying the latest ProjectSetupJob rather than persisting a redundant status field on the Project model. Projects with `configSyncedAt` set bypass setup entirely.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — data integrity concern favors single source of truth
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Avoids dual-write inconsistency between Project.setupStatus and ProjectSetupJob.status
  2. Requires a join/subquery on status polls rather than a direct field read
- **Reviewer Notes**: Confirm that query performance is acceptable given the expected volume of setup jobs per project (typically 1-3)

### Decision 3: Agent Selection as Single Required Input

- **Decision**: The setup page asks only one question — which agent CLI to use (Claude Code or Codex). No other configuration inputs are collected during onboarding. The project's `defaultAgent` field is not pre-selected; the user makes an explicit choice.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — minimal input reduces error surface
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simple UX reduces friction but limits customization at setup time
  2. Users who want both agents configured must do so later through settings
- **Reviewer Notes**: Validate whether the agent selection should default to the project's `defaultAgent` value or remain unselected

### Decision 4: Credential Verification Before Dispatch

- **Decision**: The system verifies that the project owner has a stored credential for the selected agent's provider before allowing dispatch. Missing credentials block dispatch with actionable guidance rather than failing silently mid-workflow.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (0.9) — security-sensitive operation requires pre-validation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents wasted workflow runs but adds a pre-flight check step
  2. Users without credentials see a clear path to resolution rather than cryptic workflow errors
- **Reviewer Notes**: Ensure credential guidance message links to the correct settings page for the provider

## User Scenarios & Testing

### User Story 1 - First-Time Project Setup (Priority: P1)

A project owner imports an external GitHub repository that lacks AI Board configuration files. After import, they are directed to a setup page where they choose their preferred agent CLI, verify their credentials are in place, and initialize the project. The system runs an onboarding process and, upon completion, redirects them to the project board ready for work.

**Why this priority**: This is the core happy path that resolves the 404 dead-end. Without it, imported projects without config files are unusable.

**Independent Test**: Can be fully tested by importing a repository without `.ai-board/config.yml`, completing setup, and verifying the redirect to the project board.

**Acceptance Scenarios**:

1. **Given** a project owner has just imported a repo without config files, **When** the import completes, **Then** they are directed to the setup page instead of the project board
2. **Given** the owner is on the setup page with a valid credential for their chosen agent, **When** they select an agent and click "Initialize Project", **Then** a setup job is created and the onboarding process begins
3. **Given** the onboarding process completes successfully, **When** the config sync finishes, **Then** the setup page redirects the owner to the project board
4. **Given** the setup page is showing the running state, **When** the owner refreshes the page, **Then** the running state is preserved and polling resumes

---

### User Story 2 - Setup Page Guards and Access Control (Priority: P1)

The setup page enforces ownership requirements and prevents redundant operations. Non-owners cannot access the setup page. Projects that already have configuration skip setup entirely. Users cannot dispatch multiple simultaneous setup jobs.

**Why this priority**: Security and data integrity guards are foundational — without them the system is vulnerable to unauthorized access and race conditions.

**Independent Test**: Can be tested by attempting setup access as a non-owner, navigating to setup for an already-configured project, and attempting duplicate dispatches.

**Acceptance Scenarios**:

1. **Given** a project member (non-owner) navigates to the setup page, **When** the page loads, **Then** access is denied with an appropriate error
2. **Given** a project with `configSyncedAt` already set, **When** anyone navigates to the setup page, **Then** they are redirected to the project board
3. **Given** a setup job is currently PENDING or RUNNING, **When** the owner attempts to dispatch another, **Then** the request is rejected with a conflict indication
4. **Given** a project already has a completed config, **When** the owner attempts to dispatch setup, **Then** the request is rejected as already configured

---

### User Story 3 - Missing Credential Handling (Priority: P2)

When the project owner selects an agent CLI but lacks the required credential for that agent's provider, the setup page blocks dispatch and provides clear guidance on how to configure the credential.

**Why this priority**: Prevents failed workflows due to missing credentials, providing a better experience than post-dispatch failures.

**Independent Test**: Can be tested by selecting an agent for which no credential exists and verifying the block message with guidance.

**Acceptance Scenarios**:

1. **Given** the owner selects Claude Code but has no Anthropic credential configured, **When** the credential check runs, **Then** the "Initialize Project" button is disabled and guidance is displayed
2. **Given** the owner selects Codex but has no OpenAI credential configured, **When** the credential check runs, **Then** the "Initialize Project" button is disabled and guidance is displayed
3. **Given** the owner switches their agent selection to one with a valid credential, **When** the credential check updates, **Then** the "Initialize Project" button becomes enabled

---

### User Story 4 - Setup Failure and Retry (Priority: P2)

When the onboarding process fails, the setup page displays the error details and offers a retry option. Retrying creates a fresh setup job and dispatches a new workflow run.

**Why this priority**: Error recovery is essential for a robust onboarding experience, preventing users from getting permanently stuck.

**Independent Test**: Can be tested by simulating a workflow failure callback and verifying error display and retry functionality.

**Acceptance Scenarios**:

1. **Given** the onboarding workflow fails, **When** the failure callback is received, **Then** the setup page displays the error message from the logs
2. **Given** the setup page shows a failed state, **When** the owner clicks "Retry", **Then** a new setup job is created and a fresh workflow run is dispatched
3. **Given** a previous setup job failed, **When** the owner retries successfully, **Then** the new job's completion triggers config sync and redirect as normal

---

### User Story 5 - Workflow Status Callback Pipeline (Priority: P2)

The onboarding workflow communicates status updates back to the application through authenticated callbacks. The system updates the setup job record and triggers appropriate side effects (config sync on completion, error logging on failure).

**Why this priority**: The callback pipeline is the bridge between the workflow layer and the app layer — it must work correctly for the entire flow to function.

**Independent Test**: Can be tested by sending authenticated status callbacks and verifying job record updates and side effects.

**Acceptance Scenarios**:

1. **Given** a setup job is PENDING, **When** a RUNNING callback is received with valid authentication, **Then** the job status is updated to RUNNING with a start timestamp
2. **Given** a setup job is RUNNING, **When** a COMPLETED callback is received, **Then** the job status is updated to COMPLETED and config sync is triggered
3. **Given** a setup job is RUNNING, **When** a FAILED callback is received, **Then** the job status is updated to FAILED and error details are persisted
4. **Given** an unauthenticated callback request, **When** it reaches the callback endpoint, **Then** it is rejected

---

### Edge Cases

- What happens when config sync fails after the workflow reports COMPLETED? The job should remain COMPLETED but the project stays on the setup page since `configSyncedAt` is not set. The error should be surfaced so the user can retry.
- What happens when the owner navigates away during a RUNNING job and returns later? The setup page should detect the active job and resume showing the running state with accurate elapsed time.
- What happens if the workflow never calls back (e.g., GitHub Actions outage)? The PENDING/RUNNING job remains indefinitely. A future enhancement could add timeout detection, but for this ticket the user can observe the stalled state and contact support.
- What happens when multiple browser tabs are open on the setup page? Each tab polls independently; only one dispatch is allowed due to the PENDING/RUNNING guard.

## Requirements

### Functional Requirements

- **FR-001**: System MUST redirect imported projects without configuration files to the setup page
- **FR-002**: System MUST present an agent CLI selection (Claude Code or Codex) on the setup page
- **FR-003**: System MUST verify that the project owner has a valid credential for the selected agent's provider before allowing setup dispatch
- **FR-004**: System MUST block dispatch with actionable guidance when the required credential is missing
- **FR-005**: System MUST create a setup job record and dispatch the onboarding workflow when the owner initiates setup
- **FR-006**: System MUST prevent duplicate dispatches when a setup job is PENDING or RUNNING
- **FR-007**: System MUST prevent setup dispatch for projects that already have configuration synced
- **FR-008**: System MUST poll for setup job status updates and reflect current state in the UI
- **FR-009**: System MUST preserve the current job state across page refreshes
- **FR-010**: System MUST trigger configuration sync when the onboarding workflow reports completion
- **FR-011**: System MUST redirect to the project board after successful setup and config sync
- **FR-012**: System MUST display error details and offer a retry option when the onboarding workflow fails
- **FR-013**: System MUST restrict setup page access and dispatch to project owners only
- **FR-014**: System MUST authenticate workflow status callbacks using a secure token
- **FR-015**: System MUST record the agent selection, workflow run identifier, status transitions, timestamps, and any error logs for each setup job
- **FR-016**: System MUST support an artifact summary on the setup job for listing files created by the onboarding workflow (populated by future workflow, empty for stub)

### Key Entities

- **ProjectSetupJob**: Represents a single onboarding attempt for a project. Tracks the agent selected, current status (pending, running, completed, failed), workflow run identifier, timing information, error logs, and a summary of artifacts produced. Each project can have multiple setup jobs (retry history), with the most recent active job determining the project's setup state.
- **Project** (extended): The existing project entity gains a derived setup status based on its latest setup job. Projects with a synced configuration timestamp bypass setup entirely.

### Internal Processes

- **Onboard Workflow (Stub)**: Triggered when the owner dispatches setup from the setup page. Receives the project identifier, setup job identifier, target repository, and selected agent as inputs.
  - **Input**: Project ID, job ID, GitHub repository (owner/repo format), agent selection
  - **Phases**:
    1. Signal RUNNING status back to the application
    2. Perform onboarding work (stub: brief pause simulating work)
    3. Signal COMPLETED status with artifact summary (stub: empty summary)
  - **Output**: Status callbacks to the application; in the real implementation, committed configuration files in the target repository
  - **Error behavior**: On any failure, signals FAILED status with error details. The application persists the error and allows the user to retry with a fresh workflow run. Each retry is a new job record, preserving history.

- **Config Sync (Post-Completion)**: Triggered automatically when the onboard workflow reports COMPLETED. Fetches the newly created configuration from the target repository, validates it, and stores it on the project record.
  - **Input**: Project record, owner's GitHub access token
  - **Phases**:
    1. Fetch configuration file from the target repository
    2. Parse and validate configuration
    3. Store configuration and update sync timestamp on the project
  - **Output**: Project `configSyncedAt` timestamp set, configuration stored
  - **Error behavior**: If sync fails after workflow completion, the project remains on the setup page. The job stays COMPLETED but the missing sync timestamp prevents redirect. User can observe the issue and retry.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Imported projects without configuration files land on a functional setup page with zero 404 errors
- **SC-002**: Users can complete the entire setup flow (agent selection → dispatch → completion → board redirect) in under 2 minutes for the stub workflow
- **SC-003**: 100% of unauthorized access attempts (non-owners, unauthenticated callbacks) are rejected
- **SC-004**: Duplicate dispatch attempts while a job is active are blocked with zero race conditions
- **SC-005**: Setup page correctly reflects current job state within 2 seconds of any status change (via polling)
- **SC-006**: Failed setups display actionable error information and allow retry, with 100% of retries creating fresh workflow runs
- **SC-007**: Projects with existing configuration bypass setup entirely, with zero unnecessary setup page visits

## Assumptions

- The project import flow already returns a redirect path that the client follows; no changes to the import endpoint's response structure are needed
- The existing config sync utility can be called from the workflow callback handler without modification
- The existing credential lookup by project and provider is sufficient for pre-dispatch validation
- The stub workflow will be replaced by a real implementation in a follow-up ticket; the app-layer contract (callback endpoints, status transitions) will remain stable
- Workflow dispatch follows the same pattern as existing workflows (GitHub Actions dispatch with repository, inputs, and token)
