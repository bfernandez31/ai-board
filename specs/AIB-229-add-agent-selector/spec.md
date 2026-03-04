# Feature Specification: Add Agent Selector UI on Tickets and Project Settings

**Feature Branch**: `AIB-229-add-agent-selector`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "Add agent selector UI on tickets and project settings — Let users choose which AI agent (Claude Code or Codex) handles a ticket, with a project-level default."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Agent options limited to the two existing agents (Claude Code and Codex) based on the existing `Agent` enum in the data model. No need for an extensible/dynamic agent list at this stage.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score: -1, absScore: 1) — internal tooling feature with neutral context signals; insufficient signal strength for auto-resolution at higher confidence
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE due to confidence < 0.5
- **Trade-offs**:
  1. Limiting to two hard-coded agents keeps scope tight and aligns with the existing data model
  2. If additional agents are added later, the UI will need updates — acceptable for current needs
- **Reviewer Notes**: If the team plans to add more agents soon, consider whether the UI should support a dynamic agent list from the start

---

- **Decision**: Agent editing is restricted to tickets in the INBOX stage only, consistent with the existing backend enforcement. Once a workflow starts, the agent cannot be changed.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the backend already enforces this constraint; the UI should match
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Prevents mid-workflow agent switching, which could cause inconsistent results
  2. Users must decide on agent before starting any workflow
- **Reviewer Notes**: This aligns with existing backend validation — no additional review needed

---

- **Decision**: When a ticket has no explicit agent set (null), the UI displays the project's default agent with a visual indicator that it is inherited rather than explicitly chosen.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — follows the established inheritance pattern used for clarification policy
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users clearly understand whether the agent is explicitly set or inherited
  2. Adds minor visual complexity to badges and dropdowns
- **Reviewer Notes**: Verify that the inheritance indicator is consistent with the existing clarification policy UI pattern

---

- **Decision**: The agent badge on ticket cards uses a compact format (small icon or abbreviated label) to avoid cluttering the board view.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — board cards have limited space; a compact indicator is standard practice
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Compact badges minimize visual noise on the board
  2. Full agent names may not be visible at a glance — mitigated by tooltips
- **Reviewer Notes**: Ensure badge is accessible (tooltip or aria-label for screen readers)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Agent When Creating a Ticket (Priority: P1)

A project member creates a new ticket and wants to assign a specific AI agent to handle it. When opening the ticket creation form, they see a dropdown defaulting to the project's configured default agent. They can either accept the default or switch to the other agent before submitting.

**Why this priority**: Ticket creation is the primary entry point for agent selection. Without this, users have no way to choose an agent for new work items.

**Independent Test**: Can be fully tested by creating a new ticket with the agent selector set to each available option, then verifying the correct agent is saved and displayed.

**Acceptance Scenarios**:

1. **Given** a project with default agent set to "Claude Code", **When** a user opens the new ticket form, **Then** the agent dropdown shows "Claude Code" as the pre-selected value
2. **Given** a user is creating a ticket, **When** they select "Codex" from the agent dropdown and submit, **Then** the ticket is created with agent set to "Codex"
3. **Given** a user is creating a ticket, **When** they do not change the agent dropdown and submit, **Then** the ticket is created with no explicit agent (inherits project default)

---

### User Story 2 - View Agent on Board Ticket Cards (Priority: P1)

A user viewing the project board wants to quickly identify which agent is assigned to each ticket. Each ticket card displays a small badge or icon indicating the effective agent (either explicitly set or inherited from the project default).

**Why this priority**: Visibility of agent assignment is essential for users to understand workflow routing at a glance. Tied with ticket creation as a core experience.

**Independent Test**: Can be tested by viewing board with tickets that have different agent assignments and verifying correct badges appear.

**Acceptance Scenarios**:

1. **Given** a ticket with agent explicitly set to "Codex", **When** the user views the board, **Then** the ticket card shows a "Codex" badge
2. **Given** a ticket with no explicit agent in a project defaulting to "Claude Code", **When** the user views the board, **Then** the ticket card shows a "Claude Code" badge (indicating inherited)
3. **Given** multiple tickets with different agents, **When** the user scans the board, **Then** each ticket card displays the correct agent indicator

---

### User Story 3 - Edit Agent on Existing Ticket (Priority: P2)

A user realizes they want a different agent for a ticket that is still in the INBOX stage. They open the ticket detail view and change the agent assignment. If the ticket has moved past INBOX, the agent selector is not available for editing.

**Why this priority**: Correcting agent assignment is important but secondary to initial selection. Most users will set the agent correctly at creation time.

**Independent Test**: Can be tested by editing the agent on an INBOX ticket and verifying it updates, then confirming the edit option is hidden for tickets in later stages.

**Acceptance Scenarios**:

