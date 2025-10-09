# Contract: Selective Project Cleanup and Recreation

**Contract ID**: cleanup-projects
**Feature**: 017-il-faudrait-modifier
**Status**: Specification
**Type**: Test Infrastructure

## Function Signature

```typescript
function cleanupDatabase(): Promise<void>
```

**Location**: `tests/helpers/db-cleanup.ts`
**Scope**: Project cleanup and recreation portion (lines ~26-58)

## Input Contract

**Parameters**: None (operates on singleton Prisma client)
**Preconditions**:
- Prisma client initialized and connected
- Database accessible (PostgreSQL running)
- Test environment (not production)
- Ticket cleanup already executed (foreign key safety)

**Global State**:
- Uses module-level `prisma` client from `getPrismaClient()`
- May be called multiple times per test session

## Operation Contract

### Step 1: Delete [e2e] Projects

```typescript
await client.project.deleteMany({
  where: {
    name: { startsWith: '[e2e]' }
  }
})
```

**Query Type**: Prisma parameterized DELETE query
**SQL Equivalent**: `DELETE FROM "Project" WHERE name LIKE '[e2e]%'`
**Cascade Behavior**: Deletes related tickets via `onDelete: Cascade` (if any remain)
**Idempotency**: ✅ Yes (safe to call multiple times)

### Step 2: Recreate Test Projects

```typescript
await client.project.upsert({
  where: { id: 1 },
  update: {},
  create: {
    id: 1,
    name: '[e2e] Test Project',
    description: 'Project for automated tests',
    githubOwner: 'test',
    githubRepo: 'test',
  }
})

await client.project.upsert({
  where: { id: 2 },
  update: {},
  create: {
    id: 2,
    name: '[e2e] Test Project 2',
    description: 'Second project for cross-project tests',
    githubOwner: 'test',
    githubRepo: 'test2',
  }
})
```

**Query Type**: Prisma UPSERT (INSERT or no-op if exists)
**Purpose**: Ensure deterministic test projects exist
**Idempotency**: ✅ Yes (update clause empty, safe repeated calls)

## Output Contract

**Return Value**: `Promise<void>`
**Side Effects**:
- Deletes all projects with `name` starting with `[e2e]`
- Preserves all projects without `[e2e]` prefix
- Ensures projects 1 and 2 exist with `[e2e]` prefix
- Logs success message to console

**Database State After**:
- Project 1: `[e2e] Test Project` exists
- Project 2: `[e2e] Test Project 2` exists
- Non-test projects: Unchanged
- All [e2e] projects recreated fresh

## Acceptance Criteria

### Functional Requirements

**FR-004**: Test cleanup mechanism MUST delete ONLY projects with `[e2e]` prefix in their name
```typescript
// Given: Database contains mixed projects
await createProject({ name: '[e2e] Test Project A' })
await createProject({ name: '[e2e] Test Project B' })
await createProject({ name: 'Production Project' })

// When: Cleanup runs
await cleanupDatabase()

// Then: Only [e2e] projects deleted, then recreated
const remaining = await prisma.project.findMany()
expect(remaining.some(p => p.name === 'Production Project')).toBe(true)
expect(remaining.some(p => p.name === '[e2e] Test Project A')).toBe(false)
expect(remaining.some(p => p.name === '[e2e] Test Project')).toBe(true)  // Recreated
```

**FR-007**: System MUST preserve all projects without `[e2e]` prefix during test cleanup
```typescript
// Test matrix: Various project names without prefix
const testCases = [
  'Production Board',
  'e2e Project',  // No brackets
  '[prod] Project',  // Different prefix
  'Project [e2e]',  // Suffix position
]

for (const name of testCases) {
  await createProject({ name })
  await cleanupDatabase()
  const preserved = await prisma.project.findUnique({ where: { name } })
  expect(preserved).not.toBeNull()
}
```

**FR-002**: E2E tests MUST use projects with `[e2e]` prefix in their name
```typescript
// When: Cleanup runs
await cleanupDatabase()

// Then: Test projects recreated with [e2e] prefix
const project1 = await prisma.project.findUnique({ where: { id: 1 } })
const project2 = await prisma.project.findUnique({ where: { id: 2 } })

expect(project1?.name).toBe('[e2e] Test Project')
expect(project2?.name).toBe('[e2e] Test Project 2')
```

### Non-Functional Requirements

**Performance**:
- MUST complete in <100ms for project operations
- Acceptable: 3 sequential queries (delete + 2 upserts)

**Security**:
- MUST use Prisma parameterized queries (no SQL injection risk)
- MUST NOT use raw SQL

**Reliability**:
- MUST handle missing projects gracefully (upsert creates them)
- MUST handle concurrent calls safely (Prisma handles locking)

**Determinism**:
- MUST create projects with deterministic IDs (1, 2)
- MUST use same names every time (`[e2e] Test Project`, `[e2e] Test Project 2`)
- Tests depend on stable project IDs

## Error Handling

**Database Unreachable**:
```typescript
try {
  await client.project.deleteMany({ ... })
  await client.project.upsert({ ... })
} catch (error) {
  if (error.code === 'P1001') {
    console.warn('⚠️ Skipping database cleanup: database unreachable.')
    return  // Graceful degradation
  }
  throw error
}
```

**Unique Constraint Violation**:
- `upsert` prevents duplicate key errors
- `update: {}` clause means no-op if project exists
- Safe to call multiple times without errors

## Test Strategy

### Unit Test (Contract Validation)

**Test File**: `tests/contracts/cleanup-projects.spec.ts` (new)

