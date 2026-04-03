# Feature Specification: [Compliance] Fix 2 violations - Security-First Design

**Feature Branch**: `AIB-486-compliance-fix-2`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Health scan found 2 compliance violations for principle 'Security-First Design' in lib/validations/config.ts"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

### Decision 1: Strip service credentials before DB storage and API response

- **Decision**: Service credentials (`username`, `password`) in the `services` array must be stripped before storing config in the database and before returning it in API responses, following the same pattern already used for the `env` section.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 9) — compliance/security keywords dominate with zero conflicting signals
- **Fallback Triggered?**: No — AUTO naturally recommended CONSERVATIVE due to strong security signals
- **Trade-offs**:
  1. Service credentials will no longer be available in stored config or API responses; any workflow that previously relied on reading them from the stored config will need to fetch them from the original YAML source
  2. No timeline impact — straightforward field stripping following an existing pattern
- **Reviewer Notes**: Verify that no downstream workflow reads `username`/`password` from the stored config JSON. The original YAML in the repository remains the source of truth for credentials.

### Decision 2: Replace `.passthrough()` with `.strict()` on ProjectConfigSchema

- **Decision**: Replace `.passthrough()` with `.strict()` so that unknown fields are rejected by Zod validation rather than silently persisted. Unknown fields already generate warnings; this change elevates them to validation errors.
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 9) — the constitution explicitly requires validating ALL user inputs; passthrough undermines this guarantee
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Config files with typos or unsupported fields will now fail validation instead of passing with warnings, which is stricter but safer — prevents unvalidated data from reaching the database
  2. Users with config files containing extra fields will receive clear validation errors guiding them to fix their config
- **Reviewer Notes**: Confirm that no known config files intentionally use extra root-level fields. The `collectUnknownFieldWarnings` function can remain for informational purposes but `.strict()` will handle enforcement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Service Credentials Are Never Exposed (Priority: P1)

A project owner syncs their project config that includes service credentials (e.g., database username and password). The system validates the config, strips all sensitive service fields before storage, and returns a sanitized config in the API response.

**Why this priority**: Directly addresses the security violation — sensitive credentials must never be exposed in API responses or persisted unnecessarily in the database.

**Independent Test**: Can be fully tested by submitting a config with service credentials via the sync endpoint and verifying the response and stored data contain no `username` or `password` fields.

**Acceptance Scenarios**:

1. **Given** a valid config YAML with services containing `username` and `password` fields, **When** the config is synced via POST /api/projects/:id/config/sync, **Then** the API response `config.services` entries contain only `type`, `version`, and `database` — no `username` or `password` fields.
2. **Given** a valid config YAML with services containing `username` and `password` fields, **When** the config is stored in the database, **Then** the stored JSON does not contain `username` or `password` in any service entry.
3. **Given** a valid config YAML with services that do NOT contain `username` or `password`, **When** the config is synced, **Then** the behavior is unchanged — services are stored and returned normally.

---

### User Story 2 - Unknown Config Fields Are Rejected (Priority: P1)

A project owner submits a config YAML that contains fields not defined in the schema (e.g., a typo like `commads` instead of `commands`). The system rejects the config with a clear validation error instead of silently storing unvalidated data.

**Why this priority**: Directly addresses the second compliance violation — all user inputs must be fully validated before processing.

**Independent Test**: Can be fully tested by submitting a config with an extra unknown field and verifying the sync endpoint returns a 400 validation error.

**Acceptance Scenarios**:

1. **Given** a config YAML with an unknown root-level field (e.g., `extra_field: value`), **When** the config is synced, **Then** the system returns a validation error indicating the unknown field is not permitted.
2. **Given** a config YAML with only known, valid fields, **When** the config is synced, **Then** validation passes and the config is stored normally.
3. **Given** a config YAML with an unknown field in a known section (e.g., `runtime.extra: value`), **When** the config is synced, **Then** the system returns a validation error for the unknown nested field.

---

### Edge Cases

- What happens when a service entry has `username` but not `password` (or vice versa)? Only the present credential field is stripped; validation still passes.
- What happens when existing stored configs in the database contain old `username`/`password` data? Existing data is not retroactively cleaned — only future syncs produce sanitized output. A data migration may be considered separately.
- What happens when a config previously relied on `.passthrough()` to store extra fields? Those configs will now fail validation. Users must remove unrecognized fields.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST strip `username` and `password` fields from each service entry before storing config in the database.
- **FR-002**: System MUST strip `username` and `password` fields from each service entry before returning config in API responses.
- **FR-003**: System MUST reject config files that contain fields not defined in the schema, returning descriptive validation errors.
- **FR-004**: System MUST continue to accept and process all fields that ARE defined in the schema without behavior changes.
- **FR-005**: System MUST provide clear error messages when unknown fields are detected, identifying the specific field name and its location.

### Key Entities

- **ProjectConfig**: The validated configuration object for a project. After this change, it will use strict validation (no unknown fields) and service entries will have credentials stripped before persistence.
- **ServiceConfig**: Individual service definitions within a project config. The `username` and `password` fields remain in the Zod schema for validation purposes but are stripped before storage and API exposure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of config sync operations strip service credentials before database storage and API response — no `username` or `password` fields appear in stored config JSON or sync responses.
- **SC-002**: 100% of config files containing unknown fields are rejected with descriptive validation errors rather than silently stored.
- **SC-003**: All existing valid config files (containing only known fields and no credentials) continue to sync successfully with no behavior change.
- **SC-004**: Validation error messages clearly identify the unknown field name and location, enabling users to self-correct within one attempt.
