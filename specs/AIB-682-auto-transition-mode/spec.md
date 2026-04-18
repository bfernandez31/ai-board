# Feature Specification: Auto-transition mode on full-workflow tickets

**Feature Branch**: `AIB-682-auto-transition-mode`
**Created**: 2026-04-18
**Status**: Draft
**Input**: Ticket AIB-682 — "Auto-transition mode on full-workflow tickets"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Who may toggle auto-transition on a ticket.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback, low confidence)
- **Confidence**: Low (score 0.3) — no explicit direction in the ticket; internal productivity signal (-2) vs neutral feature signal (+1) gives `netScore = -1`, `absScore = 1` → low confidence, triggers CONSERVATIVE fallback.
- **Fallback Triggered?**: Yes — confidence below 0.5 so we conservatively mirror existing stage-transition authorization.
- **Trade-offs**:
  1. Matches current stage-transition permissions (no new authorization surface), at the cost of not pre-optimizing for other collaboration patterns.
  2. Slightly more friction if a non-owner collaborator wanted to hand off a chain-run, but consistent with existing manual drag rights.
- **Reviewer Notes**: Confirm that "anyone currently allowed to drag a card forward" is the right scope; if owners-only is desired, adjust FR-002.

- **Decision**: How the user learns that auto mode disengaged after a failure.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback, low confidence)
- **Confidence**: Low (score 0.3) — ticket is silent; CONSERVATIVE fallback prevents silent failures.
- **Fallback Triggered?**: Yes.
- **Trade-offs**:
  1. Reuses the existing job-failure notification path so the user is not surprised by a halted chain, at the cost of no dedicated "auto mode disengaged" message.
  2. Keeps UI changes minimal (icon reverts to hover-only) and relies on the board's visual state as the ground truth.
- **Reviewer Notes**: Verify the current job-failure notification is sufficient; if not, a dedicated "auto mode turned off" notification could be added later.

- **Decision**: Scope of persistence for auto-mode state.
- **Policy Applied**: AUTO (high confidence)
- **Confidence**: High — the ticket explicitly states "Auto mode state is per ticket and persists across page reloads and sessions."
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Per-ticket server-side persistence keeps behavior consistent for any user viewing the board.
  2. No per-user client-side-only toggle, so a collaborator cannot silently opt out locally — they must toggle it off for everyone.
- **Reviewer Notes**: Confirm the persisted state is visible to all viewers of the ticket (intended), not a per-user preference.

- **Decision**: Visual treatment of the "on" state icon.
- **Policy Applied**: AUTO (high confidence)
- **Confidence**: High — ticket says "permanently with an accent color"; use the existing project accent token to keep the board theme-consistent.
- **Fallback Triggered?**: No.
- **Trade-offs**:
  1. Consistent with the rest of the board's visual language.
  2. No bespoke color token added.
- **Reviewer Notes**: Designer can swap the exact accent variant during implementation if desired.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fire-and-forget a full-workflow ticket from INBOX (Priority: P1)

A project owner has a well-scoped ticket in INBOX and already knows they want the full SPECIFY → PLAN → BUILD chain to run. Instead of dragging the card between stages three times and waiting between each, they enable auto-transition mode once and walk away.

**Why this priority**: This is the headline user value of the feature — removing the repeated manual drags that provide no decision value for the user. Without this, the feature has no reason to exist.

**Independent Test**: Starting from an INBOX full-workflow ticket with no running job, turn on auto-mode via the card's toggle icon, confirm the modal, and verify that the ticket progresses through SPECIFY and PLAN and lands in BUILD without any further user interaction (each transition dispatching after the previous job succeeds).

**Acceptance Scenarios**:

1. **Given** a full-workflow ticket in INBOX with no running job and auto-mode off, **When** the user clicks the fast-forward icon and confirms the modal, **Then** the ticket immediately transitions from INBOX to SPECIFY and dispatches the SPECIFY job.
2. **Given** that ticket has auto-mode on and its SPECIFY job completes successfully, **When** the job completion is recorded, **Then** the ticket automatically transitions to PLAN and the PLAN job is dispatched without user input.
3. **Given** that ticket has auto-mode on and its PLAN job completes successfully, **When** the job completion is recorded, **Then** the ticket automatically transitions to BUILD and the BUILD job is dispatched without user input.
4. **Given** the ticket reaches BUILD with auto-mode on, **When** BUILD completes, **Then** existing BUILD → VERIFY auto-transition applies as today (auto-mode is no longer needed because the icon is no longer shown from BUILD onward).

