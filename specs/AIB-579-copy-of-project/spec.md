# Feature Specification: Project onboarding hybrid workflow with stack detection and generated AI Board guidance

**Feature Branch**: `AIB-579-copy-of-project`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Copy of Project onboarding: hybrid workflow with stack detection and LLM generation"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: AUTO scoring produced conflicting signals between reliability requirements and speed-oriented onboarding constraints, so ambiguous workflow behavior defaults to conservative handling for failure reporting, idempotency, and artifact preservation.
- **Policy Applied**: AUTO
- **Confidence**: Low, net score `+1` from conflicting buckets (Sensitive/Compliance `+3`, Scalability/Reliability `+2`, Neutral Context `+1`, Internal/Speed `-2`, Explicit Speed `-3`); fallback required
- **Fallback Triggered?**: Yes — AUTO fell back to CONSERVATIVE because confidence was below 0.5
- **Trade-offs**:
  1. The workflow favors explicit reporting, validation, and partial-success safeguards over the smallest possible implementation scope.
  2. The onboarding path may do more state reporting work up front, but it reduces the risk of leaving imported projects in an unclear setup state.
- **Reviewer Notes**: Confirm that the stricter failure semantics still fit the intended lightweight onboarding UX.

- **Decision**: Existing project guidance files are preserved rather than regenerated when they already exist, with the workflow reporting those files as preserved artifacts instead of replacing them.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — preserving existing guidance avoids destructive changes to repositories that may already contain curated instructions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Re-runs are safer and idempotent for established repositories.
  2. Some projects may keep older guidance until a deliberate regeneration path is added later.
- **Reviewer Notes**: Validate that preservation is required only for `CLAUDE.md` or also for constitution and related instruction artifacts when they already exist.

- **Decision**: If deterministic detection succeeds and LLM guidance generation fails, the workflow still commits the deterministic outputs and reports the run as completed with a partial-success summary.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — this matches the stated requirement that onboarding should make the project operational even when guidance generation fails
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Projects gain immediate operational configuration without waiting for a perfect run.
  2. The setup experience must clearly distinguish usable partial completion from full completion to avoid misleading users.
- **Reviewer Notes**: Ensure the setup UI and callback contract can clearly surface partial completion without treating it as an error state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize a newly imported repository (Priority: P1)

As a project owner, I want onboarding to analyze my imported repository and create the minimum required AI Board configuration so the project becomes operational without manual repository setup.

**Why this priority**: This is the core value of the feature. Without reliable initial configuration, the imported project cannot participate in downstream AI Board workflows.

**Independent Test**: Can be fully tested by running onboarding against representative repositories from each supported stack and verifying that valid onboarding artifacts are created, committed, and reported back to the setup experience.

**Acceptance Scenarios**:

1. **Given** a newly imported repository with a supported stack and a valid owner credential, **When** onboarding runs, **Then** the repository receives a valid AI Board configuration, the generated artifacts are committed to the default branch in one commit, and the setup status reports completion with the commit reference.
2. **Given** a repository that contains recognizable manifests, lockfiles, and framework conventions, **When** deterministic detection runs, **Then** the resulting analysis captures the language, package manager, framework, commands, test tooling, and relevant services needed for onboarding.

---

### User Story 2 - Receive project-specific guidance instead of generic templates (Priority: P2)

As a project owner, I want onboarding to generate guidance that reflects my repository’s actual architecture and conventions so future AI Board work starts from accurate project context rather than boilerplate assumptions.

**Why this priority**: Generated guidance materially improves the quality of later specification, planning, and implementation work, but it depends on the foundational configuration path in User Story 1.

**Independent Test**: Can be fully tested by running onboarding on repositories with distinct structures and verifying that generated guidance references real commands, architecture patterns, testing conventions, and governance expectations found in the codebase.

**Acceptance Scenarios**:

1. **Given** a repository without an existing `CLAUDE.md`, **When** the guidance generation phase completes, **Then** the repository receives project-specific guidance and a constitution derived from the observed codebase patterns.
2. **Given** a repository that already contains a `CLAUDE.md`, **When** onboarding runs, **Then** the existing file is preserved and the artifact summary records that it was kept rather than replaced.

---

### User Story 3 - Understand failures and partial completion clearly (Priority: P3)

