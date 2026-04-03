# Feature Specification: Setup Wizard — Auto-Detection + Questionnaire + File Commit

**Feature Branch**: `AIB-472-setup-wizard-auto`
**Created**: 2026-04-03
**Status**: Draft
**Input**: Ticket AIB-472 — Setup wizard: auto-detection + questionnaire + file commit
**Merges**: AIB-460 + AIB-461 + AIB-462
**Reference**: `specs/specifications/platform-opening-design.md` Section 6

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Partial commit failure handling

- **Decision**: When committing 3 files to the repo, if one or more files fail (e.g., branch protection, permissions), the system rolls back any successfully committed files in the same operation and shows a single consolidated error message with the failure reason. The user can retry the entire commit.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, absScore 4)
- **Fallback Triggered?**: No — netScore positive, CONSERVATIVE selected directly
- **Trade-offs**:
  1. Atomic commit behavior prevents partial configuration states that could confuse workflows
  2. Slight increase in complexity — must track per-file commit results and handle rollback
- **Reviewer Notes**: Verify whether GitHub API supports multi-file commits in a single API call (tree + commit approach) to make atomicity native rather than application-level rollback.

### Decision 2: File already exists — update vs skip

- **Decision**: When a file already exists in the repo (e.g., user re-runs setup), the system fetches the existing file's SHA and performs an update (PUT with SHA). The preview step shows a diff against the existing file so the user understands what will change. The user can choose to skip individual files.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, absScore 4)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Showing diffs adds UX polish and prevents accidental overwrites of customized files
  2. Requires fetching existing file contents for comparison, adding API calls
- **Reviewer Notes**: Confirm that the diff view is sufficient or whether a full merge UI is needed for heavily customized files.

### Decision 3: Supported languages and frameworks scope

- **Decision**: Auto-detection supports the same languages and frameworks defined in the existing config.yml validation schema: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin. Frameworks: Next.js, Express, FastAPI, Django, Flask, Gin, Spring Boot, Quarkus, Micronaut, none. Unsupported stacks fall back to manual entry with "Other" option.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, absScore 4)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Bounded scope keeps detection reliable and maintainable
  2. Users with unlisted stacks must manually fill all fields (still functional, just less convenient)
- **Reviewer Notes**: Validate that the "Other/none" fallback path works end-to-end.

### Decision 4: Default branch only for file commits

- **Decision**: Files are committed exclusively to the repository's default branch (as returned by GitHub API). No branch selection UI is provided in the setup wizard.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, absScore 4)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Simplifies the commit flow and matches the design doc (Section 6)
  2. Users with branch protection on the default branch will see a clear error and must adjust protection rules or commit manually
- **Reviewer Notes**: Error messaging must clearly explain branch protection as the cause and suggest resolution steps.

### Decision 5: Model dropdown options for agent step

- **Decision**: The model dropdown shows a curated list of currently supported models (matching the agent configuration schema). The list is maintained as application configuration, not fetched dynamically from providers.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 4, absScore 4)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Static list is simpler and avoids API key requirements during setup
  2. Must be updated when new models are added
- **Reviewer Notes**: Ensure the model list stays in sync with the config validation schema.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Complete Setup Wizard Flow (Priority: P1)

A user imports a GitHub repository that does not have `.ai-board/config.yml`. After import, they are redirected to the setup wizard at `/projects/[id]/setup`. The wizard pre-fills detected stack information (language, framework, package manager, services, test frameworks, commands) from the repo analysis. The user reviews and corrects the pre-filled values across 4 steps, previews the 3 generated files, optionally edits them inline, and confirms. The files are committed to the repo's default branch, the config is synced to the project database, and the user is redirected to the project board.

**Why this priority**: This is the core end-to-end flow that delivers the complete onboarding experience. Without this, imported projects without config files have no guided setup path.

**Independent Test**: Can be fully tested by importing a repo without config, completing the wizard, and verifying files appear in the repo and config is stored in the database.

**Acceptance Scenarios**:

1. **Given** a newly imported project without `.ai-board/config.yml`, **When** the user is redirected to the setup page, **Then** the wizard loads with auto-detected values pre-filled in the form fields.
2. **Given** a repo with `package.json` containing `next` dependency and `bun.lockb` present, **When** auto-detection runs, **Then** language is pre-filled as TypeScript, framework as Next.js, and package manager as Bun.
3. **Given** the user completes all 4 wizard steps, **When** they reach the review step, **Then** 3 files are generated and displayed in a preview with inline editing capability.
4. **Given** the user confirms the file preview, **When** the commit succeeds, **Then** all 3 files exist in the repo's default branch, the project config is synced to the database, and the user is redirected to the project board.

