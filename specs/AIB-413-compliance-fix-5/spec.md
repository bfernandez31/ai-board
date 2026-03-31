# Quick Implementation: [Compliance] Fix 5 violations - Component-Driven Architecture

**Feature Branch**: `AIB-413-compliance-fix-5`
**Created**: 2026-03-31
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Fix 5 compliance violations for "Component-Driven Architecture" principle by replacing non-semantic Tailwind color tokens with design system tokens.

### Violations Fixed

1. **stage-column.tsx:218** — `rgba(0,0,0,0.35)` shadow → `hsl(var(--ctp-crust)/0.5)` token
2. **stage-column.tsx:219** — `ring-blue-500 ring-offset-black` → `ring-ring ring-offset-background`
3. **stage-column.tsx:235** — `rgba(0,0,0,0.35)` shadow + `ring-white/10` → crust token + `ring-border/20`
4. **stage-column.tsx:293** — `text-red-400`/`text-red-300` → `text-destructive`/`text-destructive/80`
5. **board.tsx:971-1075** — `border-blue-500`, `bg-blue-500/10`, `border-green-500`, `bg-green-500/10`, `border-red-500`, `bg-red-500/10` → `border-primary`, `border-ctp-green`, `border-destructive` with matching bg tokens

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