As a project owner, I want the setup workflow to report structured outcomes for success, partial success, and failure so I know whether the project is usable now and what remains to fix or regenerate later.

**Why this priority**: Clear status reporting reduces support burden and prevents repository owners from misinterpreting partially successful onboarding as either full success or total failure.

**Independent Test**: Can be fully tested by forcing failures at each major workflow stage and verifying the callback payload, artifact summary, and final status shown to the setup page.

**Acceptance Scenarios**:

1. **Given** deterministic detection succeeds and guidance generation fails, **When** onboarding finishes, **Then** the repository still receives the deterministic outputs, the callback reports completion with `partial: true`, and the artifact summary identifies missing guidance files.
2. **Given** a workflow setup, detection, guidance, or commit failure, **When** onboarding reports back to the application, **Then** it includes the failure category that matches the stage where the run stopped.

### Edge Cases

- What happens when the repository matches multiple stack or framework signals? The workflow must apply a deterministic precedence order and record the chosen interpretation in the analysis output so downstream generation receives one coherent summary.
- How does the system handle repositories with unsupported or partially detectable stacks? The workflow must still report detected signals, avoid inventing unsupported commands, and fail clearly if it cannot generate a valid operational configuration.
- What happens when the target repository already contains some onboarding artifacts but not all of them? The workflow must preserve existing guidance files, create only the missing artifacts it is allowed to add, and report which files were created versus preserved.
- How does the system handle a successful file generation step followed by a push rejection on the default branch? The workflow must report a commit failure without claiming repository initialization succeeded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The onboarding workflow MUST run against the imported repository’s current default branch after the application has created a setup job and validated that the owner has an AI credential available.
- **FR-002**: The workflow MUST send a running-status callback before repository analysis begins so the setup experience reflects that onboarding has started.
- **FR-003**: The workflow MUST perform a deterministic repository analysis phase that identifies, from repository contents alone, the best-supported language, package manager, framework, test tooling, service dependencies, and runnable project commands needed for AI Board onboarding.
- **FR-004**: The deterministic analysis phase MUST generate an AI Board configuration file that conforms to the repository’s configuration validation rules before the workflow may treat detection as successful.
- **FR-005**: The deterministic analysis phase MUST produce a structured analysis artifact that summarizes detected repository characteristics for use by later workflow steps.
- **FR-006**: The workflow MUST perform a guidance-generation phase that uses the structured analysis plus direct repository inspection to generate project-specific onboarding guidance rather than generic stack-level text.
- **FR-007**: The guidance-generation phase MUST create a constitution document whose principles reflect observed repository conventions while still preserving AI Board baseline governance requirements for security, testing, and data integrity.
- **FR-008**: The workflow MUST create an `AGENTS.md` entry point that directs agent tooling to the generated project guidance.
- **FR-009**: If `CLAUDE.md` already exists in the target repository, the workflow MUST preserve the existing file and record that preservation in the onboarding result.
- **FR-010**: The workflow MUST treat the onboarding artifacts for a successful run as one repository update and write them to the repository’s default branch in a single commit.
- **FR-011**: If deterministic detection succeeds but guidance generation fails, the workflow MUST still commit the deterministic outputs that make the project operational, mark the completion as partial, and identify which guidance artifacts were not produced.
- **FR-012**: If deterministic detection fails, the workflow MUST stop before guidance generation and report the failure as configuration generation failure.
- **FR-013**: If repository update or push fails after artifacts are prepared, the workflow MUST report commit failure and MUST NOT claim the project was successfully initialized.
- **FR-014**: The callback payload for workflow completion MUST include the final status, artifact summary, commit reference when available, applicable error code when applicable, and logs sufficient for the setup experience to explain the outcome.
- **FR-015**: The artifact summary MUST distinguish created artifacts, preserved artifacts, and missing artifacts so project owners can understand the practical readiness of the repository after the run.
- **FR-016**: The workflow MUST use the following failure categories consistently: dispatch failure for setup or validation issues before execution, configuration generation failure for deterministic analysis errors, guidance generation failure for LLM generation errors, and commit failure for repository update errors.
- **FR-017**: The workflow MUST complete typical onboarding runs quickly enough that imported projects receive either a successful or partial-success result within three minutes under normal repository conditions.
- **FR-018**: The onboarding flow MUST avoid dependency installation, runtime service startup, or other repository execution steps not required for static analysis and file generation.
- **FR-019**: The deterministic analysis logic MUST support repositories whose primary stack is TypeScript or JavaScript, Python, Rust, Go, Java or Kotlin, Ruby, or PHP.
- **FR-020**: The workflow MUST replace the existing stub onboarding workflow supplied by AIB-577 without changing the application-side setup contract already introduced by that ticket.

