# Research: Increase Ticket Description Limit to 10000 Characters

**Feature Branch**: `AIB-209-increase-ticket-description`
**Date**: 2026-02-03

## Research Tasks

### 1. PostgreSQL VARCHAR Column Expansion

**Question**: What are the performance implications of expanding a VARCHAR column from 2500 to 10000 characters?

**Decision**: Direct column expansion via Prisma migration

**Rationale**: PostgreSQL's VARCHAR expansion is a metadata-only operation when increasing size. No table rewrite is required, making this a fast operation regardless of table size.

**Alternatives Considered**:
- TEXT type: Would allow unlimited length but lose explicit constraint. Rejected because we want to enforce a specific limit.
- Separate table for long descriptions: Over-engineering for a simple limit increase. Rejected.

**Evidence**:
- PostgreSQL documentation confirms VARCHAR length increase is instant
- Previous ticket AIB-64 used same approach successfully (referenced in spec)

### 2. Zod Validation Schema Updates

**Question**: Where are the description length limits defined and how should they be updated?

**Decision**: Update constants in `lib/validations/ticket.ts`

**Rationale**: All validation schemas are centralized in a single file. Four schemas need updating:
1. `DescriptionFieldSchema` (line 46-49)
2. `CreateTicketSchema` refinement (line 83-86)
3. `descriptionSchema` for PATCH operations (line 102-106)
4. Error messages referencing "2500"

**Alternatives Considered**:
- Extract limit to a constant: Could add `const MAX_DESCRIPTION_LENGTH = 10000` but adds indirection for a single-use value. Acceptable either way.

### 3. UI Component Updates

**Question**: Which UI components display or reference the description character limit?

**Decision**: Update hardcoded values in modal components

**Rationale**: Found two locations with hardcoded "2500" strings:
1. `components/board/new-ticket-modal.tsx` (line 262, 274)
2. Need to check `ticket-detail-modal.tsx` for similar patterns

**Alternatives Considered**:
- Import constant from validation file: Would require exporting constant, adds coupling. For simple placeholder text, inline value is acceptable.

### 4. Test Updates

**Question**: Which tests verify the 2500 character limit?

**Decision**: Update existing test expectations in `tests/unit/ticket-validation.test.ts`

**Rationale**: Tests exist at lines 144-172 that verify both valid (2500 chars) and invalid (2501 chars) cases. Update to 10000/10001.

**Files Identified**:
- `tests/unit/ticket-validation.test.ts` - Unit tests for Zod schemas
- `tests/integration/tickets/crud.test.ts` - May have description length tests
- `tests/e2e/tickets/inline-editing.spec.ts` - May reference limit in UI tests

### 5. Database Migration Strategy

**Question**: How should the migration be structured?

**Decision**: Single migration changing `@db.VarChar(2500)` to `@db.VarChar(10000)`

**Rationale**:
- Prisma schema already has explicit `@db.VarChar(2500)` annotation
- Change is non-destructive (existing data preserved)
- No rollback complexity (can increase limit back down if needed)

**Migration Steps**:
1. Update `prisma/schema.prisma` line 112
2. Run `bunx prisma migrate dev --name increase-description-limit`
3. Verify migration SQL is `ALTER TABLE` with `TYPE VARCHAR(10000)`

## Summary of Changes

| Layer | File | Change |
|-------|------|--------|
| Database | `prisma/schema.prisma` | `VarChar(2500)` → `VarChar(10000)` |
| Validation | `lib/validations/ticket.ts` | Update 4 schema/error message references |
| UI | `components/board/new-ticket-modal.tsx` | Update placeholder and counter text |
| UI | `components/board/ticket-detail-modal.tsx` | Verify and update if needed |
| Tests | `tests/unit/ticket-validation.test.ts` | Update test expectations |

## Unresolved Questions

None - all technical decisions resolved. This is a straightforward limit increase.
