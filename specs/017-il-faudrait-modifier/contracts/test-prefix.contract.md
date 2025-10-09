# Contract: Test Data Prefix Enforcement

**Contract ID**: test-prefix
**Feature**: 017-il-faudrait-modifier
**Status**: Specification
**Type**: Test Pattern Convention

## Convention Overview

All test-generated data MUST use the `[e2e]` prefix pattern to enable selective cleanup and data isolation.

## Prefix Pattern Specification

### Format Definition

**Ticket Title Prefix**:
```
'[e2e] ' + <actual-title>
```

**Project Name Prefix**:
```
'[e2e] ' + <actual-name>
```

**Prefix Components**:
- Opening bracket: `[`
- Identifier: `e2e` (lowercase, no spaces)
- Closing bracket: `]`
- Space separator: ` ` (single space)
- Total length: 6 characters

### Examples

**Valid Ticket Titles**:
```typescript
'[e2e] Fix login bug'
'[e2e] Add dark mode toggle'
'[e2e] Implement user dashboard'
'[e2e] Test ticket with special chars - test, test? test!'
```

**Valid Project Names**:
```typescript
'[e2e] Test Project'
'[e2e] Test Project 2'
'[e2e] Integration Test Board'
```

**Invalid Patterns** (Will NOT be cleaned up):
```typescript
'e2e Fix login bug'           // Missing brackets
'[E2E] Fix login bug'         // Wrong case
'[ e2e ] Fix login bug'       // Extra spaces
'Fix login bug [e2e]'         // Suffix instead of prefix
'[test] Fix login bug'        // Different identifier
```

## Application Scope

### Ticket Creation

**All Test Files**: Every ticket created in tests MUST use prefix

**Before**:
```typescript
const ticket = await createTicket(request, {
  title: 'Fix login bug',
  description: 'Users cannot log in with email',
})
```

**After**:
```typescript
const ticket = await createTicket(request, {
  title: '[e2e] Fix login bug',  // ← Prefix added
  description: 'Users cannot log in with email',
})
```

**Affected Locations**:
- E2E tests: `tests/e2e/*.spec.ts` (20 files)
- API tests: `tests/api/*.spec.ts` (7 files)
- Contract tests: `tests/contracts/*.spec.ts` (3 files)
- Integration tests: `tests/integration/*.spec.ts` (5 files)
- Other tests: `tests/*.spec.ts` (5 files)

### Project Creation

**Test Helper**: Project cleanup in `tests/helpers/db-cleanup.ts`

**Before**:
```typescript
await client.project.create({
  data: {
    id: 1,
    name: 'Test Project',
    description: 'Project for automated tests',
    githubOwner: 'test',
    githubRepo: 'test',
  }
})
```

**After**:
```typescript
await client.project.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    name: '[e2e] Test Project',  // ← Prefix added
    description: 'Project for automated tests',
    githubOwner: 'test',
    githubRepo: 'test',
  }
})
```

**Note**: Projects are primarily created in cleanup helper, not individual tests

## Acceptance Criteria

### FR-001: E2E tests MUST prefix all created ticket titles with `[e2e]`

**Test Pattern**:
```typescript
test.describe('Ticket Creation', () => {
  test('should create ticket with [e2e] prefix', async ({ request }) => {
    const ticket = await createTicket(request, {
      title: '[e2e] Test ticket',  // ✅ Prefix present
      description: 'Test description',
    })

    expect(ticket.title).toMatch(/^\[e2e\] /)
  })
})
```

**Validation**: All test-created tickets in database have `[e2e]` prefix
```sql
SELECT title FROM "Ticket" WHERE title NOT LIKE '[e2e]%';
-- Expected: Only manual/production tickets, no test-created tickets
```

### FR-002: E2E tests MUST prefix all created project names with `[e2e]`

**Test Pattern**:
```typescript
test.beforeEach(async () => {
  await cleanupDatabase()

  // Projects 1 and 2 automatically created with [e2e] prefix
  const project = await prisma.project.findUnique({ where: { id: 1 } })
  expect(project?.name).toBe('[e2e] Test Project')  // ✅ Prefix present
})
```

**Validation**: All test-created projects in database have `[e2e]` prefix
```sql
SELECT name FROM "Project" WHERE name NOT LIKE '[e2e]%';
-- Expected: Only manual/production projects, no test-created projects
```

### FR-011: The `[e2e]` prefix format MUST be consistent across all test-generated entities

**Consistency Check**:
```typescript
// Regex pattern for validation
const E2E_PREFIX_PATTERN = /^\[e2e\] /

// Apply to all test data
function validateE2EPrefix(value: string): boolean {
  return E2E_PREFIX_PATTERN.test(value)
}

// Example usage in tests
expect(validateE2EPrefix('[e2e] Test')).toBe(true)
expect(validateE2EPrefix('e2e Test')).toBe(false)
expect(validateE2EPrefix('[E2E] Test')).toBe(false)
```

