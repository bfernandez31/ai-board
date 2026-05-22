# Research: Bulk Actions on INBOX Tickets

**Branch**: `AIB-822-bulk-actions-on` | **Date**: 2026-05-22

## Existing Files

### UI Components (Modify)

| File | Purpose | Action |
|------|---------|--------|
| `components/board/board.tsx` | Main board orchestrator (262 lines) | Add selection state management, pass selection props down |
| `components/board/board-grid.tsx` | DnD context + column renderer (161 lines) | Pass selection props to INBOX StageColumn |
| `components/board/stage-column.tsx` | Single stage column (334 lines) | Add checkbox rendering for INBOX, selection callbacks |
| `components/board/ticket-card.tsx` | Draggable ticket card (401 lines) | Add checkbox, Shift+click, Cmd/Ctrl+click handlers |
| `components/board/board-modals.tsx` | Modal orchestration (221 lines) | Add BulkDeleteModal, MergePreviewModal references |
| `components/board/hooks/use-board-keyboard-shortcuts.ts` | Keyboard shortcuts | Add Escape handler for clearing selection |
| `components/board/hooks/use-ticket-transitions.ts` | Transition + delete state | Reference pattern for bulk delete state management |
| `components/board/delete-confirmation-modal.tsx` | Single delete confirmation (67 lines) | Pattern reference for BulkDeleteConfirmationModal |

### API Routes (Modify)

| File | Purpose | Action |
|------|---------|--------|
| `app/api/projects/[projectId]/tickets/[id]/route.ts` | Single ticket CRUD (283 lines) | Pattern reference only — bulk uses new route |
| `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts` | Model override (110 lines) | Pattern reference for bulk model update |

### Shared Libraries (Modify)

| File | Purpose | Action |
|------|---------|--------|
| `lib/db/tickets.ts` | Ticket DB operations | Add `bulkDeleteTickets`, `mergeTickets` functions |
| `lib/tickets/deletion.ts` | Delete with cleanup (105 lines) | Add `bulkDeleteInboxTickets` function |
| `lib/hooks/mutations/useDeleteTicket.ts` | Delete mutation hook (120 lines) | Pattern reference for `useBulkDeleteTickets` |

### Hooks (Modify)

| File | Purpose | Action |
|------|---------|--------|
| `app/lib/hooks/mutations/useUpdateTicket.ts` | Single ticket update (98 lines) | Pattern reference for optimistic bulk updates |
| `app/lib/hooks/queries/useTickets.ts` | Ticket fetching | No change — cache keys used by bulk mutations |
| `app/lib/query-keys.ts` | Query key factory | No change — existing keys sufficient |

### Test Files (Extend)

| File | Purpose | Action |
|------|---------|--------|
| `tests/integration/tickets/crud.test.ts` | Ticket CRUD integration (~100 cases) | Extend with bulk delete, merge scenarios |
| `tests/unit/components/ticket-detail-modal.test.tsx` | Modal testing (~90 cases) | Pattern reference for merge modal tests |

### New Files Required

| File | Purpose |
|------|---------|
| `app/api/projects/[projectId]/tickets/bulk/route.ts` | Bulk operations API endpoint (delete, merge, update-agent, update-model) |
| `components/board/hooks/use-ticket-selection.ts` | Selection state management hook |
| `components/board/floating-action-bar.tsx` | Bottom floating bar with bulk action buttons |
| `components/board/bulk-delete-confirmation-modal.tsx` | Bulk delete confirmation dialog |
| `components/board/merge-preview-modal.tsx` | Merge preview with editable title/description/attachments |
| `lib/hooks/mutations/useBulkTicketActions.ts` | TanStack mutations for all bulk operations |
| `lib/validations/bulk-actions.ts` | Zod schemas for bulk action payloads |
| `lib/tickets/merge.ts` | Server-side merge logic |
| `tests/integration/tickets/bulk-operations.test.ts` | Integration tests for bulk API |
| `tests/unit/components/board/floating-action-bar.test.tsx` | Floating bar component tests |
| `tests/unit/components/board/merge-preview-modal.test.tsx` | Merge modal component tests |
| `tests/unit/components/board/bulk-delete-confirmation-modal.test.tsx` | Bulk delete modal tests |
| `tests/unit/hooks/use-ticket-selection.test.ts` | Selection hook unit tests |

## Patterns to Follow

### Error Handling: Discriminated Result Pattern
From `lib/tickets/deletion.ts:7-9`:
```typescript
export type DeleteTicketResult =
  | { ok: true; prsClosed: number }
  | { ok: false; status: number; body: Record<string, unknown> };
```
Bulk operations MUST return a discriminated result with per-ticket success/failure reporting.

### Active Job Detection
From `lib/tickets/deletion.ts:32-46`:
```typescript
const [hasActiveJob, project] = await Promise.all([
  prisma.job.findFirst({
    where: {
      ticketId: ticket.id,
      status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
    },
  }),
  // ...
]);
```
Bulk delete and merge MUST check for active jobs on each ticket before proceeding.

