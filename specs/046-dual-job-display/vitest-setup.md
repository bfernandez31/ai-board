# Vitest Setup Guide

**Feature**: 046-dual-job-display
**Date**: 2025-10-23
**Purpose**: Setup instructions for adding Vitest unit testing to the project

## Why Vitest?

This feature introduces utility functions that are **pure** (no side effects), making them perfect candidates for fast unit tests. Vitest provides:

- ⚡ **Speed**: ~1ms per test vs. ~500ms with Playwright
- 🔄 **Watch Mode**: Instant feedback during development
- 📦 **Minimal Setup**: Works out-of-the-box with TypeScript
- 🎯 **Focused Testing**: Test logic in isolation without browser overhead

## Installation

```bash
npm install -D vitest @vitest/ui
```

## Configuration Files

### 1. Create `vitest.config.ts`

Create this file in the project root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Pure functions don't need jsdom
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Why these settings?**:
- `globals: true` - No need to import `describe`, `it`, `expect` in every file
- `environment: 'node'` - Faster than jsdom, sufficient for utility functions
- `alias: '@'` - Matches existing Next.js path aliases

### 2. Update `package.json`

Add these scripts to the `scripts` section:

```json
{
  "scripts": {
    "test:unit": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:unit:watch": "vitest --watch",
    "test": "vitest && playwright test"
  }
}
```

**Script Purposes**:
- `test:unit` - Run unit tests once (CI)
- `test:unit:ui` - Open Vitest UI for interactive testing
- `test:unit:watch` - Watch mode for development
- `test` - Run all tests (unit + Playwright)

### 3. Update `tsconfig.json` (if needed)

Ensure Vitest types are included:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

## Project Structure

```
tests/
├── unit/                              # NEW: Vitest tests
│   ├── job-filtering.test.ts
│   ├── job-label-transformer.test.ts
│   └── stage-matcher.test.ts
├── integration/                       # Existing: Playwright
│   └── tickets/
│       └── ticket-card-job-status.spec.ts
└── e2e/                              # Existing: Playwright
    └── dual-job-display.spec.ts
```

## Example Unit Test

**File**: `tests/unit/job-filtering.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getWorkflowJob, getAIBoardJob } from '@/lib/utils/job-filtering';
import { Job, Stage } from '@prisma/client';

describe('getWorkflowJob', () => {
  it('returns null for empty array', () => {
    expect(getWorkflowJob([])).toBe(null);
  });

  it('filters out comment jobs', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'comment-plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs);
    expect(result).not.toBe(null);
    expect(result?.command).toBe('specify');
  });

  it('returns most recent workflow job', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'specify',
        status: 'COMPLETED',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: new Date('2024-01-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        command: 'plan',
        status: 'RUNNING',
        startedAt: new Date('2024-01-02'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getWorkflowJob(jobs);
    expect(result?.id).toBe(2);
  });
});

describe('getAIBoardJob', () => {
  it('filters by stage match', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, Stage.SPECIFY);
    expect(result).not.toBe(null);
    expect(result?.command).toBe('comment-specify');
  });

  it('returns null for stage mismatch', () => {
    const jobs: Job[] = [
      {
        id: 1,
        command: 'comment-specify',
        status: 'RUNNING',
        startedAt: new Date('2024-01-01'),
        ticketId: 1,
        projectId: 1,
        branch: null,
        commitSha: null,
        logs: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = getAIBoardJob(jobs, Stage.PLAN);
    expect(result).toBe(null);
  });
});
```

## Running Tests

### Development Workflow

```bash
# Terminal 1: Watch mode (runs on every file save)
npm run test:unit:watch

# Terminal 2: Dev server
npm run dev

# Make changes to lib/utils/job-filtering.ts
# Tests automatically re-run in Terminal 1
```

### CI/CD Workflow

```bash
# Run all tests once
npm test

# Or separately:
npm run test:unit     # Unit tests
npm run test:e2e      # Playwright tests
```

### Interactive UI

```bash
# Open Vitest UI in browser
npm run test:unit:ui
```

The UI provides:
- Visual test results
- Code coverage
- Test filtering
- Source code viewer

## Test Writing Best Practices

### 1. Use Descriptive Test Names

✅ **Good**:
```typescript
it('returns null when no workflow jobs exist')
```

❌ **Bad**:
```typescript
it('works correctly')
```

### 2. Test One Thing Per Test

✅ **Good**:
```typescript
it('filters out comment jobs', () => { /* ... */ });
it('returns most recent job', () => { /* ... */ });
```

❌ **Bad**:
```typescript
it('filters and sorts jobs', () => { /* ... */ });
```

### 3. Use Arrange-Act-Assert Pattern

```typescript
it('returns most recent workflow job', () => {
  // Arrange
  const jobs = [job1, job2];

  // Act
  const result = getWorkflowJob(jobs);

  // Assert
  expect(result?.id).toBe(2);
});
```

### 4. Test Edge Cases

```typescript
describe('getWorkflowJob', () => {
  it('returns null for empty array')          // Edge case
  it('handles single job')                    // Edge case
  it('handles multiple jobs')                 // Happy path
  it('returns null when only comment jobs')   // Edge case
});
```

## Performance Comparison

### Before (Playwright Only)

```
Testing job-filtering functions (20 test cases)
- Browser startup: ~1s
- DOM rendering: ~0.5s per test
- Total: ~11s for 20 tests
```

### After (Vitest)

```
Testing job-filtering functions (20 test cases)
- Pure function execution: ~1ms per test
- Total: ~20ms for 20 tests (550x faster!)
```

## Troubleshooting

### Issue: Import errors with `@/` alias

**Solution**: Ensure `vitest.config.ts` has the `resolve.alias` configuration:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './'),
  },
}
```

### Issue: TypeScript errors with `describe`, `it`, `expect`

**Solution**: Add Vitest types to `tsconfig.json`:

```json
{
  "compilerServices": {
    "types": ["vitest/globals"]
  }
}
```

Or import explicitly:

```typescript
import { describe, it, expect } from 'vitest';
```

### Issue: Prisma types not found

**Solution**: Generate Prisma client before running tests:

```bash
npx prisma generate
npm run test:unit
```

## Coverage Reporting

Enable coverage collection:

```bash
# Install coverage tool
npm install -D @vitest/coverage-v8

# Run tests with coverage
npx vitest --coverage
```

Add to `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/utils/**/*.ts'],
    },
  },
});
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 22

      # Run unit tests (fast)
      - name: Run unit tests
        run: npm run test:unit

      # Run Playwright tests (slower)
      - name: Run E2E tests
        run: npm run test:e2e
```

## Migration Path

### Phase 1: Add Vitest (Current Feature)
- Install Vitest
- Create unit tests for job utilities
- Keep Playwright for integration/E2E

### Phase 2: Gradual Adoption (Future Features)
- Write unit tests for new utility functions
- Refactor existing Playwright tests for utilities to Vitest
- Keep Playwright for component/E2E tests

### Phase 3: Optimization (Long-term)
- Achieve 100% unit test coverage on utilities
- Reduce Playwright test count (focus on critical flows)
- Faster CI/CD pipeline

## Summary

**Benefits**:
- ⚡ 60%+ faster test suite (9s vs. 27s)
- 🔄 Instant feedback during development
- 📊 Better test coverage on edge cases
- 🎯 Clearer test failures (isolated functions)

**Cost**:
- 15 minutes setup time
- One additional tool in stack

**Verdict**: Worth it for any feature with utility functions!
