# Feature Specification: Project Import — OAuth Repo Scope + Repo Picker + Creation Flow

**Feature Branch**: `AIB-471-project-import-oauth`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Project import: OAuth repo scope + repo picker + creation flow"

## Auto-Resolved Decisions

### Decision 1: OAuth Scope Granularity

- **Decision**: Request `repo` scope (full repository access) rather than fine-grained scopes like `public_repo` only. The feature requires reading private repos, checking admin rights, and fetching config files — all of which require full `repo` scope.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — OAuth scope expansion is a security-sensitive operation; broader scope is necessary for stated requirements but must be handled carefully.
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE with high confidence due to strong auth/security signals.
- **Trade-offs**:
  1. Full `repo` scope grants broader access than strictly needed for listing repos, but GitHub does not offer a narrower scope that covers private repo content reading + admin check.
  2. Users may hesitate to grant broad repo access; clear consent messaging mitigates this.
- **Reviewer Notes**: Verify that GitHub's current OAuth scope model has no narrower alternative that covers private repo content reads + admin permission checks.

### Decision 2: Token Storage Strategy

- **Decision**: Store the GitHub OAuth access token in the existing `Account` model (already populated by NextAuth sign-in callback) rather than creating a new credential entry. A server-side helper function retrieves the token from the Account record for GitHub API calls.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — Reusing the existing NextAuth Account model avoids duplicating secrets across storage locations.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Single source of truth for the GitHub token, reducing surface area for credential leaks.
  2. If a user revokes OAuth access, the stored token becomes stale — the system must handle 401 responses gracefully.
- **Reviewer Notes**: Confirm the Account model already stores the `access_token` field via NextAuth callbacks. Validate that token refresh/re-consent flow works when scope changes.

### Decision 3: Duplicate Repo Detection Scope

- **Decision**: Block duplicate imports globally (no two projects can reference the same `githubOwner` + `githubRepo` combination), not just per-user. This prevents conflicts where multiple users manage the same repo through different ai-board projects.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — A single repo managed by multiple ai-board projects would cause workflow and branch conflicts.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents workflow collisions and branch name conflicts across projects.
  2. A user who leaves a project cannot re-import the same repo under their own project without the original being deleted first.
- **Reviewer Notes**: Consider whether a future "transfer project ownership" feature should be noted as a follow-up.

### Decision 4: Admin Rights Validation Timing

- **Decision**: Validate that the user has admin rights on the selected repo at selection time (before project creation), not after. This prevents creating orphan project records when the user lacks permissions.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — Fail-fast validation is the secure default for permission checks.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Extra API call at selection time adds slight latency to the import flow.
  2. Prevents database cleanup of partially created projects.
- **Reviewer Notes**: Admin rights are needed for managing repo secrets; confirm this is a hard requirement or if "push" permission suffices for repos without secret management needs.

### Decision 5: Handling Existing Users Without Repo Scope

- **Decision**: When an existing user's token lacks `repo` scope, display a clear prompt explaining why additional permissions are needed and provide a one-click re-authorization button. The Import Project button remains visible but triggers re-authorization if the token lacks scope. The system never silently fails.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — Transparent consent and clear error states are essential for auth scope upgrades.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users must re-authorize, adding friction to first-time import after the feature launches.
  2. Clear messaging builds trust and avoids confusion about why imports fail.
- **Reviewer Notes**: Ensure the re-authorization flow preserves the user's session and returns them to the import modal after consent.

## User Scenarios & Testing

### User Story 1 - Import a Repository with Existing Config (Priority: P1)

A user with an existing GitHub repository that already has `.ai-board/config.yml` wants to bring it into ai-board. They click "Import Project", browse their repos, select one, and are taken directly to the project board with the configuration auto-loaded.

**Why this priority**: This is the core happy path that delivers the primary value — connecting external repos to ai-board with zero manual setup when config already exists.

**Independent Test**: Can be fully tested by importing a repo with a valid `.ai-board/config.yml` and verifying the project appears on the dashboard with config loaded.

**Acceptance Scenarios**:

