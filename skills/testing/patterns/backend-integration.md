# Backend Integration Tests

API routes + real database operations with Prisma. Tests the full backend stack.

## When to Use

- API endpoint behavior (POST, GET, PATCH, DELETE)
- Database constraints and cascades
- Authorization and access control
- State machine transitions
- Business logic with database

## Location

```
tests/integration/[domain]/[feature].test.ts
```

Domains: `tickets/`, `projects/`, `jobs/`, `comments/`, `cleanup/`

## Environment

- **Vitest** with `node` environment
- Real PostgreSQL database
- `fileParallelism: false` (sequential execution)
- ~50ms per test

## Critical Constraints

1. **Sequential execution** - Tests run one at a time (no parallel)
2. **Shared database** - Each worker gets isolated project IDs
3. **Cleanup required** - Call `ctx.cleanup()` in `beforeEach`
4. **[e2e] prefix** - All test data must use `[e2e]` prefix

## Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Tickets API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup(); // Clean slate for each test
  });

  describe('POST /api/projects/:projectId/tickets', () => {
    it('creates a ticket with valid data', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets`,
        {
          title: '[e2e] Test Ticket',
          description: 'Test description',
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        title: '[e2e] Test Ticket',
        stage: 'INBOX',
      });
      expect(response.data.ticketKey).toMatch(/^[A-Z]+-\d+$/);
    });

    it('returns 400 for missing title', async () => {
      const response = await ctx.api.post(
        `/api/projects/${ctx.projectId}/tickets`,
        { description: 'No title' }
      );

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('title');
    });

    it('returns 404 for non-existent project', async () => {
      const response = await ctx.api.post(
        '/api/projects/99999/tickets',
        { title: '[e2e] Test' }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/tickets/:ticketId', () => {
    it('updates ticket title', async () => {
      // Create test ticket
      const { id } = await ctx.createTicket({ title: '[e2e] Original' });

      // Update it
      const response = await ctx.api.patch(`/api/tickets/${id}`, {
        title: '[e2e] Updated',
      });

      expect(response.status).toBe(200);
      expect(response.data.title).toBe('[e2e] Updated');
    });
  });

  describe('DELETE /api/tickets/:ticketId', () => {
    it('soft deletes ticket', async () => {
      const { id } = await ctx.createTicket();

      const response = await ctx.api.delete(`/api/tickets/${id}`);

      expect(response.status).toBe(200);
      // Verify soft delete (deletedAt set)
    });
  });
});
```

## TestContext API

```typescript
interface TestContext {
  /** Isolated project ID for this worker */
  projectId: number;

  /** Pre-configured API client */
  api: APIClient;

  /** Clean up all test data in the worker's project */
  cleanup: () => Promise<void>;

  /** Create a test project */
  createProject: (name?: string) => Promise<{ id: number; key: string }>;

  /** Create a test ticket */
  createTicket: (data?: {
    title?: string;
    description?: string;
    stage?: string;
  }) => Promise<{ id: number; ticketKey: string }>;

  /** Create a test user */
  createUser: (email?: string) => Promise<{ id: string; email: string }>;
}
```

## API Client

```typescript
// GET
const response = await ctx.api.get('/api/resource');

// POST
const response = await ctx.api.post('/api/resource', { data: 'value' });

// PATCH
const response = await ctx.api.patch('/api/resource/1', { data: 'updated' });

// DELETE
const response = await ctx.api.delete('/api/resource/1');

// Response shape
interface APIResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}
```

## Testing State Transitions

```typescript
describe('Ticket Transitions', () => {
  it('transitions from INBOX to SPECIFY', async () => {
    const { id } = await ctx.createTicket({ stage: 'INBOX' });

    const response = await ctx.api.patch(`/api/tickets/${id}`, {
      stage: 'SPECIFY',
    });

    expect(response.status).toBe(200);
    expect(response.data.stage).toBe('SPECIFY');
  });

  it('rejects invalid transition INBOX to SHIP', async () => {
    const { id } = await ctx.createTicket({ stage: 'INBOX' });

    const response = await ctx.api.patch(`/api/tickets/${id}`, {
      stage: 'SHIP',
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('Invalid transition');
  });

  it('allows same status (idempotent)', async () => {
    const { id } = await ctx.createTicket({ stage: 'INBOX' });

    const response = await ctx.api.patch(`/api/tickets/${id}`, {
      stage: 'INBOX',
    });

    expect(response.status).toBe(200);
  });
});
```

## Testing Database Constraints

```typescript
describe('Project Constraints', () => {
  it('enforces unique project key', async () => {
    await ctx.createProject('[e2e] First');

    // Try to create with same key
    const response = await ctx.api.post('/api/projects', {
      name: '[e2e] Second',
      key: 'EXISTING_KEY', // Duplicate
    });

    expect(response.status).toBe(400);
    expect(response.data.error).toContain('unique');
  });

  it('cascades delete to tickets', async () => {
    const { id: projectId } = await ctx.createProject();
    await ctx.createTicket({ projectId });

    await ctx.api.delete(`/api/projects/${projectId}`);

    // Verify tickets are also deleted
    const tickets = await ctx.api.get(`/api/projects/${projectId}/tickets`);
    expect(tickets.status).toBe(404);
  });
});
```

## Best Practices

1. **Always use `[e2e]` prefix** for test data
2. **Call `ctx.cleanup()` in beforeEach** - not afterEach
3. **Test all response codes** - 200, 201, 400, 401, 403, 404
4. **Test edge cases** - empty, null, boundary values
5. **Use ctx helpers** - `createTicket()`, `createProject()` for setup
6. **Test idempotency** - Same operation twice should be safe
