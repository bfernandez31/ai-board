# Feature Specification: Project Config in DB + Dynamic Workflow Dispatch

**Feature Branch**: `AIB-478-project-config-in`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User description: "Project config in DB + dynamic workflow dispatch"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Config Staleness Threshold

- **Decision**: Auto-refresh config before workflow dispatch when last sync exceeds 1 hour, as stated in the ticket description
- **Policy Applied**: CONSERVATIVE (AUTO fallback — low confidence)
- **Confidence**: Low (0.3) — absScore 1, netScore -1, fallback triggered due to confidence < 0.5
- **Fallback Triggered?**: Yes — AUTO recommended PRAGMATIC but confidence was too low, promoted to CONSERVATIVE
- **Trade-offs**:
  1. 1-hour threshold balances freshness against unnecessary API calls; projects with rapid config changes may see brief staleness windows
  2. Auto-refresh adds latency to dispatch if config is stale (one GitHub API call)
- **Reviewer Notes**: Confirm 1-hour staleness window is acceptable for all project types. Consider whether config changes mid-workflow could cause issues.

### Decision 2: Config Sync Failure During Dispatch

- **Decision**: If config auto-refresh fails before dispatch (GitHub API error, invalid YAML), the system blocks the dispatch and surfaces a clear error rather than silently using stale config
- **Policy Applied**: CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — no explicit guidance in ticket description
- **Fallback Triggered?**: Yes — CONSERVATIVE chosen to prevent dispatching with potentially outdated or invalid configuration
- **Trade-offs**:
  1. Blocking on sync failure prevents workflows from running with wrong service inputs, avoiding hard-to-debug failures
  2. Temporary GitHub API outages could block all dispatches until config is manually re-synced or API recovers
- **Reviewer Notes**: Consider whether a "use last known good config" fallback is desirable for transient API failures vs. permanent blocking. The conservative approach prevents silent misconfigurations.

### Decision 3: Config Display Scope in Settings UI

- **Decision**: Config is displayed as a read-only, formatted summary in project settings (not raw YAML), showing runtime, services, and key configuration values
- **Policy Applied**: CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — ticket says "read-only display" but doesn't specify format
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Formatted display is more user-friendly and avoids exposing raw YAML structure that users shouldn't manually edit in the UI
  2. Users who want to see the exact YAML must check the repository directly
- **Reviewer Notes**: Validate whether a raw YAML view toggle would be useful for debugging, or if formatted summary is sufficient.

### Decision 4: Default Config for Projects Without config.yml

- **Decision**: Projects without a stored config use backward-compatible defaults: PostgreSQL 16, Bun package manager, no additional services. These defaults match the current hardcoded behavior.
- **Policy Applied**: CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — ticket specifies defaults but not full fallback behavior
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Existing projects continue to work identically without any migration action
  2. New projects that forget to add config.yml will silently get defaults rather than failing with a helpful message
- **Reviewer Notes**: Confirm these defaults match the current production behavior. Consider whether new external projects should require config.yml.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workflow Dispatch with Dynamic Config (Priority: P1)

A project owner triggers a ticket stage transition (e.g., SPECIFY → PLAN → BUILD). The system reads the project's stored configuration from the database and passes the correct service and runtime inputs to the dispatched workflow. The workflow receives the right PostgreSQL version, package manager, and other service flags without any manual intervention.

**Why this priority**: This is the core value of the feature — every workflow dispatch must use the correct project-specific configuration. Without this, workflows run with wrong settings.

**Independent Test**: Can be tested by transitioning a ticket on a project with stored config and verifying the dispatched workflow receives correct service inputs.

**Acceptance Scenarios**:

1. **Given** a project with stored config specifying PostgreSQL 14 and npm, **When** the owner transitions a ticket to BUILD, **Then** the workflow dispatch includes `needs_postgres: true`, `postgres_version: 14`, and the correct package manager input
2. **Given** a project without stored config (null), **When** the owner transitions a ticket to SPECIFY, **Then** the workflow dispatch uses default values (PostgreSQL 16, Bun)
3. **Given** a project with config last synced 2 hours ago, **When** a dispatch is triggered, **Then** the system auto-refreshes the config from GitHub before dispatching
4. **Given** a project with config last synced 30 minutes ago, **When** a dispatch is triggered, **Then** the system uses the cached config without re-fetching

---

### User Story 2 - Config Sync from GitHub (Priority: P2)

A project owner navigates to project settings and clicks "Sync config" to fetch the latest `.ai-board/config.yml` from their GitHub repository. The system retrieves the file, validates the YAML content against the schema, and stores the parsed result in the database. If the YAML is invalid, the system shows a clear validation error.

**Why this priority**: Config must be imported and kept up to date for dynamic dispatch to work. This is the primary mechanism for getting config into the database.

**Independent Test**: Can be tested by clicking "Sync config" on a project with a valid config.yml in its repository and verifying the config appears in settings.

**Acceptance Scenarios**:

1. **Given** a project with a valid `.ai-board/config.yml` in its GitHub repository, **When** the owner clicks "Sync config", **Then** the config is fetched, validated, stored in the database, and the sync timestamp is updated
2. **Given** a project whose repository has invalid YAML in config.yml, **When** the owner clicks "Sync config", **Then** the system displays specific validation errors (e.g., "Invalid postgres_version: must be 14, 15, or 16")
3. **Given** a project whose repository has no `.ai-board/config.yml`, **When** the owner clicks "Sync config", **Then** the system informs the user that no config file was found and suggests creating one
4. **Given** a successful sync, **When** the owner views project settings, **Then** the stored config is displayed in a readable format with the last sync timestamp

