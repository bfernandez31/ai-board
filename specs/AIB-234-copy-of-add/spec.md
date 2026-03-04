# Quick Implementation: Copy of Add agent selector UI on tickets and project settings

**Feature Branch**: `AIB-234-copy-of-add`
**Created**: 2026-03-04
**Mode**: Quick Implementation (bypassing formal specification)

## Description

## Goal
Let users choose which AI agent (Claude Code or Codex) handles a ticket, with a project-level default.

## Requirements
- Add an agent dropdown/selector on the ticket creation form and ticket edit view
- Show the selected agent on ticket cards in the board (small badge/icon)
- Add a default agent selector in project settings
- When creating a ticket, default to the project's `defaultAgent` value
- Agent selection should be possible before moving to SPECIFY or BUILD (not after workflow starts)

## Technical Context
- Depends on the data model ticket (Agent enum on Ticket + Project)
- Ticket creation components: look in `components/` for ticket forms and modals
- Board components: `components/board/` (board.tsx, stage-column.tsx)
- Quick-impl modal: `components/board/quick-impl-modal.tsx`
- Project settings: existing settings UI for project configuration

## Acceptance Criteria
- [ ] Agent dropdown visible on ticket creation
- [ ] Agent dropdown visible on ticket edit (only when in INBOX stage)
- [ ] Agent badge/indicator on ticket cards
- [ ] Default agent configurable in project settings
- [ ] New tickets inherit project default agent

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
