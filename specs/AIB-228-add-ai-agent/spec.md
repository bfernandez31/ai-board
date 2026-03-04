# Feature Specification: Add AI Agent Selection to Data Model (Ticket + Project)

**Feature Branch**: `AIB-228-add-ai-agent`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "Add AI agent selection to data model — allow each ticket to specify which AI agent executes its workflows, with project-level defaults."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Agent enum values limited to CLAUDE and CODEX for initial release; extensible by adding new enum values later (e.g., GEMINI)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 6) — all signals neutral/positive, no conflicting buckets
- **Fallback Triggered?**: No — AUTO resolved to CONSERVATIVE with high confidence
- **Trade-offs**:
  1. Starting with two values keeps scope tight and avoids speculative design for agents that don't exist yet
  2. Adding a new enum value later requires a database migration, but this is a standard low-risk operation
- **Reviewer Notes**: Confirm CODEX is the correct label for the OpenAI agent (vs. "OPENAI" or "GPT")

---

- **Decision**: Ticket `agent` field is nullable (null = inherit project default) rather than required with explicit default
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 6) — inheritance pattern is well-established in this codebase (see `clarificationPolicy` on Ticket)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Nullable field with inheritance keeps existing ticket creation simple — no breaking changes
  2. Requires resolution logic at workflow dispatch time to determine effective agent
- **Reviewer Notes**: The same inheritance pattern already exists for `clarificationPolicy` (ticket nullable → project default → system fallback), so this is a proven approach

---

- **Decision**: Project `defaultAgent` field defaults to CLAUDE, making migration backward-compatible with zero data changes
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 6) — the system is currently 100% Claude Code, so CLAUDE is the only correct default
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Existing projects automatically get CLAUDE as default — no user action needed
  2. Users who want CODEX must explicitly update their project settings
- **Reviewer Notes**: Verify that all existing workflow dispatch logic can handle agent selection before enabling CODEX in the UI

---

- **Decision**: Project update API (`PATCH /api/projects/[projectId]`) will be extended to accept `defaultAgent` alongside existing `clarificationPolicy` and `deploymentUrl` fields
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 6) — project update endpoint already exists and follows established patterns
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Extending existing endpoint is simpler than creating a new one
  2. No breaking changes to existing API consumers
- **Reviewer Notes**: Ensure validation rejects invalid agent values and that the field is optional in the update schema

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Owner Sets Default Agent (Priority: P1)

A project owner wants to configure which AI agent handles all new tickets in their project by default. They navigate to project settings and select their preferred agent (e.g., CODEX instead of CLAUDE).

**Why this priority**: This is the foundational configuration that enables agent selection for all tickets. Without it, the system has no way to assign non-default agents.

**Independent Test**: Can be fully tested by updating a project's default agent via the API and verifying the value persists. Delivers immediate value by allowing per-project agent configuration.

**Acceptance Scenarios**:

1. **Given** a project with no explicit `defaultAgent` set, **When** the project is fetched, **Then** the response includes `defaultAgent: "CLAUDE"` (database default)
2. **Given** a project owner updates `defaultAgent` to `CODEX`, **When** the project is fetched again, **Then** the response shows `defaultAgent: "CODEX"`
3. **Given** a non-owner member attempts to update `defaultAgent`, **When** the request is sent, **Then** the system rejects with an authorization error

---

### User Story 2 - Ticket Inherits Project Default Agent (Priority: P1)

When a new ticket is created without specifying an agent, it inherits the project's default agent. The system can determine the effective agent for any ticket by checking the ticket-level override first, then falling back to the project default.

**Why this priority**: This inheritance behavior is the core mechanism that makes agent selection work. Tickets must resolve their effective agent correctly.

**Independent Test**: Can be tested by creating a ticket without an agent field and verifying the effective agent matches the project default.

**Acceptance Scenarios**:

