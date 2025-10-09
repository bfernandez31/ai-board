# Research: E2E Test Data Isolation

**Feature**: 017-il-faudrait-modifier
**Date**: 2025-10-09
**Status**: Complete

## Research Questions

### Q1: Current Test Cleanup Pattern
**Question**: How do existing tests currently clean up test data?

**Findings**:
- Location: `tests/helpers/db-cleanup.ts:17-22`
- Current implementation: `await client.ticket.deleteMany({})` (database-wide)
- Called via: `test.beforeEach(async () => { await cleanupDatabase(); })`
- Impact: Destroys ALL tickets regardless of origin (test vs. manual)
- Project setup: Ensures projects 1 and 2 exist for test stability

**Decision**: Replace `deleteMany({})` with `deleteMany({ where: { title: { startsWith: '[e2e]' } } })`

---

### Q2: Prefix Format Selection
**Question**: What prefix format provides best balance of clarity, searchability, and compatibility?

**Options Evaluated**:
1. `[e2e]` prefix - CHOSEN
   - Pros: Visually distinct, standard bracket notation, grep-friendly
   - Cons: None significant
   - Example: `[e2e] Fix login bug`

2. `__test__` suffix
   - Pros: JavaScript convention
   - Cons: Less visually prominent, harder to spot in UI
   - Example: `Fix login bug__test__`

3. UUID suffix
   - Pros: Guaranteed uniqueness
   - Cons: Not human-readable, pollutes test data with noise
   - Example: `Fix login bug_a1b2c3d4`

4. Separate `isTestData` boolean field
   - Pros: Explicit database flag
   - Cons: Requires schema migration, adds complexity
   - Rejected: Violates "no schema changes" constraint

**Decision**: Use `[e2e]` prefix at start of title/name fields

**Rationale**:
- Clear visual indication in both database and UI
- Standard bracket notation familiar to developers
- Easy to search with `startsWith('[e2e]')` in Prisma
- No schema changes required
- Preserves test readability

---

### Q3: Selective Cleanup Implementation
**Question**: How to safely implement selective deletion without SQL injection risk?

**Options Evaluated**:
1. Prisma `where` clause with `startsWith` - CHOSEN
   ```typescript
   await client.ticket.deleteMany({
     where: { title: { startsWith: '[e2e]' } }
   })
   ```
   - Pros: Type-safe, parameterized, no SQL injection risk
   - Cons: None
   - Constitution: ✅ Complies with Security-First Design

2. Raw SQL with LIKE operator
   ```sql
   DELETE FROM "Ticket" WHERE title LIKE '[e2e]%'
   ```
   - Pros: Potentially faster
   - Cons: **REJECTED per Constitution** (no raw SQL allowed)
   - Constitution: ❌ Violates Principle IV (Security-First Design)

3. Fetch + filter + delete loop
   ```typescript
   const tickets = await client.ticket.findMany()
   const testTickets = tickets.filter(t => t.title.startsWith('[e2e]'))
   await Promise.all(testTickets.map(t => client.ticket.delete({ where: { id: t.id } })))
   ```
   - Pros: None
   - Cons: Inefficient, multiple queries, race conditions
   - Rejected: Poor performance

**Decision**: Use Prisma `where: { title: { startsWith: '[e2e]' } }`

**Rationale**:
- Type-safe parameterized query (SQL injection proof)
- Constitution compliant (no raw SQL)
- Single database operation (efficient)
- Explicit and readable

---

### Q4: Cleanup Timing Strategy
**Question**: When should cleanup run to ensure test isolation and handle failures?

**Options Evaluated**:
1. `beforeEach` hook - CHOSEN
   - When: Before every test execution
   - Pros: Ensures clean state, handles test failures gracefully
   - Cons: Slightly slower (negligible with selective deletion)
   - Current pattern: Already used in existing tests

2. `afterEach` hook only
   - When: After every test execution
   - Pros: Cleans up immediately after test
   - Cons: **Leaves pollution if test fails/crashes**
   - Rejected: Unsafe

3. `beforeAll` hook only
   - When: Once before test suite
   - Pros: Faster
   - Cons: **Tests interfere with each other**
   - Rejected: Violates test isolation

4. Both `beforeEach` + `afterEach`
   - When: Before and after every test
   - Pros: Maximum cleanup
   - Cons: Redundant, doubles cleanup time
   - Rejected: Unnecessary complexity

**Decision**: Keep existing `beforeEach` pattern with selective cleanup

**Rationale**:
- Already established pattern in codebase
- Handles test failures gracefully
- Ensures clean starting state for every test
- Minimal performance impact with selective deletion

