# Quick Implementation: [Spec Sync] technical/api/schemas

**Feature Branch**: `AIB-396-spec-sync-technical`
**Created**: 2026-03-30
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Health scan detected spec drift: editDocumentationSchema (used by POST /api/projects/:projectId/docs for validating doc edit requests with ticketId, docType, and content fields) exists in app/lib/schemas/documentation.ts but is not documented in the schemas spec.

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
