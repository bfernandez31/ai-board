# Feature Specification: Pass Agent Selection Through Workflow Dispatch Pipeline

**Feature Branch**: `AIB-230-pass-agent-selection`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "Pass agent selection through workflow dispatch pipeline"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether to use a unified payload approach vs. mixed (embed in JSON for full workflows, discrete input for others)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE due to low confidence fallback)
- **Confidence**: Low (score: 0.3 — internal infrastructure feature with no sensitive/compliance signals)
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE because absScore < 3 and confidence < 0.5
- **Trade-offs**:
  1. Mixed approach adds slight inconsistency but respects GitHub Actions 10-input limit constraint
  2. Embedding in existing JSON payloads avoids workflow file restructuring
- **Reviewer Notes**: Verify that the mixed strategy (embed in payload JSON for speckit.yml, add discrete input for others) aligns with team conventions. Confirm the `Agent` enum values are sufficient for current needs.

---

- **Decision**: Default agent value when neither ticket nor project specifies one
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9 — the Prisma schema already defines `Project.defaultAgent` with `@default(CLAUDE)`)
- **Trade-offs**:
  1. Relying on database defaults means the system always has a valid agent value
  2. No additional fallback logic needed beyond ticket → project chain
- **Reviewer Notes**: Confirm that "CLAUDE" remains the correct system-wide default as new agents are added.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full Workflow Receives Agent Selection (Priority: P1)

When a ticket transitions through the full workflow path (INBOX → SPECIFY → PLAN → BUILD), the system reads the ticket's assigned agent (or falls back to the project's default agent) and includes that agent value in every workflow dispatch so the correct CLI tool is invoked.

**Why this priority**: This is the core functionality — without it, workflows cannot invoke the correct agent CLI, making agent selection meaningless.

**Independent Test**: Can be tested by transitioning a ticket with a non-default agent through SPECIFY and verifying the dispatched workflow receives the correct agent value in its inputs.

**Acceptance Scenarios**:

1. **Given** a ticket with `agent = CODEX` in a project with `defaultAgent = CLAUDE`, **When** the ticket transitions to SPECIFY, **Then** the `specifyPayload` JSON dispatched to `speckit.yml` includes `"agent": "CODEX"`.
2. **Given** a ticket with no agent set (`agent = null`) in a project with `defaultAgent = CLAUDE`, **When** the ticket transitions to SPECIFY, **Then** the `specifyPayload` JSON includes `"agent": "CLAUDE"` (project fallback).
3. **Given** a ticket transitioning to BUILD (PLAN → BUILD), **When** the workflow is dispatched, **Then** the `specifyPayload` JSON includes the resolved agent value.

---

### User Story 2 - Quick-Impl Workflow Receives Agent Selection (Priority: P1)

When a ticket uses the quick-impl path (INBOX → BUILD), the system includes the resolved agent value in the `quickImplPayload` JSON so the quick-impl workflow invokes the correct CLI.

**Why this priority**: Quick-impl is a frequently used path that must also respect agent selection.

**Independent Test**: Can be tested by creating a ticket with a specific agent and triggering quick-impl, then verifying the `quickImplPayload` contains the agent.

**Acceptance Scenarios**:

1. **Given** a ticket with `agent = CODEX`, **When** the ticket transitions via quick-impl to BUILD, **Then** the `quickImplPayload` JSON includes `"agent": "CODEX"`.
2. **Given** a ticket with no agent set, **When** quick-impl is triggered, **Then** the `quickImplPayload` JSON includes the project's `defaultAgent` value.

---

### User Story 3 - Supporting Workflows Receive Agent Selection (Priority: P2)

When verify, cleanup, iterate, or AI-BOARD assist workflows are triggered, each receives the resolved agent value as a discrete workflow input.

**Why this priority**: These workflows also invoke agent CLIs but are secondary to the main transition paths.

**Independent Test**: Can be tested by triggering each workflow type and verifying the agent input is present in the dispatch call.

**Acceptance Scenarios**:

