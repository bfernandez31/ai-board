# Feature Specification: Define .ai-board/config.yml Schema and Validation

**Feature Branch**: `AIB-449-define-ai-board`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "Define .ai-board/config.yml schema and validation — a declarative config file for external project support"

## Auto-Resolved Decisions

### Decision 1: Required vs Optional Fields

- **Decision**: `version`, `project.name`, `project.language`, `runtime.manager`, and `commands.install` are required. All other fields are optional with sensible defaults or skip behavior.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — the ticket specifies "All fields have sensible defaults or are explicitly required" but doesn't enumerate which. The schema comments and rules section distinguish required infrastructure (version, project identity, package manager, install command) from optional tooling (lint, type_check, test_e2e).
- **Fallback Triggered?**: No — CONSERVATIVE was the AUTO recommendation at this confidence level.
- **Trade-offs**:
  1. Requiring fewer fields lowers onboarding friction for new projects but risks incomplete configs that silently skip critical steps.
  2. Requiring more fields catches misconfigurations early but increases setup burden for simple projects.
- **Reviewer Notes**: Confirm that `commands.install` should be required (some projects may not need an install step). Verify that `project.framework` being optional is acceptable — workflows may need it for framework-specific behavior later.

### Decision 2: Validation Error Format

- **Decision**: Validation errors are returned as structured objects containing the field path, error type (missing_required, invalid_value, invalid_type, unknown_field), and a human-readable message. Multiple errors are collected and returned together (not fail-on-first).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — the ticket says "clear, actionable error messages" without specifying format. Collecting all errors at once is standard validation practice and more user-friendly than stopping at the first error.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Collecting all errors requires a full validation pass but gives users a complete picture of what to fix.
  2. Structured error objects are more useful for programmatic consumers (workflows) than plain strings.
- **Reviewer Notes**: Decide if warnings (non-blocking) should also be supported (e.g., deprecated field names in future schema versions).

### Decision 3: Unknown Fields Handling

- **Decision**: Unknown top-level keys or unknown keys within known sections produce a warning but do not fail validation. This supports forward compatibility — older validators won't reject configs written for newer schema versions.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — not addressed in the ticket. CONSERVATIVE favors permissive parsing to avoid blocking workflows on harmless extra fields.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Permissive parsing prevents breakage when config evolves but may hide typos (e.g., `comands` instead of `commands`).
  2. Strict parsing catches typos but creates upgrade friction across schema versions.
- **Reviewer Notes**: Consider adding a "did you mean?" suggestion for unknown keys that are close to known keys (Levenshtein distance ≤ 2).

## User Scenarios & Testing

### User Story 1 - Valid Config Parsing (Priority: P1)

A project owner creates a `.ai-board/config.yml` file in their repository with all required fields. When a workflow runs, the validation utility successfully parses the file and returns a typed configuration object that workflows can use to set up the environment.

**Why this priority**: This is the core functionality — without successful parsing of valid configs, nothing else works. Every workflow execution depends on this.

**Independent Test**: Can be fully tested by providing a valid YAML file and verifying the parsed output matches expected typed values. Delivers the foundation for all workflow configuration.

**Acceptance Scenarios**:

1. **Given** a `.ai-board/config.yml` with all required fields populated, **When** the validation utility parses it, **Then** it returns a typed configuration object with all values correctly mapped.
2. **Given** a config with only required fields (no optional sections), **When** the utility parses it, **Then** it returns defaults for omitted optional fields and marks optional commands as skippable.
3. **Given** a config with all sections fully populated, **When** the utility parses it, **Then** every field is present in the output with correct types.

---

### User Story 2 - Invalid Config Produces Actionable Errors (Priority: P1)

A project owner creates a config file with errors (missing required fields, invalid enum values, wrong types). The validation utility returns clear, specific messages explaining exactly what is wrong and how to fix it.

**Why this priority**: Equally critical to parsing — users will inevitably make mistakes and need guidance. Poor error messages create support burden and block adoption.

**Independent Test**: Can be tested by providing various malformed configs and verifying each produces the correct error message(s) with field path and suggested fix.

**Acceptance Scenarios**:

1. **Given** a config missing the `version` field, **When** validated, **Then** the error message states: "Missing required field 'version'. Add 'version: 1' at the top of your config."
2. **Given** a config with `project.language: ruby` (unsupported value), **When** validated, **Then** the error states the field path, invalid value, and lists allowed values.
3. **Given** a config with multiple errors, **When** validated, **Then** all errors are returned together (not just the first one).
4. **Given** a config with `runtime.node: 22` (number instead of string), **When** validated, **Then** the error explains the expected type and shows the correct format.

---

### User Story 3 - Missing Config File Detection (Priority: P2)

A workflow attempts to run against a repository that does not have a `.ai-board/config.yml` file. The workflow fails immediately with a clear message directing the user to create the file.

**Why this priority**: Important for onboarding — new users need to understand that the config file is mandatory before any workflow can run.

**Independent Test**: Can be tested by running validation against a directory without the config file and verifying the specific error message.

**Acceptance Scenarios**:

1. **Given** a target repository without `.ai-board/config.yml`, **When** a workflow attempts to load the config, **Then** it fails with the message: "Missing .ai-board/config.yml — this file is required for ai-board to operate on your project."
2. **Given** a target repository with the file at a wrong path (e.g., `config.yml` at root instead of `.ai-board/config.yml`), **When** validation runs, **Then** the same missing-file error is shown (the utility only looks at the canonical path).

---

### User Story 4 - Optional Commands Gracefully Skipped (Priority: P2)

A project owner defines only `install` and `test_unit` commands, omitting `lint`, `type_check`, and `test_e2e`. When workflows reference the omitted commands, those steps are silently skipped without error.

