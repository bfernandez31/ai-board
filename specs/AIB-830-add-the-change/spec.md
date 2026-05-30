# Feature Specification: Per-Stage Model Selection for Codex Agent

**Feature Branch**: `AIB-830-add-the-change`
**Created**: 2026-05-29
**Status**: Draft
**Input**: Ticket AIB-830 — "Add the change model for codex". Owner request (FR): allow per-stage model selection for the Codex agent just like Claude today; offer GPT 5.4 and 5.5 plus their variants; research the actual available variants.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Adopt a Codex-specific model whitelist of `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2`. Exclude `gpt-5.3-codex-spark` (research preview, ChatGPT Pro-only, not generally available via API).
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.85) — model IDs verified against official OpenAI Codex docs and `openai/codex` repo (sources: developers.openai.com/codex/models, developers.openai.com/codex/config-reference, openai/codex GitHub).
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users gain a curated list aligned with what the Codex CLI actually accepts; reduces support load from invalid model strings.
  2. Power users requesting `gpt-5.3-codex-spark` or arbitrary identifiers are blocked; can be added to the whitelist later if demand emerges.
- **Reviewer Notes**: Confirm the five model IDs against the live OpenAI Codex CLI release at implementation time; the whitelist must match exact strings the CLI accepts via `--model`.

---

- **Decision**: Store Codex per-stage model selections in dedicated Codex-only fields rather than reusing the existing Claude fields.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — preserves the "dormancy" semantic already established for Claude (AIB-678): settings persist across agent switches without cross-agent contamination.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Settings remain durable when the project owner toggles between Claude and Codex; no data loss, no validation conflicts.
  2. Adds five storage fields per Project and per Ticket; minor schema growth (acceptable given small VarChar(50) footprint).
- **Reviewer Notes**: Storage shape should mirror the existing Claude fields exactly (one nullable string per stage on Project, with matching override columns on Ticket). Resolver chain mirrors Claude's ticket → project → global fallback pattern.

---

- **Decision**: Set Codex smart defaults to `gpt-5.5` for SPECIFY/PLAN, `gpt-5.4` for IMPLEMENT, and `gpt-5.4-mini` for QUICK-IMPL/VERIFY.
- **Policy Applied**: PRAGMATIC
- **Confidence**: Medium (0.7) — mirrors Claude's strong-on-reasoning / fast-on-implementation split using the equivalent OpenAI tier (top frontier for design, flagship for build, fast variant for verification).
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Cost-efficient out-of-the-box experience that matches Claude's approach (heavy reasoning on early stages, lighter on later stages).
  2. Owners can override per stage if they prefer maximum capability throughout (e.g., set every stage to `gpt-5.5`).
- **Reviewer Notes**: Mirrors Claude's `SMART_DEFAULTS` mapping. Re-check defaults at implementation if OpenAI publishes updated guidance on per-task model selection.

---

- **Decision**: Set the Codex global fallback (used when neither ticket nor project has a configured value) to `gpt-5.5`.
- **Policy Applied**: PRAGMATIC
- **Confidence**: High (0.85) — official Codex documentation recommends `gpt-5.5` as the default for most coding work.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. New projects without explicit configuration get the strongest recommended Codex model on every stage.
  2. Slightly higher per-stage cost than choosing a mini variant as the fallback, but matches the safe-default posture of Claude (Opus 4.7 as fallback).
- **Reviewer Notes**: If OpenAI changes its recommended default, the fallback constant should be updated in one place.

---

- **Decision**: Extend the existing AI Models settings card and per-ticket override dialog to support Codex when the effective agent is Codex, rather than creating a separate Codex-only surface.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9) — preserves the single, agent-aware settings UX users already know.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Lower cognitive load: one card adapts to the selected agent; consistent UX between Claude and Codex projects.
  2. Slightly more complex UI logic (renders Codex dropdowns when `defaultAgent === CODEX`, Claude dropdowns when `defaultAgent === CLAUDE`).
- **Reviewer Notes**: When the effective agent is neither Claude nor Codex (Mistral, Gemini), keep the existing informational message; only Claude and Codex have per-stage configuration today.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure per-stage Codex models in project settings (Priority: P1)

A project owner who has set their project's default agent to Codex opens AI Models settings and picks a specific Codex model for each of the five workflow stages (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY). After saving, every workflow run that uses Codex for that project executes against the chosen model per stage.

**Why this priority**: This is the headline value of the ticket. Owners running Codex want the same control over cost-vs-capability trade-offs that Claude owners already have. Without this, Codex remains a "one-size-fits-all" agent and the platform offers worse parity between agents.

**Independent Test**: Switch a project's default agent to Codex, open Settings → AI Models, pick a non-default model for each stage, save, then dispatch a job for each stage and confirm the workflow is invoked with the chosen Codex model and that the job record stores the model identifier.

**Acceptance Scenarios**:

