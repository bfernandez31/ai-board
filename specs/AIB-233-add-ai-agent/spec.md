# Quick Implementation: Add AI agent selection to data model

**Feature Branch**: `AIB-233-add-ai-agent`
**Created**: 2026-03-04
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Allow each ticket to specify which AI agent (Claude Code, Codex, or future agents) should execute its workflows. Projects should have a default agent that tickets inherit.

## Requirements
- Add an `Agent` enum to the Prisma schema with values: `CLAUDE`, `CODEX`
- Add an `agent` field on the `Ticket` model (optional, nullable) — when null, falls back to project default
- Add a `defaultAgent` field on the `Project` model with default value `CLAUDE`
- Create and apply the database migration
- Update API routes for ticket CRUD and project settings to accept/return the new field
- Update Zod validation schemas accordingly

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
