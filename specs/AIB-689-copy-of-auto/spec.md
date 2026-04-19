# Quick Implementation: Copy of Auto-transition mode on full-workflow tickets

**Feature Branch**: `AIB-689-copy-of-auto`
**Created**: 2026-04-19
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Full-workflow tickets require the user to drag the card between stages at every step: SPECIFY → PLAN → PLAN → BUILD. Each manual drag just dispatches the next workflow job and then waits for the user again. For a user who already knows they want the whole chain to run, this is friction for no reason.

BUILD → VERIFY and VERIFY → SHIP already progress automatically once a job or deployment succeeds. The goal is to offer the same "hands-off" behavior for the earlier stages, on demand.

## User value

"Fire and forget" a full ticket: activate auto mode, walk away, come back when the ticket has reached VERIFY on its own.

## Scope

- Applies only to full-workflow tickets.
- Covers the currently-manual forward transitions: INBOX → SPECIFY, SPECIFY → PLAN, PLAN → BUILD.
- Stages already auto-transitioning (BUILD → VERIFY, VERIFY → SHIP) keep their existing behavior.
- Quick-workflow tickets are out of scope (they only have one transition).

## UI behavior

A new toggle icon (double right-chevron, "fast forward") sits on the ticket card next to the existing cancel (×) icon.

- Off: icon is visible only on card hover, same pattern as the cancel icon.
- On: icon stays visible permanently with an accent color, so the state is obvious at a glance on the board.
- The icon is only rendered on full-workflow tickets currently in INBOX, SPECIFY, or PLAN. It is not shown in BUILD, VERIFY, SHIP, or CLOSED.

Tooltips:
- Off: "Enable auto-transition".
- On: "Auto-transition on — click to disable".

## Activation flow

1. User clicks the icon while it is off.
2. A confirmation modal opens listing the stages that will be launched automatically based on the current stage (for example, from INBOX: "SPECIFY → PLAN → BUILD will run automatically").
3. On confirm: auto mode is turned on for this ticket. If no job is currently running on the current stage, the next stage transition is dispatched immediately.
4. On cancel: nothing changes.

## Deactivation flow

- Clicking the icon while auto mode is on disables it immediately, without a modal.
- The icon reverts to hover-only visibility.
- Any job already running is not interrupted; it just will not trigger the next transition on completion.

## Auto-transition trigger

When a workflow job completes successfully on a ticket that has auto mode on and is currently in SPECIFY or PLAN, the next stage transition is dispatched automatically — the same way BUILD → VERIFY happens today.

## Failure handling

If any job on a ticket with auto mode on completes with a failed or cancelled status, auto mode is turned off automatically. The ticket stays on its current stage. The user has to re-enable auto mode manually to resume, after dealing with the failure.

Rationale: a failure usually means something functional needs the user's attention (ambiguous spec, broken test, missing credential, quota exhausted). Silently chaining into the next stage would hide the problem.

## Rollback interaction

If a user rolls a ticket back from VERIFY to PLAN while auto mode is on, auto mode is turned off as part of the rollback. This prevents an infinite loop (auto would otherwise re-dispatch PLAN, which would go to BUILD, which would go to VERIFY, which the user might roll back again). The user re-enables auto mode manually if they want the chain to resume.

## Edge cases

- Toggling auto mode on while a job is already running is allowed; it will take effect when that job finishes.
- Toggling auto mode on while the owner has no valid provider credential: the immediate dispatch fails, which triggers the failure-handling rule and turns auto back off.
- Quota exhausted at a later transition: the dispatch fails, auto turns off.
- User manually drags the card while auto mode is on: auto stays on and will apply at the next job completion.
- Auto mode state is per ticket and persists across page reloads and sessions.

## Acceptance criteria

1. The toggle icon is visible on hover (off) or permanently (on), but only on full-workflow tickets in INBOX, SPECIFY, or PLAN.
2. Enabling auto mode from INBOX with no job running opens a confirmation modal listing the stages to be chained; confirming causes the ticket to progress INBOX → SPECIFY → PLAN → BUILD without any further user action.
3. Enabling auto mode while a job is already running does not open a new dispatch immediately; the chain starts when that job completes successfully.
4. Disabling auto mode reverts the icon to hover-only and prevents any further automatic transition.
5. A failed or cancelled job on a ticket with auto mode on turns auto mode off; the ticket stays on its current stage.
6. Rolling back from VERIFY to PLAN on a ticket with auto mode on turns auto mode off.
7. The auto-mode state persists for the ticket across reloads and is not shared between tickets.
8. Quick-workflow tickets never show the toggle icon.

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

Implementation will be done directly by Claude Code based on the description above.