1. **Given** a project whose default agent is Codex and no per-stage models configured, **When** the owner opens Settings → AI Models, **Then** they see five dropdowns (one per stage) populated with the curated list of Codex models and a "Use global fallback" sentinel, and the resolved model preview shows the Codex global fallback.
2. **Given** the owner has selected `gpt-5.4-mini` for the QUICK-IMPL stage and saved, **When** they trigger a quick-impl ticket workflow, **Then** the resulting job runs Codex with `gpt-5.4-mini` and the stored job record reflects `gpt-5.4-mini` as the model used.
3. **Given** the owner clicks "Apply smart defaults" on a Codex project, **When** the request completes, **Then** the five stage fields are populated with the Codex smart-default model identifiers (frontier on early stages, flagship on build, fast variant on quick/verify).

---

### User Story 2 - Override Codex model for a single ticket (Priority: P2)

A user wants a specific high-stakes ticket to run on the strongest available Codex model while keeping the project-wide defaults conservative for cost. They open the ticket's model override dialog and pick `gpt-5.5` for the IMPLEMENT stage. The next IMPLEMENT job dispatched for that ticket runs on `gpt-5.5`; other tickets in the project remain unaffected.

**Why this priority**: Per-ticket override already exists for Claude; users expect parity for Codex. Without this, owners cannot escalate capability for a specific ticket without changing every workflow run for the entire project.

**Independent Test**: On a Codex project, open a ticket, set a per-stage override, dispatch the matching workflow, and confirm only that ticket's job picks the override while a sibling ticket in the same project uses the project default.

**Acceptance Scenarios**:

1. **Given** a Codex project with project-level defaults configured, **When** a member opens a ticket's model override dialog, **Then** they see the same five stage dropdowns prefilled with the project default and a "Reset all overrides" action.
2. **Given** a ticket-level override exists for IMPLEMENT, **When** the IMPLEMENT job runs, **Then** the ticket override wins over the project default; **And** when the override is cleared, the project default is restored on the next run.
3. **Given** a ticket's effective agent is Codex but the ticket has stored Claude per-stage overrides from a previous agent assignment, **When** workflows run, **Then** only Codex configuration applies and Claude overrides are ignored (and vice-versa).

---

### User Story 3 - Switch agent without losing model configuration (Priority: P3)

An owner experimenting between Claude and Codex switches their project's default agent from Claude to Codex, configures Codex stage models, then switches back to Claude. Their original Claude per-stage choices are still in place — nothing was overwritten — and Codex configuration is preserved for a future switch back.

**Why this priority**: Preserves the dormancy contract already established for Claude (AIB-678). Without it, every agent switch destroys prior configuration and discourages experimentation.

**Independent Test**: On a Claude-configured project, change the default agent to Codex, set Codex stage models, switch back to Claude, and verify the Claude per-stage settings still match what they were before the switch; switch back to Codex and verify the Codex settings are also intact.

**Acceptance Scenarios**:

1. **Given** a project with Claude per-stage models set, **When** the owner switches default agent to Codex and configures Codex stage models, **Then** both sets of configuration are stored independently.
2. **Given** the same project, **When** the owner switches default agent back to Claude, **Then** the original Claude per-stage selections are still applied to dispatched workflows; Codex selections are dormant but retained.

---

### Edge Cases

