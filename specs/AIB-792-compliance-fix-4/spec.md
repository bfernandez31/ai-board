# Quick Implementation: [Compliance] Fix 4 violations - Component-Driven Architecture

**Feature Branch**: `AIB-792-compliance-fix-4`
**Created**: 2026-05-12
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Health scan found 4 compliance violations for principle "Component-Driven Architecture":

components/admin/access-denied.tsx:1: Component uses `onClick` and `window.history.back()` but is missing the `'use client'` directive. The constitution's Component-Driven Architecture principle requires Client Components to declare `'use client'` when they need interactivity; Next.js App Router will fail to build server components that bind event handlers.
components/admin/analysis-controls.tsx:1: Component binds `onClick={onRunAnalysis}` but is missing the `'use client'` directive required for Client Components in the Next.js App Router.
components/admin/report-list.tsx:1: Component binds an inline `onClick` handler on a `<div>` but is missing the `'use client'` directive required for Client Components in the Next.js App Router.
components/admin/report-list.tsx:30: Clickable `<div onClick={...} className="cursor-pointer">` for a selectable report row violates the 'Use shadcn/ui components exclusively for UI primitives' rule and lacks accessible affordances (no role, no keyboard handler). The constitution mandates composing shadcn/ui primitives rather than rolling custom interactive elements.

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
