# Feature Specification: Add Agent Selector UI on Tickets and Project Settings

**Feature Branch**: `AIB-235-add-agent-selector`
**Created**: 2026-03-04
**Status**: Draft
**Input**: User description: "Let users choose which AI agent (Claude Code or Codex) handles a ticket, with a project-level default."
**Depends On**: AIB-228 (Agent data model — already implemented)

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Agent selector follows the same UI pattern as the existing clarification policy selector — card component in project settings with a dropdown, and a dropdown field in ticket creation/edit forms
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) — neutral feature context with no strong directional signals
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5 threshold, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Reusing proven UI patterns ensures consistency and reduces implementation risk
  2. No novel interaction patterns introduced, which limits innovation but guarantees usability
- **Reviewer Notes**: Verify that the clarification policy card pattern is the desired UX for agent selection; an alternative could be a simpler inline toggle since there are only two options

---

- **Decision**: Agent selection is locked (read-only) once a ticket leaves INBOX stage, consistent with the existing clarification policy editability rule
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) — follows established pattern but no explicit confirmation
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Prevents mid-workflow agent changes that could cause confusion or partial execution issues
  2. Users who realize they picked the wrong agent must move the ticket back to INBOX first
- **Reviewer Notes**: Confirm this matches the intended behavior from the ticket description ("Agent selection should be possible before moving to SPECIFY or BUILD, not after workflow starts")

---

- **Decision**: Agent badge on ticket cards uses a small text label (e.g., "Claude" or "Codex") rather than an icon, since the two agents do not have universally recognizable icons
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) — multiple valid display approaches
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Text labels are immediately understandable without a legend; icons could be more compact but require learning
  2. Labels take slightly more horizontal space on ticket cards
- **Reviewer Notes**: If branded icons become available for Claude and Codex, revisit this decision to use icons instead

---

- **Decision**: When a ticket has no explicit agent override (inherits project default), the ticket card shows the effective agent with a visual indicator that it is inherited (e.g., muted styling or a small "default" label)
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (score 1) — UX decision with no explicit guidance
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Distinguishing inherited vs. explicit helps users understand what happens if the project default changes
  2. Adds slight visual complexity to ticket cards
- **Reviewer Notes**: Ensure the inherited indicator is subtle enough not to clutter the board view

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project Owner Configures Default Agent in Settings (Priority: P1)

A project owner navigates to project settings and selects which AI agent should handle tickets by default. This setting applies to all new tickets that don't specify an explicit agent override.

**Why this priority**: The project-level default is the foundation for agent selection. All tickets inherit from this setting, making it the highest-impact configuration point.

**Independent Test**: Can be fully tested by navigating to project settings, changing the default agent dropdown, and verifying the selection persists after page refresh. Delivers value by allowing project-wide agent configuration.

**Acceptance Scenarios**:

1. **Given** a project with default agent set to CLAUDE, **When** the owner opens project settings, **Then** the agent selector shows CLAUDE as the current selection
2. **Given** the owner changes the default agent to CODEX, **When** the change is saved, **Then** the settings page reflects the updated selection and a success indicator appears
3. **Given** a non-owner project member views project settings, **When** they see the agent selector, **Then** it is read-only (members cannot change project defaults)

---

### User Story 2 - User Selects Agent During Ticket Creation (Priority: P1)

When creating a new ticket, the user sees an agent dropdown pre-populated with the project's default agent. They can change it to a different agent or leave the default.

**Why this priority**: Ticket creation is the primary point where agent selection happens. Users need to see and optionally change the agent before any workflow begins.

**Independent Test**: Can be tested by opening the new ticket modal, verifying the agent dropdown shows the project default, changing it to a different agent, creating the ticket, and confirming the selected agent is saved.

**Acceptance Scenarios**:

1. **Given** a project with default agent CLAUDE, **When** the user opens the new ticket modal, **Then** the agent dropdown shows CLAUDE as the pre-selected value
2. **Given** the user changes the agent to CODEX in the new ticket modal, **When** they submit the ticket, **Then** the created ticket has agent set to CODEX
3. **Given** the user leaves the agent dropdown at its default, **When** they submit the ticket, **Then** the created ticket inherits the project default (agent is null)

---

### User Story 3 - User Edits Agent on an INBOX Ticket (Priority: P2)

A user wants to change the agent on an existing ticket that is still in the INBOX stage. They open the ticket, see the current agent selection, and change it.

**Why this priority**: Editing is secondary to creation but essential for correcting mistakes or adapting to new information before work begins.

**Independent Test**: Can be tested by opening an INBOX-stage ticket, changing the agent dropdown, saving, and confirming the update persists.

**Acceptance Scenarios**:

1. **Given** an INBOX ticket with agent set to CODEX, **When** the user opens the ticket detail view, **Then** the agent dropdown shows CODEX and is editable
2. **Given** the user changes the agent from CODEX to CLAUDE, **When** they save, **Then** the ticket's agent is updated to CLAUDE
3. **Given** a ticket in SPECIFY stage, **When** the user opens the ticket detail view, **Then** the agent dropdown is read-only and cannot be changed