---

### User Story 3 - Config Display in Project Settings (Priority: P3)

A project owner views their project settings and sees a read-only display of the project's stored configuration, including runtime details, enabled services, and the last sync timestamp. This gives visibility into what configuration the system will use for workflow dispatches.

**Why this priority**: Provides transparency so owners can verify their config is correct before triggering workflows. Lower priority because it's informational, not functional.

**Independent Test**: Can be tested by viewing project settings for a project with stored config and verifying the display matches the stored data.

**Acceptance Scenarios**:

1. **Given** a project with stored config, **When** the owner views project settings, **Then** the config summary shows runtime (language, framework, package manager), enabled services (with versions), and last sync time
2. **Given** a project without stored config, **When** the owner views project settings, **Then** a message indicates no config has been synced and prompts the user to sync

---

### User Story 4 - Config Import at Project Creation (Priority: P3)

When a project is first imported into the system, the config is automatically fetched from the repository if available. This ensures new projects have their configuration stored from the start.

**Why this priority**: Automation convenience — reduces manual steps for new projects but can be done manually via "Sync config" if automatic import fails.

**Independent Test**: Can be tested by creating a new project pointing to a repository with config.yml and verifying the config is automatically stored.

**Acceptance Scenarios**:

1. **Given** a new project being imported with a valid config.yml in its repository, **When** the project is created, **Then** the config is fetched and stored automatically
2. **Given** a new project being imported without a config.yml, **When** the project is created, **Then** the project is created successfully with null config (no error)

---

### Edge Cases

- What happens when GitHub API is temporarily unavailable during config sync? System returns a clear error and preserves the last known config.
- What happens when config.yml exists but contains unsupported service types? Validation rejects with specific field-level errors.
- What happens when config changes between auto-refresh and workflow completion? The workflow uses the config that was current at dispatch time; mid-run changes take effect on next dispatch.
- What happens when multiple dispatches trigger auto-refresh simultaneously? Only one refresh should execute; concurrent requests use the result of the completed refresh.
- What happens when a project's repository is deleted or access is revoked? Config sync fails with a clear permissions/access error; existing stored config remains usable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store project configuration as structured data alongside each project record, with fields for the parsed config content and the timestamp of last synchronization
- **FR-002**: System MUST provide a mechanism for project owners to manually trigger a config sync from their repository's `.ai-board/config.yml` file
- **FR-003**: System MUST validate config content against the defined schema during every sync operation and reject invalid configurations with specific, actionable error messages
- **FR-004**: System MUST automatically refresh stale config (older than 1 hour) before dispatching any workflow
- **FR-005**: All workflow dispatch paths (ticket transitions, AI-board assist, rollback-reset, deploy preview, health scans, iterate) MUST read the project's stored config and pass the correct service inputs to the dispatched workflow
- **FR-006**: System MUST map config service declarations to workflow service inputs (e.g., a project declaring PostgreSQL 14 results in `needs_postgres: true` and `postgres_version: 14` in dispatch inputs)
- **FR-007**: System MUST use backward-compatible defaults (PostgreSQL 16, Bun) when a project has no stored config
- **FR-013**: `setup-environment.sh` MUST handle ORM setup (detect, generate, migrate) based on project files — workflow YAML files MUST NOT hardcode ORM-specific commands (e.g., `npx prisma generate`, `npx prisma migrate deploy`). This centralizes database tooling in one place so projects using different ORMs or no ORM work without workflow changes.
- **FR-014**: `package_manager` MUST NOT be passed as a workflow dispatch input — `setup-environment.sh` already reads `runtime.manager` directly from the cloned repository's `config.yml`. The dispatch only passes service container inputs (`needs_*`, `*_version`).
- **FR-008**: System MUST display the stored config in a read-only format within project settings, including the last sync timestamp
- **FR-009**: System MUST attempt to fetch and store config automatically when a new project is imported
- **FR-010**: System MUST block workflow dispatch and surface a clear error when auto-refresh fails (rather than dispatching with stale or missing config)
- **FR-011**: Config storage MUST be additive — existing projects without config continue to function identically with no migration action required (nullable fields)
- **FR-012**: Only project owners and authorized members MUST be able to trigger config sync operations

### Key Entities

- **Project Config**: The parsed representation of a project's `.ai-board/config.yml`, stored as structured data on the project record. Contains runtime settings (language, framework, package manager), service declarations (database types and versions), and agent preferences. Nullable — absence indicates no config has been synced.
- **Config Sync Timestamp**: Records when the project's config was last successfully fetched from the repository. Used to determine staleness for auto-refresh decisions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All workflow dispatches for projects with stored config include the correct service inputs matching the project's configuration, with zero mismatches
- **SC-002**: Config sync completes within 5 seconds for valid configurations
- **SC-003**: Invalid config files produce user-understandable validation errors identifying the specific fields and allowed values
- **SC-004**: Existing projects without config experience no behavioral changes — workflows dispatch with the same defaults as before this feature
- **SC-005**: Config auto-refresh triggers only when the stored config is older than the staleness threshold, avoiding unnecessary API calls on consecutive dispatches
- **SC-006**: Project owners can view their stored config and last sync time from project settings within one click
