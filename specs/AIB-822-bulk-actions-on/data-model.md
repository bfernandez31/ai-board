# Data Model: Bulk Actions on INBOX Tickets

**Branch**: `AIB-822-bulk-actions-on` | **Date**: 2026-05-22

## Entities

### No New Database Entities Required

This feature operates on existing `Ticket`, `Job`, `Comment`, and `Notification` models. The selection state is client-only (React state). No schema migration needed.

## Client-Side State

### SelectionState (React hook state)

| Field | Type | Description |
|-------|------|-------------|
| selectedIds | `Set<number>` | Currently selected ticket IDs |
| lastClickedId | `number \| null` | Last clicked ticket ID (for Shift-range selection) |
| isSelectMode | `boolean` | Derived: `selectedIds.size > 0` |

### MergePreviewState

| Field | Type | Description |
|-------|------|-------------|
| baseTicket | `TicketWithVersion` | Lowest ID ticket (merge target) |
| sourceTickets | `TicketWithVersion[]` | Other selected tickets (will be deleted) |
| mergedTitle | `string` | Editable title (pre-filled from base) |
| mergedDescription | `string` | Editable description (pre-filled concatenation) |
| selectedAttachmentIds | `string[]` | Attachment IDs to keep (max 5) |
| totalAttachmentCount | `number` | Combined count before selection |

## Validation Rules

### Bulk Delete
- All ticket IDs must belong to the specified project
- All tickets must be in INBOX stage
- Tickets with PENDING/RUNNING jobs are skipped (not rejected)
- Maximum: no arbitrary cap (bounded by INBOX size, typically <50)

### Merge
- Minimum 2 tickets required
- All tickets must be in INBOX stage
- No tickets may have PENDING/RUNNING jobs (blocks entire merge)
- Combined description ≤ 10,000 characters
- Combined attachments ≤ 5 (user must select which to keep if exceeded)
- Base ticket = lowest ID among selected

### Bulk Agent Change
- Agent must be valid enum value: `CLAUDE | CODEX | MISTRAL | GEMINI`
- All tickets must be in INBOX stage
- Uses optimistic concurrency (version field per ticket)

### Bulk Model Change
- Model must be a valid model ID from `CLAUDE_MODEL_IDS`
- Applies to all 5 stage-level fields: `specifyModel`, `planModel`, `implementModel`, `quickImplModel`, `verifyModel`
- All tickets must be in INBOX stage
- Uses optimistic concurrency (version field per ticket)

## State Transitions

No new database state transitions. Merge results in:
1. Base ticket: INBOX → INBOX (updated title, description, attachments)
2. Source tickets: INBOX → **deleted** (hard delete with cascade)

## Relationships Affected by Merge/Delete

When source tickets are hard-deleted (via Prisma cascade):
- `Job` records: Deleted (FK `ticketId` with `onDelete: Cascade`)
- `Comment` records: Deleted (FK `ticketId` with `onDelete: Cascade`)
- `Notification` records: Deleted (FK `ticketId` with `onDelete: Cascade`)
- `TicketAnalysis` records: Deleted (FK `ticketId` with cascade)
- `TicketOutcome` records: Deleted (FK `ticketId` with cascade)
- `ComparisonRecord` / `ComparisonParticipant`: Deleted (cascade)
- `DecisionPointEvaluation`: Deleted (cascade)
- `AnalysisCalibration`: Deleted (cascade)

The base ticket retains all its own related records untouched.
