# Feature Specification: Per-stage model configuration for Claude workflows

**Feature Branch**: `AIB-678-per-stage-model`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "Per-stage model configuration for Claude workflows — owners pick a Claude model per job type (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY), with optional per-ticket override. Non-Claude agents keep their current default."

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Use AUTO policy as supplied; dominant signals are data-integrity (validation of model IDs), security (owner/member authorization) and "no regression" for existing projects. Net signal weight leans positive → apply CONSERVATIVE stance for ambiguity resolution while honoring the explicit cost-conscious defaults for new projects.
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for unresolved ambiguity; PRAGMATIC where the ticket explicitly authorizes cost-optimized defaults for new projects)
- **Confidence**: High (0.85) — explicit acceptance criteria, whitelist, defaults, auth rules, and agent-awareness rules are all stated in the ticket; residual ambiguities are edge cases.
- **Fallback Triggered?**: No — explicit policy provided and signals are consistent.
- **Trade-offs**:
  1. Scope stays tightly bounded to the 5 listed job types; `iterate`, `comment-*`, `health-scan`, `retro-spec`, and `onboard` remain on the global default and are explicitly out of scope.
  2. The model whitelist is closed (4 entries). Adding a new model requires a code change rather than a runtime registry — trading flexibility for validation safety until the whitelist itself becomes a bottleneck.
- **Reviewer Notes**: Confirm that "same auth rules as agent edit" permits project members (not just owners) to change both project-level and ticket-level model configuration — the spec adopts that interpretation consistently.

---

- **Decision**: Ticket-level override storage semantics for a stage left at "Inherit from project default" persist **no value** (null/absent), so a later change to the project default is transparently picked up.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — ticket explicitly says "stores no override".
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Inherit is always live (no frozen copy of project default), matching the stated behavior.
  2. Users cannot "snapshot" a project default onto a ticket; they must explicitly pick the model if they want it pinned.
- **Reviewer Notes**: Ensure UI clearly communicates that "Inherit" tracks the project default live.

---

- **Decision**: Unknown or non-whitelisted model IDs submitted at any layer (project settings API, ticket override API) are rejected with a validation error; no silent coercion to the global fallback.
- **Policy Applied**: CONSERVATIVE (security / data integrity)
- **Confidence**: High — explicit acceptance criterion.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Strict validation protects against typo-driven dispatch failures mid-workflow.
  2. Any future model additions require the whitelist to be updated before owners can select them.
- **Reviewer Notes**: Confirm API error is returned with a clear, actionable message naming the allowed IDs.

---

- **Decision**: When a ticket's effective agent is **not** Claude at dispatch time, any stored Claude per-stage configuration (project-level or ticket-level) is ignored. The value is **preserved in storage** so that switching the agent back to Claude reactivates it without re-entry.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — explicit ticket statement "remains dormant ... reactivated if the agent is switched back to Claude".
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users don't lose configuration when experimenting with other agents.
  2. Configuration that looks "set" in storage may be inert depending on agent — UI must surface this clearly.
- **Reviewer Notes**: Check that both the Settings card and the Ticket override dialog show the informational message (instead of dropdowns) when the active agent is not Claude, so users understand the configuration is dormant.

---

- **Decision**: "Global fallback" means Opus 4.7 is the hard-coded fallback used when resolution finds no project default and no ticket override for a given stage. This fallback is also what existing projects (pre-migration) effectively resolve to on every stage.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — matches the "no regression" acceptance criterion.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Existing projects' behavior is byte-for-byte identical to today until an owner explicitly changes a setting.
  2. The global fallback hardcoding means a future default change requires code plus migration; acceptable for current scope.
- **Reviewer Notes**: Ensure migration backfills existing projects with explicit Opus 4.7 per stage (or relies on null → Opus 4.7 resolution) in a way that matches current behavior exactly.

---

