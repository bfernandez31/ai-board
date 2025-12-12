# Quickstart: Duplicate Ticket Feature

**Branch**: `AIB-106-duplicate-a-ticket` | **Date**: 2025-12-12

## Prerequisites

- Node.js 22.20.0
- PostgreSQL 14+ running
- Environment configured (`.env.local` with DATABASE_URL)
- Dependencies installed (`bun install`)

## Quick Verification

After implementation, verify the feature works:

```bash
# 1. Start the dev server
bun run dev

# 2. Run the E2E tests
bun run test:e2e tests/e2e/ticket-duplicate.spec.ts

# 3. Run API contract tests
bun run test:e2e tests/api/tickets-duplicate.spec.ts
```

## Implementation Order

### Step 1: Write Tests (TDD - Red Phase)

Create E2E and API tests first. They should fail initially.

```bash
# Create test files
touch tests/e2e/ticket-duplicate.spec.ts
touch tests/api/tickets-duplicate.spec.ts

# Run tests (should fail)
bun run test:e2e tests/e2e/ticket-duplicate.spec.ts
```

### Step 2: Implement API Endpoint (Green Phase)

1. Add `duplicateTicket` function to `lib/db/tickets.ts`:

```typescript
export async function duplicateTicket(
  projectId: number,
  sourceTicketId: number
): Promise<Ticket> {
  // 1. Fetch source ticket
  // 2. Generate new title with "Copy of " prefix
  // 3. Create new ticket with copied fields
  // 4. Return new ticket
}
```

2. Create API route at `app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts`:

```typescript
export async function POST(request, context) {
  // 1. Validate params
  // 2. Verify project access
  // 3. Call duplicateTicket
  // 4. Return 201 with new ticket
}
```

### Step 3: Implement UI (Green Phase)

Add duplicate button to `components/board/ticket-detail-modal.tsx`:

1. Add Copy icon import from lucide-react
2. Add `isDuplicating` state
3. Add `handleDuplicate` function with API call
4. Add button to header row

### Step 4: Verify Tests Pass (Green Phase)

```bash
# All tests should pass now
bun run test:e2e tests/e2e/ticket-duplicate.spec.ts
bun run test:e2e tests/api/tickets-duplicate.spec.ts

# Run full test suite
bun run test
```

## Key Files to Modify

| File | Changes |
|------|---------|
| `lib/db/tickets.ts` | Add `duplicateTicket` function |
| `app/api/projects/[projectId]/tickets/[id]/duplicate/route.ts` | New POST endpoint |
| `components/board/ticket-detail-modal.tsx` | Add duplicate button and handler |
| `tests/e2e/ticket-duplicate.spec.ts` | E2E tests for user flow |
| `tests/api/tickets-duplicate.spec.ts` | API contract tests |

## Testing the Feature Manually

1. Navigate to project board
2. Click on any ticket to open the modal
3. Look for duplicate button (Copy icon) in header row
4. Click duplicate button
5. Verify:
   - Toast shows "Ticket duplicated" with new ticket key
   - Modal closes
   - New ticket appears in INBOX column
   - New ticket has "Copy of " prefix in title
   - Description, policy, and attachments match original

## Troubleshooting

### Test: Button not found
Check `data-testid="duplicate-ticket-button"` is present on the button.

### API: 404 on source ticket
Ensure the source ticket exists and belongs to the correct project.

### UI: Toast not showing
Verify `useToast` hook is imported and `toast()` is called in success handler.

### Attachments not copied
Check that `attachments` field is included in the Prisma select query when fetching source ticket.