---

### User Story 2 — Enable auto-mode mid-flight while a job is running (Priority: P2)

A user starts a SPECIFY job manually, then decides they want the rest of the chain to run automatically. They turn on auto-mode while the SPECIFY job is still running; the chain kicks in as soon as that job succeeds.

**Why this priority**: Users will frequently decide "actually, just run the whole thing" after starting a stage manually; this avoids forcing them to cancel and restart.

**Independent Test**: On a full-workflow ticket in SPECIFY with a SPECIFY job currently running, toggle auto-mode on and confirm the modal. Verify no new dispatch happens while the job is still running; once the job completes successfully, the PLAN transition is dispatched automatically.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY with a SPECIFY job in RUNNING state and auto-mode off, **When** the user enables auto-mode and confirms, **Then** no new stage transition is dispatched immediately (the current job is not interrupted or duplicated).
2. **Given** that same ticket with auto-mode now on, **When** the running SPECIFY job completes successfully, **Then** the ticket auto-transitions to PLAN and the PLAN job is dispatched.

---

### User Story 3 — Auto-mode halts on failure so the user can intervene (Priority: P1)

A chained run hits a failure (ambiguous spec, broken tests, missing credential, quota exhausted). Rather than silently chaining into the next stage and masking the problem, auto-mode turns itself off and the ticket stays put so the user is prompted to look at what happened.

**Why this priority**: Without this, a "fire and forget" chain could hide real problems; this is a safety property that must hold from day one.

**Independent Test**: On a ticket with auto-mode on, force a stage job to fail or be cancelled, then verify that auto-mode is turned off (icon reverts to hover-only), the ticket stays on its current stage, and no further transition is dispatched automatically.

**Acceptance Scenarios**:

1. **Given** a ticket in SPECIFY with auto-mode on, **When** its SPECIFY job completes with status FAILED, **Then** auto-mode is turned off, the ticket stays in SPECIFY, and no PLAN transition is dispatched.
2. **Given** a ticket in PLAN with auto-mode on, **When** its PLAN job is cancelled, **Then** auto-mode is turned off, the ticket stays in PLAN, and no BUILD transition is dispatched.
3. **Given** the user enables auto-mode on a ticket whose owner has no valid provider credential, **When** the immediate dispatch attempt fails, **Then** the failure-handling rule fires and auto-mode is turned off.

---

### User Story 4 — Disable auto-mode at any time (Priority: P2)

A user changes their mind mid-chain and wants to resume manual control without affecting the currently running job.

**Why this priority**: Reversibility is essential for trust in an "automate my workflow" feature.

**Independent Test**: On a ticket with auto-mode on and a job running, click the fast-forward icon once. Verify auto-mode disengages instantly (no modal), the icon reverts to hover-only visibility, and when the running job eventually completes successfully, no automatic transition happens.

**Acceptance Scenarios**:

1. **Given** a ticket with auto-mode on, **When** the user clicks the icon, **Then** auto-mode is turned off immediately without a confirmation modal.
2. **Given** a ticket where auto-mode was just turned off while a job was running, **When** the running job completes successfully, **Then** the ticket does not auto-transition to the next stage.

---

### User Story 5 — Rolling back from VERIFY to PLAN disengages auto-mode (Priority: P2)

A user rolls a ticket back from VERIFY to PLAN because something needs to be redone. If auto-mode were still on, the ticket would loop: PLAN → BUILD → VERIFY, and the user might roll back again.

**Why this priority**: Prevents an infinite-loop failure mode that would be confusing and waste workflow runs.

**Independent Test**: Have a ticket in VERIFY with auto-mode on. Trigger the VERIFY → PLAN rollback. Verify that after rollback the ticket is in PLAN and auto-mode is off (icon hover-only).

**Acceptance Scenarios**:

1. **Given** a full-workflow ticket in VERIFY with auto-mode on, **When** the user rolls it back to PLAN, **Then** auto-mode is turned off as part of the rollback and the icon reverts to hover-only visibility.

