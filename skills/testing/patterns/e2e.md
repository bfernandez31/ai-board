# E2E Tests

Browser-based tests with Playwright. **Only for features that REQUIRE a real browser.**

## When to Use (ONLY these cases)

- **OAuth/Authentication** - Browser redirects, cookies, sessions
- **Drag-and-drop** - DnD Kit requires real DOM
- **Keyboard navigation** - Focus management, tab order
- **Viewport/Responsive** - Screen sizes, mobile behavior
- **Complex visual interactions** - Animations, transitions

## When NOT to Use

- API testing → Backend Integration
- Component behavior → Component tests or Frontend Integration
- Form validation → Component tests
- Data fetching → Frontend Integration with MSW

**E2E tests are EXPENSIVE (~5s each). Minimize usage.**

## Location

```
tests/e2e/[feature].spec.ts
tests/e2e/[domain]/[feature].spec.ts
```

## Environment

- **Playwright** with Chromium
- 4 parallel workers
- Real dev server running
- ~5 seconds per test

## Critical Constraints

### 1. Worker Isolation Required

```typescript
// WRONG - Don't import from @playwright/test
import { test, expect } from '@playwright/test';

// CORRECT - Use worker isolation helper
import { test, expect } from '../helpers/worker-isolation';
```

### 2. Project 3 is RESERVED

Project 3 is reserved for development. E2E tests use projects [1, 2, 4, 5, 6, 7].

```typescript
// Worker allocation:
// Worker 0 → Project 1
// Worker 1 → Project 2
// Worker 2 → Project 4 (skip 3!)
// Worker 3 → Project 5
// Worker 4 → Project 6
// Worker 5 → Project 7
```

### 3. Use projectId Fixture

```typescript
test('my test', async ({ page, projectId }) => {
  // projectId is automatically set based on worker
  await page.goto(`/projects/${projectId}/board`);
});
```

## Pattern

```typescript
import { test, expect } from '../helpers/worker-isolation';
import { cleanupDatabase } from '../helpers/db-cleanup';

test.describe('Drag and Drop', () => {
  test.beforeEach(async ({ projectId }) => {
    // Clean up before each test
    await cleanupDatabase(projectId);
  });

  test('moves ticket between columns', async ({ page, projectId }) => {
    // Setup: Create a ticket via API
    await page.request.post(`/api/projects/${projectId}/tickets`, {
      data: { title: '[e2e] Drag Test', description: 'Test' },
    });

    // Navigate to board
    await page.goto(`/projects/${projectId}/board`);

    // Wait for ticket to appear
    const ticket = page.locator('[data-testid="ticket-card"]').first();
    await expect(ticket).toBeVisible();

    // Get source and target columns
    const sourceColumn = page.locator('[data-stage="INBOX"]');
    const targetColumn = page.locator('[data-stage="SPECIFY"]');

    // Perform drag and drop
    await ticket.dragTo(targetColumn);

    // Verify ticket moved
    await expect(targetColumn.locator('[data-testid="ticket-card"]')).toHaveCount(1);
    await expect(sourceColumn.locator('[data-testid="ticket-card"]')).toHaveCount(0);
  });
});
```

## Common Patterns

### Navigation

```typescript
test('navigates to project', async ({ page, projectId }) => {
  await page.goto('/');
  await page.click(`[data-project-id="${projectId}"]`);
  await expect(page).toHaveURL(`/projects/${projectId}/board`);
});
```

### Form Submission

```typescript
test('creates ticket via modal', async ({ page, projectId }) => {
  await page.goto(`/projects/${projectId}/board`);

  // Open modal
  await page.click('[data-testid="new-ticket-button"]');

  // Fill form
  await page.fill('[name="title"]', '[e2e] New Ticket');
  await page.fill('[name="description"]', 'Description');

  // Submit
  await page.click('[type="submit"]');

  // Verify
  await expect(page.locator('text=[e2e] New Ticket')).toBeVisible();
});
```

### Keyboard Navigation

```typescript
test('supports keyboard navigation', async ({ page, projectId }) => {
  await page.goto(`/projects/${projectId}/board`);

  // Tab to first ticket
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // Verify focus
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('data-testid', 'ticket-card');

  // Press Enter to open
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  // Escape to close
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
```

### Responsive/Viewport

```typescript
test('shows mobile menu on small screens', async ({ page, projectId }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto(`/projects/${projectId}/board`);

  // Desktop menu should be hidden
  await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();

  // Mobile menu button should be visible
  await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
});
```

### Authentication Flow

```typescript
test('redirects to login when not authenticated', async ({ page }) => {
  // Clear auth state
  await page.context().clearCookies();

  await page.goto('/projects/1/board');

  // Should redirect to login
  await expect(page).toHaveURL(/\/auth\/signin/);
});
```

## API Requests in Tests

Use `page.request` for setup/teardown:

```typescript
test.beforeEach(async ({ page, projectId }) => {
  // Create test data via API
  await page.request.post(`/api/projects/${projectId}/tickets`, {
    data: { title: '[e2e] Test Ticket' },
  });
});

test.afterEach(async ({ page, projectId }) => {
  // Cleanup via API
  await page.request.delete(`/api/projects/${projectId}/tickets/cleanup`);
});
```

## Selectors Priority

1. **Role** - `page.getByRole('button', { name: 'Submit' })`
2. **Label** - `page.getByLabel('Email')`
3. **Placeholder** - `page.getByPlaceholder('Enter email')`
4. **Text** - `page.getByText('Welcome')`
5. **Test ID** - `page.locator('[data-testid="..."]')` (last resort)

## Best Practices

1. **Minimize E2E tests** - They're slow and flaky
2. **Use worker isolation** - Always import from `../helpers/worker-isolation`
3. **Clean up in beforeEach** - Not afterEach (test might fail)
4. **Use API for setup** - Faster than UI interactions
5. **Wait for elements** - Use `expect(locator).toBeVisible()` before interacting
6. **Avoid fixed waits** - Use `waitFor` with conditions instead of `sleep`
7. **Test one critical path** - Not every variation
