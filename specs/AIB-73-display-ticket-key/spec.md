# Quick Implementation: Display ticket key on alert

**Feature Branch**: `AIB-73-display-ticket-key`
**Created**: 2025-11-23
**Mode**: Quick Implementation (bypassing formal specification)

## Description

Display ticket key on alert

When performing a quick implementation (transition from inbox to build), after the confirmation modal is accepted, the success alert was displaying the ticket ID (numeric) instead of the ticket key (e.g., "AIB-73").

## Implementation Notes

This feature is being implemented via quick-impl workflow, bypassing formal specification and planning phases.

**Quick-impl is suitable for**:
- Bug fixes (typos, minor logic corrections)
- UI tweaks (colors, spacing, text changes)
- Simple refactoring (renaming, file organization)
- Documentation updates

**For complex features**, use the full workflow: INBOX → SPECIFY → PLAN → BUILD

## Implementation

**File Changed**: `components/board/board.tsx`

**Change**: Updated the toast message in `handleQuickImplConfirm` callback (line 624) from:
```typescript
description: `Workflow dispatched for ticket #${ticket.id}`,
```
to:
```typescript
description: `Workflow dispatched for ticket ${ticket.ticketKey}`,
```

This ensures users see the human-readable ticket key (e.g., "AIB-73") rather than the internal database ID.
