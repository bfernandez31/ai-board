# Research: Increase Ticket Description Limit to 10000 Characters

**Branch**: `AIB-212-copy-of-increase` | **Date**: 2026-02-03

## Executive Summary

This feature requires updating the ticket description character limit from 2500 to 10000 across all validation layers. Research confirms all unknowns are resolved and the change is straightforward.

## Research Findings

### 1. Current Implementation Locations

**Decision**: The limit is enforced at three layers: database, server-side validation, and client-side validation.

**Rationale**: Multi-layer validation ensures data integrity regardless of how the API is called.

**Findings**:

| Layer | File | Line(s) | Current Value |
|-------|------|---------|---------------|
| Database | `prisma/schema.prisma` | 112 | `@db.VarChar(2500)` |
| Zod Field Schema | `lib/validations/ticket.ts` | 48 | `.max(2500)` |
| Zod Create Refine | `lib/validations/ticket.ts` | 82 | `<= 2500` |
| Zod Patch Schema | `lib/validations/ticket.ts` | 105 | `.max(2500)` |
| New Ticket Form | `components/board/new-ticket-modal.tsx` | 263, 274 | Placeholder text, counter |
| Detail Modal | `components/board/ticket-detail-modal.tsx` | 1096 | `maxLength={2500}` |
| Unit Tests | `tests/unit/ticket-validation.test.ts` | 144-148, 165-172 | 2500 char tests |

### 2. Database Migration Strategy

**Decision**: Standard Prisma migration without data transformation.

**Rationale**:
- Increasing a VARCHAR limit never truncates existing data
- All existing descriptions are under the new 10000 limit
- No backfill or transformation scripts needed

**Alternatives Considered**:
- Custom migration with data validation: Rejected (unnecessary overhead)
- Raw SQL migration: Rejected (Prisma handles it correctly)

### 3. UI Character Counter Behavior

**Decision**: Existing CharacterCounter component works without modification.

**Rationale**:
- Component accepts `max` as a prop, dynamically displaying X/max format
- 5-digit numbers (10000) display correctly in current layout
- Warning threshold (90%) scales proportionally

**Findings**:
- `components/ui/character-counter.tsx` uses `max` prop
- Counter format: `{current}/{max}` works with any positive integer
- Warning triggers at `current > max * 0.9` (9000 characters)

### 4. Hook Validation Behavior

**Decision**: `use-ticket-edit.ts` hook receives `maxLength` as parameter from caller.

**Rationale**:
- Hook is generic; limit is passed in by modal components
- Only modal props need updating, not hook logic

**Findings**:
- `ticket-detail-modal.tsx` passes `maxLength: 2500` to hook (line 788)
- This single prop change propagates to all hook validation

### 5. API Route Validation

**Decision**: No direct changes needed to API routes.

**Rationale**:
- Routes use Zod schemas from `lib/validations/ticket.ts`
- Updating schemas automatically updates API validation
- `CreateTicketSchema` and `patchTicketSchema` inherit the change

### 6. Test Coverage

**Decision**: Update existing unit tests to validate 10000 character limit.

**Rationale**:
- Tests already exist in `tests/unit/ticket-validation.test.ts`
- Following constitution: "Update existing tests rather than creating duplicates"

**Tests to Update**:
- `should accept description with maximum length (2500 chars)` → `10000 chars`
- `should reject description exceeding 2500 characters` → `10001 characters`

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing data truncation | None | N/A | Limit increase cannot truncate |
| UI layout issues | Low | Minor | 5-digit counter tested in existing component |
| Performance degradation | Low | Minor | Text storage increase negligible |
| Migration failure | Very Low | Medium | Standard Prisma migration; reversible |

## Unknowns Resolution

All technical context marked as "NEEDS CLARIFICATION" in plan template have been resolved:

| Unknown | Resolution |
|---------|------------|
| Character count method | JavaScript string `.length` (characters, not bytes) |
| Unicode handling | Character-based counting handles multibyte correctly |
| Paste behavior | Form `maxLength` attribute truncates at boundary |
| Counter readability | Existing layout accommodates 5-digit numbers |

## Conclusion

This is a low-complexity, low-risk change affecting 5 source files plus a generated migration. No architectural decisions or trade-offs required. All layers follow the same pattern: update numeric constant from 2500 to 10000.
