# Feature Specification: Retro-Spec — Generate Project Specifications for Existing Codebases

**Feature Branch**: `AIB-587-copy-of-retro`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Retro-spec: generate project specifications for existing codebases"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Job tracking model for spec generation — use the existing setup job infrastructure (ProjectSetupJob) extended with a new job type rather than the ticket-level Job model, since retro-spec is a project-level operation without an associated ticket
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: 1, absScore: 1)
- **Fallback Triggered?**: Yes — netScore +1 with no strong directional signals; confidence 0.3 < 0.5 threshold promoted to CONSERVATIVE
- **Trade-offs**:
  1. Reusing setup job infrastructure minimizes new surface area but couples spec generation to onboarding models
  2. A separate model would be cleaner but adds schema complexity for a single-use operation
- **Reviewer Notes**: Verify whether the existing ProjectSetupJob model can accommodate a second job type (spec generation) or whether a dedicated model is warranted. Consider future extensibility if more project-level operations are planned.

---

- **Decision**: How to determine whether specs were skipped — track skip state implicitly by checking whether `specs/specifications/` exists in the target repository after onboarding completes, rather than adding a new database field
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score: 3) — industry-standard pattern of deriving state from artifacts rather than duplicating it in the database
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Avoids schema changes and keeps the repository as the source of truth for spec presence
  2. Requires a GitHub API call to check spec existence, which adds latency on board load; caching or a lightweight flag may be needed
- **Reviewer Notes**: If the GitHub API check proves too slow for the board banner decision, consider adding a `specsGeneratedAt` field to the Project model as a cache. The repository should remain the authoritative source.

---

- **Decision**: Depth levels output scope — Quick produces a single overview document; Standard produces architecture, API, and data model documents; Comprehensive produces the full `specs/specifications/` structure including functional specs, technical specs, and cross-references
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score: 5) — directly specified in the feature description with clear delineation
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. More granular depth levels give users control over time investment vs. completeness
  2. Three levels add complexity to the skill implementation and testing matrix
- **Reviewer Notes**: Validate that estimated generation times (~5/~10/~20 min) are achievable. Consider whether the UI should show estimated times or just depth labels.

---

- **Decision**: Post-completion badge behavior — "Specs ready" badge fades after 30 seconds as described, using a client-side timer rather than server-side state
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (score: 5) — explicitly specified in the description
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Client-side fade is simple and requires no persistence
  2. Users who navigate away and return won't see the completion badge (acceptable — specs presence is visible through other indicators)
- **Reviewer Notes**: Confirm that 30 seconds is sufficient for users to notice the completion. Consider whether the fade should be interruptible (e.g., hover to keep visible).

---

- **Decision**: Banner dismiss persistence — session-scoped dismissal rather than permanent dismissal, so the banner reappears on new sessions if specs still don't exist
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (score: 3) — balances user nudging with not being overly persistent; aligns with the feature's goal of encouraging spec adoption
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Session-scoped dismissal gently reminds returning users without being permanently intrusive
  2. Users who intentionally don't want specs will see the banner on every session until they generate specs
- **Reviewer Notes**: Consider whether a "Don't show again" option should be added alongside the simple dismiss. Monitor user feedback for annoyance signals.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Specs After Onboarding (Priority: P1)

After completing project onboarding (config.yml and CLAUDE.md committed), the project owner is presented with a second step offering to generate project specifications. The owner selects a depth level, optionally provides a documentation URL and additional context, and clicks "Generate Specs". A background job is dispatched, and the owner is redirected to the board where a progress indicator shows the generation status.

**Why this priority**: This is the core value proposition — without this flow, projects remain without specifications, degrading health scans, verify stages, and code reviews.

**Independent Test**: Can be fully tested by onboarding a project, completing init, and verifying the Step 2 UI appears with all fields. Clicking Generate dispatches a job and redirects to the board.

**Acceptance Scenarios**:

1. **Given** the init step has completed (configSyncedAt is set), **When** the setup page loads, **Then** a Step 2 section is displayed with a depth picker (Quick/Standard/Comprehensive), an optional documentation URL field, an optional additional context textarea, and Generate/Skip buttons.
2. **Given** the owner has selected "Standard" depth and entered a documentation URL, **When** they click "Generate Specs", **Then** a background job is created, a workflow is dispatched with the selected parameters, and the owner is redirected to the board.
3. **Given** the owner clicks "Skip for now", **When** the redirect occurs, **Then** the owner lands on the board immediately without any job being dispatched.

---

### User Story 2 - Board Progress Indicator During Generation (Priority: P1)

While spec generation is in progress, the board displays a visible indicator so the owner knows the process is running. When generation completes, the indicator updates to show success and then fades away.

**Why this priority**: Without feedback, users have no way to know whether spec generation is running, completed, or failed — leading to confusion and duplicate dispatches.

**Independent Test**: Can be tested by triggering spec generation and verifying the board header shows the progress badge, then confirming it updates to "Specs ready" on completion and fades after 30 seconds.

