# Contract: Selective Ticket Cleanup

**Contract ID**: cleanup-tickets
**Feature**: 017-il-faudrait-modifier
**Status**: Specification
**Type**: Test Infrastructure

## Function Signature

```typescript
function cleanupDatabase(): Promise<void>
```

**Location**: `tests/helpers/db-cleanup.ts`
**Scope**: Ticket cleanup portion (lines ~20-25)

## Input Contract

**Parameters**: None (operates on singleton Prisma client)
**Preconditions**:
- Prisma client initialized and connected
- Database accessible (PostgreSQL running)
- Test environment (not production)

**Global State**:
- Uses module-level `prisma` client from `getPrismaClient()`
- May be called multiple times per test session

## Operation Contract

**Primary Operation**:
```typescript
await client.ticket.deleteMany({
  where: {
    title: { startsWith: '[e2e]' }
  }
})
```

**Query Type**: Prisma parameterized DELETE query
**SQL Equivalent**: `DELETE FROM "Ticket" WHERE title LIKE '[e2e]%'`
**Transaction**: Single atomic operation
**Idempotency**: ✅ Yes (safe to call multiple times)

## Output Contract

**Return Value**: `Promise<void>`
**Side Effects**:
- Deletes all tickets with `title` starting with `[e2e]`
- Preserves all tickets without `[e2e]` prefix
- Logs success message to console

**Database State After**:
- Zero tickets with `[e2e]` prefix remain
- Non-test tickets unchanged
- Foreign key constraints maintained

## Acceptance Criteria

### Functional Requirements

**FR-003**: Test cleanup mechanism MUST delete ONLY tickets with `[e2e]` prefix in their title
```typescript
// Given: Database contains mixed tickets
await createTicket({ title: '[e2e] Test Ticket 1' })
await createTicket({ title: '[e2e] Test Ticket 2' })
await createTicket({ title: 'Manual Ticket' })

// When: Cleanup runs
await cleanupDatabase()

// Then: Only [e2e] tickets deleted
const remaining = await prisma.ticket.findMany()
expect(remaining).toHaveLength(1)
expect(remaining[0].title).toBe('Manual Ticket')
```

**FR-005**: Test cleanup mechanism MUST NOT perform database-wide deletion operations
```typescript
// Given: Database contains data
await createTicket({ title: 'Important Data' })

// When: Cleanup runs
await cleanupDatabase()

// Then: Non-test data preserved
const important = await prisma.ticket.findUnique({ where: { title: 'Important Data' } })
expect(important).not.toBeNull()
```

**FR-006**: System MUST preserve all tickets without `[e2e]` prefix during test cleanup
```typescript
// Test matrix: Various ticket titles without prefix
const testCases = [
  'Regular Ticket',
  'e2e Test',  // No brackets
  '[test] Ticket',  // Different prefix
  'Ticket [e2e]',  // Suffix position
]

for (const title of testCases) {
  await createTicket({ title })
  await cleanupDatabase()
  const preserved = await prisma.ticket.findUnique({ where: { title } })
  expect(preserved).not.toBeNull()
}
```

### Non-Functional Requirements

**Performance**:
- MUST complete in <500ms for <100 test tickets
- Acceptable: O(n) table scan (no index required at current scale)

**Security**:
- MUST use Prisma parameterized queries (no SQL injection risk)
- MUST NOT use raw SQL

**Reliability**:
- MUST handle empty database gracefully (no errors)
- MUST handle concurrent calls safely (Prisma connection pooling)

## Error Handling

**Database Unreachable**:
```typescript
try {
  await client.ticket.deleteMany({ ... })
} catch (error) {
  if (error.code === 'P1001') {
    console.warn('⚠️ Skipping database cleanup: database unreachable.')
    return  // Graceful degradation
  }
  throw error
}
```

**Connection Timeout**:
- Existing error handling in `db-cleanup.ts:59-73` applies
- Warns rather than fails test execution
- Allows tests to proceed (may fail later with stale data)

## Test Strategy

### Unit Test (Contract Validation)

**Test File**: `tests/contracts/cleanup-tickets.spec.ts` (new)

```typescript
import { test, expect } from '@playwright/test'
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup'

test.describe('Selective Ticket Cleanup Contract', () => {
  const prisma = getPrismaClient()

  test('should delete only [e2e] prefixed tickets', async () => {
    // Arrange
    await prisma.ticket.createMany({
      data: [
        { title: '[e2e] Test 1', projectId: 1, stage: 'INBOX' },
        { title: '[e2e] Test 2', projectId: 1, stage: 'INBOX' },
        { title: 'Manual Ticket', projectId: 1, stage: 'INBOX' },
      ]
    })

    // Act
    await cleanupDatabase()

    // Assert
    const remaining = await prisma.ticket.findMany()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Manual Ticket')
  })

  test('should preserve tickets without [e2e] prefix', async () => {
    // Arrange
    const tickets = [
      'Important Data',
      'e2e without brackets',
      '[test] Different prefix',
      'Suffix [e2e] position',
    ]

    for (const title of tickets) {
      await prisma.ticket.create({
        data: { title, projectId: 1, stage: 'INBOX' }
      })
    }

    // Act
    await cleanupDatabase()

    // Assert
    const remaining = await prisma.ticket.findMany()
    expect(remaining).toHaveLength(tickets.length)
  })

  test('should handle empty database gracefully', async () => {
    // Arrange: Empty database

    // Act & Assert: Should not throw
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })

  test('should complete in <500ms for 100 tickets', async () => {
    // Arrange: Create 100 test tickets
    const tickets = Array.from({ length: 100 }, (_, i) => ({
      title: `[e2e] Test Ticket ${i}`,
      projectId: 1,
      stage: 'INBOX' as const,
    }))
    await prisma.ticket.createMany({ data: tickets })

    // Act
    const startTime = Date.now()
    await cleanupDatabase()
    const duration = Date.now() - startTime

    // Assert
    expect(duration).toBeLessThan(500)
  })
})
```

### Integration Test (Existing Tests)

**Validation**: All existing tests (40 files) must pass after cleanup modification
**Method**: Run full test suite with modified cleanup helper
**Success Criteria**: Zero test failures, zero regressions

## Dependencies

**Upstream** (Required Before):
- Prisma client initialized
- Test database accessible
- Project 1 exists (for foreign key constraints)

**Downstream** (Affected By):
- All E2E tests (20 files)
- All API tests (7 files)
- All contract tests (3 files)
- All integration tests (5 files)

## Migration Strategy

**Phase 1**: Implement selective cleanup (this contract)
**Phase 2**: Update tests to use `[e2e]` prefix (40 files)
**Rollback**: Restore `deleteMany({})` if issues arise

**Backward Compatibility**:
- Old tests (no prefix): Data deleted by old cleanup, preserved by new cleanup
- New tests (with prefix): Data deleted by both old and new cleanup
- Mixed: Safe transition period (both cleanup strategies coexist)

## Constitutional Compliance

✅ **Principle I: TypeScript-First Development**
- Function signature explicitly typed
- Prisma queries type-safe

✅ **Principle IV: Security-First Design**
- Parameterized query (no SQL injection)
- No raw SQL usage

✅ **Principle V: Database Integrity**
- Prisma ORM exclusive usage
- Foreign key constraints preserved
- Cascade behavior respected

## Contract Status

**Specification**: Complete ✅
**Implementation**: Pending (Phase 2)
**Testing**: Pending (contract tests to be written first)
**Validation**: Pending (existing tests must pass)

**Ready for Implementation**: ✅
