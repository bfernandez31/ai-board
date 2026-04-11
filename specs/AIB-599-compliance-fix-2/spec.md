# Quick Implementation: [Compliance] Fix 2 violations - Security-First Design

**Feature Branch**: `AIB-599-compliance-fix-2`
**Created**: 2026-04-11
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Health scan found 2 compliance violations for principle "Security-First Design":

1. **app/api/internal/credentials/route.ts:81** — PUT handler has `request.json()` and validation (lines 81-89) outside try-catch block. If JSON parsing fails, the error is unhandled and will not return a structured `{ error }` response.
2. **app/api/projects/import/route.ts:140** — Error response exposes internal database project ID via `existingProjectId` field in 409 DUPLICATE_REPO response.

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
