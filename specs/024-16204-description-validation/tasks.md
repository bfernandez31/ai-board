# Tasks: Align Description Validation with Title Validation

**Feature Branch**: `024-16204-description-validation`
**Input**: Design documents from `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/`
**Prerequisites**: research.md, data-model.md, contracts/PATCH-tickets-validation.yaml, quickstart.md

## Execution Flow
```
1. Update validation schemas in lib/validations/ticket.ts
2. Add contract tests for PATCH validation
3. Update E2E tests for inline editing validation
4. Verify backward compatibility and existing tests
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Core Implementation
- [X] T001 Add regex validation to titleSchema and descriptionSchema in lib/validations/ticket.ts

**Details**: Update `titleSchema` and `descriptionSchema` to include `.regex(ALLOWED_CHARS_PATTERN, 'can only contain letters, numbers, spaces, and common special characters')` after `.max()` validation, matching the pattern used in `CreateTicketSchema`.

**Files**: `lib/validations/ticket.ts` (lines 109-143)

**Implementation**:
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

export const descriptionSchema = z
  .string()
  .trim()
  .min(1, { message: 'Description cannot be empty' })
  .max(1000, { message: 'Description must be 1000 characters or less' })
  .regex(
    ALLOWED_CHARS_PATTERN,
    'can only contain letters, numbers, spaces, and common special characters'
  );
```

## Phase 3.2: Tests (Validation)
- [X] T002 [P] Add character validation test cases to tests/api/tickets-patch.spec.ts
- [X] T003 [P] Update inline editing tests in tests/e2e/tickets/inline-editing.spec.ts

**T002 Details**: Add test cases in `tests/api/tickets-patch.spec.ts` to verify:
- Valid special characters accepted: `[e2e]`, `{braces}`, `(parens)`, `'quotes'`, `@symbols`
- Invalid characters rejected: emojis (😀), control chars (`\n`, `\t`)
- Error response format matches contract (400 with Zod validation structure)

**Test Cases to Add**:
```typescript
// Valid characters
test('PATCH /api/projects/1/tickets/:id - accepts description with [e2e] prefix', ...)
test('PATCH /api/projects/1/tickets/:id - accepts description with brackets and quotes', ...)
test('PATCH /api/projects/1/tickets/:id - accepts all allowed special characters', ...)

// Invalid characters
test('PATCH /api/projects/1/tickets/:id - rejects description with emoji', ...)
test('PATCH /api/projects/1/tickets/:id - rejects description with newline', ...)
test('PATCH /api/projects/1/tickets/:id - rejects description with tab character', ...)

// Error format
test('PATCH /api/projects/1/tickets/:id - returns correct validation error structure', ...)
```

**T003 Details**: Update `tests/e2e/tickets/inline-editing.spec.ts` to verify:
- Inline editing accepts special characters in descriptions
- Validation errors display correctly in UI
- Test data with `[e2e]` prefix works in inline editing

**Test Cases to Add/Update**:
```typescript
test('inline edit description with [e2e] prefix succeeds', ...)
test('inline edit description with special characters succeeds', ...)
test('inline edit description with emoji shows validation error', ...)
test('validation error message is clear and actionable', ...)
```

## Phase 3.3: Verification
- [X] T004 Run all existing contract tests to verify no regressions (npm test -- tests/api/)
- [X] T005 Run all existing E2E tests to verify no regressions (npm test -- tests/e2e/)
- [ ] T006 Manual validation using quickstart.md test scenarios

**T004 Details**: Run contract test suite:
```bash
npm test -- tests/api/projects-tickets-post.spec.ts
npm test -- tests/api/tickets-patch.spec.ts
npm test -- tests/api/projects-tickets-get.spec.ts
npm test -- tests/api/tickets-get.spec.ts
```
Expected: All tests pass (no breaking changes)

**T005 Details**: Run E2E test suite:
```bash
npm test -- tests/e2e/tickets/inline-editing.spec.ts
npm test -- tests/e2e/projects/validation-format.spec.ts
```
Expected: All tests pass with updated validation rules

**T006 Details**: Execute manual test scenarios from `quickstart.md`:
- Test 1: Create ticket with special characters (POST)
- Test 2: Update description with special characters (PATCH)
- Test 3: Reject invalid characters (emoji test)
- Test 4: Reject control characters (newline test)
- Test 5: Update title with special characters
- Test 6: Edge case - only spaces (should fail)
- Test 7: All allowed special characters

## Dependencies
- T001 blocks T002, T003 (validation schema must be updated before tests can pass)
- T002, T003 can run in parallel after T001
- T004, T005, T006 require T001, T002, T003 complete

## Parallel Execution Examples

**After T001 completes, launch T002-T003 together**:
```bash
# Terminal 1: Contract tests
npm test -- tests/api/tickets-patch.spec.ts

# Terminal 2: E2E tests
npm test -- tests/e2e/tickets/inline-editing.spec.ts
```

**Verification phase (T004-T006) can run sequentially**:
```bash
# Run all contract tests
npm test -- tests/api/

# Run all E2E tests
npm test -- tests/e2e/

# Manual quickstart validation
# Follow scenarios in quickstart.md
```

## Notes
- **No database migration required** (validation is application-level only)
- **No API contract changes** (response format unchanged)
- **Backward compatible** (all existing tickets remain valid)
- **Test data prefix** (`[e2e]`) must work in all scenarios
- **Performance**: Regex validation < 1ms per field

## Success Criteria
### Functional
- ✅ POST and PATCH use identical character set validation
- ✅ All allowed characters work in both create and edit operations
- ✅ All prohibited characters rejected with clear error messages
- ✅ Test data with `[e2e]` prefix works in inline editing

### Test Coverage
- ✅ Contract tests validate API request/response schemas
- ✅ E2E tests validate inline editing UI behavior
- ✅ No regressions in existing test suite
- ✅ Manual quickstart scenarios pass

### Performance
- ✅ PATCH endpoint response time < 200ms p95
- ✅ Validation overhead < 1ms per field

## Validation Checklist
*Required before marking feature complete*

- [X] lib/validations/ticket.ts updated with regex validation
- [X] titleSchema includes ALLOWED_CHARS_PATTERN
- [X] descriptionSchema includes ALLOWED_CHARS_PATTERN
- [X] Contract tests added for character validation
- [X] E2E tests updated for inline editing validation
- [X] All existing tests pass (no regressions)
- [ ] Manual quickstart scenarios verified
- [X] Error messages clear and actionable
- [X] [e2e] prefix works in all contexts
- [X] Performance benchmarks met

## Files Modified
1. **lib/validations/ticket.ts** (T001)
   - Lines 109-143: Add `.regex()` to titleSchema and descriptionSchema

2. **tests/api/tickets-patch.spec.ts** (T002)
   - Add 7+ test cases for character validation

3. **tests/e2e/tickets/inline-editing.spec.ts** (T003)
   - Add 4+ test cases for inline editing with special characters

## References
- **Feature Specification**: `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/spec.md`
- **Research**: `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/research.md`
- **Data Model**: `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/data-model.md`
- **Contract**: `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/contracts/PATCH-tickets-validation.yaml`
- **Quickstart**: `/home/runner/work/ai-board/ai-board/specs/024-16204-description-validation/quickstart.md`
- **Validation Rules**: `/home/runner/work/ai-board/ai-board/CLAUDE.md` (Validation Rules section)
