# Feature Specification: Token saving via RTK + unified per-ticket Run settings

**Feature Branch**: `AIB-849-token-saving-via`
**Created**: 2026-06-03
**Status**: Draft
**Input**: User description: "Token saving via RTK + unified per-ticket Run settings"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

> Clarification policy input: **AUTO**. AUTO scored the request as net-positive on reliability/safety signals ("never fail or degrade a run") with low overall confidence (absScore < 3 → confidence Low). Per the AUTO scoring model, low confidence forces a **CONSERVATIVE** fallback, so each ambiguity below is resolved with the most cautious, least-surprising default.

- **Decision**: Token saving is a per-run setting that follows the same project-default + nullable-ticket-override inheritance as clarification policy and agent (null on the ticket = inherit project default).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (0.3) — ticket explicitly names this pattern, so risk of being wrong is minimal.
- **Fallback Triggered?**: Yes — low confidence promoted AUTO to CONSERVATIVE; outcome matches the ticket's stated intent.
- **Trade-offs**:
  1. Reuses an established, well-understood override model; no new inheritance semantics to learn.
  2. Slightly more storage (one project field + one nullable ticket field) vs a single global flag.
- **Reviewer Notes**: Confirm the three-state ticket control (Inherit / Force ON / Force OFF) matches how policy and agent overrides are surfaced.

- **Decision**: The token-saving ticket override is editable at any stage (it governs each future run), unlike agent/policy which are INBOX-only. The toggle is disabled only while a run is actively executing on the ticket.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (0.3) — ticket says "same stage-based editability rules as today" for existing controls but is silent on the new toggle's stage rules.
- **Fallback Triggered?**: Yes — CONSERVATIVE chosen to maximize usefulness without breaking an in-flight run.
- **Trade-offs**:
  1. Users can A/B test savings on later stages of the same ticket without cloning into INBOX.
  2. Behavior differs from agent/policy (INBOX-only), which reviewers must accept as intentional.
- **Reviewer Notes**: Validate that changing the toggle mid-ticket only affects runs dispatched after the change, never a run already in progress.

- **Decision**: Each job records a stored indicator of whether token saving was Active, Inactive (OFF), or Fell back (enabled but install/activation failed); this indicator is shown in job details.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (0.3) — ticket requires "job details indicate token saving was active" but does not name a field or the exact set of states.
- **Fallback Triggered?**: Yes — three explicit states chosen over a single boolean so telemetry comparisons remain interpretable (criterion 3 distinguishes OFF from fallback).
- **Trade-offs**:
  1. Three states make A/B telemetry unambiguous and surface silent fallbacks.
  2. One extra recorded value per job.
- **Reviewer Notes**: Confirm "Fell back" is visible and visually distinct from "Inactive" in job details.

- **Decision**: The compression tool is pinned to a specific known-good version and obtained over the network at run time; if the network fetch, install, or hook activation fails the run continues with the tool inactive (recorded as fallback).
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Low (0.3) — ticket mandates graceful fallback but does not specify sourcing or version pinning.
- **Fallback Triggered?**: Yes — pinning + non-blocking install is the safest interpretation of "never fail or degrade a run."
- **Trade-offs**:
  1. Pinning avoids surprise behavior changes from upstream updates; predictable runs.
  2. Version bumps require a deliberate change rather than tracking latest automatically.
- **Reviewer Notes**: Confirm the pinned version and that no run can be blocked or slowed materially by the install step.

- **Decision**: Scope is limited to the Claude agent on the standard workflow stages (specify/plan/build/verify/ship and quick-impl). Non-Claude agents ignore the setting entirely and run unchanged.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium — ticket states this scope explicitly.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Narrow, safe rollout; other agents unaffected.
  2. Savings only realized for Claude runs in phase 1.
- **Reviewer Notes**: Confirm the toggle is still configurable on tickets whose agent is non-Claude (it simply has no effect), to avoid confusing UX when the agent later changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable token saving for a project and let tickets inherit it (Priority: P1)

A project owner wants agent runs to consume fewer tokens. In project settings they find a new **Token saving** card (default OFF), and turn it ON. From then on, every ticket in that project inherits "token saving ON" for its agent runs unless an individual ticket overrides it.

**Why this priority**: This is the core value of the feature — reducing token consumption on real runs. Without it, nothing else matters.

**Independent Test**: Toggle the project Token saving card ON, dispatch a Claude BUILD run on an inheriting ticket, and confirm the run completes successfully and its job details report token saving as Active.

**Acceptance Scenarios**:

1. **Given** a project with Token saving OFF (default), **When** the owner opens project settings, **Then** a Token saving card is visible showing the current state OFF.
2. **Given** the owner is the project owner, **When** they switch the card ON, **Then** the project default becomes ON and the change persists.
3. **Given** a non-owner member views project settings, **When** they open the Token saving card, **Then** they cannot change it (read-only / disabled), consistent with other owner-only settings.
4. **Given** the project default is ON and a ticket has no override, **When** a Claude run is dispatched, **Then** the effective setting for the run is ON.

---

### User Story 2 - Run a Claude build with token saving active and confirm savings via telemetry (Priority: P1)

