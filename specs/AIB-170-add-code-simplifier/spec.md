# Quick Implementation: Add code simplifier and pr review to verify workflow

**Feature Branch**: `AIB-170-add-code-simplifier`
**Created**: 2026-01-21
**Mode**: Quick Implementation (bypassing formal specification)

## Description

In the verify workflow, add:
1. A new step to run a code simplifier command BEFORE the doc synchronization
2. A code review step AFTER the creation of the PR

The code-simplifier should be inspired by the Claude plugin code simplifier agent but implemented as a command.
The code-review should read the constitution file in addition to CLAUDE.md to determine confidence and find issues.

References:
- Code simplifier: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md
- Code review: https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-review/commands/code-review.md

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