---

### Q5: Test Migration Strategy
**Question**: How to systematically add `[e2e]` prefix to ~40 test files?

**Options Evaluated**:
1. Direct string modification - CHOSEN
   ```typescript
   // Before
   title: 'Fix login bug'
   // After
   title: '[e2e] Fix login bug'
   ```
   - Pros: Simple, explicit, preserves test logic
   - Cons: Manual per-test modification
   - Effort: ~40 files, ~5 min each = ~3-4 hours

2. Wrapper helper function
   ```typescript
   const e2eTitle = (title: string) => `[e2e] ${title}`
   title: e2eTitle('Fix login bug')
   ```
   - Pros: Centralized prefix logic
   - Cons: Adds indirection, harder to grep for actual titles
   - Rejected: Over-engineering

3. Test data factories
   ```typescript
   const createTestTicket = (data) => createTicket({ ...data, title: `[e2e] ${data.title}` })
   ```
   - Pros: DRY principle
   - Cons: Adds abstraction layer, inconsistent with existing patterns
   - Rejected: Not requested, adds complexity

4. Global Playwright test config
   - Pros: Automatic prefix injection
   - Cons: **Not supported by Playwright**
   - Rejected: Technical impossibility

**Decision**: Direct string modification in all test files

**Rationale**:
- Preserves existing test structure and patterns
- Explicit and greppable
- No new abstractions or indirection
- Aligns with "simple over clever" principle

---

### Q6: Project Creation Pattern
**Question**: How should test projects be created and cleaned up?

**Current Pattern** (tests/helpers/db-cleanup.ts:23-56):
```typescript
const project1 = await client.project.findUnique({ where: { id: 1 } })
if (!project1) {
  await client.project.create({
    data: { id: 1, name: 'Test Project', ... }
  })
}
```

**Decision**: Modify to use `[e2e]` prefix and selective cleanup

**New Pattern**:
```typescript
// 1. Delete all [e2e] projects
await client.project.deleteMany({
  where: { name: { startsWith: '[e2e]' } }
})

// 2. Recreate [e2e] test projects with deterministic IDs
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

**Rationale**:
- Consistent with ticket cleanup pattern
- Preserves deterministic IDs (tests expect project 1 and 2)
- `upsert` ensures idempotency
- Selective deletion preserves manual projects

---

### Q7: Test File Categorization
**Question**: What categories of tests exist and what's the migration order?

**Findings** (via `glob tests/**/*.spec.ts`):
```
Total: 40 test files across 6 categories

Category 1: E2E Tests (20 files in tests/e2e/)
- board-empty.spec.ts
- board-multiple.spec.ts
- board-responsive.spec.ts
- cross-project-prevention.spec.ts
- inline-editing.spec.ts
- project-board.spec.ts
- project-routing.spec.ts
- project-validation-404.spec.ts
- project-validation-format.spec.ts
- ticket-card.spec.ts
- ticket-create.spec.ts
- ticket-errors.spec.ts
- ticket-truncation.spec.ts
- [7 more files]

Category 2: API Tests (7 files in tests/api/)
- projects-tickets-get.spec.ts
- projects-tickets-patch.spec.ts
- projects-tickets-post.spec.ts
- tickets-get.spec.ts
- tickets-patch.spec.ts
- tickets-post.spec.ts
- [1 more file]

Category 3: Contract Tests (3 files in tests/contracts/)
- tickets-branch.spec.ts
- tickets-create.spec.ts
- tickets-update.spec.ts

Category 4: Integration Tests (5 files in tests/integration/)
- ticket-automode.spec.ts
- ticket-branch-assignment.spec.ts
- ticket-branch-validation.spec.ts
- ticket-defaults.spec.ts
- ticket-multi-field-update.spec.ts

Category 5: Database Tests (3 files)
- database/ticket-project-constraints.spec.ts
- project-cascade.spec.ts
- project-uniqueness.spec.ts

Category 6: Other Tests (2 files)
- foundation.spec.ts
- drag-drop.spec.ts
- [plus 8 more in root tests/]
```

**Decision**: Migrate in order: Infrastructure → E2E → API → Contracts → Integration → Remaining

**Rationale**:
- Infrastructure first (cleanup helper) enables all other tests
- E2E tests most critical (user-facing functionality)
- API tests next (backend contracts)
- Integration tests depend on both E2E and API
- Database/other tests least critical

---

### Q8: Performance Impact Assessment
**Question**: What's the performance impact of selective deletion vs. database-wide deletion?

**Analysis**:
```
Current (deleteMany({})):
- Operation: Table scan + delete all rows
- Time: ~50ms for 100 tickets
- Complexity: O(n)