- A previously-saved Codex model identifier is later removed from the whitelist (model deprecated by OpenAI): treat as "not set" and fall through to the next layer of the resolver (project default → global fallback). UI shows the resolved fallback rather than the stale value.
- The owner sets the default agent to Codex but Codex per-stage selections are empty: all dispatched workflows use the Codex global fallback (`gpt-5.5`). The UI clearly indicates which stages are using the fallback vs. an explicit selection.
- The effective agent for a ticket is Codex (via ticket-level agent override) but the project default agent is Claude: ticket workflows resolve through the Codex resolver, using ticket → project Codex defaults → Codex global fallback. Claude configuration is ignored for that ticket's runs.
- A new project is created with default agent Codex: smart defaults should be available via the same "Apply smart defaults" affordance.
- Smart defaults are applied while the project is mid-job: in-flight jobs continue with whatever model they were dispatched with; only subsequent dispatches use the new smart defaults.
- An unauthorized user (non-owner, non-member) attempts to read or write Codex model settings: blocked by the same authorization rules used for Claude settings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a project owner to select a Codex model for each of the five workflow stages (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY) when the project's default agent is Codex.
- **FR-002**: System MUST expose a curated list of Codex model identifiers — `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, `gpt-5.2` — with human-readable labels in the selection UI.
- **FR-003**: System MUST validate any Codex model identifier received from the UI or API against the curated whitelist and reject identifiers not on the list.
- **FR-004**: System MUST persist Codex per-stage selections in storage that is independent of the existing Claude per-stage storage, so neither set of configuration is overwritten when the project owner switches agents.
- **FR-005**: System MUST resolve the Codex model for any given workflow dispatch in the following order: ticket-level Codex override → project-level Codex default → Codex global fallback (`gpt-5.5`).
- **FR-006**: System MUST include the resolved Codex model identifier in the workflow dispatch payload so the runner can invoke the Codex CLI with the correct `--model` value.
- **FR-007**: System MUST record the resolved Codex model identifier on the resulting job record for observability and historical comparison.
- **FR-008**: System MUST treat an unrecognized stored model identifier (e.g., a previously-saved model that was later removed from the whitelist) as "not set" and fall through to the next layer of the resolver chain.
- **FR-009**: Project owners MUST be able to apply Codex smart defaults via a single action that sets all five stage fields to the curated smart-default values (`gpt-5.5` for SPECIFY and PLAN; `gpt-5.4` for IMPLEMENT; `gpt-5.4-mini` for QUICK-IMPL and VERIFY).
- **FR-010**: Authorized members MUST be able to set per-ticket Codex overrides via the existing model override dialog when the ticket's effective agent is Codex.
- **FR-011**: Authorized members MUST be able to reset all per-ticket Codex overrides for a ticket in a single action.
- **FR-012**: System MUST ignore Claude per-stage configuration when the effective agent is Codex, and ignore Codex per-stage configuration when the effective agent is Claude.
- **FR-013**: When the project's default agent is neither Claude nor Codex (e.g., Mistral, Gemini), the AI Models settings card MUST continue to show the existing informational message rather than per-stage dropdowns.
- **FR-014**: System MUST enforce the same authorization rules for Codex model settings as for Claude model settings — project owners and members for read; project owners only (or the equivalent existing role boundary used for Claude settings) for write.
- **FR-015**: System MUST display, in the settings UI, which model each stage will resolve to (whether from explicit selection or fallback), so owners can confirm intent before saving.

### Key Entities

- **Project Codex Model Configuration**: Project-level selection of one Codex model per workflow stage. Five nullable slots (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY). A null slot means "use Codex global fallback." Stored independently of the Project's Claude configuration so both can coexist.
- **Ticket Codex Model Override**: Ticket-level override of one Codex model per workflow stage. Same five nullable slots. A null slot means "use the project-level Codex default." Stored independently of the Ticket's Claude override so both can coexist.
- **Codex Model Whitelist**: The closed set of Codex model identifiers and labels the platform supports. Sourced from official OpenAI Codex CLI documentation. Updated explicitly (not auto-discovered).
- **Codex Smart Defaults**: A constant mapping of stage → recommended Codex model used by the "Apply smart defaults" action.
- **Job Model Telemetry**: Existing job-record field that captures the actual model identifier used for a dispatched workflow run, regardless of agent.

### Internal Processes

- **Codex Model Resolution (per workflow dispatch)**: When a workflow is dispatched and the effective agent is Codex, the system resolves which Codex model to use.
  - **Input**: The ticket (which may carry its own agent override), the project (default agent and project-level Codex configuration), and the command/stage being dispatched.
  - **Phases**:
    1. Compute effective agent (ticket agent override or project default agent).
    2. If effective agent is not Codex, exit this resolver (Claude resolver or fallback handles it).
    3. Map the command to a stage key (SPECIFY/PLAN/IMPLEMENT/QUICK-IMPL/VERIFY); if the command is not stage-keyed, return no Codex model.
    4. Check ticket-level Codex override for the stage; if it is a valid whitelisted Codex identifier, use it.
    5. Otherwise check project-level Codex default for the stage; if valid, use it.
    6. Otherwise use the Codex global fallback (`gpt-5.5`).
  - **Output**: A single Codex model identifier string (or null if effective agent isn't Codex), which is injected into the workflow dispatch payload and recorded on the resulting Job.
  - **Error behavior**: An invalid or stale stored identifier is treated as "not set" and falls through; the resolver itself never throws. If no identifier can be resolved for a Codex dispatch, the workflow proceeds with the global fallback.

- **Apply Codex Smart Defaults (owner-initiated, one-shot)**: When the owner clicks "Apply smart defaults" on a Codex project.
  - **Input**: The project identifier and the authenticated owner's session.
  - **Phases**:
    1. Authorize the request (project owner).
    2. Set the five Codex stage fields on the project to the smart-default values.
    3. Return the updated project configuration to the UI.
  - **Output**: The five project-level Codex stage fields populated; the UI refreshes to show the new selections.
  - **Error behavior**: Authorization failure returns the standard 403/404 surface; partial application is not possible (the five fields update as a single transaction).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A project owner can change a Codex stage model from the default to a different option and have the next dispatched workflow run on that model in under 30 seconds (UI selection + save + dispatch).
- **SC-002**: 100% of dispatched Codex workflows record a non-null model identifier on the resulting job record (no "unknown" jobs).
- **SC-003**: When the project owner toggles default agent between Claude and Codex three or more times, both sets of per-stage configuration remain intact across every toggle (zero data loss).
- **SC-004**: New projects whose owners click "Apply smart defaults" with default agent Codex have all five stage fields populated with valid Codex model identifiers in a single action.
- **SC-005**: Any model identifier submitted to the configuration API outside the curated whitelist is rejected with a clear validation message; zero invalid identifiers reach storage.
- **SC-006**: When OpenAI deprecates a model identifier and it is removed from the whitelist, projects that had it stored continue to dispatch successfully (fall-through to next resolver layer) without manual intervention.
