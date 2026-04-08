# Feature Specification: Project Onboarding Setup Flow

**Feature Branch**: `AIB-576-copy-of-project`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Imported repositories without project configuration must land on a working setup flow that verifies the selected agent credential, launches onboarding, tracks progress, and returns the user to the project board after setup completes."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Applied the `AUTO` clarification policy and fell back to `CONSERVATIVE` for unresolved defaults because the ticket mixes security-sensitive access controls and credential verification with temporary stub-workflow language.
- **Policy Applied**: AUTO
- **Confidence**: Low, score `+2` (`+3` sensitive/authentication and ownership controls, `+1` general user-facing setup flow, `-2` internal speed/stub signals)
- **Fallback Triggered?**: Yes. `AUTO` produced low confidence and multiple conflicting signal buckets, so the specification defaults to `CONSERVATIVE`.
- **Trade-offs**:
  1. Prioritizes authorization, duplicate-run prevention, and reliable recovery over the lightest possible setup flow.
  2. Adds stricter behavior around state transitions and retry safety, which slightly narrows implementation freedom but reduces dead-end and race-condition risk.
- **Reviewer Notes**: Confirm that the stricter ownership and state-guard expectations match product intent before implementation begins.

- **Decision**: Treated each retry as a new setup attempt while preserving prior attempt history instead of reusing or overwriting an earlier failed run.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium. This is the safest default for auditability, supportability, and recovery behavior.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves a complete history of onboarding attempts for troubleshooting.
  2. Requires the project to determine current setup state from the latest attempt instead of a single mutable record.
- **Reviewer Notes**: Validate that reporting and dashboard views should only treat the latest non-terminal attempt as active.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start Project Setup for an Imported Repository (Priority: P1)

As a project owner who imports a repository without board configuration, I need a working setup screen so I can initialize the project instead of being trapped on a dead-end page.

**Why this priority**: This is the blocked core journey. Without it, imported projects cannot become usable in AI Board.

**Independent Test**: Can be fully tested by importing an unconfigured repository, landing on the setup screen, selecting an eligible agent, and starting setup successfully.

**Acceptance Scenarios**:

1. **Given** an imported project without synced configuration and no active setup attempt, **When** the owner opens the setup screen, **Then** the owner sees agent selection, current credential readiness, and an action to initialize the project.
2. **Given** an imported project that already has synced configuration, **When** the owner attempts to access the setup screen, **Then** the owner is sent directly to the project board instead of seeing setup.
3. **Given** a non-owner user with project access, **When** that user attempts to open the setup screen, **Then** access is denied and setup cannot be started.
4. **Given** the owner selects an agent without a matching credential, **When** the screen validates readiness, **Then** setup remains blocked and the owner sees guidance on how to add the missing credential.

---

### User Story 2 - Monitor Setup Progress and Recover from Failure (Priority: P2)

As a project owner, I need setup progress to stay visible across refreshes and failures so I can trust the onboarding process and retry if needed.

**Why this priority**: Users need confidence that setup is actually running and need a recovery path if the workflow does not complete successfully.

**Independent Test**: Can be fully tested by starting setup, refreshing during execution, observing continued progress, forcing a failure, and starting a new attempt from the failure state.

**Acceptance Scenarios**:

1. **Given** an active setup attempt, **When** the owner refreshes or revisits the setup screen, **Then** the current in-progress state and elapsed time are shown without requiring a new submission.
2. **Given** a setup attempt fails, **When** the owner views the setup screen, **Then** the failure reason is shown and a retry action is available.
3. **Given** a failed setup attempt, **When** the owner retries, **Then** a new setup attempt is created and tracked separately from the failed attempt.
4. **Given** a setup attempt is already pending or running, **When** another start request is submitted, **Then** the request is rejected and the existing active attempt remains authoritative.

---

### User Story 3 - Complete Setup and Enter the Project Board (Priority: P3)

As a project owner, I need successful onboarding to transition me into the normal project experience automatically so I can begin using the board immediately.

**Why this priority**: The onboarding flow only delivers value if a completed setup leads directly into a usable project state.

**Independent Test**: Can be fully tested by completing a setup attempt, verifying the project configuration sync runs, and confirming the owner is redirected to the project board with completion details available.

**Acceptance Scenarios**:

1. **Given** a setup attempt completes successfully, **When** completion is reported, **Then** project configuration is synchronized and the project is eligible to skip setup thereafter.
2. **Given** setup has completed successfully, **When** the owner next visits the project, **Then** the owner is taken to the project board rather than back to setup.
3. **Given** the completion response includes a summary of preserved or created files, **When** the owner sees the completed state, **Then** the owner can review that summary before leaving the setup flow.

### Edge Cases