An operator clones a ticket into two copies, forces token saving ON for one and OFF for the other, runs the same stage on both, and compares the existing per-job token telemetry (input / cache / peak / average context) to quantify the real savings.

**Why this priority**: Demonstrates and measures the benefit using telemetry we already record, with no new estimation machinery; this is how the team validates the ~80% claim.

**Independent Test**: Create two clones of one ticket (one ON, one OFF), run the same Claude stage on each, and verify both jobs expose comparable token telemetry plus a clear per-job indicator of whether token saving was active.

**Acceptance Scenarios**:

1. **Given** a ticket with token saving effectively ON, **When** a Claude BUILD run executes, **Then** the run completes successfully and job details show token saving as Active.
2. **Given** a ticket with token saving effectively OFF, **When** a Claude BUILD run executes, **Then** the run behaves identically to today and job details show token saving as Inactive.
3. **Given** two cloned tickets (one ON, one OFF) that have each completed a run, **When** the operator compares their job telemetry, **Then** the per-job indicator lets them attribute any token difference to the setting.
4. **Given** token saving was requested ON but the tool failed to install or activate, **When** the run completes, **Then** the run still succeeds and job details show token saving as Fell back (not Active).

---

### User Story 3 - Manage all per-ticket run overrides from one "Run settings" dialog (Priority: P1)

A user opening a ticket wants to review and adjust its execution overrides — agent, per-stage models, clarification policy, and token saving — in one place. The kebab menu now offers a single **Run settings** item (plus Simple copy and Full clone). The dialog groups the four sections, shows each inherited project default and whether an override is set, and enforces the same editability rules as before.

**Why this priority**: The three separate "Edit X" dialogs do not scale; consolidation is required to add the new token-saving control coherently, and the ticket asks for it explicitly.

**Independent Test**: Open the ticket kebab, confirm exactly three items (Run settings, Simple copy, Full clone), open Run settings, and verify all four sections render with correct inherited defaults and override indicators.

**Acceptance Scenarios**:

1. **Given** a ticket detail view, **When** the user opens the kebab menu, **Then** it contains only Run settings, Simple copy, and Full clone — and no standalone Edit Policy / Edit Agent / Edit Models items.
2. **Given** the Run settings dialog is open, **When** the user views each section, **Then** Agent, Models (per stage), Clarification policy, and Token saving are present, each showing the inherited project default and whether an override is active.
3. **Given** a ticket past the INBOX stage, **When** the user opens Run settings, **Then** Agent and Clarification policy controls are read-only (INBOX-only rule preserved) while Models follow their current per-stage editability rules.
4. **Given** the user changes any override and saves, **When** the dialog closes, **Then** the override persists and validation/permissions match the previous standalone dialogs exactly.
5. **Given** the user sets a ticket override and later selects Inherit, **When** they save, **Then** the ticket reverts to the project default for that setting.

---

### User Story 4 - See at a glance when token saving is on for a ticket (Priority: P2)

A user scanning a ticket's header status strip wants to know whether token saving is effectively ON, the same way policy and agent are indicated today. A compact icon badge with a tooltip appears when token saving is effectively ON for the ticket.

**Why this priority**: Visibility makes telemetry comparisons interpretable and prevents confusion about why two similar tickets show different token usage; secondary to the core enable/measure/consolidate flows.

**Independent Test**: View a ticket whose effective token saving is ON and confirm a badge with an explanatory tooltip appears in the header status strip; view one that is OFF and confirm no badge.

**Acceptance Scenarios**:

1. **Given** a ticket whose effective token saving is ON, **When** the user views the header status strip, **Then** a compact token-saving badge is shown with a tooltip explaining the state and its source (inherited vs override).
2. **Given** a ticket whose effective token saving is OFF, **When** the user views the header status strip, **Then** no token-saving badge is shown, consistent with how policy/agent badges behave.

---

### Edge Cases

