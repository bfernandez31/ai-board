# Feature Specification: AI-Board Claude Code Plugin Package

**Feature Branch**: `AIB-203-copy-of-create`
**Created**: 2026-02-01
**Status**: Draft
**Input**: User description: "Package all ai-board commands, scripts, and templates as a Claude Code plugin for installation on managed projects."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Plugin namespace changed from `speckit.*` to `ai-board.*`
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — workflow compatibility marked as CRITICAL, plus CI/CD reliability concerns
- **Fallback Triggered?**: No — confidence threshold met
- **Trade-offs**:
  1. Renaming requires updating all workflow files (speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, iterate.yml) but provides consistent branding
  2. Existing projects using old command names will need migration, but this is expected during plugin installation
- **Reviewer Notes**: Verify all GitHub Actions workflows are updated to use `ai-board.*` command names before deployment

---

- **Decision**: Plugin-relative path resolution strategy for scripts and templates
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — reliability for CI/CD execution environments
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Commands must dynamically resolve their plugin installation path rather than using hardcoded paths
  2. Adds slight complexity but ensures portability across different project structures
- **Reviewer Notes**: Ensure path resolution works in both local development and GitHub Actions environments

---

- **Decision**: Constitution template copied to `.specify/memory/` only if missing (non-destructive)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — data integrity concern for existing customizations
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves existing project constitutions with customizations
  2. New projects get a starting template without overwriting established configurations
- **Reviewer Notes**: Document this behavior clearly so users understand constitution inheritance

---

- **Decision**: Testing approach follows Testing Trophy (integration tests for plugin installation, unit tests for path resolution utilities)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (0.6) — testing requirements specified in ticket
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Integration tests verify end-to-end plugin installation but are slower
  2. Unit tests provide fast feedback for utility functions
- **Reviewer Notes**: Follow existing test patterns in `tests/integration/` and `tests/unit/` directories

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install AI-Board Plugin on Managed Project (Priority: P1)

A project maintainer wants to add ai-board workflow capabilities to their managed project by installing the ai-board plugin. After installation, all ai-board commands, scripts, and templates become available for use with Claude Code.

**Why this priority**: Core functionality that enables the entire plugin ecosystem. Without installation, no other features work.

**Independent Test**: Can be tested by running the plugin installation command on a fresh project and verifying all expected files and commands are available.

**Acceptance Scenarios**:

1. **Given** a project without ai-board plugin installed, **When** the user runs `/plugin install ai-board`, **Then** all ai-board commands become available in the project's Claude Code environment
2. **Given** a project without ai-board plugin installed, **When** the user runs `/plugin install ai-board`, **Then** all scripts are accessible at `{plugin-path}/scripts/`
3. **Given** a project without ai-board plugin installed, **When** the user runs `/plugin install ai-board`, **Then** all templates are accessible at `{plugin-path}/templates/`
4. **Given** a project without `.specify/memory/constitution.md`, **When** the plugin is installed, **Then** the constitution template is copied to `.specify/memory/constitution.md`
5. **Given** a project with existing `.specify/memory/constitution.md`, **When** the plugin is installed, **Then** the existing constitution file is preserved unchanged

---

### User Story 2 - Execute AI-Board Commands via Plugin (Priority: P2)

A user runs ai-board workflow commands (specify, plan, implement, verify, etc.) on a managed project that has the ai-board plugin installed. The commands execute successfully using plugin-relative paths to scripts and templates.

**Why this priority**: Primary use case after installation. Commands must work correctly with the plugin's resource structure.

**Independent Test**: Can be tested by invoking each ai-board command and verifying it completes without path resolution errors.

**Acceptance Scenarios**:

1. **Given** a project with ai-board plugin installed, **When** the user runs `/ai-board.specify`, **Then** the command successfully loads the spec template from `{plugin-path}/templates/spec-template.md`
2. **Given** a project with ai-board plugin installed, **When** the user runs `/ai-board.plan`, **Then** the command successfully loads the plan template from `{plugin-path}/templates/plan-template.md`
3. **Given** a project with ai-board plugin installed, **When** the user runs `/ai-board.implement`, **Then** the command successfully executes scripts from `{plugin-path}/scripts/bash/`
4. **Given** a project with ai-board plugin installed, **When** any ai-board command executes, **Then** it correctly resolves paths relative to the plugin installation directory

---

### User Story 3 - GitHub Workflows Execute Plugin Commands (Priority: P2)

GitHub Actions workflows (speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, iterate.yml) successfully invoke the renamed ai-board commands when triggered by ai-board stage transitions.

**Why this priority**: Critical for automated workflow execution. Marked as CRITICAL in requirements.

**Independent Test**: Can be tested by triggering each workflow and verifying it invokes the correct ai-board command name.

**Acceptance Scenarios**:

1. **Given** a ticket transitions to SPECIFY stage, **When** speckit.yml workflow triggers, **Then** it invokes `/ai-board.specify` (not `/speckit.specify`)
2. **Given** a ticket transitions to PLAN stage, **When** speckit.yml workflow triggers, **Then** it invokes `/ai-board.plan` (not `/speckit.plan`)
3. **Given** a ticket transitions to BUILD stage, **When** speckit.yml workflow triggers, **Then** it invokes `/ai-board.implement` (not `/speckit.implement`)
4. **Given** a QUICK workflow ticket, **When** quick-impl.yml triggers, **Then** it invokes `/ai-board.quick-impl`
5. **Given** a ticket in VERIFY stage, **When** verify.yml triggers, **Then** it invokes `/ai-board.verify`
6. **Given** a cleanup is triggered, **When** cleanup.yml runs, **Then** it invokes `/ai-board.cleanup`

---

### User Story 4 - Plugin Validation (Priority: P3)

The ai-board plugin passes Claude Code's plugin validation checks, ensuring it can be listed and installed from the plugin registry.

**Why this priority**: Required for distribution but can be validated after core functionality works.

**Independent Test**: Can be tested by running Claude Code's plugin validation command on the plugin package.

**Acceptance Scenarios**:

1. **Given** the ai-board plugin package, **When** plugin validation is run, **Then** the plugin.json is valid
2. **Given** the ai-board plugin package, **When** plugin validation is run, **Then** all referenced command files exist
3. **Given** the ai-board plugin package, **When** plugin validation is run, **Then** all referenced script files exist
4. **Given** the ai-board plugin package, **When** plugin validation is run, **Then** all referenced template files exist

---

### Edge Cases

- What happens when a command references a script that doesn't exist in the plugin? → Return clear error message with the expected path
- How does the system handle plugin installation on a project that already has conflicting ai-board commands? → Warn user and skip conflicting commands
- What happens if the constitution.md template is corrupted or missing from the plugin? → Installation should fail with clear error message before partial installation occurs
- How does path resolution work when the plugin is installed in a non-standard location? → Plugin must detect its own installation path dynamically

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST package all ai-board commands under the `ai-board.*` namespace (replacing `speckit.*` prefix)
- **FR-002**: System MUST include all workflow commands: `ai-board.specify`, `ai-board.plan`, `ai-board.implement`, `ai-board.verify`, `ai-board.tasks`, `ai-board.clarify`, `ai-board.analyze`, `ai-board.checklist`, `ai-board.constitution`
- **FR-003**: System MUST include standalone commands renamed to ai-board namespace: `ai-board.quick-impl`, `ai-board.cleanup`, `ai-board.iterate-verify`
- **FR-004**: System MUST include all bash scripts at `{plugin-path}/scripts/bash/` (common.sh, create-new-feature.sh, create-pr-and-transition.sh, etc.)
- **FR-005**: System MUST include all JavaScript scripts at `{plugin-path}/scripts/` (analyze-slow-tests.js, generate-test-report.js, etc.)
- **FR-006**: System MUST include all templates at `{plugin-path}/templates/` (spec-template.md, plan-template.md, tasks-template.md, summary-template.md, checklist-template.md, agent-file-template.md)
- **FR-007**: System MUST include constitution.md template at `{plugin-path}/memory/`
- **FR-008**: System MUST include plugin manifest at `.claude-plugin/plugin.json` with valid schema
- **FR-009**: Commands MUST resolve scripts and templates using plugin-relative paths (not hardcoded paths)
- **FR-010**: Plugin installation MUST copy constitution.md to `.specify/memory/` only if the target file does not exist
- **FR-011**: System MUST update all internal command references from `speckit.*` to `ai-board.*`
- **FR-012**: Plugin MUST pass Claude Code plugin validation checks

### Key Entities *(include if feature involves data)*

- **Plugin Manifest**: Configuration file (plugin.json) that declares commands, scripts, and resources provided by the plugin
- **Command**: A Claude Code command file (.md) that defines a specific workflow action
- **Script**: Executable file (bash or JavaScript) that commands invoke for automation tasks
- **Template**: Markdown file providing structure for generated artifacts (specs, plans, tasks, etc.)
- **Constitution**: Project-level governance document that defines coding standards and principles

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of existing speckit.* commands have ai-board.* equivalents in the plugin
- **SC-002**: Plugin installation completes successfully on 100% of compatible projects
- **SC-003**: All 6 GitHub workflows (speckit.yml, quick-impl.yml, verify.yml, cleanup.yml, ai-board-assist.yml, iterate.yml) execute successfully with renamed commands
- **SC-004**: Plugin passes validation with zero errors
- **SC-005**: Path resolution works correctly in both local development and GitHub Actions environments
- **SC-006**: Existing projects with custom constitutions retain their customizations after plugin installation
- **SC-007**: Zero breaking changes to workflow execution behavior (only command names change)