**Why this priority**: Enables projects with minimal tooling to use ai-board without being forced to set up linting or E2E tests.

**Independent Test**: Can be tested by parsing a config with missing optional commands and verifying the output marks them as undefined/skippable.

**Acceptance Scenarios**:

1. **Given** a config with `commands.lint` omitted, **When** a workflow checks for the lint command, **Then** the config object indicates the command is not defined and the step should be skipped.
2. **Given** a config with only `commands.install` defined, **When** validated, **Then** validation passes without errors — all other commands are optional.

---

### User Story 5 - Schema Version Validation (Priority: P3)

The validation utility checks the `version` field to ensure it matches a supported schema version. If the version is unsupported or missing, a clear error directs the user to update their config.

**Why this priority**: Enables future schema migrations without breaking existing configs. Lower priority because only version 1 exists today.

**Independent Test**: Can be tested by providing configs with version 1 (passes), version 2 (fails with "unsupported version"), and missing version (fails with "required field").

**Acceptance Scenarios**:

1. **Given** a config with `version: 1`, **When** validated, **Then** validation succeeds using the v1 schema rules.
2. **Given** a config with `version: 2`, **When** validated, **Then** validation fails with: "Unsupported config version '2'. Supported versions: 1."
3. **Given** a config with `version: "one"` (string instead of number), **When** validated, **Then** validation fails with a type error.

---

### Edge Cases

- What happens when the YAML file is syntactically invalid (broken indentation, tabs vs spaces)? → The parser produces a clear YAML syntax error with line number.
- What happens when `services` declares an unsupported service type? → A warning is emitted but validation does not fail (forward compatibility).
- What happens when `env` values contain special characters or multi-line strings? → Values are passed through as-is; the YAML parser handles escaping.
- What happens when the config file exists but is empty? → Treated as missing all required fields; all required-field errors are returned.
- What happens when `runtime.node` is specified but `project.language` is `python`? → Allowed without error — some Python projects may need Node for tooling.

## Requirements

### Functional Requirements

- **FR-001**: System MUST define a versioned YAML schema (version 1) for `.ai-board/config.yml` with sections: `version`, `project`, `runtime`, `services`, `commands`, `env`, and `agent`.
- **FR-002**: System MUST require the following fields: `version` (integer), `project.name` (string), `project.language` (enum), `runtime.manager` (enum), and `commands.install` (string).
- **FR-003**: System MUST validate `project.language` against allowed values: `typescript`, `python`, `go`, `rust`, `java`.
- **FR-004**: System MUST validate `project.framework` against allowed values when present: `nextjs`, `express`, `fastapi`, `django`, `gin`, `none`.
- **FR-005**: System MUST validate `runtime.manager` against allowed values: `bun`, `npm`, `yarn`, `pnpm`, `pip`, `poetry`, `cargo`.
- **FR-006**: System MUST validate `agent.cli` against allowed values when present: `claude-code`, `codex`.
- **FR-007**: System MUST treat missing optional commands (`build`, `lint`, `type_check`, `test_unit`, `test_integration`, `test_e2e`) as skippable — no error produced.
- **FR-008**: System MUST collect and return all validation errors at once rather than failing on the first error.
- **FR-009**: System MUST produce error messages that include the field path, the error type, and a human-readable explanation with guidance on how to fix the issue.
- **FR-010**: System MUST fail with a specific error message when `.ai-board/config.yml` is not found: "Missing .ai-board/config.yml".
- **FR-011**: System MUST validate that `version` equals `1` (the only currently supported version) and reject unknown versions with a message listing supported versions.
- **FR-012**: System MUST parse `services` entries and validate each against known service types (`postgres`, `redis`, `mysql`, `mongo`) with their required sub-fields (e.g., `version` is required for each service).
- **FR-013**: System MUST accept `env` as an optional flat key-value map of strings.
- **FR-014**: System MUST emit warnings (not errors) for unknown top-level keys or unknown keys within known sections to support forward compatibility.
- **FR-015**: System MUST return a fully typed configuration object on successful validation, with default values populated for omitted optional fields.

### Key Entities

- **ProjectConfig**: The root configuration object representing a fully validated `.ai-board/config.yml` file. Contains all sections with required fields guaranteed present and optional fields defaulted.
- **ValidationError**: A structured error containing a field path (e.g., `project.language`), error type (e.g., `invalid_value`), the invalid value provided, and a human-readable message.
- **ServiceConfig**: A service entry within the `services` section, representing a sidecar container for GitHub Actions. Contains service type, version, and service-specific configuration (e.g., database name, credentials for Postgres).

## Assumptions

- Only version 1 of the schema will be supported initially. Future versions will be added via new validation logic keyed on the `version` field.
- The validation utility runs in the ai-board repository (not in the target repo) and reads the config file from a provided path.
- Service credentials in the config (e.g., `postgres.password`) are for CI/test environments only — production credentials are never stored in this file.
- The `agent.model` field is a free-form string (not validated against a fixed list) to allow new models without config schema changes.
- `runtime.manager_version`, `runtime.node`, and `runtime.python` are optional strings — when omitted, workflows use their default versions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of valid config files conforming to the documented schema parse successfully without errors.
- **SC-002**: 100% of configs missing required fields produce specific error messages naming the missing field within 1 second of validation.
- **SC-003**: Users can create a valid config file from the schema documentation alone, without needing to reference source code or ask for support.
- **SC-004**: Validation of a config file with 5+ errors returns all errors in a single pass (not one at a time).
- **SC-005**: Repositories without `.ai-board/config.yml` receive the exact error message "Missing .ai-board/config.yml" within the first 10 seconds of workflow execution.
- **SC-006**: Optional commands omitted from the config result in zero errors and zero workflow failures — steps are silently skipped.