### Optimistic Concurrency Control
From `app/api/projects/[projectId]/tickets/[id]/route.ts:149`:
```typescript
const result = await patchTicketInline(ticketId, projectId, requestVersion, { ... });
```
And from `lib/tickets/images.ts` — `updateMany` with version constraint:
```typescript
prisma.ticket.updateMany({ where: { id: ticketId, version: expectedVersion }, data: { ... } })
```
Bulk update operations MUST use version-based concurrency for each ticket.

### Optimistic UI Pattern
From `lib/hooks/mutations/useDeleteTicket.ts:76-97`:
```typescript
onMutate: async (ticketId: number) => {
  await queryClient.cancelQueries({ queryKey: queryKeys.projects.tickets(projectId) });
  const previousTickets = queryClient.getQueryData<Ticket[]>(queryKeys.projects.tickets(projectId));
  queryClient.setQueryData<Ticket[]>(queryKeys.projects.tickets(projectId), (old) => {
    if (!old || !Array.isArray(old)) return [];
    return old.filter((t) => t.id !== ticketId);
  });
  return { previousTickets: previousTickets ?? [] };
}
```
Bulk mutations MUST follow the same cancel → snapshot → optimistic update → rollback pattern.

### Cascade Delete (Prisma Schema)
From `prisma/schema.prisma:205`:
```prisma
project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
```
Tickets have `onDelete: Cascade` relationships for comments, jobs, and notifications. `prisma.ticket.delete` cascades automatically. Bulk delete can use `prisma.ticket.deleteMany` for INBOX tickets (no branches to clean up per spec assumption).

### Authorization Pattern
From `lib/db/auth-helpers.ts`:
- `verifyProjectAccess(projectId)` — checks owner OR member
- All bulk operations need a single project-level auth check, then verify each ticket belongs to that project.

### Agent/Model Update Patterns
From `app/api/projects/[projectId]/tickets/[id]/model-config/route.ts:29-36`:
```typescript
const updateData: Record<string, string | null> = {};
for (const key of STAGE_MODEL_KEYS) {
  if (validated.resetAll) {
    updateData[key] = null;
  } else if (validated[key] !== undefined) {
    updateData[key] = validated[key] ?? null;
  }
}
```
Bulk model change applies all 5 stage model keys uniformly.

Agent update uses PATCH on `agent` field (from ticket PATCH route).

### Toast Notification Pattern
From `components/board/board.tsx:117-138`:
```typescript
toast({
  variant: 'destructive',
  title: 'Ticket modified by another user',
  description: 'Please refresh the page and try again.',
});
```
Bulk operations MUST use toast for reporting partial success/failure to the user.

## Research Decisions

### Decision: Single bulk endpoint vs per-action endpoints
- **Chosen**: Single `POST /api/projects/[projectId]/tickets/bulk` with action discriminator
- **Rationale**: Reduces route sprawl; all bulk actions share auth + validation. Action type in body: `{ action: "delete" | "merge" | "update-agent" | "update-model", ticketIds: [...], ... }`
- **Alternatives**: Separate routes per action — rejected because they'd duplicate auth/validation boilerplate

### Decision: Client-side vs server-side selection validation
- **Chosen**: Server validates all ticket IDs belong to project and are in INBOX stage
- **Rationale**: Client selection state is untrusted; server must re-verify stage and ownership. Constitution mandates "Validate ALL user inputs before processing"
- **Alternatives**: Trust client selection — rejected per security-first principle

### Decision: Merge transaction strategy
- **Chosen**: Prisma interactive transaction wrapping update + deleteMany
- **Rationale**: Constitution requires "Use Prisma transactions for operations affecting multiple tables". Merge updates base ticket, then deletes source tickets (cascades jobs/comments/notifications automatically).
- **Alternatives**: Sequential operations without transaction — rejected because partial failure would leave orphaned state

### Decision: Partial success behavior for bulk operations
- **Chosen**: Skip individual failures, proceed with remaining, return detailed report
- **Rationale**: Spec explicitly states "Successfully processed tickets are not rolled back" and skipped tickets get error messages
- **Alternatives**: All-or-nothing transaction — rejected per spec's explicit partial-success requirement

### Decision: Floating action bar implementation
- **Chosen**: Fixed-position div at bottom of viewport (not a Sheet/drawer)
- **Rationale**: Action bar needs to be visible alongside the board columns. Sheet would cover the board. Fixed-position div with aurora styling matches the design system.
- **Alternatives**: Sheet side panel — rejected because it obscures ticket cards

### Decision: Selection state management
- **Chosen**: Custom hook `useTicketSelection` with `Set<number>` for selected IDs, `lastClickedId` for Shift-range
- **Rationale**: React state + Set is sufficient for client-only ephemeral selection. No need for global state library (forbidden). Follows hook composition pattern used throughout the board.
- **Alternatives**: URL-based selection (like modal state) — rejected because selection is ephemeral and shouldn't survive navigation