1. **Given** a ticket with `agent = CODEX` transitioning to VERIFY (BUILD → VERIFY), **When** the verify workflow is dispatched, **Then** the workflow inputs include `agent: "CODEX"`.
2. **Given** a comment mentioning `@ai-board` on a ticket with `agent = CODEX`, **When** the AI-BOARD assist workflow is dispatched, **Then** the workflow inputs include `agent: "CODEX"`.
3. **Given** a cleanup workflow is triggered for a ticket with no agent set, **When** the cleanup workflow is dispatched, **Then** the workflow inputs include the project's `defaultAgent`.
4. **Given** an iterate workflow is triggered for a ticket with `agent = CODEX`, **When** the iterate workflow is dispatched, **Then** the workflow inputs include `agent: "CODEX"`.

---

### Edge Cases

- What happens when a ticket's agent value is null and the project's defaultAgent is also somehow null? The system should fall back to "CLAUDE" as the system-wide default (matching the Prisma schema default).
- What happens when an invalid or unrecognized agent value is stored? The system should only allow values defined in the Agent enum, enforced at the database level.
- What happens during the CLEAN workflow path? The cleanup workflow should also receive the agent value, resolved from the ticket or project default.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST resolve the effective agent for a ticket by checking the ticket's `agent` field first, then falling back to the project's `defaultAgent`.
- **FR-002**: System MUST include the resolved agent value in the `specifyPayload` JSON when dispatching the SPECIFY workflow (speckit.yml), since that workflow is at the 10-input limit.
- **FR-003**: System MUST include the resolved agent value in the `quickImplPayload` JSON when dispatching the quick-impl workflow.
- **FR-004**: System MUST pass the resolved agent value as a discrete `agent` input when dispatching the verify workflow.
- **FR-005**: System MUST pass the resolved agent value as a discrete `agent` input when dispatching the cleanup workflow.
- **FR-006**: System MUST pass the resolved agent value as a discrete `agent` input when dispatching the iterate workflow.
- **FR-007**: System MUST pass the resolved agent value as a discrete `agent` input when dispatching the AI-BOARD assist workflow.
- **FR-008**: System MUST ensure the `specifyPayload` already includes the `command` input's worth of data (SPECIFY vs PLAN vs BUILD) so the agent is available regardless of which speckit command runs.
- **FR-009**: Each receiving workflow MUST declare and accept the new `agent` input (or parse it from the payload JSON) so the value is accessible to workflow steps.

### Key Entities

- **Agent**: An enum representing the CLI tool to invoke (currently CLAUDE, CODEX). Stored on both tickets (optional, per-ticket override) and projects (required, with system default).
- **Workflow Inputs**: The set of key-value pairs passed to GitHub Actions `workflow_dispatch` events. Subject to a maximum of 10 inputs per workflow.
- **Payload JSON**: A stringified JSON object used as a single workflow input to bundle multiple values when the 10-input limit is reached (e.g., `specifyPayload`, `quickImplPayload`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of agent-invoking workflow dispatches include the resolved agent value (verifiable through dispatch input inspection).
- **SC-002**: Tickets with a specific agent override always dispatch with that agent, never the project default (zero incorrect agent routing).
- **SC-003**: Tickets without an agent override always dispatch with the project's default agent (consistent fallback behavior).
- **SC-004**: No workflow exceeds the GitHub Actions 10-input limit after changes (speckit.yml remains at 10, others remain within limit).

## Assumptions

- The `Agent` enum (CLAUDE, CODEX) is already defined in the Prisma schema and sufficient for current needs.
- The `Ticket.agent` (optional) and `Project.defaultAgent` (required, defaults to CLAUDE) fields already exist in the database.
- The `handleTicketTransition()` function already has access to both ticket and project data (via `TicketWithProject` type).
- The `dispatchAIBoardWorkflow()` function can be extended to accept and pass an `agent` parameter.
- Workflow YAML files can be updated to accept new inputs without breaking existing dispatches (GitHub Actions ignores extra inputs gracefully).
