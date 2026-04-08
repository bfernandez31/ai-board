# Feature Specification: Project Onboarding Setup Page and Hybrid Initialization Workflow

**Feature Branch**: `AIB-573-copy-of-project`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Imported repositories without AI Board configuration must land on a functional setup flow that gathers the preferred agent CLI, verifies credentials, runs a lightweight hybrid onboarding workflow, commits generated project configuration files, and returns the user to the project board."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Use a conservative onboarding posture for access control, workflow dispatch safety, and persistence of onboarding state while still allowing a single-question setup flow.
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.6) based on net score `+4`: neutral user-facing setup flow `+1`, reliability and recovery requirements `+2`, credential and ownership safeguards `+3`, lightweight/speed signals `-2`; one conflicting bucket kept the score below high confidence.
- **Fallback Triggered?**: No. AUTO still resolved to CONSERVATIVE because the net score stayed positive and conflict remained limited to one speed-oriented bucket.
- **Trade-offs**:
  1. The flow favors duplicate-dispatch prevention, resumable status handling, and owner-only initiation over a looser “click and hope” onboarding experience.
  2. Initial setup may block sooner when credentials or project state are invalid, but avoids ambiguous workflow runs and inconsistent project state.
- **Reviewer Notes**: Confirm that conservative gating on ownership, credential readiness, and single active onboarding job matches the intended product behavior for imported repositories.

- **Decision**: Treat deterministic repository detection as the source of truth for generated project configuration, and treat repository analysis by the selected agent as the source of truth for generated governance and agent-instruction content.
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.6) because the description strongly separates structured detection from code-understanding tasks, but still leaves room for project-specific exceptions that reviewers should validate.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Structured configuration remains predictable and testable across common stacks.
  2. Narrative guidance files can reflect real project conventions, but their quality depends on repository readability and successful agent execution.
- **Reviewer Notes**: Validate that the generated setup artifacts remain understandable to project owners even when the analyzed repository has mixed conventions or partial metadata.

- **Decision**: Preserve any existing primary agent-instruction file, but still allow the onboarding workflow to create missing governance, configuration, ignore, and linked alias files needed to make the project operational.
- **Policy Applied**: AUTO
- **Confidence**: Medium (0.6) because idempotency and partial-success expectations are explicit, while the exact preservation boundaries had to be inferred.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Existing repository guidance is not overwritten, reducing the risk of damaging curated project instructions.
  2. Some imported repositories may finish onboarding with a mix of pre-existing and generated artifacts, so reviewers need to ensure the resulting project state is coherent.
- **Reviewer Notes**: Confirm that preserving existing instruction content while generating the remaining required files still satisfies the definition of “initialized project.”

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize an imported project (Priority: P1)

As a project owner, I can open a setup page for an imported repository that is missing required AI Board configuration, choose the agent I want to use, and start initialization so the project becomes operational instead of landing in a dead-end state.

**Why this priority**: Without this flow, imported repositories without configuration cannot be used at all.

**Independent Test**: Can be fully tested by importing a repository without project configuration, visiting the setup page, selecting an eligible agent, starting initialization, and confirming the project becomes accessible through the normal board.

**Acceptance Scenarios**:

1. **Given** an imported project without synced configuration, **When** the owner opens the project, **Then** the system routes them to a setup page instead of an error page.
2. **Given** the setup page is shown and the owner has a valid credential for one supported agent, **When** they choose that agent and start initialization, **Then** the system creates a project-scoped onboarding job and moves the page into a running state.
3. **Given** the onboarding job completes successfully, **When** the page receives the completed status, **Then** the system shows the generated artifact summary and allows the owner to continue to the project board.

---

### User Story 2 - Prevent invalid or duplicate onboarding runs (Priority: P2)

As a project owner, I receive clear blocking guidance when onboarding cannot start because my selected agent is not configured or another onboarding run is already in progress, so I do not create conflicting jobs or wait on a workflow that cannot succeed.

**Why this priority**: Protecting state integrity and giving actionable feedback reduces failed runs and support burden.

**Independent Test**: Can be tested by opening setup without the required credential, and separately by reopening the page while a run is pending or active, and confirming the system blocks duplicate starts while surfacing the current state.

**Acceptance Scenarios**:

1. **Given** the owner selects an agent without a usable credential, **When** they attempt to initialize the project, **Then** the system blocks dispatch and explains what must be configured before retrying.
2. **Given** an onboarding job for the project is pending or running, **When** the owner refreshes or revisits the setup page, **Then** the page resumes the active running state instead of offering another dispatch.
3. **Given** an onboarding job is already pending or running, **When** another initialization request is submitted, **Then** the system rejects the duplicate request and keeps the original job authoritative.

