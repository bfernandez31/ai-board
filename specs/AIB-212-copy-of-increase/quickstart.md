# Quickstart: Increase Ticket Description Limit

**Branch**: `AIB-212-copy-of-increase` | **Date**: 2026-02-03

## Implementation Order

Execute changes in this order to maintain consistency:

### Step 1: Database Schema

Update Prisma schema and generate migration:

```prisma
// prisma/schema.prisma line 112
description         String               @db.VarChar(10000)
```

```bash
bunx prisma migrate dev --name increase-ticket-description-limit
bunx prisma generate
```

### Step 2: Validation Schemas

Update all Zod schemas in `lib/validations/ticket.ts`:

1. **Line 48**: `DescriptionFieldSchema` - `.max(10000, 'Description must be 10000 characters or less')`
2. **Line 82**: `CreateTicketSchema` refine - `data.description.length <= 10000`
3. **Line 105**: `descriptionSchema` - `.max(10000, { message: 'Description must be 10000 characters or less' })`

### Step 3: UI Components

1. **`components/board/new-ticket-modal.tsx`**:
   - Line 263: Update placeholder text to "max 10000 characters"
   - Line 274: Update counter display to "X/10000 characters"

2. **`components/board/ticket-detail-modal.tsx`**:
   - Line 1096: Update `maxLength={10000}`

### Step 4: Unit Tests

Update `tests/unit/ticket-validation.test.ts`:

1. Lines 144-148: Change test description to "10000 chars" and `'a'.repeat(10000)`
2. Lines 165-172: Change test to "10001 characters" and `'a'.repeat(10001)`
3. Update expected error message to "10000 characters or less"

### Step 5: Verify

```bash
bun run type-check
bun run lint
bun run test:unit
bun run test:integration
```

## Validation Checklist

- [ ] Database migration created and applied
- [ ] Prisma client regenerated
- [ ] All 3 Zod schema locations updated
- [ ] New ticket modal placeholder and counter updated
- [ ] Ticket detail modal maxLength updated
- [ ] Unit tests updated to validate 10000 limit
- [ ] All tests pass
- [ ] Type check passes
- [ ] Lint passes

## Testing Verification

After implementation, verify:

1. Create a new ticket with exactly 10000 characters - should succeed
2. Try to create a ticket with 10001 characters - should show validation error
3. Edit an existing ticket and expand to 10000 characters - should succeed
4. Character counter shows "X/10000" format correctly