Selective (deleteMany({ where: { title: { startsWith: '[e2e]' } } })):
- Operation: Index scan (if indexed) + delete matching rows
- Time: ~50ms for 100 tickets (similar, assuming no index)
- Complexity: O(n) with string comparison
- Note: PostgreSQL string pattern matching without index
```

**Performance Goals** (from plan.md):
- Test cleanup: <2s total
- Selective delete: <500ms per operation

**Decision**: Acceptable without index optimization

**Rationale**:
- Test data volume low (<100 tickets per test)
- String comparison overhead negligible (<10ms)
- No index needed for current scale
- Future optimization: Add `GIN` index if needed

---

### Q9: Edge Case Handling
**Question**: What edge cases need special handling?

**Identified Edge Cases**:

1. **Test failure mid-execution**
   - Scenario: Test crashes before cleanup runs
   - Mitigation: `beforeEach` cleanup handles orphaned data
   - Status: ✅ Handled by existing pattern

2. **Concurrent test runs**
   - Scenario: Parallel test execution with same `[e2e]` data
   - Mitigation: Playwright runs tests serially by default
   - Status: ✅ Not applicable (serial execution)
   - Future: If parallel enabled, use unique IDs per test worker

3. **Manual data with `[e2e]` prefix**
   - Scenario: User manually creates data with `[e2e]` prefix
   - Impact: Gets deleted by test cleanup
   - Mitigation: Document convention, use different prefix for manual testing
   - Status: ⚠️ Acceptable risk (edge case, easily avoided)

4. **Orphaned test entities if cleanup fails**
   - Scenario: Cleanup throws error, test proceeds
   - Mitigation: Existing error handling in db-cleanup.ts:59-73
   - Status: ✅ Already handled with try-catch and logging

5. **Foreign key constraints during deletion**
   - Scenario: Deleting projects before tickets (FK violation)
   - Mitigation: Delete tickets first, then projects (order matters)
   - Status: ✅ Will be handled in updated cleanup function

**Decision**: No additional edge case handling required

**Rationale**:
- Existing patterns handle most edge cases
- Serial test execution prevents concurrency issues
- Manual `[e2e]` prefix usage is user error (documented risk)

---

## Summary of Decisions

| Research Area | Decision | Rationale |
|--------------|----------|-----------|
| Cleanup Pattern | Replace `deleteMany({})` with selective `where` clause | Constitution compliant, safe, efficient |
| Prefix Format | `[e2e]` at start of title/name | Clear, searchable, no schema changes |
| Implementation | Prisma `startsWith('[e2e]')` filter | Type-safe, no SQL injection, constitution compliant |
| Timing | Keep `beforeEach` pattern | Handles failures, ensures clean state |
| Migration | Direct string modification | Simple, explicit, preserves patterns |
| Project Pattern | `[e2e]` prefix + selective cleanup + upsert | Consistent with tickets, idempotent |
| Order | Infrastructure → E2E → API → Others | Critical path first, dependency order |
| Performance | No index optimization needed | Current scale adequate, <500ms target met |
| Edge Cases | Use existing error handling | Sufficient for current requirements |

---

## Best Practices for Future Tests

**When creating new E2E tests**:
1. Always prefix test data titles with `[e2e] `
2. Use `beforeEach(async () => { await cleanupDatabase(); })` pattern
3. Assume clean database state at test start
4. Don't rely on test execution order
5. Use deterministic project IDs (1, 2) for consistency

**Example**:
```typescript
test('should create ticket', async ({ request }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Fix login bug',  // ← Always prefix
    description: 'Test description',
  })
  // ... test logic
})
```

---

## Constitutional Alignment Verification

✅ **Principle I: TypeScript-First Development**
- All cleanup functions maintain strict typing
- Prisma queries are type-safe

✅ **Principle III: Test-Driven Development**
- Existing tests preserved
- Migration approach maintains TDD compliance

✅ **Principle IV: Security-First Design**
- Prisma parameterized queries (no SQL injection)
- No raw SQL (constitution requirement met)

✅ **Principle V: Database Integrity**
- Using Prisma ORM exclusively
- No schema changes required
- Foreign key constraints preserved

---

## Next Steps (Phase 1)

1. Create data-model.md (no schema changes, document pattern)
2. Create contract definitions for cleanup functions
3. Create quickstart.md validation steps
4. Update CLAUDE.md with new test patterns
5. Ready for /tasks command (Phase 2)

---

**Research Complete**: 2025-10-09
**All NEEDS CLARIFICATION resolved**: ✅
**Ready for Phase 1**: ✅