- What happens when configuration becomes available before the owner starts setup? The setup flow is skipped and the project opens normally.
- How does the system handle a duplicate start request while another setup attempt is pending or running? The duplicate request is rejected without creating a second active attempt.
- What happens when the owner switches the selected agent after viewing credential status? Credential readiness is recalculated for the newly selected agent before setup can begin.
- How does the system handle a late callback from an older attempt after a newer retry has started? Historical records are preserved, but only the latest relevant attempt may control the project’s current setup state.
- What happens when setup completes but configuration synchronization cannot be finalized immediately? The attempt must not silently disappear; the owner must see that setup did not finish cleanly and can retry or seek support.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST route imported projects that do not yet have synchronized project configuration into a dedicated setup experience instead of a dead-end page.
- **FR-002**: The setup experience MUST be available only to the project owner for starting or retrying onboarding.
- **FR-003**: The system MUST prevent the setup experience from being shown once the project already has synchronized configuration and MUST direct the user to the project board instead.
- **FR-004**: The setup experience MUST ask the owner to choose exactly one supported agent option before setup can begin.
- **FR-005**: The system MUST verify whether the owner has a usable credential for the selected agent before allowing setup to start.
- **FR-006**: When no usable credential exists for the selected agent, the system MUST block setup initiation and provide actionable guidance describing what the owner must add or fix.
- **FR-007**: When setup is started, the system MUST create a new project-scoped setup attempt record that stores the selected agent, lifecycle timestamps, current status, and any result summary returned by the workflow.
- **FR-008**: The system MUST allow only one active setup attempt per project at a time.
- **FR-009**: The system MUST reject any new setup initiation request while another setup attempt for the same project is pending or running.
- **FR-010**: The system MUST expose the current setup state and latest setup attempt details so the setup experience can resume accurately after refresh or revisit.
- **FR-011**: The system MUST show elapsed time and current progress while setup is pending or running.
- **FR-012**: The system MUST allow the onboarding workflow to report setup status changes to the application through an authenticated callback mechanism.
- **FR-013**: The system MUST accept setup status transitions for pending, running, completed, and failed outcomes and persist the associated timestamps and messages.
- **FR-014**: When setup completes successfully, the system MUST trigger project configuration synchronization before the project is treated as fully onboarded.
- **FR-015**: When setup fails, the system MUST preserve failure details for display to the owner and MUST offer a retry path that creates a fresh setup attempt.
- **FR-016**: The system MUST derive the project’s overall setup status from the latest setup attempt so the correct state can be restored across page loads.
- **FR-017**: The system MUST preserve prior setup attempts for history and troubleshooting even after newer attempts are created.
- **FR-018**: Project collaborators who are not owners MAY view the latest setup status through project status surfaces, but they MUST NOT be allowed to start, retry, or control setup.
- **FR-019**: The completed setup state MUST present any returned artifact summary in a human-readable way before the owner proceeds to the project board.
- **FR-020**: The initial onboarding workflow used for this ticket MUST be sufficient to exercise the full application flow from start request through completion callback, status updates, and project entry.

### Key Entities *(include if feature involves data)*

- **Project**: A managed repository workspace that may require onboarding before the board experience is available.
- **Project Setup Attempt**: A project-scoped record of one onboarding run, including the chosen agent, lifecycle status, timestamps, workflow reference, result details, and any failure information.
- **Owner Credential**: The owner’s authorized access needed to run onboarding with the selected agent.
- **Artifact Summary**: A structured summary of files or outputs the onboarding run reports as created or preserved for owner review after completion.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Onboarding Dispatch**: Starts when the owner chooses an eligible agent and requests initialization.
  - **Input**: Project identity, repository reference, selected agent, owner authorization context, and the new setup attempt record.
  - **Phases**: Validate that setup is still required; confirm the owner is allowed to start it; confirm the selected agent has a usable credential; create a new setup attempt; hand off the onboarding request to the external workflow.
  - **Output**: A pending or running setup attempt that the setup screen can track.
  - **Error behavior**: If validation fails or another active attempt already exists, no new active attempt is created and the owner receives the blocking reason.

- **Setup Status Callback**: Runs whenever the onboarding workflow reports progress or completion back to the application.
  - **Input**: Setup attempt identifier, authenticated workflow status report, result summary, and any failure details.
  - **Phases**: Authenticate the callback source; locate the target setup attempt; apply the reported lifecycle change; record timestamps and result details; determine whether follow-up synchronization is required.
  - **Output**: Updated setup attempt state and refreshed project setup status.
  - **Error behavior**: Invalid or outdated callbacks are rejected or ignored without corrupting the latest project state.

- **Configuration Synchronization After Completion**: Runs immediately after a successful onboarding completion is accepted.
  - **Input**: Project identity, owner repository access, and the onboarding result context.
  - **Phases**: Retrieve the project’s current configuration from the repository; update the project’s synchronized configuration state; mark setup as no longer required.
  - **Output**: A project that can enter the standard board experience without visiting setup again.
  - **Error behavior**: If synchronization cannot complete, the project remains out of the fully onboarded state and the owner sees that setup did not finish cleanly.

### Assumptions

- Imported repositories that already have synchronized board configuration do not require onboarding and should bypass setup entirely.
- The selected agent options available during setup are limited to the two agent families named in the ticket.
- A successful onboarding completion is not considered final until the project’s configuration has been synchronized back into application state.
- The workflow used in this ticket is intentionally minimal and exists only to validate the application-side setup lifecycle end to end.

### Dependencies

- Project import must continue to identify when synchronized configuration is missing so the correct setup path is used.
- Owner credential management must be able to confirm whether the selected agent can be used before setup starts.
- The onboarding workflow must be able to send authenticated lifecycle updates back to the application.
- Project configuration synchronization must remain available after onboarding completes so the project can transition into the normal board experience.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of imported projects that lack synchronized configuration are presented with a working setup path instead of a dead-end page.
- **SC-002**: 95% of eligible project owners can start setup within 60 seconds of first reaching the setup screen, excluding time spent adding missing credentials.
- **SC-003**: 100% of setup status changes become visible in the setup experience within 5 seconds of the application receiving the update.
- **SC-004**: 100% of duplicate setup start attempts made during an active run are rejected without creating a second active setup attempt.
- **SC-005**: 100% of successfully completed setup attempts result in the project skipping setup on the next project entry.
- **SC-006**: 100% of failed setup attempts present an actionable error state and allow the owner to start a new attempt from the setup experience.
