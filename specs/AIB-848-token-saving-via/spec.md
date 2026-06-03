# Feature Specification: Token saving via RTK + unified per-ticket Run settings

**Feature Branch**: `AIB-848-token-saving-via`  
**Created**: 2026-06-03  
**Status**: Draft  
**Input**: User description: "Token saving via RTK + unified per-ticket Run settings"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Scope token saving to Claude core stage-transition runs only; exclude other agents and auxiliary workflows.
- **Policy Applied**: AUTO resolved with CONSERVATIVE fallback.
- **Confidence**: Low; netScore +1 from reliability/user-facing signals and cost/internal-tool signals.
- **Fallback Triggered?**: Yes; low confidence and conflicting cost-vs-reliability signals favor a bounded scope.
- **Trade-offs**: Reduces rollout risk and avoids changing unrelated agent behavior. Later expansion requires a follow-up ticket.
- **Reviewer Notes**: Confirm which Claude auxiliary commands, if any, should be included after core runs prove stable.

- **Decision**: Ticket token-saving override uses Inherit, Force on, and Force off, editable under the same stage rules as agent and clarification policy.
- **Policy Applied**: AUTO resolved with CONSERVATIVE fallback.
- **Confidence**: Medium; user specified the same override pattern but not every disabled-state detail.
- **Fallback Triggered?**: Yes; follows the narrowest existing per-ticket settings behavior.
- **Trade-offs**: Prevents late-stage run semantics from changing unexpectedly. Users must decide before the ticket leaves INBOX.
- **Reviewer Notes**: Validate whether VERIFY-stage iteration needs a separate override path before implementation.

- **Decision**: The project default applies to future runs for tickets that inherit it; running and completed jobs keep the setting captured at job start.
- **Policy Applied**: AUTO resolved with CONSERVATIVE fallback.
- **Confidence**: Low; timing behavior was not explicit.
- **Fallback Triggered?**: Yes; freezing the run setting protects auditability and reproducible telemetry.
- **Trade-offs**: Mid-run project changes are not retroactive. Users may need to start a new run to compare settings.
- **Reviewer Notes**: Ensure job information clearly distinguishes ticket effective setting from run-captured state.

- **Decision**: Measurement uses existing job telemetry only, plus run-level token-saving status; no new savings estimator is required.
- **Policy Applied**: AUTO.
- **Confidence**: High; the ticket explicitly rejects new estimation machinery.
- **Fallback Triggered?**: No.
- **Trade-offs**: Keeps phase 1 small and grounded in real runs. Savings comparisons require users to compare similar tickets.
- **Reviewer Notes**: Confirm the displayed telemetry fields are enough for users to compare cloned tickets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable token saving for Claude runs (Priority: P1)

A project owner enables token saving as a project default so Claude workflow runs can reduce command-output token usage without changing how users trigger work.

**Why this priority**: This delivers the main cost-saving value while preserving existing workflow behavior when disabled.

**Independent Test**: Can be tested by enabling the project setting, running a Claude BUILD job on an inherited ticket, and verifying the job succeeds with token saving marked active or fallback.

**Acceptance Scenarios**:

1. **Given** a project whose Token saving setting is OFF, **When** the project owner turns it ON and starts a Claude BUILD run on a ticket that inherits project defaults, **Then** the run attempts token saving and the job details show the run-level result.
2. **Given** a Claude run with token saving effectively ON, **When** the token-saving tool activates successfully, **Then** large shell-command outputs are compressed before entering the agent context and the run completes through the normal job lifecycle.
3. **Given** a Claude run with token saving effectively ON, **When** token-saving setup or activation fails, **Then** the run continues normally without token saving and the job details show a fallback state with an understandable reason.

---

### User Story 2 - Override token saving per ticket (Priority: P1)

An authorized project user chooses whether a specific ticket inherits the project default, forces token saving ON, or forces token saving OFF before starting workflow automation.

**Why this priority**: Per-ticket overrides make A/B measurement and exception handling possible without changing the whole project.

**Independent Test**: Can be tested by setting project default OFF, forcing token saving ON on one INBOX ticket, forcing it OFF on another, and confirming each future Claude run captures the expected setting.

**Acceptance Scenarios**:

1. **Given** project Token saving is OFF, **When** an INBOX ticket is set to Force ON and a Claude run starts, **Then** that run treats token saving as enabled for that ticket only.
2. **Given** project Token saving is ON, **When** an INBOX ticket is set to Force OFF and a Claude run starts, **Then** that run behaves as token saving disabled for that ticket.
3. **Given** a ticket is no longer editable for agent or clarification-policy overrides, **When** the user opens Run settings, **Then** the token-saving override is visible but cannot be changed.

