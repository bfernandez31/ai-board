# Quickstart: Testing Trophy Architecture

**Feature**: AIB-116-restructure-test-suite
**Date**: 2025-12-24

## Overview

This guide explains how to write and run tests following the Testing Trophy architecture.

## Test Commands

```bash
# Run unit tests (fast, ~1ms per test)
bun run test:unit

# Run integration tests (medium, ~50ms per test)
bun run test:integration

# Run E2E tests (slow, ~500ms per test)
bun run test:e2e

# Run all tests
bun run test
```

## When to Use Each Test Type

| Test Type | Use When | Example |
|-----------|----------|---------|
| **Unit** (Vitest) | Testing pure functions with no side effects | Date formatting, validation logic |
| **Integration** (Vitest) | Testing API endpoints, database operations | Ticket CRUD, job status updates |
| **E2E** (Playwright) | Testing browser-required interactions | Drag-drop, OAuth, keyboard nav |

## Writing Integration Tests

### File Location

```
tests/integration/
├── projects/          # Project-related API tests
├── tickets/           # Ticket-related API tests
├── comments/          # Comment-related API tests
├── jobs/              # Job-related API tests
└── cleanup/           # Cleanup workflow tests
```

### Basic Pattern

```typescript
// tests/integration/tickets/crud.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext } from '@/tests/fixtures/vitest/setup';

describe('Ticket CRUD', () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('should create a ticket', async () => {
    const response = await ctx.api.post(
      `/api/projects/${ctx.projectId}/tickets`,
      { title: '[e2e] Test Ticket' }
    );

    expect(response.status).toBe(201);
    expect(response.data.ticketKey).toMatch(/^[A-Z]{3}-\d+$/);
  });

  it('should get ticket by ID', async () => {
    // Create ticket first
    const created = await ctx.createTicket({ title: '[e2e] Read Test' });

    // Read it back
    const response = await ctx.api.get(
      `/api/tickets/${created.id}`
    );

    expect(response.status).toBe(200);
    expect(response.data.title).toBe('[e2e] Read Test');
  });
});
```

### Using the API Client

```typescript
// GET request
const response = await ctx.api.get('/api/projects/1');

// POST with body
const response = await ctx.api.post('/api/projects', {
  name: '[e2e] New Project',
  key: 'TST'
});

// PATCH with body
const response = await ctx.api.patch('/api/tickets/1', {
  title: 'Updated Title'
});

// DELETE
const response = await ctx.api.delete('/api/tickets/1');

// Check response
expect(response.status).toBe(200);
expect(response.ok).toBe(true);
expect(response.data.id).toBe(1);
```

### Worker Isolation

Each test worker gets an isolated project ID. No manual configuration needed.

```typescript
// ctx.projectId is automatically set based on worker
// Workers 0-5 → Projects [1, 2, 4, 5, 6, 7]
// Project 3 is skipped (reserved for development)

it('uses isolated project', async () => {
  // All tests in this worker share ctx.projectId
  // Different workers use different projects
  // No data conflicts between parallel tests
  console.log(`Running on project ${ctx.projectId}`);
});
```

### Database Fixtures

```typescript
// Create a ticket for testing
const ticket = await ctx.createTicket({
  title: '[e2e] My Ticket',
  description: 'Test description',
  stage: 'INBOX'
});

// Create a user for auth testing
const user = await ctx.createUser('other@e2e.local');

// Clean up test data
await ctx.cleanup();
```

## Writing E2E Tests (Playwright)

Only use Playwright for browser-required scenarios.

### Valid E2E Use Cases

1. **Drag-drop** - Requires real pointer events
2. **OAuth flows** - Requires browser redirects
3. **Keyboard navigation** - Requires real focus management
4. **Viewport testing** - Requires browser window sizing
5. **Visual state** - Requires CSS rendering

### E2E Pattern

```typescript
// tests/e2e/board/drag-drop.spec.ts
import { test, expect } from '@/tests/helpers/worker-isolation';

test('should move ticket via drag-drop', async ({ page, projectId }) => {
  await page.goto(`/projects/${projectId}/board`);

  const ticketCard = page.locator('[data-draggable="true"]').first();
  const targetColumn = page.locator('[data-column="SPECIFY"]');

  await ticketCard.dragTo(targetColumn);

  await expect(ticketCard).toHaveAttribute('data-stage', 'SPECIFY');
});
```

## Migration Guide: Playwright → Vitest

### Step 1: Identify Test Type

Ask: "Does this test REQUIRE a browser?"

- **No browser required** → Migrate to Vitest integration test
- **Browser required** → Keep as Playwright E2E test

### Step 2: Convert Syntax

```typescript
// BEFORE (Playwright)
test('should create ticket', async ({ request }) => {
  const response = await request.post('/api/projects/1/tickets', {
    data: { title: '[e2e] Test' }
  });
  expect(response.status()).toBe(201);
});

// AFTER (Vitest)
it('should create ticket', async () => {
  const response = await ctx.api.post('/api/projects/1/tickets', {
    title: '[e2e] Test'
  });
  expect(response.status).toBe(201);
});
```

### Step 3: Update Imports

```typescript
// BEFORE (Playwright)
import { test, expect } from '@playwright/test';

// AFTER (Vitest)
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext } from '@/tests/fixtures/vitest/setup';
```

### Step 4: File Naming

```
# Rename files
tests/api/tickets.spec.ts → tests/integration/tickets/crud.test.ts
tests/api/projects.spec.ts → tests/integration/projects/crud.test.ts
```

## Common Patterns

### Testing Error Responses

```typescript
it('should return 404 for missing ticket', async () => {
  const response = await ctx.api.get('/api/tickets/99999');

  expect(response.status).toBe(404);
  expect(response.data.error).toBe('Ticket not found');
});
```

### Testing Auth Requirements

```typescript
it('should require auth for protected routes', async () => {
  // Create client without auth
  const unauthApi = createAPIClient({ testUserId: '' });

  const response = await unauthApi.get('/api/projects');

  expect(response.status).toBe(401);
});
```

### Testing Validation

```typescript
it('should validate ticket title', async () => {
  const response = await ctx.api.post(
    `/api/projects/${ctx.projectId}/tickets`,
    { title: '' } // Empty title
  );

  expect(response.status).toBe(400);
  expect(response.data.error).toContain('title');
});
```

## Performance Expectations

| Test Type | Avg Time | Max Time |
|-----------|----------|----------|
| Unit | ~1ms | 10ms |
| Integration | ~50ms | 200ms |
| E2E | ~500ms | 5s |

## Troubleshooting

### "Cannot connect to server"

Ensure the dev server is running:
```bash
bun run dev
```

### "Project not found"

Ensure test fixtures are set up:
```bash
bun run test:integration --run-once
```

### "Data conflicts between tests"

Check that tests use `ctx.cleanup()` in `beforeEach`.
