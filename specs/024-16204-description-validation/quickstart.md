# Quickstart: Align Description Validation with Title Validation

**Feature Branch**: `024-16204-description-validation`
**Date**: 2025-10-11

## Overview
This quickstart guide validates that ticket description validation has been aligned with title validation, ensuring consistent character set validation across POST (create) and PATCH (edit) operations.

## Prerequisites

### Environment Setup
```bash
# Ensure you're on the feature branch
git checkout 024-16204-description-validation

# Install dependencies (if needed)
npm install

# Start development database (if not running)
docker compose up -d postgres

# Run migrations (if needed)
npx prisma migrate dev

# Start development server
npm run dev
```

### Test Data Setup
Ensure test projects 1 and 2 exist with `[e2e]` prefix:
```bash
# Run database setup script
npx tsx scripts/create-test-projects.ts
```

## Validation Tests

### Test 1: Create Ticket with Special Characters (POST)
**Purpose**: Verify POST endpoint accepts allowed special characters

```bash
curl -X POST http://localhost:3000/api/projects/1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "[e2e] Fix login bug",
    "description": "Description with [brackets], (parens), and '\''quotes'\''"
  }'
```

**Expected Response**: `200 OK` with ticket JSON
```json
{
  "id": 123,
  "title": "[e2e] Fix login bug",
  "description": "Description with [brackets], (parens), and 'quotes'",
  "stage": "INBOX",
  "version": 1,
  "projectId": 1,
  ...
}
```

### Test 2: Update Description with Special Characters (PATCH)
**Purpose**: Verify PATCH endpoint accepts allowed special characters (previously failed)

```bash
# Get ticket version first
TICKET_ID=123  # Use ID from Test 1
VERSION=$(curl -s http://localhost:3000/api/projects/1/tickets/$TICKET_ID | jq -r '.version')

# Update description with special characters
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"Updated: [e2e] Testing with {braces}, /slashes/, and @symbols!\",
    \"version\": $VERSION
  }"
```

**Expected Response**: `200 OK` with updated ticket
```json
{
  "id": 123,
  "description": "Updated: [e2e] Testing with {braces}, /slashes/, and @symbols!",
  "version": 2,
  ...
}
```

**Key Validation**: Before this feature, PATCH would reject special characters. Now it accepts them consistently with POST.

### Test 3: Reject Invalid Characters in PATCH
**Purpose**: Verify validation rejects emojis and control characters

```bash
# Update ticket with emoji (should fail)
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"Bug with emoji 😀\",
    \"version\": 2
  }"
```

**Expected Response**: `400 Bad Request` with validation error
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "code": "invalid_string",
      "validation": "regex",
      "message": "can only contain letters, numbers, spaces, and common special characters",
      "path": ["description"]
    }
  ]
}
```

### Test 4: Reject Control Characters in PATCH
**Purpose**: Verify validation rejects newlines and tabs

```bash
# Update ticket with newline (should fail)
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"Line 1\nLine 2\",
    \"version\": 2
  }"
```

**Expected Response**: `400 Bad Request` with validation error

### Test 5: Update Title with Special Characters (PATCH)
**Purpose**: Verify title validation also works consistently

```bash
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"[e2e] Bug: Login fails (critical)\",
    \"version\": 2
  }"
```

**Expected Response**: `200 OK` with updated title

### Test 6: Edge Case - Only Special Characters
**Purpose**: Verify "at least one non-whitespace" rule still enforced

```bash
# Update with only spaces (should fail)
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"   \",
    \"version\": 2
  }"
```

**Expected Response**: `400 Bad Request` with "Description cannot be empty" error

### Test 7: All Allowed Special Characters
**Purpose**: Comprehensive test of entire allowed character set

```bash
curl -X PATCH http://localhost:3000/api/projects/1/tickets/$TICKET_ID \
  -H "Content-Type: application/json" \
  -d "{
    \"description\": \"Chars: .,?!-:;'\\\"\\\(\\\)\\\[\\\]\\\{\\\}\\\\/\\\\@#\$%&*+=_~\\\`|\",
    \"version\": 2
  }"
```

**Expected Response**: `200 OK` accepting all allowed special characters

## Automated Test Execution

### Run Contract Tests
```bash
# Test PATCH endpoint validation
npm test -- tests/api/tickets-patch.spec.ts