1. **Given** a project with `defaultAgent: CODEX` and a ticket created without specifying `agent`, **When** the ticket is fetched, **Then** `agent` is `null` and the effective agent resolves to `CODEX` via the project
2. **Given** a project with `defaultAgent: CLAUDE`, **When** a ticket is created with `agent: CODEX`, **Then** the ticket's `agent` field is `CODEX`, overriding the project default
3. **Given** a ticket with `agent: null`, **When** the project's `defaultAgent` changes from `CLAUDE` to `CODEX`, **Then** the ticket's effective agent changes to `CODEX` (inheritance is dynamic)

---

### User Story 3 - Ticket Creator Overrides Agent (Priority: P2)

A user creating or editing a ticket wants to specify a different AI agent than the project default for that particular ticket. They select the agent during ticket creation or update it later.

**Why this priority**: Agent override provides flexibility for individual tickets but depends on the default agent infrastructure from P1 stories.

**Independent Test**: Can be tested by creating a ticket with an explicit agent value and verifying it persists independently of the project default.

**Acceptance Scenarios**:

1. **Given** a project with `defaultAgent: CLAUDE`, **When** a user creates a ticket with `agent: CODEX`, **Then** the ticket is saved with `agent: CODEX`
2. **Given** a ticket with `agent: CODEX`, **When** the user updates it to `agent: null`, **Then** the ticket falls back to the project default
3. **Given** a ticket in INBOX stage, **When** the user updates the `agent` field, **Then** the update succeeds (agent is editable in INBOX)

---

### Edge Cases

- What happens when an invalid agent value is submitted? The system rejects with a validation error listing valid options.
- What happens to existing tickets after migration? They retain `agent: null`, inheriting the project default of `CLAUDE`. No data loss or behavior change.
- What happens if a ticket specifies an agent that the project doesn't support yet (e.g., workflows not implemented for CODEX)? The data model accepts any valid enum value; workflow dispatch logic (out of scope) is responsible for handling unsupported agents.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an agent selection with at least two options: CLAUDE and CODEX
- **FR-002**: Projects MUST have a default agent setting that applies to all tickets unless overridden
- **FR-003**: New projects MUST default to CLAUDE as the agent, ensuring backward compatibility
- **FR-004**: Tickets MUST allow an optional agent override that takes precedence over the project default
- **FR-005**: When a ticket has no agent override, the system MUST resolve the effective agent from the project's default
- **FR-006**: The ticket creation flow MUST accept an optional agent selection
- **FR-007**: The ticket update flow MUST allow changing or clearing the agent override
- **FR-008**: The project settings update flow MUST allow changing the default agent
- **FR-009**: System MUST validate that agent values are one of the allowed options
- **FR-010**: Database migration MUST preserve all existing data with CLAUDE as the default for existing projects
- **FR-011**: All API responses for tickets MUST include the agent field (null when not overridden)
- **FR-012**: All API responses for projects MUST include the defaultAgent field

### Key Entities *(include if feature involves data)*

- **Agent**: An enumeration representing supported AI agents (CLAUDE, CODEX). Extensible for future agents.
- **Project.defaultAgent**: The agent assigned to all tickets in a project by default. Required, defaults to CLAUDE.
- **Ticket.agent**: An optional override specifying which agent handles this specific ticket. When null, inherits from project.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All existing projects continue to function identically after migration — zero regressions in ticket creation, updates, or workflow dispatch
- **SC-002**: Users can set a project's default agent and see the change reflected immediately in project settings
- **SC-003**: Users can override the agent on individual tickets during creation or editing
- **SC-004**: 100% of API endpoints that return ticket or project data include the new agent fields
- **SC-005**: Invalid agent values are rejected with clear validation errors before reaching the database

## Assumptions

- The agent enum is purely a data model concern in this ticket; workflow dispatch logic to route to different agents will be handled in a subsequent ticket
- The `agent` field on tickets follows the same editability rules as `clarificationPolicy` (editable in INBOX stage)
- No UI changes are included in this ticket — this is a data model and API-only change
- The CODEX agent label is the agreed-upon identifier for OpenAI's agent offering