---

### Edge Cases

- **Toggle while job is running**: allowed; takes effect at the next successful job completion (covered in US2).
- **Toggle on, but owner has no valid provider credential**: the immediate dispatch fails, failure-handling turns auto-mode off.
- **Quota exhausted at a later transition**: the auto-dispatched job fails, failure-handling turns auto-mode off, ticket stays on current stage.
- **User manually drags the card while auto-mode is on**: auto-mode remains on; it applies at the next successful job completion (no extra dispatch is fired on the manual drag itself beyond what the drag already does).
- **Quick-workflow ticket**: toggle icon is never rendered.
- **Ticket in BUILD, VERIFY, SHIP, or CLOSED**: toggle icon is not rendered (BUILD → VERIFY and VERIFY → SHIP already auto-progress today; nothing to chain beyond).
- **Page reload / new session**: auto-mode state persists per ticket.
- **Two users viewing the same ticket**: both see the same on/off state (server-side, per-ticket state).
- **User cancels the confirmation modal**: nothing changes — icon stays off, no dispatch.
- **Rollback from VERIFY to PLAN while auto-mode on**: auto-mode is turned off as part of the rollback (prevents infinite loop).

## Requirements *(mandatory)*

### Functional Requirements

#### Visibility & eligibility

- **FR-001**: The fast-forward toggle icon MUST only be rendered on tickets whose workflow type is FULL and whose current stage is INBOX, SPECIFY, or PLAN.
- **FR-002**: Toggling auto-mode MUST be permitted for any user who is currently permitted to advance the ticket to its next stage manually (same authorization as today's manual drag).
- **FR-003**: The toggle icon MUST NOT be rendered on quick-workflow tickets in any stage.
- **FR-004**: The toggle icon MUST NOT be rendered on full-workflow tickets in BUILD, VERIFY, SHIP, or CLOSED.

#### Icon presentation

- **FR-005**: When auto-mode is off, the icon MUST be hidden by default and visible only on card hover, matching the existing cancel (×) icon pattern.
- **FR-006**: When auto-mode is on, the icon MUST be permanently visible with the project's accent styling so the state is obvious at a glance across the board.
- **FR-007**: The icon's tooltip MUST read "Enable auto-transition" when off and "Auto-transition on — click to disable" when on.

#### Activation flow

- **FR-008**: Clicking the icon while auto-mode is off MUST open a confirmation modal that lists the stages that will be launched automatically, computed from the current stage (e.g., from INBOX: "SPECIFY → PLAN → BUILD will run automatically"; from SPECIFY: "PLAN → BUILD will run automatically"; from PLAN: "BUILD will run automatically").
- **FR-009**: Confirming the modal MUST turn auto-mode on and persist that state for the ticket.
- **FR-010**: If no workflow job is currently running on the ticket at the moment of confirmation, confirming the modal MUST immediately dispatch the transition to the next stage.
- **FR-011**: If a workflow job is currently running on the ticket at the moment of confirmation, confirming the modal MUST NOT dispatch any new transition immediately; the chain MUST start when that job completes successfully.
- **FR-012**: Cancelling the modal MUST leave auto-mode unchanged (still off) and MUST NOT dispatch anything.

#### Deactivation flow

- **FR-013**: Clicking the icon while auto-mode is on MUST turn auto-mode off immediately without any confirmation modal.
- **FR-014**: Turning auto-mode off MUST NOT interrupt, cancel, or otherwise affect any workflow job that is already running.
- **FR-015**: After auto-mode is turned off, the icon MUST revert to hover-only visibility.

#### Auto-transition trigger

- **FR-016**: When a workflow job on a ticket with auto-mode on completes successfully and the ticket is currently in SPECIFY or PLAN, the system MUST automatically transition the ticket to the next stage and dispatch the corresponding job — using the same path and authorization as the existing BUILD → VERIFY auto-transition.
- **FR-017**: Manually dragging a card forward while auto-mode is on MUST keep auto-mode on; the next successful job completion MUST still trigger the next transition.

#### Failure handling

- **FR-018**: If any workflow job on a ticket with auto-mode on completes with status FAILED or CANCELLED, the system MUST turn auto-mode off automatically for that ticket.
- **FR-019**: On such a failure, the ticket MUST remain on its current stage; no further transition MUST be dispatched automatically.
- **FR-020**: Re-enabling auto-mode after a failure MUST require an explicit user action (the same activation flow as FR-008/FR-009).
- **FR-021**: If the immediate dispatch triggered on activation (FR-010) fails for any reason (missing credential, quota exhausted, etc.), the failure-handling rule (FR-018) MUST fire and auto-mode MUST be turned off.

#### Rollback interaction

- **FR-022**: When a ticket is rolled back from VERIFY to PLAN (existing VERIFY→PLAN rollback), if auto-mode is on, the rollback MUST turn auto-mode off as part of the rollback operation.

#### Persistence & scope

- **FR-023**: Auto-mode state MUST be stored per ticket and MUST persist across page reloads and user sessions.
- **FR-024**: Auto-mode state on one ticket MUST NOT affect the auto-mode state of any other ticket.
- **FR-025**: All users viewing a given ticket MUST see the same auto-mode state (it is a property of the ticket, not a per-user preference).

### Key Entities *(include if feature involves data)*

- **Ticket auto-mode flag**: A boolean-like property of a full-workflow ticket indicating whether chained stage advancement is enabled. Scoped to a single ticket. Default value when a ticket is created: off.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Auto-transition trigger on job completion**
  - **Input**: A completed workflow job and the ticket it belongs to, including the ticket's current stage, workflow type, and auto-mode flag.
  - **Phases**:
    1. Determine whether the job's terminal status is SUCCESS, FAILED, or CANCELLED.
    2. If terminal status is FAILED or CANCELLED and the ticket has auto-mode on, turn auto-mode off and stop (no further dispatch).
    3. If terminal status is SUCCESS, the workflow type is FULL, auto-mode is on, and the ticket is currently in SPECIFY or PLAN, dispatch the transition to the next stage using the same path as a manual advance.
    4. If terminal status is SUCCESS but the ticket is not in an auto-eligible stage (e.g., BUILD → VERIFY already handled by existing logic), take no auto-mode-specific action.
  - **Output**: Either a newly dispatched next-stage job, or an auto-mode flag turned off, or no state change (if the ticket does not qualify).
  - **Error behavior**: If the auto-dispatch itself fails (credential missing, quota exhausted, any dispatch-layer error), the failure-handling rule fires and auto-mode is turned off; the ticket stays on its current stage.

- **Activation-time immediate dispatch**
  - **Input**: A user confirming the activation modal on a ticket with no currently running job.
  - **Phases**:
    1. Persist auto-mode as on for the ticket.
    2. Dispatch the transition to the next stage using the same path as a manual advance.
    3. If the dispatch fails, turn auto-mode back off (failure-handling rule).
  - **Output**: Auto-mode persisted on, and either a newly dispatched job or auto-mode reverted to off on dispatch failure.
  - **Error behavior**: See phase 3 above; the user is notified through the existing job-failure notification path so they know the chain did not start.

- **Rollback interaction**
  - **Input**: A VERIFY → PLAN rollback request for a ticket.
  - **Phases**:
    1. Execute the existing rollback logic.
    2. If the ticket's auto-mode flag is on, turn it off as part of the rollback.
  - **Output**: Ticket is on PLAN with auto-mode off.
  - **Error behavior**: If the rollback itself fails, auto-mode state is left unchanged (no partial update).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can chain a full-workflow ticket from INBOX to BUILD with exactly one interaction after the initial click — the confirmation modal — and zero further clicks or drags (down from three manual drags today).
- **SC-002**: Zero tickets silently advance past a failed or cancelled job; 100% of such tickets stay on their current stage with auto-mode off after the failure.
- **SC-003**: Auto-mode state is preserved for 100% of tickets across page reloads and new sessions (state is never lost client-side).
- **SC-004**: No infinite loops are observable: after a VERIFY → PLAN rollback, 100% of affected tickets have auto-mode off.
- **SC-005**: The on/off state of auto-mode on any full-workflow ticket in INBOX/SPECIFY/PLAN is visually identifiable from the board without hovering (the "on" state is always visible).
- **SC-006**: Quick-workflow tickets never display the toggle icon in any stage (0% incorrect rendering).