### Key Entities *(include if feature involves data)*

- **Project Setup Job**: The tracked onboarding attempt for an imported project, including current status, final outcome, and the callback-visible summary returned to the application.
- **Repository Analysis Summary**: The structured record of detected stack, commands, frameworks, services, and testing signals extracted during deterministic analysis.
- **Onboarding Artifact Summary**: The report of configuration and guidance files that were created, preserved, omitted, or unavailable after the workflow completed.
- **Owner AI Credential**: The project owner’s authorized agent credential required to run the guidance-generation phase.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Repository Onboarding Workflow**: Triggered when the setup system dispatches onboarding for an imported project.
  - **Input**: Project identifier, repository location, owner credential context, callback endpoint contract, and target default branch
  - **Phases**:
    1. Report running status to the application.
    2. Retrieve the AI Board workflow assets needed for onboarding.
    3. Clone the target repository in a state suitable for static inspection and artifact creation.
    4. Retrieve the owner’s agent credential and prepare the selected agent runtime.
    5. Run deterministic repository analysis and produce the operational configuration plus analysis summary.
    6. Run project-specific guidance generation using the analysis summary and repository contents.
    7. Assemble the final artifact set, preserving protected existing files where required.
    8. Commit the allowed artifacts to the target repository in one repository update.
    9. Send the final callback with status, artifact summary, and commit reference when available.
  - **Output**: Repository artifacts, repository commit reference on success or partial success, and setup-status callback payload
  - **Error behavior**: Stops immediately on setup or deterministic-analysis failures; allows partial completion when guidance generation fails after deterministic outputs are ready; reports commit failure if repository update cannot be applied

- **Deterministic Stack Detection**: Triggered during onboarding before any LLM-based generation begins.
  - **Input**: Repository files and directories available from the default-branch clone
  - **Phases**:
    1. Inspect manifests, lockfiles, configuration files, and task definitions.
    2. Resolve the primary language, package manager, framework, services, commands, and test tooling using deterministic rules.
    3. Generate the operational configuration artifact.
    4. Generate the structured analysis summary for later use.
    5. Validate that the generated configuration is acceptable before declaring the phase successful.
  - **Output**: Valid operational configuration and structured repository analysis summary
  - **Error behavior**: Fails the onboarding run as configuration generation failure if a valid operational configuration cannot be produced

- **Project Guidance Generation**: Triggered only after deterministic detection succeeds.
  - **Input**: Structured repository analysis summary, repository contents, baseline governance standards, and existing guidance-file state
  - **Phases**:
    1. Inspect repository code and structure directly.
    2. Generate project guidance that reflects actual commands, architecture, testing patterns, and conventions.
    3. Generate a constitution whose rigor reflects observed repository patterns while preserving required baseline safeguards.
    4. Preserve existing guidance files that must not be overwritten.
    5. Produce a stable agent entry point for future AI Board work.
  - **Output**: Project-specific guidance artifacts and preserved-artifact metadata
  - **Error behavior**: May fail independently after deterministic outputs exist; such failures must be surfaced as partial completion rather than total loss of the operational configuration

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of onboarding runs for representative supported repositories finish with either full success or partial success in under 3 minutes.
- **SC-002**: 100% of successful and partial-success onboarding runs produce an operational configuration that passes the project’s configuration validation rules before it is committed.
- **SC-003**: 100% of onboarding callbacks for terminal states include a machine-readable artifact summary and the correct outcome category for the stage where the run ended.
- **SC-004**: In validation runs across supported stacks, project owners can identify the repository’s actual commands, architecture cues, and testing conventions from generated guidance without relying on generic placeholder text.
- **SC-005**: 100% of repositories that already contain protected guidance files retain those files unchanged during onboarding reruns.