- **Non-Claude agent with token saving ON**: The setting is stored and shown but has no effect; the run proceeds normally and its job indicates token saving was Inactive (out of scope for this agent).
- **Tool install/activation failure**: The run continues without compression and is recorded as Fell back; the failure never aborts or stalls the run.
- **Setting changed mid-ticket / mid-run**: A change to the toggle applies only to runs dispatched afterward; a run already executing is unaffected.
- **Owner downgrades or member views settings**: Only the project owner can change the project Token saving card; members see it read-only.
- **Clone behavior**: Simple copy and Full clone carry the ticket's token-saving override (or its inherit state) so ON-vs-OFF A/B clones are easy to set up.
- **Inherit toggling**: Switching a ticket override back to Inherit must restore project-default behavior with no residual override.
- **Compression produces unparseable output**: When the tool cannot parse a command's output it passes the full output through unchanged, so the agent never loses information.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a project-level "Token saving" setting, owner-controlled, defaulting to OFF, presented as a card in project settings.
- **FR-002**: The system MUST allow each ticket to override the project token-saving default with one of three states: Inherit (default), Force ON, or Force OFF.
- **FR-003**: The system MUST compute an effective token-saving value for each run as the ticket override when set, otherwise the project default — mirroring the clarification-policy and agent inheritance model.
- **FR-004**: When the effective value is ON for a Claude run on a standard workflow stage, the system MUST install and activate the output-compression tool for the agent before the agent is invoked, so large command outputs are compressed before entering the agent's context.
- **FR-005**: When the effective value is OFF, the run MUST behave identically to today — no install, no hook, and no measurable overhead.
- **FR-006**: If install or activation of the compression tool fails, the run MUST proceed normally without it and MUST be recorded as having fallen back; a token-saving failure MUST NEVER cause a run to fail or degrade.
- **FR-007**: The system MUST limit token-saving activation to the Claude agent; runs on other agents MUST be unaffected regardless of the setting.
- **FR-008**: The system MUST record, per job, whether token saving was Active, Inactive, or Fell back, and MUST surface this in job details.
- **FR-009**: The system MUST NOT introduce any new token-estimation machinery; savings MUST be assessable using the existing per-job token telemetry (input, cache, peak context, average context).
- **FR-010**: The system MUST replace the ticket kebab's "Edit Policy", "Edit Agent", and "Edit Models" items with a single "Run settings" item; the kebab MUST retain only "Run settings", "Simple copy", and "Full clone".
- **FR-011**: The unified Run settings dialog MUST present four sections — Agent, Models (per stage), Clarification policy, and Token saving — each showing the inherited project default and whether an override is set.
- **FR-012**: The Run settings dialog MUST preserve the existing editability rules for each control (Agent and Clarification policy editable in INBOX only; Models per their current per-stage rules) and the existing validation and permission checks.
- **FR-013**: The token-saving control in Run settings MUST be editable at any stage when no run is actively executing on the ticket; changes MUST apply only to subsequently dispatched runs.
- **FR-014**: The ticket header status strip MUST show a compact icon badge with a tooltip when token saving is effectively ON, consistent with the existing policy and agent badges, and MUST show nothing when it is OFF.
- **FR-015**: Changing any override in Run settings MUST persist with the same semantics as before, and switching an override back to Inherit MUST restore project-default behavior.
- **FR-016**: The system MUST NOT change the semantics, validation, permissions, or apply-timing of the existing agent, models, and clarification-policy overrides — this is a consolidation of entry points only.
- **FR-017**: The compression tool version used at run time MUST be pinned/known rather than tracking an unspecified latest, so run behavior is reproducible.

### Key Entities *(include if feature involves data)*

- **Project token-saving default**: A boolean configuration on a project (default OFF), owner-editable, that all the project's tickets inherit unless overridden.
- **Ticket token-saving override**: An optional per-ticket value (unset = inherit, or Force ON / Force OFF) that takes precedence over the project default when computing the effective value for a run.
- **Job token-saving outcome**: A per-job record of whether token saving was Active, Inactive, or Fell back during that run, displayed in job details and used to interpret token telemetry.
- **Per-job token telemetry (existing)**: Input, cache, peak-context, and average-context token figures already recorded per job; reused unchanged to measure savings.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Token-saving activation during a Claude run**: Runs as part of agent run setup before the Claude agent is invoked, only when the effective token-saving value is ON and the agent is Claude.
  - **Input**: The effective token-saving value for the run, the resolved agent, and the workflow stage.
  - **Phases**:
    1. Determine the effective value; if OFF or agent is non-Claude, skip entirely (no overhead).
    2. Obtain the pinned compression tool and register it as a pre-command output hook for the agent.
    3. Verify activation; on any failure, abandon activation cleanly and mark the run as fallback.
    4. Invoke the agent as usual; the hook compresses qualifying command outputs and passes through anything it cannot parse.
    5. Record the token-saving outcome (Active / Inactive / Fell back) on the job.
  - **Output**: A completed run plus a per-job token-saving outcome; existing token telemetry is captured as today.
  - **Error behavior**: Any install/activation error is swallowed; the run continues without compression and is marked Fell back. The token-saving step can never fail or block the run, and is not retried within the run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A project owner can enable token saving for a project and have an inheriting ticket run with it active in a single, successful Claude run.
- **SC-002**: For comparable cloned tickets (one ON, one OFF) running the same stage, the ON run shows measurably lower context-token usage in the existing telemetry — targeting a substantial reduction on command-heavy stages (reference goal ~80% on command outputs).
- **SC-003**: 100% of runs where token-saving install or activation fails still complete with the same success rate as token-saving-OFF runs (zero failures attributable to token saving).
- **SC-004**: Every job exposes an unambiguous token-saving outcome (Active / Inactive / Fell back) in its details, so any two runs can be compared without guessing whether the setting applied.
- **SC-005**: The ticket kebab presents exactly three items (Run settings, Simple copy, Full clone), and the Run settings dialog lets a user view and edit all four override categories from one place.
- **SC-006**: Existing per-ticket agent, models, and clarification-policy overrides behave identically before and after the change (no regression in persistence, validation, permissions, or apply-timing).
- **SC-007**: Token-saving-OFF runs show no measurable change in duration or token usage versus before the feature (within normal run-to-run variance).