```typescript
import { test, expect } from '@playwright/test'
import { cleanupDatabase, getPrismaClient } from '../helpers/db-cleanup'

test.describe('Selective Project Cleanup Contract', () => {
  const prisma = getPrismaClient()

  test('should delete only [e2e] prefixed projects', async () => {
    // Arrange
    await prisma.project.createMany({
      data: [
        { name: '[e2e] Temp Project', githubOwner: 'test', githubRepo: 'temp1' },
        { name: 'Production Project', githubOwner: 'prod', githubRepo: 'prod' },
      ]
    })

    // Act
    await cleanupDatabase()

    // Assert
    const e2eProject = await prisma.project.findFirst({
      where: { name: '[e2e] Temp Project' }
    })
    const prodProject = await prisma.project.findFirst({
      where: { name: 'Production Project' }
    })

    expect(e2eProject).toBeNull()  // Deleted
    expect(prodProject).not.toBeNull()  // Preserved
  })

  test('should recreate projects 1 and 2 with [e2e] prefix', async () => {
    // Arrange: Delete projects if they exist
    await prisma.project.deleteMany({ where: { id: { in: [1, 2] } } })

    // Act
    await cleanupDatabase()

    // Assert
    const project1 = await prisma.project.findUnique({ where: { id: 1 } })
    const project2 = await prisma.project.findUnique({ where: { id: 2 } })

    expect(project1).not.toBeNull()
    expect(project1?.name).toBe('[e2e] Test Project')
    expect(project2).not.toBeNull()
    expect(project2?.name).toBe('[e2e] Test Project 2')
  })

  test('should be idempotent (safe to call multiple times)', async () => {
    // Act: Call cleanup multiple times
    await cleanupDatabase()
    await cleanupDatabase()
    await cleanupDatabase()

    // Assert: Projects still exist correctly
    const project1 = await prisma.project.findUnique({ where: { id: 1 } })
    expect(project1?.name).toBe('[e2e] Test Project')
  })

  test('should preserve projects without [e2e] prefix', async () => {
    // Arrange
    const projects = [
      'Important Project',
      'e2e without brackets',
      '[prod] Different prefix',
      'Suffix [e2e] position',
    ]

    for (const name of projects) {
      await prisma.project.create({
        data: {
          name,
          githubOwner: 'test',
          githubRepo: name.replace(/\s+/g, '-').toLowerCase()
        }
      })
    }

    // Act
    await cleanupDatabase()

    // Assert
    for (const name of projects) {
      const preserved = await prisma.project.findFirst({ where: { name } })
      expect(preserved).not.toBeNull()
    }
  })

  test('should complete in <100ms', async () => {
    // Arrange: Create some [e2e] projects
    await prisma.project.createMany({
      data: [
        { name: '[e2e] Temp 1', githubOwner: 'test', githubRepo: 'temp1' },
        { name: '[e2e] Temp 2', githubOwner: 'test', githubRepo: 'temp2' },
      ]
    })

    // Act
    const startTime = Date.now()
    await cleanupDatabase()
    const duration = Date.now() - startTime

    // Assert
    expect(duration).toBeLessThan(100)
  })
})
```

### Integration Test (Existing Tests)

**Validation**: All existing tests must still find projects 1 and 2 after cleanup
**Method**: Verify no test failures related to missing projects
**Success Criteria**: Zero `projectId: 1` or `projectId: 2` foreign key errors

## Dependencies

**Upstream** (Required Before):
- Prisma client initialized
- Ticket cleanup completed (avoid foreign key conflicts during project deletion)

**Downstream** (Affected By):
- All tests using `projectId: 1` (majority of tests)
- Cross-project tests using `projectId: 2`
- Project routing tests expecting specific project IDs

## Foreign Key Safety

### Deletion Order Matters

**Safe Order** (Current Implementation):
```typescript
// 1. Delete [e2e] tickets first
await client.ticket.deleteMany({ where: { title: { startsWith: '[e2e]' } } })

// 2. Delete [e2e] projects (no FK violations, tickets already gone)
await client.project.deleteMany({ where: { name: { startsWith: '[e2e]' } } })

// 3. Recreate projects
await client.project.upsert({ ... })
```

**Unsafe Order** (Would Cause Errors):
```typescript
// ❌ WRONG: Deleting projects first
await client.project.deleteMany({ ... })  // FK violation if tickets exist
await client.ticket.deleteMany({ ... })
```

**Why Safe**:
- Ticket cleanup removes all `[e2e]` tickets before project deletion
- Project deletion cascades any remaining tickets (shouldn't be any)
- Recreation creates fresh projects for next test

## Migration Strategy

**Phase 1**: Implement selective cleanup (this contract)
**Phase 2**: Update existing project creation to use `[e2e]` prefix
**Rollback**: Restore old `findUnique` + conditional `create` pattern

**Backward Compatibility**:
- Tests expecting "Test Project" → Update to expect "[e2e] Test Project"
- Tests creating manual projects → Unaffected (different names)
- Project ID stability → Maintained (IDs 1 and 2 deterministic)

## Constitutional Compliance

✅ **Principle I: TypeScript-First Development**
- Function signature explicitly typed
- Prisma queries type-safe

✅ **Principle IV: Security-First Design**
- Parameterized queries (no SQL injection)
- No raw SQL usage

✅ **Principle V: Database Integrity**
- Prisma ORM exclusive usage
- Upsert prevents constraint violations
- Foreign key constraints respected
- Cascade behavior leveraged

## Contract Status

**Specification**: Complete ✅
**Implementation**: Pending (Phase 2)
**Testing**: Pending (contract tests to be written first)
**Validation**: Pending (existing tests must pass)

**Ready for Implementation**: ✅