## Length Constraint Validation

### Ticket Title Constraints

**Database Constraint**: `title VARCHAR(200)`
**Prefix Length**: 6 characters (`'[e2e] '`)
**Remaining Space**: 194 characters for actual title

**Validation**:
```typescript
function createE2ETicketTitle(actualTitle: string): string {
  const prefix = '[e2e] '
  const fullTitle = prefix + actualTitle

  if (fullTitle.length > 200) {
    throw new Error(`Title too long: ${fullTitle.length} chars (max 200)`)
  }

  return fullTitle
}
```

**Current Test Data**: Longest title ~80 chars → 86 chars with prefix ✅

### Project Name Constraints

**Database Constraint**: `name VARCHAR(100)`
**Prefix Length**: 6 characters (`'[e2e] '`)
**Remaining Space**: 94 characters for actual name

**Validation**:
```typescript
function createE2EProjectName(actualName: string): string {
  const prefix = '[e2e] '
  const fullName = prefix + actualName

  if (fullName.length > 100) {
    throw new Error(`Name too long: ${fullName.length} chars (max 100)`)
  }

  return fullName
}
```

**Current Test Data**: Longest name ~20 chars → 26 chars with prefix ✅

## Migration Checklist

### Per-Test-File Checklist

For each test file (40 total):

- [ ] Identify all ticket creation calls
- [ ] Add `[e2e] ` prefix to ticket `title` fields
- [ ] Verify no title exceeds 200 chars (194 + 6)
- [ ] Run test file individually to verify pass
- [ ] Update any title-matching assertions (if exact match)
- [ ] Commit changes for this file

### Common Patterns to Update

**Pattern 1: Direct ticket creation**
```typescript
// Before
{ title: 'Fix bug', ... }

// After
{ title: '[e2e] Fix bug', ... }
```

**Pattern 2: Ticket arrays**
```typescript
// Before
const tickets = [
  { title: 'First ticket', ... },
  { title: 'Second ticket', ... },
]

// After
const tickets = [
  { title: '[e2e] First ticket', ... },
  { title: '[e2e] Second ticket', ... },
]
```

**Pattern 3: Assertion updates** (if needed)
```typescript
// Before
expect(cardText).toContain('Fix login bug')

// After
expect(cardText).toContain('Fix login bug')  // Still works (substring match)

// OR if exact match required
expect(ticket.title).toBe('[e2e] Fix login bug')
```

## Exception Cases

### When NOT to Use Prefix

**Manual Test Data**:
- Data created via UI for manual testing
- Data created in development database
- Data seeded for development/staging environments

**Production Data**:
- Real user-generated tickets/projects
- Data created outside test execution context

**Rule**: Only test automation code should create `[e2e]` prefixed data

## Validation Strategy

### Automated Validation

**Pre-Merge Hook** (Future Enhancement):
```typescript
// Validate all test files have [e2e] prefix
const testFiles = glob.sync('tests/**/*.spec.ts')
for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  const ticketCreations = content.match(/title:\s*['"]([^'"]+)['"]/g)

  for (const match of ticketCreations || []) {
    if (!match.includes('[e2e]')) {
      console.error(`Missing [e2e] prefix in ${file}:`, match)
      process.exit(1)
    }
  }
}
```

**Note**: Manual validation for initial migration, automated validation optional

### Manual Validation

**After Migration Checklist**:
```bash
# 1. Run full test suite
npm run test

# 2. Check for test data without prefix (should be empty)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Ticket\" WHERE title NOT LIKE '[e2e]%';"

# 3. Verify test projects have prefix
psql $DATABASE_URL -c "SELECT name FROM \"Project\" WHERE id IN (1, 2);"
# Expected: '[e2e] Test Project', '[e2e] Test Project 2'
```

## Test Coverage Requirements

**All Tests Must Pass**: Zero failures after prefix addition
**No Logic Changes**: Test behavior unchanged (only data creation modified)
**Backward Compatible**: Can coexist with unprefixed tests during migration

## Constitutional Compliance

✅ **Principle III: Test-Driven Development**
- Maintains existing test structure
- No impact on test coverage
- Preserves TDD workflow

✅ **Principle I: TypeScript-First Development**
- Type-safe string concatenation
- No type changes required

## Contract Status

**Specification**: Complete ✅
**Implementation**: Pending (40 test files to update)
**Testing**: Validation via existing test suite
**Migration**: Systematic file-by-file approach

**Ready for Implementation**: ✅

## Summary

**Prefix Pattern**: `[e2e] ` (6 chars)
**Scope**: All test-created tickets and projects
**Validation**: Existing test suite (zero failures expected)
**Migration**: 40 test files requiring prefix addition
**Timeline**: ~3-4 hours (40 files × 5 min/file)