1. **Given** a ticket in INBOX stage with agent set to "Claude Code", **When** the user opens the ticket detail and changes the agent to "Codex", **Then** the ticket's agent is updated to "Codex"
2. **Given** a ticket in INBOX stage with an inherited agent, **When** the user explicitly sets the agent to "Claude Code", **Then** the ticket now has an explicit agent override
3. **Given** a ticket in SPECIFY stage, **When** the user opens the ticket detail, **Then** the agent is displayed but cannot be edited
4. **Given** a ticket in INBOX stage, **When** the user changes the agent and another user has also modified the ticket, **Then** the system handles the conflict gracefully (optimistic concurrency)

---

### User Story 4 - Configure Default Agent in Project Settings (Priority: P2)

A project owner navigates to project settings to change the default AI agent for all new tickets. They select the desired agent from a dropdown, and the change takes effect for all future tickets that don't have an explicit agent override.

**Why this priority**: Project-level defaults reduce repetitive selection but are configured less frequently than individual ticket agents.

**Independent Test**: Can be tested by changing the project default agent in settings and then creating a new ticket to verify it inherits the new default.

**Acceptance Scenarios**:

1. **Given** a project with default agent "Claude Code", **When** the owner navigates to settings, **Then** the current default agent is displayed as "Claude Code"
2. **Given** a project owner in settings, **When** they change the default agent to "Codex" and save, **Then** the project's default agent is updated to "Codex"
3. **Given** a project with default agent changed to "Codex", **When** a user creates a new ticket without specifying an agent, **Then** the new ticket form shows "Codex" as the pre-selected agent
4. **Given** existing tickets with no explicit agent, **When** the project default agent is changed, **Then** those tickets' effective agent reflects the new project default

---

### User Story 5 - Agent Selection in Quick-Impl Flow (Priority: P3)

A user drags a ticket directly to BUILD using the quick-impl path. The quick-impl confirmation modal includes an agent selector so the user can choose which agent handles the quick implementation.

**Why this priority**: Quick-impl is an alternative workflow path; agent selection here completes the feature but is lower priority since most tickets go through the standard flow.

**Independent Test**: Can be tested by initiating a quick-impl transition and verifying the agent selector appears and the selected agent is used.

**Acceptance Scenarios**:

1. **Given** a ticket being moved to BUILD via quick-impl, **When** the confirmation modal appears, **Then** an agent selector is visible with the project default pre-selected
2. **Given** a user in the quick-impl modal, **When** they select "Codex" and confirm, **Then** the ticket is updated with agent "Codex" before the workflow starts

---

### Edge Cases

- What happens when a ticket's agent is displayed but the project default has changed since the ticket was created? → The badge shows the ticket's effective agent (explicit override or current project default)
- What if both agents become unavailable in the future? → Out of scope for this feature; the enum is fixed at two values
- How does the agent badge interact with other ticket card badges (priority, clarification policy)? → Agent badge should coexist without overlap, positioned consistently with other metadata indicators

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an agent selector dropdown on the ticket creation form, defaulting to the project's configured default agent
- **FR-002**: System MUST display an agent selector on the ticket detail view that is editable only when the ticket is in the INBOX stage
- **FR-003**: System MUST show the agent selector as read-only (display only) for tickets that have moved past the INBOX stage
- **FR-004**: System MUST display an agent badge/indicator on each ticket card in the board view showing the effective agent
- **FR-005**: System MUST provide a default agent selector in the project settings page, allowing project owners to set the default agent for new tickets
- **FR-006**: System MUST pre-populate the agent dropdown on new tickets with the project's default agent value
- **FR-007**: System MUST visually distinguish between explicitly set agents and inherited (project default) agents on ticket cards and detail views
- **FR-008**: System MUST include an agent selector in the quick-impl confirmation modal
- **FR-009**: System MUST prevent agent modification once a ticket's workflow has started (any stage after INBOX)

### Key Entities

- **Agent**: Represents an AI agent that can handle ticket workflows. Currently two options: Claude Code (CLAUDE) and Codex (CODEX). Each ticket can have an explicit agent or inherit from the project default.
- **Project Default Agent**: A project-level configuration that determines which agent is used for tickets that do not have an explicit agent override. Defaults to Claude Code.
- **Ticket Agent Assignment**: The effective agent for a ticket, resolved by checking the ticket's explicit agent first, then falling back to the project's default agent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select an agent when creating a ticket in under 5 seconds (single dropdown interaction)
- **SC-002**: 100% of ticket cards on the board display the correct effective agent indicator
- **SC-003**: Users can change the project default agent in settings and see the change reflected in new ticket creation forms immediately
- **SC-004**: Agent editing is blocked for 100% of tickets that have moved past the INBOX stage
- **SC-005**: Users can visually distinguish inherited vs. explicitly set agents on ticket cards without additional clicks (badge differentiation)

## Assumptions

- The data model (Agent enum on Ticket and Project) already exists and is fully functional
- Backend API endpoints for creating/updating tickets and projects already accept the agent field
- The agent resolution logic (ticket agent → project default) is already implemented
- The UI follows existing patterns established by the clarification policy feature (badges, edit dialogs, settings cards)
- Only two agents exist (Claude Code and Codex); no dynamic agent registry is needed