---

### User Story 2 — Auto-Detection Accuracy (Priority: P2)

The system silently analyzes the target repository via GitHub API at import time to detect the tech stack. Detection covers language (from GitHub language stats), framework (from dependency files), package manager (from lock files), runtime version (from version files), services (from docker-compose or ORM config), test frameworks (from config file presence), and commands (from package.json scripts). All detection is best-effort — partial results are accepted and failures do not block the wizard.

**Why this priority**: Accurate auto-detection reduces manual effort and improves onboarding speed. However, the wizard is still usable with fully manual input, making this an enhancement rather than a blocker.

**Independent Test**: Can be tested by running detection against repos with known stacks and verifying the output matches expectations.

**Acceptance Scenarios**:

1. **Given** a repository with `package.json` listing `express` as a dependency and `package-lock.json` present, **When** auto-detection runs, **Then** the result includes framework: Express, manager: npm.
2. **Given** a repository with `docker-compose.yml` referencing a `postgres:16` image, **When** auto-detection runs, **Then** PostgreSQL is detected as a service with version 16.
3. **Given** a repository with `vitest.config.ts` and `playwright.config.ts`, **When** auto-detection runs, **Then** both Vitest and Playwright are detected as test frameworks.
4. **Given** a repository where GitHub API returns a 404 for `package.json`, **When** auto-detection runs, **Then** framework and commands detection gracefully returns empty results without blocking other detections.
5. **Given** a Python repository with `requirements.txt` and `pytest.ini`, **When** auto-detection runs, **Then** language is Python, and test framework is pytest.

---

### User Story 3 — File Preview and Inline Editing (Priority: P2)

After completing the questionnaire, the user sees a preview of all 3 generated files (config.yml, CLAUDE.md, constitution.md). Each file is displayed in a code editor with syntax highlighting. The user can edit any file's content before confirming the commit. Changes made in the editor are reflected in the final committed files.

**Why this priority**: Inline editing gives users confidence and control over what gets committed to their repo. It prevents the need to immediately edit files after setup.

**Independent Test**: Can be tested by modifying file content in the preview and verifying the committed files match the edited content.

**Acceptance Scenarios**:

1. **Given** the user reaches the review step, **When** the 3 files are displayed, **Then** each file shows syntax-highlighted content in an editable code editor.
2. **Given** the user edits the CLAUDE.md preview to add a custom section, **When** they confirm the commit, **Then** the committed CLAUDE.md includes the user's custom content.
3. **Given** the user makes no edits, **When** they confirm, **Then** the committed files match the generated templates exactly.

---

### User Story 4 — Existing Files Handling (Priority: P3)

When a project already has some or all of the 3 configuration files in the repo, the wizard detects this and adjusts its behavior. For files that exist, it shows a diff between the generated version and the existing version. The user can choose to update or skip each file individually.

**Why this priority**: Edge case that occurs when re-running setup or when partial configuration exists. Important for robustness but not the primary flow.

**Independent Test**: Can be tested by running the wizard on a repo that already has `.ai-board/config.yml` and verifying the diff is shown and skip option works.

**Acceptance Scenarios**:

1. **Given** a project where `.ai-board/config.yml` already exists, **When** the user navigates to the setup page, **Then** the wizard detects the existing file and shows a diff in the preview step.
2. **Given** the user chooses to skip updating an existing file, **When** they confirm, **Then** that file is not modified in the repo while other files are committed normally.
3. **Given** all 3 files already exist and the user skips all, **When** they confirm, **Then** no commits are made and the user is redirected to the board.

---

### User Story 5 — Error Handling for Commit Failures (Priority: P3)

When the file commit fails due to insufficient permissions, branch protection rules, or network errors, the system displays a clear, actionable error message. The user's form data and file edits are preserved so they can retry after resolving the issue.

**Why this priority**: Error resilience is important for production quality but represents an exception path rather than the primary flow.

**Independent Test**: Can be tested by simulating a commit failure (e.g., token without write access) and verifying the error message and retry behavior.

**Acceptance Scenarios**:

