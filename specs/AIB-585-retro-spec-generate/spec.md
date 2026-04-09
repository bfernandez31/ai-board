# Feature Specification: Retro-Spec — Generate Project Specifications for Existing Codebases

**Feature Branch**: `AIB-585-retro-spec-generate`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Retro-spec: generate project specifications for existing codebases"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Retro-spec job uses the existing `ProjectSetupJob` model (with a new command type indicator) rather than creating a new model, since the lifecycle (PENDING/RUNNING/COMPLETED/FAILED) and relationship to a project are identical to onboard jobs.
- **Policy Applied**: AUTO (resolved CONSERVATIVE)
- **Confidence**: Medium (score 3) — the feature adds a new workflow but follows established patterns
- **Fallback Triggered?**: No — CONSERVATIVE was the AUTO recommendation
- **Trade-offs**:
  1. Reusing `ProjectSetupJob` keeps the schema simpler but requires distinguishing retro-spec jobs from onboard jobs (e.g., via a `type` or `command` field)
  2. A separate model would provide clearer separation but adds schema and API complexity for identical behavior
- **Reviewer Notes**: Confirm that adding a `command` or `type` discriminator to `ProjectSetupJob` is acceptable, or if a separate table is preferred

---

- **Decision**: Depth levels (Quick/Standard/Comprehensive) control the breadth and detail of generated specifications, not the accuracy. All levels produce correct specifications — they differ in how many spec files and how much detail each contains.
- **Policy Applied**: AUTO (resolved CONSERVATIVE)
- **Confidence**: Medium (score 3) — reasonable default that aligns with the described time estimates
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Quick may miss important architectural details but is fast for simple projects
  2. Comprehensive is thorough but costs more in LLM tokens and time
- **Reviewer Notes**: Validate that the proposed depth-to-content mapping (see Internal Processes section) matches user expectations

---

- **Decision**: The "specs skipped" banner on the board is stored as a client-side dismissal (local storage or cookie) rather than a server-side flag, since it is a UI preference and not a business state.
- **Policy Applied**: AUTO (resolved CONSERVATIVE)
- **Confidence**: Medium (score 3) — standard UI pattern for dismissible banners
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Client-side dismissal means banner reappears on new devices/browsers — but users can dismiss again or generate specs
  2. Server-side would persist across devices but adds unnecessary schema complexity for a UX hint
- **Reviewer Notes**: If multi-device consistency is important to users, consider a server-side `specsSkipped` flag on the Project model

---

- **Decision**: After the onboard init step completes (configSyncedAt set), the setup page automatically redirects to the board. If specs have not been generated, the board shows a dismissible banner offering spec generation. The setup page does not show a "Step 2" — instead, the spec generation prompt lives on the board as a banner/modal.
- **Policy Applied**: AUTO (resolved CONSERVATIVE)
- **Confidence**: Medium (score 3) — the post-init redirect fix is explicit in the ticket, and consolidating the Step 2 UX into the board avoids users being stuck on a setup page after init is already complete
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Board-based banner is discoverable and non-blocking — users can start working immediately
  2. A dedicated Step 2 on the setup page would be more prominent but conflicts with the requirement that setup redirects to board after init
- **Reviewer Notes**: The ticket describes both "Step 2 on setup page" and "redirect to board after init". These conflict. This spec resolves by having the setup page redirect immediately and placing the spec generation prompt on the board. If a two-step setup page is preferred, the redirect behavior must be deferred until Step 2 is completed or skipped.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Specs After Onboarding (Priority: P1)

A project owner has just completed onboarding (config.yml + CLAUDE.md committed). They land on the board and see a banner informing them that project specs are not yet generated, with a brief explanation of the benefits. They click "Generate" which opens a modal where they select a depth level, optionally provide a documentation URL and additional context, then click "Generate Specs". A background job is dispatched, the modal closes, and a badge in the board header shows "Generating specs..." with a pulse animation. When generation completes, the badge changes to "Specs ready" and fades away after 30 seconds.

**Why this priority**: This is the core feature — without spec generation, all downstream benefits (health scans, verify stage, code reviews) remain unavailable for onboarded projects.

**Independent Test**: Can be fully tested by onboarding a project, clicking "Generate" on the banner, selecting a depth, and verifying that specs appear in the repository's `specs/specifications/` directory.

**Acceptance Scenarios**:

