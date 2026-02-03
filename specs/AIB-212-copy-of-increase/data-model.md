# Data Model: Increase Ticket Description Limit

**Branch**: `AIB-212-copy-of-increase` | **Date**: 2026-02-03

## Entity Changes

### Ticket Entity

**Model**: `Ticket` (existing)

**Field Change**:

| Field | Type Before | Type After | Constraint Change |
|-------|-------------|------------|-------------------|
| `description` | `String @db.VarChar(2500)` | `String @db.VarChar(10000)` | Max length increased 4x |

**Prisma Schema Change**:

```prisma
// Before (line 112)
description         String               @db.VarChar(2500)

// After
description         String               @db.VarChar(10000)
```

## Validation Schema Changes

### DescriptionFieldSchema

```typescript
// Before (lib/validations/ticket.ts:46-49)
export const DescriptionFieldSchema = z
  .string()
  .min(1, 'Description is required')
  .max(2500, 'Description must be 2500 characters or less');

// After
export const DescriptionFieldSchema = z
  .string()
  .min(1, 'Description is required')
  .max(10000, 'Description must be 10000 characters or less');
```

### CreateTicketSchema Refine

```typescript
// Before (lib/validations/ticket.ts:79-86)
.refine((data) => data.description.length <= 2500, {
  message: 'Description must be 2500 characters or less',
  path: ['description'],
})

// After
.refine((data) => data.description.length <= 10000, {
  message: 'Description must be 10000 characters or less',
  path: ['description'],
})
```

### descriptionSchema (Patch)

```typescript
// Before (lib/validations/ticket.ts:102-106)
export const descriptionSchema = z
  .string()
  .trim()
  .min(1, { message: 'Description cannot be empty' })
  .max(2500, { message: 'Description must be 2500 characters or less' });

// After
export const descriptionSchema = z
  .string()
  .trim()
  .min(1, { message: 'Description cannot be empty' })
  .max(10000, { message: 'Description must be 10000 characters or less' });
```

## State Transitions

No state transitions are affected by this change. The `description` field is a simple data attribute with no state machine behavior.

## Relationships

No relationship changes. The `description` field is a leaf property of the `Ticket` entity with no foreign key implications.

## Migration

**Type**: Schema alteration (column width increase)

**Strategy**: Standard Prisma migration

**Command**:
```bash
bunx prisma migrate dev --name increase-ticket-description-limit
```

**Rollback**:
```bash
bunx prisma migrate reset  # Development only
# Production: deploy previous migration version
```

**Data Impact**: None. Increasing VARCHAR limit never truncates existing data.
