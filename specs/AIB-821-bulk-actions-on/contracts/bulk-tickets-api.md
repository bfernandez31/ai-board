# Contracts: Bulk Tickets API (AIB-821)

All endpoints live under `/api/projects/[projectId]/tickets/bulk/`.

**Shared conventions:**

- **Auth**: session cookie OR Bearer PAT, enforced via `verifyProjectAccess(projectId, request)` (owner OR project member).
- **Method**: `POST` (all bulk actions are mutating; the request bodies are too large for query strings).
- **Content-Type**: `application/json`.
- **`projectId` source of truth**: URL path. Bodies do NOT carry a `projectId`.
- **Error envelope**: `{ error: string, code: string, details?: object }`. Codes are stable; messages may evolve.
- **Atomicity**: every handler wraps its work in `prisma.$transaction`. No partial mutation on any failure.
- **Cap**: every endpoint rejects `ticketIds.length > 50` with `400 BULK_LIMIT_EXCEEDED`.

---

## 1. `POST /api/projects/[projectId]/tickets/bulk/delete`

### Request

```ts
// Validated by bulkDeleteSchema in lib/validations/bulk.ts
{
  ticketIds: number[];                       // 1..50, unique, positive integers
  expectedVersions: Record<number, number>;  // keys ⊇ ticketIds; values are positive ints
}
```

### Zod schema (target shape)

```ts
export const bulkDeleteSchema = z.object({
  ticketIds: z.array(z.number().int().positive())
    .min(1, 'At least one ticket must be selected')
    .max(50, 'Select at most 50 tickets per bulk action')
    .refine(ids => new Set(ids).size === ids.length, 'Ticket ids must be unique'),
  expectedVersions: z.record(z.string().regex(/^\d+$/), z.number().int().positive()),
}).refine(
  (data) => data.ticketIds.every(id => data.expectedVersions[String(id)] !== undefined),
  { message: 'expectedVersions must include every selected ticket id', path: ['expectedVersions'] }
);
```

### Success — `200 OK`

```ts
{
  success: true;
  deleted: {
    count: number;                  // === ticketIds.length
    ticketKeys: string[];           // human-readable keys for toast / activity log
  };
  notifiedCreatorIds: string[];     // user ids that received TICKET_DELETED notifications
}
```

### Errors

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure (cap, duplicates, missing expectedVersions key) |
| 401 | `AUTH_ERROR` | unauthenticated |
| 403 | `FORBIDDEN_PROJECT` | actor lacks project access |
| 403 | `FORBIDDEN_CROSS_PROJECT` | one or more `ticketIds` resolved to a different project |
| 409 | `BULK_CONFLICT_STAGE_DRIFT` | `details: { conflictingIds: number[] }` — at least one id missing or not INBOX |
| 409 | `BULK_CONFLICT_VERSION` | `details: { conflictingIds: number[], currentVersions: Record<number, number> }` |
| 500 | `DATABASE_ERROR` | unexpected DB failure (transaction rolled back) |

### Contract notes

- INBOX tickets never have a `branch` set (branch is created at workflow start, see CLAUDE.md "branch: Created by workflow"). Therefore bulk delete SKIPS the GitHub cleanup path that `lib/tickets/deletion.ts` performs for non-INBOX deletes. This is a deliberate scope narrowing — bulk delete is INBOX-only.
- Cascade behavior matches Prisma schema FKs: comments, jobs, analyses, outcomes are cascade-deleted; notifications targeting deleted tickets switch `ticketId` to NULL (see data-model.md §2).

---

## 2. `POST /api/projects/[projectId]/tickets/bulk/merge`

### Request

```ts
{
  baseTicketId: number;                     // smallest selected id (server re-verifies)
  sourceTicketIds: number[];                // 1..49, unique, disjoint from baseTicketId
  title: string;                            // 1..100 chars
  description: string;                      // 1..10000 chars
  expectedVersions: Record<number, number>; // ⊇ {baseTicketId, ...sourceTicketIds}
}
```

### Zod schema

