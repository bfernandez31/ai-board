# Feature Specification: Token Saving via RTK + Unified Per-Ticket Run Settings

**Feature Branch**: `AIB-851-copy-of-token`
**Created**: 2026-06-04
**Status**: Draft
**Input**: User description: "Token saving via RTK + unified per-ticket Run settings"

## Auto-Resolved Decisions

- **Decision**: Token saving toggle editability — editable at any stage (not locked to INBOX like policy/agent), since it is a run-time optimization with no impact on ticket workflow semantics
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3) — description does not specify editability timing; other overrides have stage locks
- **Fallback Triggered?**: Yes — AUTO confidence too low; promoted to CONSERVATIVE
- **Trade-offs**: Allows last-minute toggling before any stage run, but prevents accidental mid-run changes (setting only affects future runs, not in-progress ones)
- **Reviewer Notes**: Confirm that toggling token saving mid-workflow (e.g., ON for BUILD, OFF for VERIFY) is an acceptable user flow

---

- **Decision**: Clone and copy behavior — when cloning or copying a ticket, the token saving override is preserved (copied to the new ticket), consistent with how policy and agent overrides are handled
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3) — description mentions cloning for A/B comparison but does not specify whether the override copies
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE
- **Trade-offs**: Preserving overrides enables the described A/B comparison workflow; users can still change the clone's setting post-copy
- **Reviewer Notes**: Verify that the existing clone mechanism already copies nullable override fields; if not, this is a new behavior to implement

---

- **Decision**: Unified dialog behavior for locked settings — when a ticket is past INBOX, agent and clarification policy sections appear as read-only (displaying the effective value) rather than being hidden, so users can see all run settings in one place
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Low (0.3) — description says "same stage-based editability rules" but does not specify read-only vs hidden for past-stage fields
- **Fallback Triggered?**: Yes — AUTO promoted to CONSERVATIVE; showing read-only is more cautious than hiding (no information loss)
- **Trade-offs**: Increases dialog visual density slightly; prevents confusion about what settings are active
- **Reviewer Notes**: Ensure read-only sections have clear visual distinction (dimmed/disabled state) and a tooltip explaining why editing is locked

---

- **Decision**: Token saving applies to iterate runs — since iterate executes a Claude agent during VERIFY stage and the description scopes token saving to "Claude agent runs on the standard workflow stages," iterate is included
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — iterate is a standard Claude workflow stage, and the description's scope wording ("standard workflow stages") encompasses it
- **Fallback Triggered?**: No
- **Trade-offs**: Maximizes token savings coverage; no risk since RTK has automatic fallback on failure
- **Reviewer Notes**: Confirm iterate workflow uses the same agent dispatch path as BUILD/VERIFY

---

- **Decision**: Token saving indicator shows three states — active, inactive, and fallback — rather than a simple on/off, so that RTK installation or activation failures are distinguishable from "deliberately off"
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6) — description requires fallback to be "visible in the job information"; three states make this unambiguous
- **Fallback Triggered?**: No
- **Trade-offs**: Slightly more complex display, but essential for diagnosing why savings did not occur on a run where the setting was enabled
- **Reviewer Notes**: Validate that the fallback state is actionable (e.g., tooltip or detail text explains what failed)

## User Scenarios & Testing

### User Story 1 - Enable Token Saving for a Project (Priority: P1)

A project owner navigates to project settings and finds a new "Token Saving" card. The card explains that enabling this setting compresses large command outputs during Claude agent runs, reducing token consumption. The owner toggles the setting ON and saves. All future Claude agent runs on tickets in this project (that do not override the setting) will use token-saving compression.

**Why this priority**: This is the foundational setting — without the project-level toggle, no token saving can occur. It gates the entire Feature 1 value.

**Independent Test**: Can be fully tested by toggling the setting in project settings and verifying the value persists across page reloads. Delivers the ability to opt a project into token saving.

**Acceptance Scenarios**:

1. **Given** a project with token saving OFF (default), **When** the owner opens project settings, **Then** a "Token Saving" card is visible with the toggle in the OFF position and a description of what the setting does.
2. **Given** the project settings page is open, **When** the owner toggles token saving ON and saves, **Then** the setting persists and displays as ON on subsequent visits.
3. **Given** a project with token saving ON, **When** the owner toggles it back to OFF and saves, **Then** future runs proceed without token-saving compression.
4. **Given** a non-owner project member, **When** they view project settings, **Then** the token saving card is visible but the toggle is not editable (owner-only control).

