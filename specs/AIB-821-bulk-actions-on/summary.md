# Implementation Summary: Bulk actions on INBOX tickets (multi-select + merge)

**Branch**: `AIB-821-bulk-actions-on` | **Date**: 2026-05-22
**Spec**: [spec.md](spec.md)

## Changes Summary

Adds multi-select on the INBOX column with four bulk operations (delete, merge, change-agent, change-model) gated to ≤50 tickets per call. New `Ticket.creatorId` and an extended `Notification` model (TICKET_DELETED/TICKET_MERGED, nullable ticketId+SetNull) enable creator notifications without polluting the comment thread. Selection lives in a new `useBulkSelection` hook; a floating `BulkActionBar` hosts the actions plus two modals (delete confirm, merge preview). All bulk endpoints run inside `prisma.$transaction` with INBOX-stage filter + optimistic-version map.

## Key Decisions

- Four dedicated POST routes (`/tickets/bulk/{delete,merge,agent,model}`) over one generic — narrower Zod, cleaner error tables.
- Bulk merge: smallest-id base preserved, attachments concatenated `[base, ...sources asc]`, TICKET_MERGED notification rows created BEFORE source delete (`ticketId → SetNull` schema). No optimistic update.
- Bulk delete + merge: per-id `expectedVersions` map; agent/model only need stage filter.

## Files Modified

prisma: schema.prisma + 20260522063559_bulk_actions_inbox/migration.sql. lib: validations/bulk.ts, tickets/bulk-operations.ts, hooks/mutations/useBulk{Delete,Merge,UpdateTicketField}.ts, db/tickets.ts. app: 4 new routes under api/projects/[projectId]/tickets/bulk/, notifications/route.ts, projects/[projectId]/tickets/[id]/duplicate/route.ts. components: ui/checkbox.tsx, board/{bulk-action-bar,bulk-delete-confirmation-modal,bulk-merge-preview-modal}.tsx, board/hooks/use-bulk-selection.ts + edits to board.tsx, board-grid.tsx, stage-column.tsx, ticket-card.tsx, hooks/use-board-keyboard-shortcuts.ts. tests: 4 new unit suites, 2 new integration suites, plus extensions to crud/constraints/model-override/keyboard-shortcuts.

## ⚠️ Manual Requirements

Integration test suite requires a running dev server (`TEST_MODE=true bun run dev`) to execute; unit tests and type-check pass locally. SC-001/SC-002 timing smoke-test still owed during PR review.