```ts
export const bulkMergeSchema = z.object({
  baseTicketId: z.number().int().positive(),
  sourceTicketIds: z.array(z.number().int().positive())
    .min(1, 'Merge requires at least 2 tickets')
    .max(49, 'Select at most 50 tickets per bulk action'),
  title: titleSchema,                       // from lib/validations/ticket.ts
  description: descriptionSchema,           // from lib/validations/ticket.ts
  expectedVersions: z.record(z.string().regex(/^\d+$/), z.number().int().positive()),
})
.refine(d => !d.sourceTicketIds.includes(d.baseTicketId), { message: 'baseTicketId cannot appear in sourceTicketIds' })
.refine(d => new Set(d.sourceTicketIds).size === d.sourceTicketIds.length, { message: 'sourceTicketIds must be unique' })
.refine(d => d.sourceTicketIds.every(id => id > d.baseTicketId), { message: 'baseTicketId must be smaller than every source id (FR-016)' })
.refine(d => d.expectedVersions[String(d.baseTicketId)] !== undefined && d.sourceTicketIds.every(id => d.expectedVersions[String(id)] !== undefined), { message: 'expectedVersions must include base and every source id' });
```

### Success — `200 OK`

```ts
{
  success: true;
  base: {
    id: number;
    ticketKey: string;
    title: string;
    description: string;
    version: number;                        // post-merge version (was n, now n+1)
    attachmentCount: number;
    updatedAt: string;                      // ISO 8601
  };
  deleted: {
    count: number;                          // === sourceTicketIds.length
    ticketKeys: string[];
  };
  notifiedCreatorIds: string[];             // recipients of TICKET_MERGED notifications
}
```

### Errors

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure (length, base-not-smallest, missing expectedVersions key) |
| 400 | `BULK_MERGE_REQUIRES_TWO` | `sourceTicketIds.length < 1` (selection had only the base) — emitted only if Zod is bypassed |
| 401 | `AUTH_ERROR` | unauthenticated |
| 403 | `FORBIDDEN_PROJECT` | actor lacks project access |
| 403 | `FORBIDDEN_CROSS_PROJECT` | base or any source not in this project |
| 409 | `BULK_CONFLICT_STAGE_DRIFT` | base or any source missing or not INBOX; `details.conflictingIds` |
| 409 | `BULK_CONFLICT_VERSION` | version mismatch on base or any source; `details.conflictingIds`, `details.currentVersions` |
| 500 | `DATABASE_ERROR` | unexpected DB failure |

### Contract notes

- Notification ordering inside the transaction: `tx.notification.createMany(...)` for TICKET_MERGED runs BEFORE `tx.ticket.delete(...)` on sources, but with `Notification.ticketId` set to the source id. The schema change (`onDelete: SetNull`, see data-model.md §2) ensures the row survives the cascade. `mergedIntoTicketId` is set to the surviving base ticket id so the notification UI can link to it.
- Attachments are concatenated as `[...base.attachments, ...sortedSources.flatMap(s => s.attachments)]`. No deduplication.
- The base ticket's `agent`, model overrides, `autoMode`, `clarificationPolicy`, `workflowType`, `stage`, `branch`, `previewUrl`, and `ticketKey` are preserved (FR-022).

---

## 3. `POST /api/projects/[projectId]/tickets/bulk/agent`

### Request

```ts
{
  ticketIds: number[];      // 1..50, unique
  agent: 'CLAUDE' | 'CODEX' | 'MISTRAL' | 'GEMINI' | null;
}
```

### Zod schema

```ts
export const bulkAgentSchema = z.object({
  ticketIds: z.array(z.number().int().positive())
    .min(1).max(50)
    .refine(ids => new Set(ids).size === ids.length, 'Ticket ids must be unique'),
  agent: z.nativeEnum(Agent).nullable(),
});
```

### Success — `200 OK`

```ts
{
  success: true;
  updated: {
    count: number;
    ticketIds: number[];
    agent: Agent | null;
  };
}
```

### Errors

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure (cap, invalid agent enum) |
| 401 | `AUTH_ERROR` | unauthenticated |
| 403 | `FORBIDDEN_PROJECT` | actor lacks project access |
| 403 | `FORBIDDEN_CROSS_PROJECT` | id resolves to different project |
| 409 | `BULK_CONFLICT_STAGE_DRIFT` | `details.conflictingIds` |
| 500 | `DATABASE_ERROR` | unexpected DB failure |

### Contract notes

- Does NOT emit notifications (FR-030).
- Mutates only `agent` + `version` (increment) + `updatedAt`. All other fields preserved (FR-023).
- No `expectedVersions` requirement — stage filter is sufficient guard.

