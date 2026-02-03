# Quickstart: Increase Ticket Description Limit

**Feature Branch**: `AIB-209-increase-ticket-description`

## Implementation Checklist

### 1. Database Layer

```bash
# Update Prisma schema
# File: prisma/schema.prisma, line 112
# Change: @db.VarChar(2500) → @db.VarChar(10000)

# Generate migration
bunx prisma migrate dev --name increase-description-limit

# Verify migration
bunx prisma generate
```

### 2. Validation Layer

**File**: `lib/validations/ticket.ts`

Update these schemas:
1. Line 49: `DescriptionFieldSchema.max(2500, ...)` → `.max(10000, ...)`
2. Line 83: `CreateTicketSchema` refinement `<= 2500` → `<= 10000`
3. Line 106: `descriptionSchema.max(2500, ...)` → `.max(10000, ...)`

Update error messages from "2500 characters" to "10000 characters".

### 3. UI Layer

**File**: `components/board/new-ticket-modal.tsx`

1. Line 262: Update placeholder text
2. Line 274: Update character counter display

**File**: `components/board/ticket-detail-modal.tsx`

Verify and update any hardcoded "2500" references.

### 4. Test Layer

**File**: `tests/unit/ticket-validation.test.ts`

Update test cases:
1. Line 144-148: Valid max length test (2500 → 10000)
2. Line 165-172: Invalid length test (2501 → 10001)

### 5. Verification

```bash
# Run type check
bun run type-check

# Run unit tests
bun run test:unit

# Run integration tests
bun run test:integration

# Manual verification
# 1. Create ticket with ~5000 character description
# 2. Edit ticket, expand to ~9000 characters
# 3. Verify character counter shows correct values
```

## Files Modified Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | VARCHAR limit |
| `lib/validations/ticket.ts` | Zod schema limits + error messages |
| `components/board/new-ticket-modal.tsx` | UI placeholder + counter |
| `components/board/ticket-detail-modal.tsx` | UI placeholder (if applicable) |
| `tests/unit/ticket-validation.test.ts` | Test expectations |

## Risk Assessment

- **Risk Level**: Low
- **Rollback**: Change Prisma schema back to 2500, revert code changes
- **Data Loss Risk**: None (column expansion preserves existing data)