- **Decision**: "Custom models" indicator on the ticket card triggers when **any** of the 5 stages on the ticket has a non-inherit value, regardless of agent (i.e., shown even if ticket's agent is currently non-Claude but Claude overrides are stored). Tooltip lists the overridden stages (by name) and, when agent is non-Claude, notes that overrides are currently dormant.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium — ticket says "compact 'Custom models' badge … tooltip listing the overridden stages"; the dormant-when-non-Claude note is a conservative extension to avoid misleading the user.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users clearly see the override exists but also that it's inert for the current agent.
  2. Slightly busier tooltip text.
- **Reviewer Notes**: Confirm the UI copy for the dormant-state tooltip is acceptable; alternatively hide the badge entirely when agent is non-Claude (stricter reading of the ticket).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure default model per stage for a project (Priority: P1)

A project owner opens the project Settings page and, in a new "AI Models" card, picks a Claude model for each of the 5 job types (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY). The change persists immediately. The next time a workflow runs for any ticket in that project — without a ticket-level override — the selected model is the one actually invoked.

**Why this priority**: This is the minimum viable feature: it delivers cost tuning at project scope, which is the most common knob (one configuration per project applies to every ticket). Without it, neither ticket-level overrides nor the migration logic make sense.

**Independent Test**: Can be fully validated by opening Settings on a Claude project, changing IMPLEMENT to Sonnet 4.6, dispatching an IMPLEMENT job from any ticket with no override, and confirming the job record shows Sonnet 4.6 as the model used.

**Acceptance Scenarios**:

1. **Given** a project whose default agent is Claude and whose IMPLEMENT model is Opus 4.7, **When** the owner selects Sonnet 4.6 in the IMPLEMENT row of the AI Models card, **Then** the change is persisted immediately and the UI reflects the new selection without full page reload.
2. **Given** the owner has just changed IMPLEMENT to Sonnet 4.6, **When** an IMPLEMENT workflow is dispatched for a ticket with no ticket-level override, **Then** the dispatch payload carries Sonnet 4.6 as the model ID and the resulting Job record records Sonnet 4.6 as the model actually used.
3. **Given** the persistence API is temporarily unavailable, **When** the owner attempts a change, **Then** the optimistic update reverts to the previous value and a non-blocking error is shown.
4. **Given** the project's default agent is Codex (not Claude), **When** the owner opens Settings, **Then** the AI Models card shows the informational message "Using Codex's latest default model. Per-stage selection is only available for Claude today." instead of the 5 dropdowns, and no dropdown interaction is possible.

---

### User Story 2 - Resolve effective model at workflow dispatch (Priority: P1)

When a user triggers a SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, or VERIFY workflow, the system determines which Claude model to hand to the workflow using a clear priority chain: ticket-level override first, then project default, then the global Opus 4.7 fallback.

**Why this priority**: Without correct resolution, configuration on either layer is meaningless. This is the mechanical heart of the feature.

**Independent Test**: Can be fully validated by setting different values at each layer (global fallback only / project only / ticket override), dispatching each of the 5 job types, and verifying the dispatch input matches the expected resolution.

**Acceptance Scenarios**:

1. **Given** a ticket with IMPLEMENT override = Haiku 4.5 and project default IMPLEMENT = Sonnet 4.6, **When** an IMPLEMENT job is dispatched, **Then** the workflow receives Haiku 4.5.
2. **Given** a ticket with no override for PLAN and project default PLAN = Opus 4.6, **When** a PLAN job is dispatched, **Then** the workflow receives Opus 4.6.
3. **Given** an existing project left untouched since migration and a ticket with no override, **When** any of the 5 workflows dispatches, **Then** the workflow receives Opus 4.7 — identical behavior to before the feature shipped.
4. **Given** a ticket whose effective agent is Gemini and whose Claude per-stage override is set to Haiku 4.5 on IMPLEMENT, **When** an IMPLEMENT job is dispatched, **Then** no Claude model is sent; Gemini uses its own current default and the stored Claude override is preserved but ignored.
5. **Given** a workflow job has completed, **When** inspecting the Job record, **Then** the `model` field reflects the resolved model that was actually used (so per-stage cost analytics remain accurate).

---

### User Story 3 - Override a single ticket's models (Priority: P2)

A team lead has a particularly tricky ticket and wants to try Opus 4.7 on VERIFY even though the project default for VERIFY is Sonnet 4.6. They open a dialog from the ticket detail view, pick Opus 4.7 for VERIFY, leave the other 4 stages on "Inherit from project default", and save. The ticket card now shows a "Custom models" badge with a tooltip listing VERIFY.

**Why this priority**: High-value but not strictly required for P1 (owners can still tune at project level). Delivers the A/B experimentation use case.

**Independent Test**: Can be validated by opening the override dialog on a ticket, setting VERIFY to Opus 4.7, confirming the badge appears, dispatching a VERIFY job, and confirming Opus 4.7 was used while other stages (dispatched on the same ticket) still resolve to project defaults.

**Acceptance Scenarios**:

1. **Given** a ticket in a Claude project, **When** the user opens the per-stage override dialog, **Then** 5 rows are shown, each with "Inherit from project default" as the first option followed by the 4 whitelisted models.
2. **Given** a ticket where VERIFY override is Opus 4.7 and other stages are inherit, **When** the ticket is displayed in any ticket list or board, **Then** a "Custom models" badge is visible next to the agent badge and its tooltip enumerates "VERIFY" (only).
3. **Given** a ticket with several stage overrides, **When** the user clicks "Reset all to project defaults", **Then** all stored overrides are cleared in a single action and the "Custom models" badge disappears.
4. **Given** a ticket whose effective agent is not Claude, **When** the user opens the override dialog, **Then** the dialog shows the informational message instead of the 5 selectors.
5. **Given** a non-owner, non-member user, **When** they attempt to open or submit the override dialog, **Then** the action is refused with the same authorization response as the existing agent edit action.

---

### User Story 4 - Smart defaults for new projects (Priority: P2)

A user creates a brand-new project. Without any manual configuration, the new project's AI Models card is pre-populated with opinionated, cost-conscious defaults: SPECIFY → Opus 4.7, PLAN → Opus 4.7, IMPLEMENT → Sonnet 4.6, QUICK-IMPL → Sonnet 4.6, VERIFY → Sonnet 4.6. Owners of pre-existing projects, who keep Opus 4.7 everywhere by migration, can opt-in to the same smart defaults via a single Settings action.

**Why this priority**: Reduces cost for new users by default without creating regressions for existing ones. Lower priority because existing projects still work (they just cost more).

**Independent Test**: Create a new project, inspect AI Models card defaults match the smart default set; separately, on a migrated existing project, trigger the opt-in action and verify the same defaults are applied.

**Acceptance Scenarios**:

1. **Given** the feature has shipped, **When** a new project is created, **Then** its 5 per-stage model settings are persisted as the smart default set (SPECIFY=Opus 4.7, PLAN=Opus 4.7, IMPLEMENT=Sonnet 4.6, QUICK-IMPL=Sonnet 4.6, VERIFY=Sonnet 4.6).
2. **Given** an existing project whose owner hasn't touched the AI Models card, **When** workflows dispatch, **Then** all 5 stages resolve to Opus 4.7 (no regression).
3. **Given** an existing project, **When** the owner clicks an opt-in action to apply smart defaults, **Then** the project's 5 per-stage settings update to the smart default set in one operation.

---

### Edge Cases

- **Model removed from whitelist**: A previously saved model ID is no longer in the whitelist (e.g., deprecated). On read, the stored value is flagged in the UI (e.g., "Unavailable — falls back to Opus 4.7"); at dispatch, the system treats the stage as if no value were set, so resolution walks to the next layer. Validation on write continues to reject unknown IDs; deprecated IDs are read-only until re-selected.
- **Project agent changed from Claude to Codex while configuration exists**: Stored Claude per-stage configuration is preserved but dormant; no dispatch uses it. Ticket card badge indicating "Custom models" still shows with a dormant-state tooltip.
- **Ticket agent differs from project agent**: Resolution follows the ticket's effective agent. If that agent is Claude, both layers apply; if not, Claude configuration is ignored even if the project default agent is Claude.
- **Concurrent edits**: Two tabs submit conflicting AI Models card changes. Last write wins; neither tab crashes; optimistic updates reconcile with server state on refresh.
- **Optimistic update failure**: Network error on save reverts the dropdown to the pre-change value and surfaces a non-blocking error (no in-flight workflow is affected because persistence is a precondition for dispatch using the new value).
- **Workflow retry after model change**: A job failed, then the owner changed the project default, then the job is retried. The retry resolves the model again at dispatch time (takes the new default) — the original Job record still shows the previously used model.
- **Unknown model ID via direct API call**: Request is rejected with a validation error listing the currently accepted whitelist.
- **Migration of existing project**: All existing projects' stored values are equivalent to Opus 4.7 for every stage at migration. No existing Job record is modified; only future dispatches are affected.
- **Tooltip on long lists of overridden stages**: When all 5 stages are overridden, the tooltip enumerates all 5 stages; no truncation occurs (the list is bounded to 5 items).

## Requirements *(mandatory)*

### Functional Requirements

#### Project-level configuration

- **FR-001**: The system MUST allow a project owner or member to configure, per project, a Claude model for each of the 5 job types: SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY.
- **FR-002**: The system MUST restrict selectable models to the whitelist: Claude Opus 4.7, Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5. Any attempt to persist a value outside this whitelist MUST be rejected with a validation error.
- **FR-003**: The project Settings page MUST expose an "AI Models" card alongside the existing Clarification Policy card. The card MUST render a 5-row table (one per job type) with a model selector and a short description of each stage when the project's default agent is Claude.
- **FR-004**: When the project's default agent is not Claude, the AI Models card MUST show an informational message of the form "Using {Agent}'s latest default model. Per-stage selection is only available for Claude today." and MUST NOT render the model selectors.
- **FR-005**: Changes to any of the 5 model selectors MUST be persisted immediately using optimistic update. On persistence failure, the previous value MUST be restored and a non-blocking error surfaced to the user.
- **FR-006**: Newly created projects MUST be persisted with the smart default set: SPECIFY=Opus 4.7, PLAN=Opus 4.7, IMPLEMENT=Sonnet 4.6, QUICK-IMPL=Sonnet 4.6, VERIFY=Sonnet 4.6.
- **FR-007**: Existing projects that predate the feature MUST resolve to Opus 4.7 for every stage unless an owner/member explicitly changes the value. Migration MUST NOT change any project's dispatch behavior.
- **FR-008**: The AI Models card MUST offer an opt-in action for owners of existing projects to apply the smart default set in one operation.

#### Ticket-level override

- **FR-009**: Every ticket MUST support an optional per-stage override for each of the 5 job types. For each stage the stored value is either a whitelisted model ID or "inherit" (no value stored).
- **FR-010**: The ticket detail view MUST expose an edit dialog, modeled on the existing Agent edit dialog, with 5 rows (one per job type). Each row's selector MUST offer "Inherit from project default" as the first option followed by the 4 whitelisted models.
- **FR-011**: The dialog MUST provide a "Reset all to project defaults" action that clears all 5 stored overrides on the ticket in a single operation.
- **FR-012**: When the ticket's effective agent is not Claude, the override dialog MUST show the same informational message as the Settings card (with "{Agent}" substituted) and MUST NOT render the 5 selectors.
- **FR-013**: Stored ticket overrides MUST be preserved (not deleted) when the agent is switched to a non-Claude agent; they MUST become active again if the agent is switched back to Claude.

#### Resolution and dispatch

- **FR-014**: At workflow dispatch time for any of the 5 job types (specify, plan, implement, quick-impl, verify), when the effective agent is Claude, the system MUST resolve the model as: ticket override (if set) → project default → Opus 4.7 global fallback.
- **FR-015**: When the effective agent is not Claude, the system MUST NOT apply any Claude per-stage configuration; the dispatch MUST use the agent's own current default.
- **FR-016**: The model ID resolved at dispatch time MUST be passed to the workflow and MUST be recorded in the Job record's existing `model` field so that per-stage cost analytics remain accurate.
- **FR-017**: Job types outside the 5 configurable stages (iterate, comment-*, health-scan, retro-spec, onboard) MUST continue to dispatch using the global default and MUST NOT be affected by project or ticket per-stage configuration.

#### Authorization

- **FR-018**: Both project-level AI Models configuration and ticket-level per-stage override MUST follow the same authorization rules as the existing agent edit action: project owner or project member can read and write; others are refused.
- **FR-019**: API endpoints accepting these configurations MUST enforce the authorization rules server-side and MUST reject unknown model IDs with a validation error regardless of caller.

#### Visual indicators

- **FR-020**: When any stage on a ticket has a non-inherit value, the ticket card (in all ticket list/board views) MUST display a compact "Custom models" badge adjacent to the existing agent badge. The badge MUST expose a tooltip enumerating the stages that are overridden (by human-readable stage name).
- **FR-021**: When the ticket's effective agent is not Claude but Claude overrides exist in storage, the "Custom models" badge state MUST communicate that the overrides are dormant (e.g., muted style or tooltip suffix), so users are not misled into thinking the overrides will be applied.

### Key Entities *(include if feature involves data)*

- **ProjectModelConfig**: One logical record per project, carrying 5 values (SPECIFY, PLAN, IMPLEMENT, QUICK-IMPL, VERIFY), each a Claude model ID drawn from the whitelist. For existing (pre-feature) projects the effective value is Opus 4.7 for every slot. For new projects the smart default set is persisted at creation.
- **TicketModelOverride**: One logical record per ticket, carrying up to 5 values (one per job type). Each value is either a whitelisted Claude model ID or absent (meaning "inherit project default"). A ticket with no overrides at all MAY have no physical record.
- **ClaudeModelWhitelist**: Closed, code-owned set of 4 entries (Opus 4.7, Opus 4.6, Sonnet 4.6, Haiku 4.5). Each entry carries an identifier used at dispatch and a human-readable label used in the UI.
- **Job (existing)**: Continues to record the `model` field populated with the resolved model ID at dispatch time.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Workflow dispatch for SPECIFY/PLAN/IMPLEMENT/QUICK-IMPL/VERIFY**: Triggered when a user or automation requests the corresponding stage action on a ticket.
  - **Input**: Ticket identifier, job type, effective agent, stored project-level per-stage config, stored ticket-level per-stage overrides, global fallback.
  - **Phases**:
    1. Authorize caller using existing agent-edit rules.
    2. Determine effective agent for the ticket.
    3. If agent is Claude: resolve model as ticket override → project default → Opus 4.7 fallback.
    4. If agent is not Claude: use agent's own current default; ignore Claude per-stage configuration.
    5. Validate resolved model ID is in whitelist; on mismatch (e.g., stale stored value), fall back to the next resolution layer.
    6. Dispatch workflow with resolved model ID in the payload.
    7. Create Job record with `model` populated to the dispatched model ID.
  - **Output**: Dispatched workflow run, Job record with accurate `model` field.
  - **Error behavior**: If resolution cannot produce any valid model for Claude (should not happen because Opus 4.7 fallback is always defined), dispatch MUST abort and report a clear error rather than dispatch with an invalid model. Non-Claude dispatches are unaffected.

- **Project creation seed**: Triggered when a new project is created.
  - **Input**: Default agent for the project.
  - **Phases**:
    1. Persist the smart default set for the 5 job types.
    2. Persistence happens regardless of the project's default agent, so switching to Claude later activates the stored values immediately.
  - **Output**: ProjectModelConfig populated with smart defaults.
  - **Error behavior**: Failure MUST abort project creation (project is not partially created) since the seed is part of the creation transaction.

- **Opt-in smart defaults action**: Triggered by an existing-project owner/member clicking the opt-in control on the AI Models card.
  - **Input**: Project identifier.
  - **Phases**:
    1. Authorize caller.
    2. Overwrite all 5 per-stage values with the smart default set.
    3. Persist atomically.
  - **Output**: Updated ProjectModelConfig; UI reflects new values.
  - **Error behavior**: On persistence failure, no values are changed; UI reverts optimistic update.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of SPECIFY/PLAN/IMPLEMENT/QUICK-IMPL/VERIFY workflow dispatches on Claude tickets use the resolved model from the ticket-override → project-default → global-fallback chain, verifiable by inspecting the Job `model` field.
- **SC-002**: 100% of workflow dispatches on non-Claude agent tickets are unchanged by per-stage configuration (identical model selection behavior as before the feature shipped).
- **SC-003**: 100% of pre-feature projects dispatch Opus 4.7 on every stage until their owner/member explicitly changes a value — measurable by comparing the resolved model on untouched existing projects to the pre-feature baseline on a representative sample.
- **SC-004**: 100% of new projects created after release have the smart default set persisted at creation time, verifiable by inspecting the persisted ProjectModelConfig immediately after project creation.
- **SC-005**: 100% of API attempts to persist a non-whitelisted model ID (at either layer) return a validation error rather than silently accepting or coercing the value.
- **SC-006**: 100% of attempts to change project-level or ticket-level model configuration by a non-owner / non-member user are rejected by the authorization layer.
- **SC-007**: A project owner can change any of the 5 per-stage defaults and see the change reflected in the UI within 200 ms of clicking (optimistic update), with revert-on-error behavior verifiable under simulated API failure.
- **SC-008**: Every ticket with at least one non-inherit stage override displays the "Custom models" badge in ticket list/board views, and the badge's tooltip accurately enumerates the overridden stages.
- **SC-009**: On new projects, the ratio of Sonnet-4.6 dispatches to Opus-4.7 dispatches across IMPLEMENT/QUICK-IMPL/VERIFY stages exceeds 80% in the first full billing period after release (measured on a per-dispatch basis), demonstrating that smart defaults take effect by default.
- **SC-010**: Switching a project's agent from Claude to a non-Claude provider and back to Claude preserves any previously saved per-stage configuration with zero data loss (verified by round-trip inspection).