---

## 4. `POST /api/projects/[projectId]/tickets/bulk/model`

### Request

```ts
{
  ticketIds: number[];      // 1..50, unique
  model: string | null;     // 1..50 chars (matches schema VarChar(50)) or null to clear
}
```

### Zod schema

```ts
export const bulkModelSchema = z.object({
  ticketIds: z.array(z.number().int().positive())
    .min(1).max(50)
    .refine(ids => new Set(ids).size === ids.length, 'Ticket ids must be unique'),
  model: z.union([z.string().min(1).max(50), z.null()]),
});
```

### Success — `200 OK`

```ts
{
  success: true;
  updated: {
    count: number;
    ticketIds: number[];
    model: string | null;
    appliedFields: ['specifyModel', 'planModel', 'implementModel', 'quickImplModel', 'verifyModel'];
  };
}
```

### Errors

Same shape as bulk agent (above). Specific to model: `400 VALIDATION_ERROR` on length > 50 (matches `Ticket.specifyModel @db.VarChar(50)`).

### Contract notes

- Writes the single `model` value to all FIVE per-command override fields (FR-024). The full applied field list is echoed back in `updated.appliedFields` for client logging and tests.
- Does NOT emit notifications (FR-030).

---

## UI Contract: Floating Bulk Action Bar

Component: `components/board/bulk-action-bar.tsx`

**Visible only when**: `selectedIds.size > 0` AND viewing a project board.

**Layout (left → right)**:

| Slot | Element | Behavior |
|---|---|---|
| 1 | `{count} selected` | Updates live with `selectedIds.size` |
| 2 | `<Button>Merge</Button>` | `disabled` when `selectedIds.size < 2` OR `selectedIds.size > 50` |
| 3 | `<Button variant="destructive">Delete</Button>` | `disabled` when `selectedIds.size > 50` |
| 4 | `<Select aria-label="Change agent">` | Dropdown lists `Agent` enum values; selection commits immediately (no extra modal) |
| 5 | `<Select aria-label="Change model">` | Dropdown lists models from `lib/models/claude-models.ts`; selection commits immediately |
| 6 | `<Button variant="ghost">Cancel</Button>` | Clears `selectedIds` and exits select mode |

**Positioning**: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50` (Tailwind static classes — no dynamic construction per CLAUDE.md).

**Theming**: uses `aurora-card` utility from `globals.css` for the blue→violet gradient background.

**Accessibility (FR-032)**:
- All buttons reachable via Tab; visible focus ring (shadcn default).
- `aria-live="polite"` on the counter so screen readers hear count updates.
- Disabled buttons carry `title` attributes with the disable reason.
- Escape key (bound at board level) clears selection and exits the bar.

## UI Contract: Bulk Delete Confirmation Modal

Component: `components/board/bulk-delete-confirmation-modal.tsx`

- Uses shadcn `<Dialog>`.
- Title: `Delete {count} tickets?`
- Body: `This will permanently delete {count} tickets and all their attachments, comments, and history. This action cannot be undone.`
- Buttons: `Cancel` (closes), `Delete {count} tickets` (destructive variant, fires bulk-delete mutation).
- On success: closes itself, parent clears selection, parent exits select mode.

## UI Contract: Bulk Merge Preview Modal

Component: `components/board/bulk-merge-preview-modal.tsx`

- Uses shadcn `<Dialog>` with `aurora-*` styling.
- Title: `Merge {count} tickets`
- Body sections:
  1. **Base label**: "Base: AIB-{n} — {title}" prominently displayed.
  2. **Source list**: each non-base ticket shown as "AIB-{n} — {title}" in ascending id order, with a small "will be deleted" badge.
  3. **Title input**: text field, prefilled with base title, max 100 chars, live char counter.
  4. **Description textarea**: prefilled per FR-019, max 10000 chars, live char counter; counter turns red and submit disables when > 10000.
  5. **Attachment count line**: "Combined attachments: {n}" (computed from base + sources).
- Buttons: `Cancel`, `Merge {count} tickets` (primary; disabled if title or description invalid).
- On submit: fires `useBulkMergeTickets` mutation. On `409 BULK_CONFLICT_*` or `400 VALIDATION_ERROR`, modal stays open and surfaces the error inline above the buttons.
- On success: closes, base ticket refetches, sources removed from board, select mode exits.