---

### User Story 3 - Manage all run overrides in one dialog (Priority: P2)

A project user opens one Run settings dialog from the ticket detail menu to view and edit agent, model, clarification policy, and token-saving overrides.

**Why this priority**: The UI consolidation prevents the ticket menu from growing as additional run settings are added.

**Independent Test**: Can be tested by opening a ticket detail menu and confirming the menu contains only Run settings, Simple copy, and Full clone where applicable, then editing existing overrides through the unified dialog.

**Acceptance Scenarios**:

1. **Given** a ticket detail modal is open, **When** the user opens the overflow menu, **Then** the separate Edit Policy, Edit Agent, and Edit Models actions are absent and a single Run settings action is present.
2. **Given** the user opens Run settings, **When** the dialog loads, **Then** Agent, Models, Clarification policy, and Token saving appear as separate sections with inherited project defaults and override state visible.
3. **Given** an existing agent, model, or clarification-policy override is changed through Run settings, **When** the user saves, **Then** the behavior matches the existing dedicated dialogs, including validation, permissions, and stage-based editability.

---

### User Story 4 - Compare real savings with cloned tickets (Priority: P3)

A project user compares two similar or cloned tickets, one with token saving ON and one OFF, using existing job telemetry and run-level token-saving status.

**Why this priority**: The feature is useful only if users can interpret actual savings without a new estimation workflow.

**Independent Test**: Can be tested by cloning a ticket, running comparable Claude jobs with opposite token-saving settings, and comparing their Stats telemetry with the active/inactive status visible.

**Acceptance Scenarios**:

1. **Given** two cloned tickets have comparable completed jobs, **When** one ran with token saving active and one ran with token saving inactive, **Then** the user can identify each run state and compare existing input, cache, peak context, average context, duration, and cost telemetry.
2. **Given** a full clone copies historical jobs, **When** the clone appears, **Then** copied job telemetry remains a point-in-time snapshot and any copied token-saving run state remains interpretable.
3. **Given** a job predates token-saving status capture, **When** the user views its telemetry, **Then** the status is shown as unavailable or not recorded rather than active or inactive.

### Edge Cases

- Token saving is OFF by default for all new and existing projects until a project owner enables it.
- A ticket with no token-saving override inherits the current project default for future runs.
- Changing the project default or ticket override does not affect jobs already running or completed.
- Non-Claude agents are unaffected even when a project or ticket setting is ON; job details show token saving as not applicable or inactive.
- Token-saving setup, activation, parsing, or runtime failures never fail the workflow run by themselves; the run falls back to normal output.
- The header indicator appears only when token saving is effectively ON for the ticket, not merely when a past job used it.
- Existing ticket duplication continues to work; copied tickets preserve run settings consistently with other per-ticket execution overrides.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a project-level Token saving setting that is controlled by the project owner and defaults to OFF.
- **FR-002**: The system MUST allow authorized users to view the project Token saving setting from project settings, including whether it is currently ON or OFF.
- **FR-003**: The system MUST allow each ticket to resolve Token saving from the project default unless a ticket override is set.
- **FR-004**: The system MUST support three ticket-level Token saving states: inherit project default, force ON, and force OFF.
- **FR-005**: The system MUST apply ticket-level Token saving overrides only to future runs and MUST preserve the run-captured setting for in-progress and completed jobs.
- **FR-006**: The system MUST restrict ticket Token saving override editability to the same stages and permissions used by per-ticket agent and clarification-policy overrides.
- **FR-007**: The system MUST replace the separate ticket-menu actions for editing policy, agent, and models with one Run settings action.
- **FR-008**: The system MUST keep Simple copy and Full clone available from the ticket detail menu according to their existing eligibility rules.
- **FR-009**: The Run settings dialog MUST group Agent, Models by stage, Clarification policy, and Token saving in clearly separated sections.
- **FR-010**: Each Run settings section MUST show the inherited project default, the ticket override state, and whether the setting is currently editable.
- **FR-011**: Existing agent, model, and clarification-policy validation, inheritance, permissions, and stage-based editability MUST remain unchanged after consolidation.
- **FR-012**: When a Claude core stage-transition run starts with Token saving effectively ON, the run MUST activate the approved RTK token-saving behavior before the agent receives shell-command output.
- **FR-013**: When Token saving is effectively OFF, the run MUST avoid token-saving setup and preserve current run behavior with no added token-saving overhead.
- **FR-014**: When Token saving setup or activation fails, the run MUST continue without token saving and MUST expose the fallback state in job information.
- **FR-015**: Non-Claude agents MUST be unaffected by Token saving settings and MUST not attempt token-saving activation.
- **FR-016**: Job details MUST show run-level Token saving status for relevant jobs: active, inactive, fallback, not applicable, or not recorded.
- **FR-017**: Ticket header status indicators MUST show a compact token-saving indicator with a tooltip when Token saving is effectively ON for the ticket.
- **FR-018**: Existing per-job telemetry MUST remain the source for savings assessment; the system MUST NOT introduce a new savings estimator in this phase.
- **FR-019**: Users MUST be able to compare cloned or similar tickets by reading existing telemetry alongside the Token saving status captured for each run.
- **FR-020**: Ticket duplication MUST preserve Token saving settings consistently with other per-ticket execution overrides.