1. **Given** a signed-in user with `repo` scope granted, **When** they click "Import Project" and select a repo containing `.ai-board/config.yml`, **Then** a new project is created with the repo's config loaded and the user is redirected to the project board.
2. **Given** a signed-in user with `repo` scope granted, **When** they search for a specific repo by name in the picker, **Then** matching repos (personal and organizational) appear in the results showing name, description, visibility, and last push date.
3. **Given** a user selects a repo, **When** the config is fetched and validated, **Then** the project's stored configuration matches the contents of the repo's `.ai-board/config.yml`.

---

### User Story 2 - Import a Repository Without Config (Priority: P1)

A user imports a repo that does not have `.ai-board/config.yml`. After selection, they are redirected to a setup wizard to configure the project.

**Why this priority**: Equal to P1 because most external repos will not have ai-board config initially — this is likely the more common path.

**Independent Test**: Can be tested by importing a repo without `.ai-board/config.yml` and verifying redirect to `/projects/[id]/setup`.

**Acceptance Scenarios**:

1. **Given** a signed-in user with `repo` scope, **When** they import a repo that lacks `.ai-board/config.yml`, **Then** a project is created and the user is redirected to the setup wizard at `/projects/[id]/setup`.
2. **Given** the project was created without config, **When** the user views the project, **Then** the project shows as needing setup and has no config stored.

---

### User Story 3 - OAuth Scope Upgrade for Existing Users (Priority: P2)

An existing user who signed up before this feature has a GitHub token without `repo` scope. When they try to import a project, they are guided through a re-authorization flow to grant the additional scope.

**Why this priority**: Critical for adoption since all existing users will need scope upgrade, but lower than core import flow since it's a one-time friction point.

**Independent Test**: Can be tested by simulating a user session with a token lacking `repo` scope and verifying the re-authorization prompt appears.

**Acceptance Scenarios**:

1. **Given** an existing user whose GitHub token lacks `repo` scope, **When** they click "Import Project", **Then** they see a clear explanation of why additional permissions are needed and a button to re-authorize.
2. **Given** the user completes re-authorization, **When** they return to the app, **Then** their token now has `repo` scope and the repo picker loads successfully.
3. **Given** the user dismisses the re-authorization prompt, **When** they remain on the projects page, **Then** no project is created and they can retry later.

---

### User Story 4 - Duplicate Repo Import Prevention (Priority: P2)

A user attempts to import a repository that is already linked to an existing ai-board project. The system blocks the duplicate and informs the user.

**Why this priority**: Data integrity safeguard; prevents workflow conflicts but is an error-path scenario.

**Independent Test**: Can be tested by attempting to import a repo that is already associated with a project and verifying the error message.

**Acceptance Scenarios**:

1. **Given** a repository is already linked to an ai-board project, **When** any user attempts to import the same repo, **Then** the system displays a message identifying the existing project and prevents creation.
2. **Given** the duplicate is blocked, **When** the user views the picker, **Then** already-imported repos are visually distinguished or filtered from the list.

---

### User Story 5 - Repo Picker Filtering and Pagination (Priority: P3)

A user with many repositories across personal and organizational accounts needs to find a specific repo efficiently using search, org filters, and pagination.

**Why this priority**: UX enhancement that improves the experience for power users with many repos but is not blocking for the core flow.

**Independent Test**: Can be tested by loading the picker for a user with repos across multiple orgs and verifying filter, search, and pagination work correctly.

**Acceptance Scenarios**:

1. **Given** a user with repos in multiple organizations, **When** they open the repo picker and filter by a specific org, **Then** only repos from that organization are displayed.
2. **Given** more than 100 repos match the current filter, **When** the user scrolls or navigates, **Then** additional pages load correctly.
3. **Given** a user types in the search field, **When** they enter a partial repo name, **Then** results filter to matching repos across names and descriptions.

---

### Edge Cases

