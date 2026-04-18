# Quick Implementation: Copy of Per-stage model configuration for Claude workflows

**Feature Branch**: `AIB-679-copy-of-per`
**Created**: 2026-04-18
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Problem

Every workflow currently runs on the same hardcoded Anthropic model (Opus 4.7). Project owners cannot tune the model per job type to reduce cost on simpler stages, nor can they A/B test a stronger model on a single tricky ticket. A new model release requires a repo commit before anyone can use it.

## Expected behavior

Project owners can choose, for each of the following five job types, which Claude model is used:

- SPECIFY
- PLAN
- IMPLEMENT
- QUICK-IMPL
- VERIFY

(`iterate`, `comment-*`, `health-scan`, `retro-spec`, `onboard` are out of scope — they keep running on the global default.)

Available models (whitelist):

- Claude Opus 4.7
- Claude Opus 4.6
- Claude Sonnet 4.6
- Claude Haiku 4.5

Configuration is split in two layers:

1. **Project level** — a default per job type, configured from the project Settings page.
2. **Ticket level override** — optional per-stage override on any individual ticket. Each stage can either pick a model or *inherit from the project default*.

At job dispatch time, the effective model is resolved as: ticket override (if set) → project default → global fallback (Opus 4.7).

## Agent awareness

Only the Claude agent exposes a per-stage model choice. For Codex, Mistral, and Gemini:
- The UI shows an informational message instead of the dropdowns ("Using {Agent}'s latest default model. Per-stage selection is only available for Claude today.")
- No override is applied at dispatch — each agent keeps its own default.

Claude-specific configuration stored on a project or ticket remains dormant when the agent is switched to another provider, and is reactivated if the agent is switched back to Claude.

## Defaults

- **Existing projects** (at migration time): behavior unchanged — Opus 4.7 applied everywhere. No surprise, no regression.
- **New projects** (created after the feature ships): opinionated, cost-conscious defaults:
  - SPECIFY → Opus 4.7
  - PLAN → Opus 4.7
  - IMPLEMENT → Sonnet 4.6
  - QUICK-IMPL → Sonnet 4.6
  - VERIFY → Sonnet 4.6

Owners of existing projects can opt into these smart defaults manually from Settings.

## UI

### Project Settings
A dedicated "AI Models" card on the project Settings page, sitting alongside the existing Clarification Policy card. When the project's default agent is Claude, it shows a 5-row table (one row per job type) with a model selector and a short description of the stage. When the default agent is not Claude, the card shows the informational message described above.

### Ticket override
Accessible from the ticket detail view, via a dialog that mirrors the pattern of the existing Agent edit dialog. Same 5-row layout, but each selector has "Inherit from project default" as the first option (stores no override). A "Reset all to project defaults" action clears the whole override in one click. When the ticket's effective agent is not Claude, the dialog shows the informational message.

### Ticket card indicator
When a ticket has at least one stage overridden, a compact "Custom models" badge is shown next to the existing agent badge, with a tooltip listing the overridden stages.

## Acceptance criteria

- [ ] Project Settings page shows the new "AI Models" card; owners can change any of the 5 models and the change is persisted immediately (optimistic update with revert on error).
- [ ] Creating a new project persists the smart defaults; existing projects keep Opus 4.7 for every stage until explicitly changed.
- [ ] Ticket detail exposes an edit dialog allowing per-stage override, including an "inherit" option per stage and a global reset.
- [ ] At workflow dispatch, the model sent to the workflow is the resolved one (ticket override → project default → Opus 4.7 fallback). This applies to specify, plan, implement, quick-impl, and verify dispatches.
- [ ] Non-Claude agents still run on their current default; any stored Claude model configuration is ignored while another agent is active.
- [ ] Ticket card displays a visible "Custom models" indicator when any stage is overridden on that ticket.
- [ ] The Job record continues to track the model actually used (existing field), so per-stage cost analytics remain available.
- [ ] Only the project owner or a project member can change project-level or ticket-level model configuration (same auth rules as agent edit).
- [ ] Attempting to save an unknown model ID via the API is rejected with a validation error.
- [ ] No regression: an existing project left untouched after migration dispatches every workflow with Opus 4.7, identical to today.

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