### Assumptions

- "Core stage-transition runs" means the standard ticket workflow runs for SPECIFY, PLAN, BUILD or IMPLEMENT, QUICK-IMPL, and VERIFY.
- Auxiliary commands such as comments, assistant mentions, health scans, deploy previews, rollbacks, and log pruning are outside this feature's phase-1 scope.
- RTK is the approved token-saving tool for this feature, based on its documented behavior as a command-output compression proxy for LLM coding workflows: https://github.com/rtk-ai/rtk
- "Active" means token saving was requested and successfully prepared before the agent invocation began.
- "Fallback" means token saving was requested but the run proceeded with normal command output because setup or activation did not complete.

### Key Entities *(include if feature involves data)*

- **Project Run Settings**: The project-level defaults that control workflow execution behavior for tickets that inherit settings, including Token saving.
- **Ticket Run Settings**: Per-ticket execution overrides for agent, per-stage models, clarification policy, and Token saving; nullable override state means inherit the project default where applicable.
- **Workflow Job**: A single workflow execution associated with a ticket or project; records command, status, telemetry, and the run-level Token saving status captured at job start.
- **Job Telemetry**: Existing resource-usage measurements for a job, including tokens, cache usage, context size, duration, cost, model, and tools used.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Run settings resolution**: Triggered when a ticket is displayed, edited, duplicated, or dispatched for a workflow run.
  - **Input**: Project defaults, ticket overrides, ticket stage, user permissions, selected agent, and workflow command.
  - **Phases**: Resolve inherited values, determine editability, freeze run-captured values when a job starts, and expose effective values to the UI and workflow.
  - **Output**: Effective run settings for display, saved overrides when changed, and immutable run settings attached to each started job.
  - **Error behavior**: Invalid or unavailable overrides are rejected before save; display surfaces the current stored state without silently changing it.

- **Claude token-saving activation**: Triggered when a Claude core stage-transition workflow starts and Token saving is effectively ON.
  - **Input**: The run-captured Token saving state, workflow command, ticket context, and approved token-saving tool availability.
  - **Phases**: Prepare token saving, activate it before agent execution, run the normal agent workflow, capture whether token saving was active or fell back, and continue normal telemetry capture.
  - **Output**: Completed, failed, or cancelled job with normal workflow outputs plus Token saving status for the run.
  - **Error behavior**: Token-saving setup or activation failures are non-blocking; the run proceeds normally and records fallback information.

- **Telemetry comparison support**: Triggered when users view job details, ticket Stats, or comparisons for tickets with completed jobs.
  - **Input**: Existing job telemetry, job status, workflow command, agent, and Token saving status.
  - **Phases**: Present run status next to existing telemetry and preserve copied job telemetry when tickets are cloned.
  - **Output**: Interpretable job and ticket-level telemetry that lets users compare ON versus OFF runs.
  - **Error behavior**: Missing historic Token saving status is shown as not recorded; missing telemetry follows the existing Stats display behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of projects show Token saving as OFF until an owner explicitly enables it.
- **SC-002**: A project owner can change the project Token saving default and see inherited ticket state update in the interface within 2 seconds.
- **SC-003**: On ticket detail menus, the only run-configuration entry is Run settings, and the menu still offers Simple copy and Full clone according to existing eligibility rules.
- **SC-004**: A user can identify a ticket's effective Token saving state and override source from the Run settings dialog in under 10 seconds.
- **SC-005**: 100% of relevant jobs display one of the defined Token saving statuses by the time the job reaches a terminal state.
- **SC-006**: No workflow run fails solely because token-saving setup, activation, or parsing failed.
- **SC-007**: With Token saving OFF, Claude runs complete with no visible token-saving activation or fallback events.
- **SC-008**: Users can compare two cloned tickets with opposite Token saving settings using existing job telemetry without any additional estimation step.
- **SC-009**: Existing agent, model, and clarification-policy override workflows remain testable through Run settings with no loss of current validation or editability behavior.