- What happens when the user's GitHub token is revoked or expired mid-import? → Display an auth error and prompt re-authorization.
- What happens when a repo is deleted on GitHub after being imported? → Existing project remains but workflows will fail with a clear error referencing the missing repo.
- What happens when the user loses admin rights on a repo after import? → Import succeeds (admin was validated at import time); future operations that require admin access fail with an appropriate message.
- What happens when `.ai-board/config.yml` exists but is malformed? → Project is created but config is not stored; user is redirected to setup wizard with a warning about the invalid config.
- What happens when GitHub API rate limits are hit during repo listing? → Display a rate limit message with estimated reset time; allow retry.
- What happens when the user has zero repositories? → Display an empty state in the picker with guidance.

## Requirements

### Functional Requirements

- **FR-001**: System MUST request `repo` scope (in addition to `read:user user:email`) during GitHub OAuth authorization.
- **FR-002**: System MUST persist the GitHub OAuth access token server-side and provide a helper function to retrieve it for authenticated GitHub API calls.
- **FR-003**: System MUST detect when an existing user's token lacks `repo` scope and prompt for re-authorization before allowing import.
- **FR-004**: System MUST provide a repo picker interface that lists the user's GitHub repositories (personal and organizational).
- **FR-005**: Repo picker MUST support search filtering across repository names and descriptions.
- **FR-006**: Repo picker MUST support filtering by organization or personal account.
- **FR-007**: Repo picker MUST display repository name, description, visibility (public/private), and last push date.
- **FR-008**: Repo picker MUST support pagination for users with more than 100 repositories.
- **FR-009**: System MUST validate that the user has admin rights on the selected repository before allowing import.
- **FR-010**: System MUST create a project record with the repository's owner and name upon successful import.
- **FR-011**: System MUST check for `.ai-board/config.yml` in the selected repository after project creation.
- **FR-012**: When config exists and is valid, system MUST fetch, validate, and store it in the project record, then redirect to the project board.
- **FR-013**: When config is missing or invalid, system MUST redirect to the setup wizard at `/projects/[id]/setup`.
- **FR-014**: System MUST prevent importing a repository that is already linked to any existing project (global uniqueness on `githubOwner` + `githubRepo`).
- **FR-015**: The "Import Project" button on the projects page MUST be enabled; the "Create Project" button MUST remain disabled.
- **FR-016**: System MUST handle GitHub API errors gracefully — inaccessible repos, rate limits, network failures, and insufficient permissions MUST produce clear user-facing messages.
- **FR-017**: System MUST enforce subscription-based project quota limits during import (consistent with existing project creation limits).

### Key Entities

- **Project**: Extended with GitHub repository linkage (`githubOwner`, `githubRepo`). Stores imported config. Enforces global uniqueness on repo reference.
- **Account** (NextAuth): Stores the GitHub OAuth access token with updated scope. Used as the source of truth for GitHub API authentication.
- **GitHub Repository** (external): The source repo being imported. Attributes surfaced: name, description, visibility, last push date, user permission level.
- **Project Config**: Optional YAML configuration (`.ai-board/config.yml`) fetched from the repo and stored as structured data in the project record.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can complete the full import flow (click "Import Project" → project visible on board) in under 30 seconds for repos with existing config.
- **SC-002**: 100% of duplicate import attempts are blocked with a clear explanation before any database record is created.
- **SC-003**: Existing users without `repo` scope can successfully upgrade their authorization and import a project in a single session without signing out.
- **SC-004**: Repo picker returns results for users with up to 1,000 repositories without degradation in usability.
- **SC-005**: All error states (rate limit, no admin rights, network failure, malformed config) display actionable user-facing messages within 3 seconds.
- **SC-006**: Zero projects are created in a partial state — every project record either has valid config loaded or is correctly flagged for setup wizard.

## Assumptions

- GitHub's OAuth scope model requires `repo` for private repository content access; no narrower scope exists that covers both repo listing and content reads for private repos.
- The existing NextAuth Account model already stores `access_token` from the GitHub provider callback.
- The setup wizard (`/projects/[id]/setup`) will be implemented as a separate ticket (per platform-opening-design.md Section 6).
- The "Create Project" button (manual creation without GitHub) will be enabled in a future ticket.
- Project quota enforcement logic already exists and can be reused during import.
- The config validation logic from `syncProjectConfig()` can be reused for import-time config processing.
