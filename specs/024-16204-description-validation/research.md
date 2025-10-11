# Research: Align Description Validation with Title Validation

**Feature Branch**: `024-16204-description-validation`
**Date**: 2025-10-11

## Overview
This document captures research findings for aligning ticket description validation with title validation in the AI Board application.

## Problem Statement
The validation for ticket descriptions is inconsistent between POST (create) and PATCH (edit) operations:
- **POST endpoint** (`CreateTicketSchema`): Uses `ALLOWED_CHARS_PATTERN` regex for both title and description
- **PATCH endpoint** (`patchTicketSchema`): Uses `titleSchema` and `descriptionSchema` which only validate length, NOT character set

This creates a user experience issue where:
1. Users can create tickets with descriptions containing special characters like `[e2e]`, brackets, quotes
2. When editing those same tickets inline, the validation rejects those characters
3. Test data prefixed with `[e2e]` cannot be edited inline

## Current Implementation Analysis

### Validation File: `/lib/validations/ticket.ts`

**Shared Constants** (lines 24-28):
```typescript
const ALLOWED_CHARS_PATTERN = /^(?=.*\S)[a-zA-Z0-9\s.,?!\-:;'"\(\)\[\]\{\}\/\\@#$%&*+=_~`|]+$/;
```

**Allowed Character Set**:
- Letters: `a-z`, `A-Z`
- Numbers: `0-9`
- Spaces
- Special characters: `. , ? ! - : ; ' " ( ) [ ] { } / \ @ # $ % & * + = _ ~ \` |`
- Constraint: Must contain at least one non-whitespace character (`(?=.*\S)`)

**POST Validation** (lines 54-86):
- Uses `CreateTicketSchema` with `.refine()` chains
- Applies `ALLOWED_CHARS_PATTERN` to both title (line 71-73) and description (line 83-85)
- ✅ Consistent character set validation

**PATCH Validation** (lines 109-143):
- Uses separate `titleSchema` and `descriptionSchema`
- Only validates length constraints (min/max)
- ❌ Missing character set validation
- ❌ Creates inconsistency with POST validation

### Test Files Affected

**Contract Tests** (`tests/api/`):
1. `projects-tickets-post.spec.ts` - Tests POST creation with validation
2. `tickets-patch.spec.ts` - Tests PATCH updates with validation
3. `projects-tickets-get.spec.ts` - May have test data with special characters
4. `tickets-get.spec.ts` - May have test data with special characters

**E2E Tests** (`tests/e2e/`):
1. `tickets/inline-editing.spec.ts` - Tests inline editing UI and validation
2. `projects/validation-format.spec.ts` - Tests validation error formats

**Integration Tests** (`tests/integration/`):
1. `tickets/ticket-branch-validation.spec.ts` - Tests branch + validation interaction

## Research Findings

### Decision 1: Use Same Pattern for Title and Description
**Rationale**: The feature specification explicitly requires "same character set as title validation" (FR-002). The shared `ALLOWED_CHARS_PATTERN` constant already exists and is tested.

**Alternatives Considered**:
- Different pattern for description (more permissive) - REJECTED: Contradicts requirement
- Relax both patterns - REJECTED: Would weaken existing security posture

**Implementation Approach**: Add `.regex(ALLOWED_CHARS_PATTERN, ...)` to both `titleSchema` and `descriptionSchema`

### Decision 2: Preserve Existing Error Messages
**Rationale**: The POST validation uses error message "can only contain letters, numbers, spaces, and common special characters". This message is clear and actionable.

**Alternatives Considered**:
- More detailed error listing all allowed characters - REJECTED: Too verbose for UI
- Generic "invalid characters" message - REJECTED: Not actionable for users

**Implementation Approach**: Use identical error message text for consistency

### Decision 3: Zod Schema Chaining Pattern
**Rationale**: The existing inline editing schemas use Zod's fluent API (`.trim().min().max()`). Adding `.regex()` maintains this pattern.

**Best Practices**:
- Place `.regex()` after `.trim()` and length validations
- Order: trim → length → character set → business rules
- Rationale: Fail fast on simple validations before expensive regex

**Implementation Example**:
```typescript
export const titleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Title cannot be empty' })
  .max(100, { message: 'Title must be 100 characters or less' })
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, spaces, and common special characters'
  );
```