**Acceptance Scenarios**:

1. **Given** a spec generation job is in PENDING or RUNNING state, **When** the board loads or polls for updates, **Then** a badge in the board header displays "Generating specs..." with a pulse animation.
2. **Given** the spec generation job transitions to COMPLETED, **When** the board detects the status change, **Then** the badge updates to "Specs ready" and fades out after 30 seconds.
3. **Given** the spec generation job fails, **When** the board detects the FAILED status, **Then** the badge displays an error state with an option to retry.

---

### User Story 3 - Board Banner for Skipped Specs (Priority: P2)

When a project owner skipped spec generation during onboarding, the board displays a dismissable banner explaining the value of specs and offering a one-click path to generate them.

**Why this priority**: Encourages spec adoption for projects that skipped the step, improving downstream workflow quality without blocking the user.

**Independent Test**: Can be tested by onboarding a project, skipping Step 2, navigating to the board, and verifying the banner appears with a Generate button and a dismiss button.

**Acceptance Scenarios**:

1. **Given** the project has completed onboarding but has no generated specs, **When** the board loads, **Then** a dismissable banner is displayed: "Project specs not generated — Specs improve health scans, ticket workflows, and code review quality — [Generate] [Dismiss]".
2. **Given** the banner is visible, **When** the owner clicks "Generate", **Then** a modal opens with the same depth picker, documentation URL, and context fields as the setup Step 2.
3. **Given** the banner is visible, **When** the owner clicks the dismiss button, **Then** the banner is hidden and does not reappear during the current session.
4. **Given** the owner dismissed the banner and revisits the board in a new session, **When** the board loads and specs still don't exist, **Then** the banner reappears (dismiss is session-scoped, not permanent).

---

### User Story 4 - Post-Init Redirect Fix (Priority: P1)

After the onboarding init step completes and configSyncedAt is set, the setup page transitions to Step 2 instead of staying idle. The setup page must not offer to re-initialize a project that is already configured.

**Why this priority**: Without this fix, users get stuck on the setup page after successful onboarding, creating a broken experience.

**Independent Test**: Can be tested by completing onboarding init, then verifying the setup page shows Step 2. Navigating directly to the setup page URL for a fully-configured project should redirect to the board.

**Acceptance Scenarios**:

1. **Given** the init step has just completed (configSyncedAt set), **When** the setup page detects the change via polling, **Then** it presents Step 2 (spec generation) instead of staying on the init step.
2. **Given** a project has configSyncedAt set and spec generation was already completed or skipped, **When** a user navigates directly to the setup page URL, **Then** the user is redirected to the board.
3. **Given** a project has configSyncedAt set but the user has not yet acted on Step 2, **When** the setup page loads, **Then** only Step 2 (spec generation) is shown — the init step is marked as complete and cannot be re-triggered.

---

### User Story 5 - Retro-Spec Workflow Execution (Priority: P1)

A new workflow is dispatched that clones the target repository, analyzes the codebase using a retro-spec skill/command, generates appropriately scoped specification documents, and commits them to the repository's default branch.

**Why this priority**: This is the backend engine that powers the entire feature — without it, no specs are generated regardless of the UI.

**Independent Test**: Can be tested by dispatching the workflow with known inputs and verifying that `specs/specifications/` is committed to the target repo with content appropriate to the selected depth.

**Acceptance Scenarios**:

1. **Given** the workflow is dispatched with depth "quick", **When** the workflow completes, **Then** `specs/specifications/` contains a single overview document covering high-level project purpose and structure.
2. **Given** the workflow is dispatched with depth "standard", **When** the workflow completes, **Then** `specs/specifications/` contains architecture, API endpoints, and data model documentation.
3. **Given** the workflow is dispatched with depth "comprehensive", **When** the workflow completes, **Then** `specs/specifications/` contains full functional specifications, technical specifications, and cross-referenced documentation.
4. **Given** a documentation URL is provided, **When** the workflow runs, **Then** the external documentation is fetched and incorporated as additional context for the LLM generation.
5. **Given** the workflow encounters an error (clone failure, LLM error, push failure), **When** the error occurs, **Then** the job status is updated to FAILED with a descriptive error message.

### Edge Cases