---

### User Story 3 - Recover from onboarding failure and review outputs (Priority: P3)

As a project owner, I can retry onboarding after a failure and later review or adjust generated setup artifacts from project settings so the project can recover without manual repository surgery.

**Why this priority**: Imported repositories vary widely, so recovery and post-run review are required for trust and adoption.

**Independent Test**: Can be tested by forcing an onboarding failure, confirming the page moves to an error state with retry, then completing a later run and verifying the generated artifacts remain reviewable from project settings.

**Acceptance Scenarios**:

1. **Given** the onboarding workflow fails, **When** the owner views the setup page, **Then** the page shows the failure state, the latest error details, and a retry action for a fresh run.
2. **Given** a previous run failed, **When** the owner retries onboarding, **Then** the system starts a new end-to-end onboarding run rather than resuming the failed attempt.
3. **Given** onboarding completed successfully, **When** the owner opens project settings later, **Then** they can review and adjust the generated onboarding artifacts without rerunning import.

---

### Edge Cases

- What happens when the imported repository already contains valid project configuration before the setup page loads? The system redirects directly to the project board and skips setup entirely.
- What happens when the repository already contains a primary agent-instruction file but is missing the other required files? The onboarding run preserves the existing instruction file and generates only the missing operational artifacts.
- What happens when repository analysis can generate project configuration but fails later while producing guidance content? The job records failure details, partial outputs remain governed by the workflow result, and the owner can retry from the setup page.
- How does the system handle page refreshes or browser reconnects during a long-running onboarding job? The current project-scoped setup job remains the source of truth and the page resumes from its latest persisted status.
- How does the system handle repositories that do not match a supported stack cleanly? The onboarding flow still produces the best valid configuration it can from detected evidence, records the result, and requires the owner to review generated project settings after completion.
- How does the system handle missing ignore rules for generated project metadata? Successful onboarding ensures the project metadata directory is ignored if it was not already excluded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST route imported projects that do not yet have synced project configuration to a dedicated setup page instead of returning a not-found response.
- **FR-002**: The setup page MUST be accessible only to the project owner and MUST deny onboarding actions to non-owners.
- **FR-003**: The setup page MUST present exactly one onboarding choice before initialization begins: which supported agent the owner wants to use for repository analysis.
- **FR-004**: The system MUST verify that the owner has a usable credential for the selected agent before allowing onboarding to start.
- **FR-005**: The setup page MUST keep the initialization action disabled until credential verification succeeds and MUST provide actionable guidance when verification fails.
- **FR-006**: When initialization starts, the system MUST create or reuse a single authoritative project-scoped setup job record that tracks pending, running, completed, and failed states together with timing and error details.
- **FR-007**: The system MUST reject duplicate onboarding dispatch attempts while a setup job for the same project is pending or running.
- **FR-008**: The setup page MUST poll and display the latest setup job state, including elapsed time while running, success details on completion, and failure details when the job fails.
- **FR-009**: If the owner refreshes the page during an active onboarding run, the setup page MUST resume from the persisted setup job state rather than resetting to the initial form.
- **FR-010**: A successful onboarding run MUST generate a valid project configuration file from deterministic repository detection and make that configuration available for sync into AI Board project state.
- **FR-011**: Deterministic repository detection MUST recognize common stack signals across at least JavaScript or TypeScript, Python, Rust, Go, Java or Kotlin, Ruby, and PHP repositories.
- **FR-012**: Deterministic repository detection MUST derive project commands, runtime indicators, testing signals, and likely service dependencies from repository evidence rather than manual user input.
- **FR-013**: The onboarding workflow MUST produce a structured analysis summary that is used as context for repository-aware generation of guidance content.
- **FR-014**: The onboarding workflow MUST generate a project-specific agent instruction file that reflects observed repository conventions, commands, architecture, and testing patterns instead of generic placeholders.
- **FR-015**: The onboarding workflow MUST preserve an existing primary agent instruction file when one is already present.
- **FR-016**: The onboarding workflow MUST generate a project governance file whose principles reflect observed repository conventions while still including baseline governance and quality expectations.
- **FR-017**: The onboarding workflow MUST create a linked agent alias file that points to the primary generated or preserved instruction file so supported agents share the same runtime guidance source.
- **FR-018**: Successful onboarding MUST ensure the project metadata directory is ignored by source control if it is not already ignored.
- **FR-019**: Successful onboarding MUST commit all generated or updated onboarding artifacts to the repository in one atomic change on the repository’s default branch.
- **FR-020**: After a successful onboarding run, the system MUST synchronize the generated project configuration into application state and redirect the owner to the project board.
- **FR-021**: If the project already has synced configuration before or during setup access, the system MUST skip setup and redirect to the project board.
- **FR-022**: If onboarding fails, the system MUST persist the failure state and error details and MUST allow the owner to start a fresh retry run from the setup page.
- **FR-023**: Project settings MUST allow the owner to review and adjust generated onboarding artifacts after initialization completes.
- **FR-024**: The onboarding workflow MUST remain lightweight by limiting itself to repository access, deterministic detection, agent analysis, artifact generation, commit creation, and status callback handling, without performing full environment bootstrapping.