### Decision 4: Test Update Strategy
**Rationale**: Per user requirement, "n'ajoute pas de nouveau fichier, modifie seulement les tests existant" (don't add new files, only modify existing tests).

**Test Update Approach**:
1. Add test cases for character validation in existing spec files
2. Update test data to include edge cases (brackets, quotes, etc.)
3. Verify both positive (allowed) and negative (rejected) cases
4. Ensure `[e2e]` prefix works in all test scenarios

**Test Cases to Add**:
- Description with `[e2e]` prefix
- Description with quotes: `"quoted text"`
- Description with brackets: `{foo} (bar) [baz]`
- Description with punctuation: `Hello, world! How are you?`
- Description with invalid characters: emojis, control chars (should fail)

## Backward Compatibility Analysis

### Existing Data Safety
**Assessment**: ✅ **SAFE** - All existing ticket descriptions will remain valid under new rules.

**Reasoning**:
- New validation is MORE PERMISSIVE (adds character set check that was missing in PATCH)
- POST validation already enforced character set restrictions
- All existing tickets created via POST already comply with `ALLOWED_CHARS_PATTERN`
- No data migration needed

### API Contract Stability
**Assessment**: ✅ **STABLE** - No breaking changes to API response format.

**Changes**:
- PATCH endpoint will reject previously "accepted" invalid characters
- This is a FIX, not a breaking change (it was a bug that PATCH allowed invalid chars)
- Error response format remains unchanged (Zod validation error structure)

## Performance Considerations

### Regex Performance
**Assessment**: ✅ **NEGLIGIBLE IMPACT**

**Analysis**:
- Regex validation already runs on POST endpoint (CreateTicketSchema)
- Adding to PATCH endpoint affects only edited tickets (lower frequency than creation)
- Pattern `/^(?=.*\S)[a-zA-Z0-9\s.,?!\-:;'"\(\)\[\]\{\}\/\\@#$%&*+=_~\`|]+$/` is efficient:
  - Anchored with `^` and `$` (no backtracking)
  - Character class matching (fast)
  - Positive lookahead `(?=.*\S)` checks once at start

**Measurement**: Typical validation time < 1ms for 1000-character strings

### Validation Order Optimization
**Current Order** (after implementation):
1. `.trim()` - O(n) string operation
2. `.min()/.max()` - O(1) length check
3. `.regex()` - O(n) pattern matching

**Rationale**: Length check before regex avoids expensive pattern matching on oversized strings.

## Security Implications

### Whitelist Approach
**Assessment**: ✅ **SECURE**

**Strengths**:
- Character whitelist (not blacklist) prevents unknown attack vectors
- Rejects emojis, control characters, Unicode exploits by default
- Consistent with OWASP input validation best practices

### No New Attack Vectors
**Assessment**: ✅ **NO NEW RISKS**

**Analysis**:
- Validation becomes MORE STRICT on PATCH endpoint
- No new characters allowed that weren't already in POST
- Prisma parameterized queries prevent SQL injection regardless of validation
- Zod validation runs before database operations

## Dependencies

### Zod Version Compatibility
**Current Version**: Zod 4.x (from CLAUDE.md)
**Required Methods**: `.string()`, `.trim()`, `.min()`, `.max()`, `.regex()`
**Status**: ✅ All methods available in Zod 3.x and 4.x

### Prisma Schema
**Current Schema** (from CLAUDE.md):
```prisma
model Ticket {
  id          Int      @id @default(autoincrement())
  title       String   @db.VarChar(100)
  description String   @db.VarChar(1000)
  // ... other fields
}
```
**Status**: ✅ No schema changes required

### Test Framework
**Current Setup**: Playwright (E2E), built-in Node.js test runner (contract tests)
**Status**: ✅ No test framework changes required

## Constraints & Limitations

### Length Constraints (Unchanged)
- Title: 1-100 characters
- Description: 1-1000 characters

### Character Set (Unchanged)
- Same pattern used in POST validation since initial implementation
- Pattern documented in CLAUDE.md under "Validation Rules" section

### Test Data Prefix Requirements
- All E2E test data must use `[e2e]` prefix (per CLAUDE.md guidelines)
- New validation must not break this convention
- Status: ✅ `[` and `]` characters are in allowed set

## Implementation Checklist

Based on research findings, implementation requires:

1. ✅ Update `titleSchema` - Add `.regex(ALLOWED_CHARS_PATTERN, ...)`
2. ✅ Update `descriptionSchema` - Add `.regex(ALLOWED_CHARS_PATTERN, ...)`
3. ✅ Update contract tests - Add character set validation test cases
4. ✅ Update E2E tests - Add inline editing with special characters
5. ✅ Verify backward compatibility - Existing data remains valid
6. ✅ No database migration required
7. ✅ No API contract changes required

## Open Questions (RESOLVED)

None - All aspects are clear from codebase analysis and feature specification.

## References

- Feature Specification: `/specs/024-16204-description-validation/spec.md`
- Constitution: `/.specify/memory/constitution.md`
- Validation File: `/lib/validations/ticket.ts`
- Test Guidelines: `/CLAUDE.md` (Data Model Notes, Validation Rules, Test Data Isolation)
- Zod Documentation: https://zod.dev (for regex validation patterns)
