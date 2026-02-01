# Frontend Integration Tests

Component + Hook + API together, with API responses mocked via MSW (Mock Service Worker).
More realistic than component tests, faster than E2E.

## When to Use

- Component makes API calls (not just mocked hooks)
- Need to test loading/error/success states with real hook behavior
- Non-critical user flows (critical flows go to E2E)
- Form submissions with API responses
- Data fetching and display

## When NOT to Use

- Pure UI rendering → use Component tests
- Database operations → use Backend Integration
- Browser-required features → use E2E

## Location

```
tests/integration/frontend/[feature].test.ts
```

## Environment

- **Vitest** + **RTL** + **MSW** with `happy-dom`
- Medium speed (~50ms per test)
- Real hooks, mocked API responses

## Setup Required

### 1. Install MSW (if not already installed)

```bash
bun add -D msw
```

### 2. Create MSW handlers

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Default handlers for common endpoints
  http.get('/api/projects/:projectId/tickets', () => {
    return HttpResponse.json({
      tickets: [
        { id: 1, ticketKey: 'PRJ-1', title: 'Test Ticket', stage: 'INBOX' },
      ],
    });
  }),

  http.post('/api/projects/:projectId/tickets', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 2,
      ticketKey: 'PRJ-2',
      ...body,
    }, { status: 201 });
  }),

  http.patch('/api/tickets/:ticketId', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 1,
      ...body,
    });
  }),
];
```

### 3. Create MSW server

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 4. Setup in test config

```typescript
// tests/integration/frontend/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '@/tests/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/mocks/server';
import React from 'react';

// Import component (NO mocking hooks - they run for real!)
import { TicketList } from '@/components/tickets/ticket-list';

describe('TicketList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TicketList projectId={1} />
      </QueryClientProvider>
    );
  };

  it('displays tickets from API', async () => {
    // Uses default handler from tests/mocks/handlers.ts
    renderComponent();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    renderComponent();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    // Override handler for this test
    server.use(
      http.get('/api/projects/:projectId/tickets', () => {
        return HttpResponse.json(
          { error: 'Failed to fetch' },
          { status: 500 }
        );
      })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('creates ticket and updates list', async () => {
    const user = userEvent.setup();

    // Track if POST was called
    let createCalled = false;
    server.use(
      http.post('/api/projects/:projectId/tickets', async ({ request }) => {
        createCalled = true;
        const body = await request.json();
        return HttpResponse.json({
          id: 2,
          ticketKey: 'PRJ-2',
          title: body.title,
          stage: 'INBOX',
        }, { status: 201 });
      })
    );

    renderComponent();

    // Wait for initial load
    await screen.findByText('Test Ticket');

    // Open create modal and submit
    await user.click(screen.getByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Ticket');
    await user.click(screen.getByRole('button', { name: /create/i }));

    // Verify API was called
    await waitFor(() => {
      expect(createCalled).toBe(true);
    });
  });
});
```

## MSW Handler Patterns

### Success Response

```typescript
http.get('/api/resource', () => {
  return HttpResponse.json({ data: 'value' });
});
```

### Error Response

```typescript
http.get('/api/resource', () => {
  return HttpResponse.json(
    { error: 'Not found' },
    { status: 404 }
  );
});
```

### Delayed Response (loading states)

```typescript
http.get('/api/resource', async () => {
  await delay(100); // from 'msw'
  return HttpResponse.json({ data: 'value' });
});
```

### Capture Request Body

```typescript
http.post('/api/resource', async ({ request }) => {
  const body = await request.json();
  // Use body in response or assertions
  return HttpResponse.json({ id: 1, ...body }, { status: 201 });
});
```

### Path Parameters

```typescript
http.get('/api/projects/:projectId/tickets/:ticketId', ({ params }) => {
  const { projectId, ticketId } = params;
  return HttpResponse.json({
    id: Number(ticketId),
    projectId: Number(projectId),
  });
});
```

### Query Parameters

```typescript
http.get('/api/search', ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  return HttpResponse.json({ results: [`Result for: ${query}`] });
});
```

## Best Practices

1. **Use default handlers** for common happy paths
2. **Override per-test** for error cases or specific scenarios
3. **Don't mock hooks** - let them run with MSW responses
4. **Test real loading states** - MSW enables this naturally
5. **Verify API calls** when needed (track with variables or spy)