---

### User Story 2 - Override Token Saving at Ticket Level (Priority: P1)

A user opens the ticket detail view and accesses the unified "Run settings" dialog from the kebab menu. In the Token Saving section, the dialog shows the inherited project default and allows the user to override it (force ON, force OFF, or use project default). This override applies only to this ticket's future runs.

**Why this priority**: Per-ticket override is essential for the A/B comparison workflow described in the acceptance criteria and enables granular control. Together with Story 1, this completes the token-saving configuration surface.

**Independent Test**: Can be tested by setting a ticket override, running a job, and verifying the override is reflected in job details. Delivers per-ticket token saving control.

**Acceptance Scenarios**:

1. **Given** a project with token saving OFF and a ticket with no override, **When** the user opens Run settings, **Then** the Token Saving section shows "OFF (project default)".
2. **Given** a project with token saving ON, **When** the user sets the ticket override to OFF and saves, **Then** subsequent runs on this ticket do not use token-saving compression.
3. **Given** a ticket with a token saving override set, **When** the user changes the override back to "Use project default", **Then** the ticket inherits the project setting for subsequent runs.
4. **Given** a ticket at any stage (INBOX through SHIP), **When** the user opens Run settings, **Then** the Token Saving toggle is editable regardless of stage.

---

### User Story 3 - Unified Run Settings Dialog (Priority: P1)

A user opens the ticket detail view and clicks the kebab menu. Instead of seeing three separate "Edit Policy", "Edit Agent", "Edit Models" items, they see a single "Run settings" item. Clicking it opens a unified dialog with sections for Agent, Models (per stage), Clarification Policy, and Token Saving. Each section shows the inherited project default and whether an override is set. The kebab menu retains only "Run settings", "Simple copy", and "Full clone" as menu items.

**Why this priority**: The UX consolidation is a prerequisite for adding token saving to the dialog without further expanding the kebab menu. It also addresses the existing scalability concern with adding more per-ticket settings.

**Independent Test**: Can be tested by verifying the kebab menu structure, opening the unified dialog, and confirming all four setting sections are present and functional. Delivers a cleaner, more scalable settings UX.

**Acceptance Scenarios**:

1. **Given** a ticket detail view, **When** the user opens the kebab menu, **Then** they see exactly three items: "Run settings", "Simple copy", and "Full clone" (with Full clone shown only for stages that have branches).
2. **Given** the unified dialog is open on an INBOX ticket, **When** the user views the dialog, **Then** all four sections (Agent, Models, Clarification Policy, Token Saving) are present and editable per their respective rules.
3. **Given** the unified dialog is open on a BUILD-stage ticket, **When** the user views the dialog, **Then** Agent and Clarification Policy sections are visible but read-only (locked past INBOX), while Models and Token Saving remain editable.
4. **Given** a section shows the project default, **When** the user sets an override and saves, **Then** the section updates to show the override value and an "(override)" indicator.
5. **Given** all overrides are removed (set to "Use project default"), **When** the user views the dialog, **Then** all sections show inherited values with "(project default)" labels.

---

### User Story 4 - Token Saving Active During Agent Runs (Priority: P2)

When a Claude agent run is dispatched on a ticket where the effective token saving setting is ON, the workflow runner installs and activates RTK (output compression tool) before invoking the agent. Command outputs during the run are semantically compressed, reducing token consumption. If RTK installation or activation fails, the run proceeds without compression (graceful fallback).

**Why this priority**: This is the runtime behavior that delivers actual token savings. It depends on Stories 1-2 for configuration but is the core value driver.

**Independent Test**: Can be tested by running a BUILD job on a ticket with token saving ON and verifying in job details that token saving was active. Delivers measurable token savings on agent runs.

**Acceptance Scenarios**:

1. **Given** a ticket with token saving effectively ON, **When** a BUILD job is dispatched for a Claude agent, **Then** the agent run completes successfully with RTK active and job details indicate "Token saving: Active".
2. **Given** a ticket with token saving effectively OFF, **When** a BUILD job is dispatched, **Then** the run behaves identically to today and job details indicate "Token saving: Inactive".
3. **Given** a ticket with token saving effectively ON but RTK installation fails, **When** the job runs, **Then** the run completes normally without compression and job details indicate "Token saving: Fallback" with an explanation.
4. **Given** a non-Claude agent (Codex, Gemini, Mistral) on a ticket with token saving ON, **When** a job is dispatched, **Then** the agent runs without RTK (no effect) and job details reflect that token saving is not applicable for this agent type.

---

### User Story 5 - Compare Token Savings Between Cloned Tickets (Priority: P2)

A user clones a ticket (Full clone), toggles token saving ON for one and OFF for the other, runs the same stage on both, and then compares job telemetry (input tokens, cache tokens, peak/avg context) between the two runs to quantify real token savings from RTK compression.

**Why this priority**: This is the measurement and validation workflow. It depends on Stories 1-4 being functional and uses existing telemetry — no new estimation machinery needed.

**Independent Test**: Can be tested by cloning a ticket, setting different token saving states, running jobs, and comparing the telemetry values in job details. Delivers evidence-based validation of token savings.

**Acceptance Scenarios**:

1. **Given** two cloned tickets (one with token saving ON, one OFF), **When** both complete a BUILD job, **Then** each job's detail view shows whether token saving was active, alongside standard telemetry metrics (input tokens, cache tokens, peak/avg context, cost).
2. **Given** a cloned ticket, **When** the user changes its token saving override, **Then** the override change does not affect the original ticket's setting.
3. **Given** completed jobs on both tickets, **When** the user views job telemetry for both, **Then** the token saving indicator makes it clear which run used compression, enabling direct comparison.

---

### User Story 6 - Token Saving Badge in Header Status Strip (Priority: P3)

When token saving is effectively ON for a ticket, a compact icon badge appears in the ticket header status strip (alongside existing policy and agent badges). Hovering over the badge shows a tooltip explaining the setting. This provides at-a-glance visibility of the token saving state without opening the Run settings dialog.

**Why this priority**: This is a visibility enhancement that improves discoverability but is not required for core functionality.

**Independent Test**: Can be tested by enabling token saving for a ticket and verifying the badge appears in the header strip with the correct tooltip. Delivers quick visual indicator of the active optimization.

**Acceptance Scenarios**:

1. **Given** a ticket where token saving is effectively ON, **When** the user views the ticket detail, **Then** a token saving badge is visible in the header status strip.
2. **Given** a ticket where token saving is effectively OFF (or unset and project default is OFF), **When** the user views the ticket detail, **Then** no token saving badge appears.
3. **Given** the token saving badge is visible, **When** the user hovers over it, **Then** a tooltip indicates whether the setting is from a ticket override or inherited from the project default.

---

### Edge Cases