# Expected: All tests pass, including new character validation tests
```

### Run E2E Tests
```bash
# Test inline editing with special characters
npm test -- tests/e2e/tickets/inline-editing.spec.ts

# Expected: Tests pass for both valid and invalid character inputs
```

### Run Integration Tests
```bash
# Test validation + branch interaction
npm test -- tests/integration/tickets/ticket-branch-validation.spec.ts

# Expected: Tests pass with updated validation rules
```

### Run All Tests
```bash
# Full test suite
npm test

# Expected: All tests pass (no regressions)
```

## Validation Checklist

After running all tests, verify:

- ✅ POST endpoint accepts special characters in descriptions (unchanged behavior)
- ✅ PATCH endpoint accepts special characters in descriptions (NEW behavior)
- ✅ Both endpoints reject emojis, control characters, and invalid Unicode
- ✅ Both endpoints accept `[e2e]` prefix (critical for test isolation)
- ✅ Both endpoints enforce "at least one non-whitespace" rule
- ✅ Both endpoints trim leading/trailing whitespace
- ✅ Error messages are clear and actionable
- ✅ No breaking changes to existing API contracts
- ✅ No performance degradation (validation < 1ms)

## Success Criteria

### Functional Validation
1. **Consistency**: POST and PATCH use identical character set validation
2. **Completeness**: All allowed characters work in both operations
3. **Security**: All prohibited characters rejected in both operations
4. **Usability**: Error messages guide users to fix validation issues

### Test Coverage
1. **Contract Tests**: API request/response schemas validated
2. **E2E Tests**: Inline editing UI tested with special characters
3. **Integration Tests**: Validation interacts correctly with other features
4. **No Regressions**: All existing tests still pass

### Performance
1. **Response Time**: PATCH endpoint < 200ms p95 (validation overhead < 1ms)
2. **No Database Impact**: No additional queries or schema changes

### Backward Compatibility
1. **Existing Data**: All existing tickets remain valid
2. **API Contract**: No breaking changes to response format
3. **Test Data**: `[e2e]` prefixed data works in all contexts

## Troubleshooting

### Issue: PATCH still rejects special characters
**Diagnosis**: Validation schema not updated or server not restarted
**Fix**:
```bash
# Verify changes in validation file
git diff lib/validations/ticket.ts

# Restart development server
npm run dev
```

### Issue: Tests fail with "cannot read property 'version'"
**Diagnosis**: Test database not seeded with fixture data
**Fix**:
```bash
# Clean and recreate test data
npm test -- --setup
```

### Issue: Validation error messages are unclear
**Diagnosis**: Error message text doesn't match specification
**Fix**:
```bash
# Check error message in validation file
grep -A2 "regex.*ALLOWED_CHARS_PATTERN" lib/validations/ticket.ts

# Should see: "can only contain letters, numbers, spaces, and common special characters"
```

### Issue: Existing tests fail after validation changes
**Diagnosis**: Test data contains characters now rejected by validation
**Fix**:
```bash
# Identify failing test
npm test -- tests/api/tickets-patch.spec.ts

# Update test data to use only allowed characters
# Replace emojis, newlines, etc. with allowed special characters
```

## Rollback Procedure

If validation causes unexpected issues in production:

```bash
# Revert changes to validation file
git checkout HEAD~1 -- lib/validations/ticket.ts

# Restart server
npm run dev

# Verify POST and PATCH work with previous validation
curl -X PATCH http://localhost:3000/api/projects/1/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{"description": "Rollback test", "version": 1}'
```

## Next Steps

After validating the feature works correctly:

1. **Code Review**: Submit PR for team review
2. **Staging Deployment**: Deploy to staging environment for integration testing
3. **Documentation Update**: Update API documentation with new validation rules
4. **Production Deployment**: Deploy to production after staging validation
5. **Monitoring**: Monitor error rates for validation failures (should not increase)

## Resources

- **Feature Specification**: `/specs/024-16204-description-validation/spec.md`
- **Implementation Plan**: `/specs/024-16204-description-validation/plan.md`
- **Research Findings**: `/specs/024-16204-description-validation/research.md`
- **Data Model**: `/specs/024-16204-description-validation/data-model.md`
- **API Contract**: `/specs/024-16204-description-validation/contracts/PATCH-tickets-validation.yaml`
- **Validation File**: `/lib/validations/ticket.ts`
- **Test Files**: `/tests/api/tickets-patch.spec.ts`, `/tests/e2e/tickets/inline-editing.spec.ts`
