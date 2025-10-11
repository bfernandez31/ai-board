# Test Database Cleanup Guide

## Problem Solved: Project 3 Deletion

Previously, the project 3 created with `scripts/create-dev-project.ts` was being deleted during test runs due to dangerous cleanup functions.

## Root Cause Analysis

**Two cleanup functions existed with different behaviors:**

### ❌ Dangerous: `cleanupTestData()` (OLD - DEPRECATED)
- **Location**: `tests/helpers/db-setup.ts` and `tests/helpers/transition-helpers.ts`
- **Behavior**: Deleted **ALL projects and tickets** without discrimination
- **Impact**: Development project 3 was deleted during test runs

```typescript
// DEPRECATED - DO NOT USE
async function cleanupTestData() {
  await prisma.ticket.deleteMany({});  // ❌ Deletes ALL tickets
  await prisma.project.deleteMany({}); // ❌ Deletes ALL projects (including project 3!)
}
```

### ✅ Safe: `cleanupDatabase()` (CURRENT)
- **Location**: `tests/helpers/db-cleanup.ts`
- **Behavior**: Selective cleanup preserving non-test data
- **Protection**: Projects 1-2 are test fixtures, Project 3+ are preserved

```typescript
// CURRENT - USE THIS
async function cleanupDatabase() {
  // Delete ALL tickets from test projects 1 and 2
  await prisma.ticket.deleteMany({
    where: { projectId: { in: [1, 2] } }
  });

  // Delete only [e2e] prefixed tickets from other projects
  await prisma.ticket.deleteMany({
    where: {
      title: { startsWith: '[e2e]' },
      projectId: { notIn: [1, 2] }
    }
  });

  // Delete only [e2e] prefixed projects (EXCEPT 1 and 2)
  await prisma.project.deleteMany({
    where: {
      name: { startsWith: '[e2e]' },
      id: { notIn: [1, 2] }
    }
  });

  // ✅ Project 3 is PRESERVED because:
  // - It has name "AI Board Development" (no [e2e] prefix)
  // - It has ID 3 (not in test fixtures 1-2)
}
```

## Solution Applied

### Changes Made

1. **Replaced imports in 5 test files:**
   - `tests/e2e/seed/idempotency.spec.ts`
   - `tests/e2e/seed/env-validation.spec.ts`
   - `tests/database/project-uniqueness.spec.ts`
   - `tests/database/project-cascade.spec.ts`
   - `tests/database/ticket-project-constraints.spec.ts`

   ```diff
   - import { cleanupTestData } from '../helpers/db-setup';
   + import { cleanupDatabase } from '../helpers/db-cleanup';
   ```

2. **Replaced function calls:**
   ```diff
   test.beforeEach(async () => {
   -   await cleanupTestData();
   +   await cleanupDatabase();
   });
   ```

3. **Deprecated old functions:**
   - Both `cleanupTestData()` implementations now throw errors
   - Clear deprecation messages guide developers to use `cleanupDatabase()`

## Data Isolation Strategy

### Project ID Allocation

**CRITICAL: Projects 1 and 2 are RESERVED for E2E tests only.**

- **Project 1**: Primary test project (`githubOwner: "test"`, `githubRepo: "test"`)
- **Project 2**: Secondary test project for cross-project tests (`githubOwner: "test"`, `githubRepo: "test2"`)
- **Project 3+**: Available for development and production use

### Test Data Prefix Convention

All E2E test-generated data MUST use the `[e2e]` prefix pattern:

```typescript
// ✅ CORRECT - Test data with [e2e] prefix
await createTicket({
  title: '[e2e] Fix login bug',
  description: 'Test description',
})

// ❌ WRONG - No [e2e] prefix
await createTicket({
  title: 'Fix login bug',
  description: 'Test description',
})
```

### Cleanup Behavior

- **Tickets**: Deletes only tickets with `title` starting with `[e2e]`
- **Projects**: Deletes only projects with `name` starting with `[e2e]` AND `id` NOT IN (1, 2)
- **Manual Data**: All data without `[e2e]` prefix is preserved

## Development Workflow

### Creating Development Project

```bash
# Create or recreate project 3 for development
npx tsx scripts/create-dev-project.ts
```

**Output:**
```
✅ Development project created successfully!
   ID: 3
   Name: AI Board Development
   GitHub: bfernandez31/ai-board
   Board URL: http://localhost:3000/projects/3/board

💡 Use this project for all development work to avoid test interference.
```

### Verifying Project 3 Preservation

```bash
# Check if project 3 exists
npx tsx scripts/check-project-3.ts
```

**Expected Output:**
```
✅ Project 3 EXISTS:
{
  "id": 3,
  "name": "AI Board Development",
  "description": "Main development project for AI Board kanban application",
  "githubOwner": "bfernandez31",
  "githubRepo": "ai-board",
  ...
}
```

### Running Tests Safely

```bash
# Run all E2E tests (project 3 will be preserved)
npm run test:e2e

# Run specific test file
npm run test:e2e -- tests/database/project-uniqueness.spec.ts

# Verify project 3 still exists after tests
npx tsx scripts/check-project-3.ts
```

## Best Practices

### For Test Authors

1. **Always use `cleanupDatabase()` from `db-cleanup.ts`:**
   ```typescript
   import { cleanupDatabase } from './helpers/db-cleanup';

   test.beforeEach(async () => {
     await cleanupDatabase();
   });
   ```

2. **Always prefix test data with `[e2e]`:**
   ```typescript
   const ticket = await createTicket({
     title: '[e2e] Test Ticket',  // ← [e2e] prefix mandatory
     description: 'Test description',
   });
   ```

3. **Use test projects 1 and 2 for E2E tests:**
   ```typescript
   // Use project 1 for primary tests
   const projectId = 1;

   // Use project 2 for cross-project tests
   const otherProjectId = 2;
   ```

4. **Never use project 3+ in automated tests:**
   - Project 3 is reserved for development
   - Projects 4+ may contain production data

### For Developers

1. **Use project 3 for manual testing and development**
2. **Never create data without `[e2e]` prefix in automated tests**
3. **Run tests freely without worrying about project 3 deletion**

## Troubleshooting

### Issue: Project 3 was deleted

**Diagnosis:**
```bash
npx tsx scripts/check-project-3.ts
# Output: ❌ Project 3 NOT FOUND
```

**Solution:**
```bash
# Recreate project 3
npx tsx scripts/create-dev-project.ts
```

**Root Cause Check:**
```bash
# Search for deprecated cleanupTestData() usage
grep -r "cleanupTestData" tests/
# Should only find deprecated function definitions, not active usage
```

### Issue: Tests are failing with cleanup errors

**Diagnosis:**
Test output shows: `cleanupTestData() is deprecated`

**Solution:**
Replace deprecated function with `cleanupDatabase()`:
```typescript
- import { cleanupTestData } from '../helpers/db-setup';
+ import { cleanupDatabase } from '../helpers/db-cleanup';

test.beforeEach(async () => {
-   await cleanupTestData();
+   await cleanupDatabase();
});
```

## Summary

**Before (Problem):**
- ❌ `cleanupTestData()` deleted ALL projects including project 3
- ❌ Development data was lost during test runs
- ❌ Multiple cleanup functions with inconsistent behavior

**After (Solution):**
- ✅ `cleanupDatabase()` preserves non-test data (project 3+)
- ✅ Selective cleanup using `[e2e]` prefix pattern
- ✅ Single source of truth for cleanup logic
- ✅ Development project 3 survives all test runs

**Result:** Development workflow is now safe and predictable! 🎉