- What happens when the project default changes while a ticket has an override? The ticket override continues to take precedence; removing the override re-inherits the new project default.
- What happens if RTK is activated but encounters an unrecoverable error mid-run? RTK operates as a pre-tool hook with automatic fallback to full output per command; individual command failures do not cascade.
- What happens when a ticket is cloned (Simple copy) vs. Full clone? Simple copy creates a new ticket in INBOX with the token saving override copied; Full clone also copies the branch and spec files.
- What happens if a user toggles token saving between stages on the same ticket? Each run uses the effective setting at dispatch time; in-progress runs are not affected by subsequent changes.
- What happens when the agent type is changed from Claude to a non-Claude agent on a ticket with token saving ON? Token saving has no effect on non-Claude agents; the setting is preserved but functionally inert, and the job indicates "not applicable."

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a project-level "Token Saving" setting, accessible in project settings, that defaults to OFF and can be toggled ON/OFF by the project owner.
- **FR-002**: System MUST support a per-ticket token saving override that follows the same nullable inheritance pattern as clarification policy and agent overrides (three states: force ON, force OFF, inherit from project default).
- **FR-003**: System MUST resolve the effective token saving setting for a ticket using the chain: ticket override > project default > OFF (global fallback).
- **FR-004**: When the effective token saving setting is ON for a Claude agent run, the workflow runner MUST install and activate RTK (output compression tool) before invoking the agent.
- **FR-005**: When the effective token saving setting is OFF, or the agent is not Claude, the workflow runner MUST NOT install or invoke RTK; runs MUST behave identically to current behavior.
- **FR-006**: If RTK installation or activation fails, the run MUST proceed without compression; the system MUST NOT fail, degrade, or retry the run due to a token-saving failure.
- **FR-007**: Each completed job MUST record whether token saving was active, inactive, or fell back for that run, visible in job details.
- **FR-008**: The ticket detail kebab menu MUST contain exactly three items: "Run settings", "Simple copy", and "Full clone" (with Full clone conditional on branch-bearing stages).
- **FR-009**: The "Run settings" dialog MUST group all per-ticket execution overrides in sections: Agent, Models (per stage), Clarification Policy, and Token Saving.
- **FR-010**: Each section in the Run settings dialog MUST display the inherited project default and clearly indicate whether an override is set, using "(override)" and "(project default)" labels.
- **FR-011**: Agent and Clarification Policy sections MUST be editable only when the ticket is in INBOX stage; they MUST appear as read-only in later stages. Models and Token Saving sections MUST remain editable per their current and defined rules respectively.
- **FR-012**: The ticket header status strip MUST show a compact icon badge with tooltip when token saving is effectively ON for the ticket, consistent with existing policy and agent badges.
- **FR-013**: When a ticket is cloned (Simple copy or Full clone), the token saving override MUST be preserved on the new ticket.
- **FR-014**: Token saving MUST apply to all Claude agent stages: SPECIFY, PLAN, BUILD, VERIFY (including iterate), and quick-impl. Non-Claude agents are unaffected.
- **FR-015**: Existing per-ticket override behavior for policy, agent, and models MUST remain unchanged — the consolidation is UX-only, not a change of semantics.

### Key Entities

- **Token Saving Setting (Project)**: A project-level boolean flag indicating whether token-saving compression is enabled by default for that project's Claude agent runs. Controlled by the project owner.
- **Token Saving Override (Ticket)**: A per-ticket nullable override of the project default. Three states: ON (force enabled), OFF (force disabled), or null (inherit from project). Follows the same inheritance pattern as clarification policy and agent.
- **Token Saving Status (Job)**: A per-job indicator recording whether token saving was active, inactive, or fell back during that run. Used for telemetry comparison and debugging.

### Internal Processes

- **RTK Activation During Agent Run**: Triggered when a Claude agent workflow dispatches a job for a ticket where the effective token saving setting is ON.
  - **Input**: Effective token saving flag (resolved from ticket override > project default), agent type, job ID
  - **Phases**:
    1. Check effective token saving setting — if OFF or agent is not Claude, skip entirely (zero overhead)
    2. Download and install RTK binary from official source
    3. Activate RTK as a Claude Code PreToolUse hook so command outputs are intercepted and compressed
    4. Record activation status on the job (active, inactive, or fallback)
    5. Proceed with normal agent invocation
  - **Output**: Agent run with compressed command outputs (when active), or unmodified run (when inactive/fallback). Job record updated with token saving status.
  - **Error behavior**: Any failure in steps 2-3 triggers graceful fallback — the run continues without compression, and the job is marked with "fallback" status including the reason for failure. The run is never failed or degraded due to token saving errors.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Project owners can enable or disable token saving in project settings within 10 seconds (single toggle interaction).
- **SC-002**: Users can override the token saving setting at ticket level within 15 seconds via the unified Run settings dialog.
- **SC-003**: All Claude agent runs with token saving ON complete successfully with no increase in run failure rate compared to token saving OFF.
- **SC-004**: Job details clearly indicate the token saving status (active/inactive/fallback) for every completed job, enabling direct telemetry comparison between paired runs.
- **SC-005**: The ticket detail kebab menu contains exactly 3 items (down from 5), reducing menu complexity by 40%.
- **SC-006**: All four per-ticket override settings (agent, models, policy, token saving) are accessible from a single dialog, reducing the number of dialog opens needed from 3 to 1 for users managing multiple settings.
- **SC-007**: No regression in existing per-ticket override behavior — policy, agent, and model overrides continue to function identically to their pre-consolidation behavior.
- **SC-008**: When RTK installation or activation fails, 100% of affected runs complete normally via graceful fallback, with the fallback state visible in job details.