1. **Given** a project with `configSyncedAt` set and no specs generated, **When** the owner visits the board, **Then** a dismissible banner is shown: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality — [Generate] [x]"
2. **Given** the owner clicks "Generate" on the banner, **When** the spec generation modal opens, **Then** it displays a depth picker (Quick/Standard/Comprehensive), an optional documentation URL field, and an optional additional context textarea
3. **Given** the owner selects "Standard" depth and clicks "Generate Specs", **When** the job is dispatched, **Then** the modal closes, the banner is replaced by a header badge "Generating specs..." with a pulse indicator, and the owner is not navigated away from the board
4. **Given** the spec generation job completes successfully, **When** the board polls for job status, **Then** the badge changes to "Specs ready" and fades after 30 seconds
5. **Given** the spec generation job fails, **When** the board polls for job status, **Then** the badge shows an error state with an option to retry

---

### User Story 2 - Skip Spec Generation (Priority: P2)

A project owner sees the spec generation banner on the board but wants to start working immediately. They dismiss the banner by clicking the close button. The banner does not reappear during this session on this device. If they later want specs, they can trigger generation from the board (e.g., via a project settings or menu option).

**Why this priority**: Users must have an unobstructed path to start working. Forcing spec generation would block productivity.

**Independent Test**: Can be tested by dismissing the banner and verifying it does not reappear on page reload, then verifying that a "Generate Specs" option remains accessible elsewhere.

**Acceptance Scenarios**:

1. **Given** the spec generation banner is visible, **When** the owner clicks the close (x) button, **Then** the banner is dismissed and does not reappear on page reload
2. **Given** the banner was dismissed, **When** the owner wants to generate specs later, **Then** a "Generate Specs" option is available (e.g., in project settings or board menu) that opens the same modal

---

### User Story 3 - Post-Init Redirect to Board (Priority: P1)

A project owner is on the setup page. The onboard init job completes and `configSyncedAt` is set. The setup page automatically redirects to the board. The setup page does not offer to re-initialize a project that is already configured.

**Why this priority**: This is a bug fix — users are currently stuck on the setup page after init completes. Critical for the onboarding experience.

**Independent Test**: Can be tested by completing an onboard init and verifying the setup page redirects to the board without manual intervention.

**Acceptance Scenarios**:

1. **Given** a project with `configSyncedAt` already set, **When** the owner navigates to the setup page, **Then** they are immediately redirected to the board
2. **Given** the owner is on the setup page and the init job completes, **When** `configSyncedAt` transitions from null to a timestamp, **Then** the page automatically redirects to the board
3. **Given** a configured project, **When** the setup page loads, **Then** no "Initialize" button or re-init option is shown

---

### User Story 4 - Spec Generation with External Documentation (Priority: P3)

A project owner has existing documentation hosted on an external platform (Notion, Confluence, wiki). During spec generation, they paste the URL into the optional documentation URL field and add business context in the textarea. The generated specs incorporate information from both the codebase analysis and the external documentation.

**Why this priority**: Enhances spec quality for projects with existing documentation, but the core feature works without it.

**Independent Test**: Can be tested by providing a documentation URL during spec generation and verifying the generated specs reference information from that documentation.

**Acceptance Scenarios**:

1. **Given** the spec generation modal is open, **When** the owner enters a documentation URL and additional context, **Then** both fields accept input and are included in the job dispatch
2. **Given** a documentation URL is provided, **When** the retro-spec workflow runs, **Then** it fetches the URL content and uses it as additional context for spec generation
3. **Given** the documentation URL is unreachable, **When** the workflow attempts to fetch it, **Then** spec generation continues using only the codebase (with a warning logged, not a failure)

---

### User Story 5 - Board Badge During Generation (Priority: P2)

While a retro-spec job is running, the board header displays a status badge that keeps the owner informed of progress without blocking their workflow.

**Why this priority**: Provides real-time feedback during an async operation — important for trust and transparency.

**Independent Test**: Can be tested by triggering spec generation and observing the badge transitions: "Generating specs..." (pulse) -> "Specs ready" (fade) or error state.

**Acceptance Scenarios**:

1. **Given** a retro-spec job is PENDING or RUNNING, **When** the board renders, **Then** a badge with text "Generating specs..." and a pulse animation is visible in the board header area
2. **Given** a retro-spec job completes, **When** the status is polled, **Then** the badge changes to "Specs ready" and fades out after 30 seconds
3. **Given** a retro-spec job fails, **When** the status is polled, **Then** the badge shows an error indicator with a retry option

---

### Edge Cases