1. **Given** the user's GitHub token lacks write access to the repo, **When** the commit is attempted, **Then** a clear error message explains the permission issue and suggests re-authorizing with the correct scope.
2. **Given** the default branch has branch protection requiring PR reviews, **When** the commit is attempted, **Then** the error message explains that branch protection is blocking direct commits and suggests temporarily adjusting rules or committing via PR manually.
3. **Given** a commit fails, **When** the user returns to the review step, **Then** their edited file contents and form data are preserved for retry.

---

### Edge Cases

- What happens when the GitHub API rate limit is exceeded during auto-detection? → Detection returns partial results; wizard proceeds with whatever was detected. A warning banner informs the user that some detections may be incomplete.
- What happens when the repo is empty (no files at all)? → Auto-detection returns empty results for all fields. The wizard loads with all fields blank for manual entry. File commit still works (creates the files as the first commit).
- What happens when the user navigates away mid-wizard? → Form state is not persisted. Returning to the setup page starts fresh with auto-detection re-running.
- What happens when two users try to set up the same project simultaneously? → The second commit will fail with a SHA mismatch (GitHub API rejects stale SHA). The user sees an error and can retry, which fetches the updated SHA.
- What happens when the user's session expires during setup? → Standard auth redirect to login page. After re-authentication, the user is redirected back to the setup page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST analyze a GitHub repository via API to detect language, framework, package manager, runtime version, services, test frameworks, and commands without cloning the repo.
- **FR-002**: Auto-detection MUST be non-blocking — partial results are accepted and individual detection failures do not prevent the wizard from loading.
- **FR-003**: System MUST provide a setup wizard at `/projects/[id]/setup` with 4 sequential steps: Stack, Services, Commands, and Agent configuration.
- **FR-004**: Wizard form fields MUST be pre-filled with auto-detection results where available, and users MUST be able to modify any pre-filled value.
- **FR-005**: System MUST generate 3 files from the completed questionnaire: `.ai-board/config.yml`, `CLAUDE.md`, and `.ai-board/constitution.md`.
- **FR-006**: System MUST display all 3 generated files in a preview with syntax highlighting and inline editing capability before committing.
- **FR-007**: System MUST commit all files atomically to the repository's default branch via GitHub API on user confirmation.
- **FR-008**: System MUST sync the committed config.yml contents to the project database after a successful commit.
- **FR-009**: System MUST redirect the user to the project board after successful commit and config sync.
- **FR-010**: System MUST detect existing files in the repo and allow the user to skip updating individual files during the preview step.
- **FR-011**: System MUST display a diff view when a file already exists in the repo, showing differences between the generated and existing versions.
- **FR-012**: System MUST display clear, actionable error messages when commits fail due to permissions, branch protection, or other GitHub API errors.
- **FR-013**: System MUST preserve user form data and file edits when a commit fails, allowing retry without re-entering information.
- **FR-014**: System MUST skip the setup wizard and redirect to the board when the project already has a synced config.

### Key Entities

- **DetectionResult**: Represents the output of repo auto-analysis — contains detected language, framework, package manager, runtime version, services, test frameworks, and commands. Each field is optional (detection is best-effort).
- **SetupWizardState**: Represents the user's progress through the 4-step questionnaire — contains stack choices, service selections, command definitions, and agent configuration. Drives file generation.
- **GeneratedFile**: Represents a file to be committed — contains file path, generated content, existing content (if file exists in repo), existing SHA (for updates), and user-edited content. Three instances per setup: config.yml, CLAUDE.md, constitution.md.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users complete the full setup wizard (from page load to successful commit) in under 3 minutes for repos where auto-detection succeeds.
- **SC-002**: Auto-detection correctly identifies the primary language and package manager for at least 90% of repositories that use supported stacks.
- **SC-003**: 95% of setup wizard completions result in a successful file commit on the first attempt (excluding repos with branch protection).
- **SC-004**: Zero projects are left in an inconsistent state (files committed but config not synced, or partial file commits) after setup completion.
- **SC-005**: Users who complete the wizard can immediately run their first ai-board workflow without additional manual configuration.

## Assumptions

- The user has already imported the project (Section 5 of platform-opening-design.md) and their GitHub OAuth token has `repo` scope with write access.
- The GitHub API Contents endpoint supports the necessary operations (read, create, update) for the 3 target file paths.
- The existing config validation schema (`lib/validations/config.ts`) covers all fields needed for the generated config.yml.
- The existing config sync mechanism (`lib/config-sync.ts`) can be reused after the commit step to store the config in the database.
- Auto-detection does not require cloning the repository — all analysis is performed via GitHub REST API.