- What happens when spec generation is triggered but `specs/specifications/` already exists in the target repo? The system should detect existing specs and offer to overwrite or merge, defaulting to overwrite with a warning in the job output.
- What happens when the documentation URL is unreachable? The workflow should proceed without external docs and note in the job output that the URL was inaccessible.
- What happens when the user navigates away from the board during generation? The job continues running; the badge state is restored from polling when the user returns.
- What happens when two spec generation jobs are dispatched concurrently? The system should prevent concurrent spec generation jobs for the same project (conflict guard).
- What happens when the setup page is accessed by a non-owner member? Only the project owner should see and interact with Step 2; members should be redirected to the board.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a Step 2 section on the setup page after the init step completes (configSyncedAt is set), offering spec generation with depth selection, optional documentation URL, and optional additional context.
- **FR-002**: System MUST provide three depth levels for spec generation: Quick (overview only), Standard (architecture + API + data model), and Comprehensive (full functional + technical specs).
- **FR-003**: System MUST dispatch a background workflow when the user clicks "Generate Specs", passing project ID, job ID, selected depth, documentation URL, additional context, target repository, and agent type.
- **FR-004**: System MUST redirect the user to the board after clicking either "Generate Specs" or "Skip for now".
- **FR-005**: System MUST display a progress badge in the board header while spec generation is in progress, showing "Generating specs..." with a pulse indicator.
- **FR-006**: System MUST update the progress badge to "Specs ready" when the job completes, then fade the badge after 30 seconds.
- **FR-007**: System MUST display a dismissable banner on the board when the project has no generated specs, explaining their value and offering a "Generate" button.
- **FR-008**: The "Generate" button on the board banner MUST open a modal with the same fields as the setup Step 2 (depth picker, documentation URL, additional context).
- **FR-009**: System MUST prevent concurrent spec generation jobs for the same project.
- **FR-010**: System MUST allow the job status to be tracked via polling from the frontend.
- **FR-011**: The setup page MUST NOT offer re-initialization when the project is already configured (configSyncedAt is set).
- **FR-012**: The retro-spec workflow MUST commit generated `specs/specifications/` files to the target repository's default branch.
- **FR-013**: When a documentation URL is provided, the workflow MUST fetch and incorporate the external documentation as additional context for generation.
- **FR-014**: When the documentation URL is unreachable, the workflow MUST proceed without it and report the inaccessibility in the job output.
- **FR-015**: Only the project owner MUST be able to trigger spec generation (consistent with existing setup page access control).
- **FR-016**: The banner dismiss action MUST be session-scoped — the banner reappears on new sessions if specs still don't exist.

### Key Entities

- **Spec Generation Job**: Represents a running or completed spec generation operation. Tracks project association, selected depth, job status (pending/running/completed/failed), documentation URL, additional context, and timestamps.
- **Depth Level**: An enumeration of generation scope — Quick, Standard, or Comprehensive — determining the breadth and detail of generated specifications.
- **Generated Specifications**: The output artifact committed to the target repository under `specs/specifications/`, containing project documentation scaled to the selected depth.

### Internal Processes

- **Retro-Spec Workflow**: Triggered when the user clicks "Generate Specs" from either the setup page Step 2 or the board banner modal. Receives project ID, job ID, depth level, optional documentation URL, optional additional context, target repository, and agent type.
  - **Input**: Project ID, job ID, depth (quick/standard/comprehensive), documentation URL (optional), additional context (optional), target repository (owner/repo format), agent type (CLAUDE/CODEX)
  - **Phases**:
    1. Report job status as RUNNING
    2. Clone the target repository
    3. Read existing codebase structure, config.yml, CLAUDE.md, and constitution.md
    4. If documentation URL provided, fetch external documentation content
    5. Execute the retro-spec skill/command with depth and context parameters
    6. Generate `specs/specifications/` directory with content scaled to the chosen depth
    7. Commit and push generated files to the repository's default branch
    8. Report job status as COMPLETED
  - **Output**: `specs/specifications/` directory committed to the target repository; job status updated to COMPLETED with artifact summary
  - **Error behavior**: On failure at any phase, report job status as FAILED with a descriptive error message. The workflow is not automatically retryable — the user can re-trigger from the board banner. Partial results are not committed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Project owners can generate specifications for an existing codebase within the estimated time for their chosen depth level (Quick ~5 min, Standard ~10 min, Comprehensive ~20 min).
- **SC-002**: After spec generation, health scan spec-sync returns actionable results instead of SKIPPED for 100% of projects with generated specs.
- **SC-003**: 90% of users who see the Step 2 prompt choose to generate specs rather than skip (measured over the first 30 days).
- **SC-004**: Users can track spec generation progress from the board without leaving the page or manually checking external systems.
- **SC-005**: The board banner conversion rate (users who click "Generate" from the banner after initially skipping) is at least 20% within 7 days.
- **SC-006**: Spec generation completes successfully (no FAILED jobs) for at least 95% of dispatched workflows.
- **SC-007**: Users complete the entire flow (onboard init → generate specs → land on board) in under 2 minutes of active interaction time (excluding background generation).

## Assumptions

- The existing onboarding workflow infrastructure (GitHub Actions dispatch, job status polling, credential management) is reusable for spec generation without significant modification.
- The retro-spec skill/command will be created as a new skill alongside existing skills (ai-board.specify, ai-board.plan, etc.).
- External documentation URLs are publicly accessible or accessible with the owner's credentials — no additional authentication mechanism is needed for fetching docs.
- The `specs/specifications/` directory structure follows the existing convention visible in the project's own `specs/specifications/` directory.
- Session-scoped banner dismissal uses standard browser session storage — no server-side persistence is needed for the dismiss state.