- What happens when the owner triggers spec generation for a project that already has `specs/specifications/` in the repository? The workflow should overwrite/update existing specs (with the generated content reflecting current codebase state).
- What happens if two spec generation jobs are dispatched concurrently for the same project? Only one active retro-spec job should be allowed per project at a time; the second request should be rejected.
- What happens if the project repository is empty or has minimal code? The workflow should still generate specs (even if minimal) and not fail — output scales to what the codebase offers.
- What happens if the documentation URL points to a page requiring authentication? The workflow should fail gracefully for that URL fetch (log warning) and proceed with codebase-only analysis.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a dismissible banner on the board when a project has completed onboarding but has no generated specs
- **FR-002**: System MUST provide a modal with depth selection (Quick/Standard/Comprehensive), optional documentation URL input, and optional additional context textarea
- **FR-003**: System MUST dispatch a background retro-spec workflow when the owner clicks "Generate Specs"
- **FR-004**: System MUST show a real-time status badge in the board header during spec generation (pulse animation while running, success/fade on completion, error state on failure)
- **FR-005**: System MUST allow the owner to dismiss the spec generation banner, and the dismissal MUST persist across page reloads on the same device
- **FR-006**: System MUST redirect from the setup page to the board when `configSyncedAt` is set (both on page load and during polling)
- **FR-007**: System MUST NOT offer project re-initialization on the setup page when the project is already configured
- **FR-008**: System MUST prevent concurrent retro-spec jobs for the same project (reject if one is already active)
- **FR-009**: System MUST track retro-spec job status through the standard PENDING/RUNNING/COMPLETED/FAILED lifecycle with polling support
- **FR-010**: System MUST commit generated `specs/specifications/` directory to the target repository's default branch upon successful completion
- **FR-011**: System MUST scale spec output according to the selected depth level (Quick: overview; Standard: architecture + API + data model; Comprehensive: full functional + technical specs)
- **FR-012**: System MUST fetch and incorporate external documentation when a URL is provided, and MUST NOT fail if the URL is unreachable
- **FR-013**: System MUST provide a way to trigger spec generation after the banner has been dismissed (e.g., board menu or project settings)

### Key Entities

- **ProjectSetupJob (extended)**: Existing job entity, extended with a discriminator to distinguish onboard jobs from retro-spec jobs. Tracks job lifecycle, workflow run ID, error messages, and artifact summary.
- **Project**: Existing entity. The `configSyncedAt` field serves as the gate for setup-to-board redirect. No new fields needed for spec generation tracking — the presence of an active retro-spec `ProjectSetupJob` indicates generation in progress.

### Internal Processes

- **Retro-Spec Workflow** (`retro-spec.yml`): Triggered by API dispatch when owner requests spec generation from the board.
  - **Input**: project_id, job_id, depth (QUICK/STANDARD/COMPREHENSIVE), docUrl (optional), context (optional), githubRepository (owner/repo format), agent (CLAUDE/CODEX)
  - **Phases**:
    1. Report RUNNING status to the app
    2. Clone the target repository
    3. Fetch owner's AI credential from app API
    4. If docUrl provided, fetch external documentation content
    5. Execute the `ai-board.retro-spec` agent command with codebase, config files, depth, external docs, and additional context as inputs
    6. Commit generated `specs/specifications/` files to the repository's default branch
    7. Report COMPLETED status with artifact summary
  - **Output**: `specs/specifications/` directory committed to the target repo containing spec files scaled to the chosen depth
  - **Error behavior**: Reports FAILED status with error message. Partial results are not committed. Unreachable doc URL logs a warning but does not fail the job. Job is retryable.

- **Retro-Spec Agent Command** (`ai-board.retro-spec`): LLM-powered analysis command executed within the workflow.
  - **Input**: Codebase file tree, config.yml, CLAUDE.md, constitution.md, depth level, external documentation (if any), additional context (if any)
  - **Phases**:
    1. Analyze codebase structure and existing configuration
    2. Incorporate external documentation and user-provided context
    3. Generate spec files with content depth matching the selected level:
       - **Quick**: Project overview, high-level architecture summary
       - **Standard**: Architecture, API endpoints, data model, key workflows
       - **Comprehensive**: Full functional specs, technical specs, entity documentation, API schemas, workflow documentation
    4. Write generated files to `specs/specifications/` directory
  - **Output**: Generated spec files in the working directory (committed by the workflow)
  - **Error behavior**: Propagates errors to the workflow for status reporting

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Project owners can trigger spec generation within 30 seconds of landing on the board after onboarding
- **SC-002**: Quick depth generates specs in under 5 minutes, Standard in under 10 minutes, Comprehensive in under 20 minutes
- **SC-003**: Setup page redirects to the board within 3 seconds of `configSyncedAt` being set
- **SC-004**: 100% of generated specs produce a valid `specs/specifications/` directory with at least one spec file
- **SC-005**: Health scan spec-sync returns a non-SKIPPED result for projects with generated specs
- **SC-006**: Board badge transitions (generating -> ready/error) are visible to the user within one polling cycle (2 seconds) of job status change
- **SC-007**: Dismissing the spec banner persists across page reloads without re-appearing