### Key Entities *(include if feature involves data)*

- **Setup Job**: A project-scoped onboarding record that tracks selected agent, lifecycle status, timing, completion metadata, and the latest failure details for a repository initialization attempt.
- **Imported Project**: A project linked to an external repository that may exist in AI Board before its operational configuration has been generated and synced.
- **Onboarding Artifact Set**: The collection of repository files produced or preserved by initialization, including project configuration, governance guidance, primary agent instructions, linked agent alias, and ignore updates.
- **Repository Analysis Summary**: The structured detection output describing repository evidence, inferred stack signals, commands, testing indicators, and service clues that guide later content generation.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Project Onboarding Dispatch**: Triggered when the project owner starts initialization from the setup page.
  - **Input**: Project identity, repository reference, selected agent, ownership validation result, and credential readiness result.
  - **Phases**: Validate that setup is still required; confirm ownership and credential availability; prevent duplicate active jobs; create the authoritative setup job; dispatch the onboarding workflow.
  - **Output**: A persisted pending or running setup job and a setup page that can track progress.
  - **Error behavior**: If validation fails, no new onboarding workflow is started and the owner receives a blocking error with guidance. If dispatch fails after job creation, the stored job state must clearly reflect failure rather than remaining orphaned.

- **Deterministic Repository Detection**: Triggered by the onboarding workflow after repository access is prepared.
  - **Input**: The imported repository contents and repository metadata.
  - **Phases**: Inspect repository manifests and configuration clues; infer stack, command, testing, and service signals; generate a valid project configuration; generate a structured analysis summary for later use.
  - **Output**: A configuration artifact ready for validation and sync plus a structured analysis summary for repository-aware content generation.
  - **Error behavior**: If repository signals are incomplete or mixed, the process still produces the most defensible valid output it can. If it cannot produce valid configuration, the onboarding workflow fails with actionable error details.

- **Repository-Aware Guidance Generation**: Triggered after deterministic detection succeeds.
  - **Input**: Selected agent, repository contents, repository analysis summary, and existing guidance files if present.
  - **Phases**: Read project structure and conventions; preserve any existing primary instruction file; generate or update the missing governance and guidance artifacts; create the linked alias file; prepare the full artifact set for commit.
  - **Output**: A coherent onboarding artifact set that enables AI Board workflows and agent guidance for the imported repository.
  - **Error behavior**: If guidance generation fails, the setup job records failure details and the owner can retry with a fresh run. Partial outputs must not be represented as a successful onboarding result.

- **Onboarding Completion and Sync**: Triggered when artifact generation finishes.
  - **Input**: Final onboarding artifact set, repository commit result, and setup job identifier.
  - **Phases**: Create one atomic repository change; update setup job status and committed file summary; synchronize project configuration into application state; notify the setup page of completion.
  - **Output**: A completed setup job, synced project configuration, and a project that can open directly on the board.
  - **Error behavior**: If the repository change or configuration sync fails, the setup job must end in a failed state with retry guidance rather than reporting completion.

### Assumptions and Dependencies

- Imported projects already have a repository connection that allows AI Board to inspect the default branch and create a repository change when onboarding succeeds.
- Supported agents remain limited to the two choices described in the feature request, and credential readiness can be checked before workflow dispatch.
- Project settings remain the long-term place where owners can review and adjust generated onboarding artifacts after setup completes.
- Configuration synchronization remains the mechanism that determines whether a project should bypass setup on future visits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of imported repositories that lack project configuration reach a functional setup page instead of a not-found page.
- **SC-002**: At least 95% of eligible project owners who start setup with a valid credential can complete onboarding and reach the project board without manual repository edits.
- **SC-003**: At least 95% of successful onboarding runs complete within 3 minutes from initialization start to completed status being shown on the setup page.
- **SC-004**: 100% of successful onboarding runs produce a valid project configuration that can be synchronized into project state and used to bypass setup on subsequent visits.
- **SC-005**: 100% of successful onboarding runs preserve any pre-existing primary agent instruction file while still producing the remaining required operational artifacts.
- **SC-006**: At least 90% of generated guidance files are accepted by project owners without immediate manual correction, measured by no settings edits within the first review session after onboarding.