---

### User Story 4 - User Sees Agent Badge on Board Ticket Cards (Priority: P2)

When viewing the kanban board, each ticket card displays a small badge or label indicating which agent is assigned. This provides at-a-glance visibility without opening the ticket.

**Why this priority**: Visual feedback on the board improves workflow awareness but is not required for agent selection to function.

**Independent Test**: Can be tested by viewing the board with tickets assigned to different agents and verifying each card shows the correct agent label.

**Acceptance Scenarios**:

1. **Given** a ticket with agent explicitly set to CODEX, **When** the board is displayed, **Then** the ticket card shows a "Codex" badge
2. **Given** a ticket with no explicit agent (inherits CLAUDE from project), **When** the board is displayed, **Then** the ticket card shows a "Claude" indicator with inherited/default styling
3. **Given** tickets with mixed agents on the board, **When** the user scans the board, **Then** they can visually distinguish which agent handles each ticket

---

### User Story 5 - User Selects Agent in Quick-Impl Modal (Priority: P3)

When using the quick-implementation path (dragging a ticket directly to BUILD), the quick-impl confirmation modal includes an agent selector so the user can choose which agent handles the quick implementation.

**Why this priority**: Quick-impl is a secondary workflow path; the modal already confirms the action, so adding agent selection is a natural extension but lower priority than the main flows.

**Independent Test**: Can be tested by dragging an INBOX ticket to BUILD, verifying the quick-impl modal shows an agent dropdown, selecting an agent, and confirming the ticket is created with the chosen agent.

**Acceptance Scenarios**:

1. **Given** a user drags an INBOX ticket to BUILD, **When** the quick-impl modal appears, **Then** it includes an agent dropdown defaulting to the project's default agent
2. **Given** the user changes the agent in the quick-impl modal, **When** they confirm, **Then** the ticket's agent is set to the selected value

---

### Edge Cases

- What happens when the project default agent changes after tickets are created? Tickets with no explicit agent override dynamically inherit the new default; tickets with an explicit override are unaffected.
- What happens if only one agent is available? The selector still shows the dropdown with the single option — no special "hide when only one" logic, as this simplifies the UI and prepares for future agents.
- What happens to the agent field on tickets moved back to INBOX from a later stage? The agent becomes editable again, allowing the user to change it before re-starting the workflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project settings MUST display an agent selector allowing the project owner to set the default agent
- **FR-002**: The agent selector in project settings MUST show the current default agent value on load
- **FR-003**: Changes to the default agent in project settings MUST persist immediately via the existing project update endpoint
- **FR-004**: The ticket creation form MUST include an agent dropdown pre-populated with the project's default agent
- **FR-005**: When a user creates a ticket without changing the agent dropdown, the ticket MUST be saved with agent as null (inheriting the project default)
- **FR-006**: When a user explicitly selects an agent during ticket creation, the ticket MUST be saved with that agent value
- **FR-007**: The ticket edit view MUST display the agent dropdown as editable only when the ticket is in INBOX stage
- **FR-008**: The ticket edit view MUST display the agent as read-only when the ticket is in any stage other than INBOX
- **FR-009**: Ticket cards on the board MUST display the effective agent as a small badge or label
- **FR-010**: Ticket cards MUST visually distinguish between explicitly set agents and inherited (project default) agents
- **FR-011**: The quick-impl confirmation modal MUST include an agent dropdown defaulting to the project's default agent
- **FR-012**: Only project owners MUST be able to change the project default agent; members see it as read-only

### Key Entities *(include if feature involves data)*

- **Agent (enum)**: Represents supported AI agents — CLAUDE and CODEX. Already exists in the data model (AIB-228).
- **Project.defaultAgent**: The project-level default agent. Already exists as a required field defaulting to CLAUDE.
- **Ticket.agent**: Optional ticket-level agent override. Null means inherit from project. Already exists as a nullable field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can change the project default agent in settings and see the updated value reflected within 2 seconds
- **SC-002**: 100% of new tickets display the project default agent as the pre-selected value in the creation form
- **SC-003**: Users can visually identify the assigned agent for every ticket on the board without opening the ticket
- **SC-004**: Agent selection is prevented on tickets that have left INBOX stage — zero unauthorized agent changes on in-progress tickets
- **SC-005**: All existing tickets and projects continue to function identically — zero regressions from UI changes

## Assumptions

- The Agent data model (enum, fields, validation, API support) is fully implemented by AIB-228 and available on the main branch
- The UI follows established patterns from the clarification policy selector (card component in settings, dropdown in forms)
- Only two agents exist (CLAUDE, CODEX); the UI should accommodate future additions but does not need to handle dynamic agent lists
- Agent editability rules mirror clarification policy rules: editable in INBOX, read-only in all other stages
- The quick-impl modal already exists and can be extended with an additional dropdown field
