# Research: React Testing Library Component Testing Integration

**Feature**: AIB-119-copy-of-testing
**Date**: 2025-12-27
**Status**: Complete

## Research Summary

This document consolidates research findings for integrating React Testing Library (RTL) component tests into the AI Board Testing Trophy architecture.

---

## 1. RTL Query Priority (Best Practices)

**Decision**: Follow RTL's recommended query priority order.

**Rationale**: Kent C. Dodds designed RTL to encourage tests that resemble how users interact with software. Queries accessible to everyone (roles, labels) should be preferred over implementation details (test IDs).

### Query Priority (Most to Least Preferred)

| Priority | Query | When to Use |
|----------|-------|-------------|
| 1 | `getByRole` | Primary query - buttons, inputs, headings, dialogs |
| 2 | `getByLabelText` | Form elements with labels |
| 3 | `getByPlaceholderText` | Input fields with placeholder (if no label) |
| 4 | `getByText` | Non-interactive elements with text content |
| 5 | `getByDisplayValue` | Filled form elements |
| 6 | `getByAltText` | Images with alt text |
| 7 | `getByTitle` | Elements with title attribute |
| 8 | `getByTestId` | Last resort - when no semantic query works |

**Alternatives Considered**:
- Cypress testing selectors (rejected: RTL is faster for component tests)
- Custom data attributes (rejected: obscures accessibility gaps)

---

## 2. Test Provider Wrappers

**Decision**: Create reusable wrapper with QueryClientProvider for TanStack Query context.

**Rationale**: Components using TanStack Query hooks require QueryClientProvider context. A reusable wrapper simplifies test setup and ensures consistent configuration.

### Recommended Implementation

```typescript
// tests/unit/components/helpers/test-wrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface TestWrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestWrapper({ children, queryClient }: TestWrapperProps) {
  const client = queryClient ?? createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: { queryClient?: QueryClient }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();
  return {
    ...render(ui, {
      wrapper: ({ children }) => (
        <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
      ),
    }),
    queryClient,
  };
}
```

**Alternatives Considered**:
- Manual QueryClient per test (rejected: verbose, inconsistent)
- Global QueryClient (rejected: test pollution, flaky tests)

---

## 3. User Event Simulation

**Decision**: Use `@testing-library/user-event` for all user interactions.

**Rationale**: `user-event` dispatches realistic event sequences (focus, keydown, keyup, input, change) while `fireEvent` dispatches single synthetic events. This catches more integration bugs.

### Comparison

| Feature | user-event | fireEvent |
|---------|------------|-----------|
| Event sequence | Realistic (like real user) | Single synthetic event |
| Focus management | Automatic | Manual |
| Typing simulation | Character by character | Direct value set |
| Use case | Default choice | Edge cases, performance |

### Example Usage

```typescript
import userEvent from '@testing-library/user-event';

it('submits form on button click', async () => {
  const user = userEvent.setup();
  render(<CommentForm {...props} />);

  await user.type(screen.getByRole('textbox'), 'Hello world');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(onSubmit).toHaveBeenCalledWith('Hello world');
});
```

**Alternatives Considered**:
- fireEvent only (rejected: misses realistic interaction bugs)
- Direct state manipulation (rejected: tests implementation, not behavior)

---

## 4. Async Patterns

**Decision**: Use `findBy*` queries for async rendering; `waitFor` for assertions.

**Rationale**: RTL provides built-in async utilities that handle React's async rendering patterns correctly.

### Pattern Guidelines

| Scenario | Use | Example |
|----------|-----|---------|
| Element appears after render | `findBy*` | `await screen.findByText('Loaded')` |
| Wait for condition | `waitFor` | `await waitFor(() => expect(...))` |
| Element disappears | `waitForElementToBeRemoved` | `await waitForElementToBeRemoved(...)` |
| Static element | `getBy*` | `screen.getByRole('button')` |
| Element may not exist | `queryBy*` | `screen.queryByText('Error')` |

### Best Practices

```typescript
// GOOD: Use findBy for async elements
const submitButton = await screen.findByRole('button', { name: /submit/i });

// GOOD: Use waitFor for assertions on async state
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// BAD: Don't use waitFor to find elements
await waitFor(() => screen.getByText('Success')); // Anti-pattern

// BAD: Don't use arbitrary delays
await new Promise(r => setTimeout(r, 100)); // Never do this
```

**Alternatives Considered**:
- Manual setTimeout delays (rejected: flaky, slow)
- act() wrapper everywhere (rejected: RTL handles this internally)

---

## 5. Anti-Patterns to Avoid

**Decision**: Follow RTL philosophy - test behavior, not implementation.

**Rationale**: Tests should give confidence that the app works for users. Implementation-focused tests break on refactors and miss real bugs.

### Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing implementation details | Breaks on refactor, false negatives | Test user-visible behavior |
| Using container.querySelector | Fragile, not accessible | Use RTL queries |
| Checking internal state | Tests React, not your code | Test rendered output |
| Testing library internals | TanStack Query handles caching | Test component behavior |
| Snapshot testing everything | Hard to review, false confidence | Use for stable UI only |
| Over-mocking | Miss integration bugs | Mock at boundaries only |

### What to Test

```typescript
// GOOD: Test user behavior
it('shows error when form is invalid', async () => {
  render(<Form />);
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(screen.getByText(/required/i)).toBeInTheDocument();
});

// BAD: Test implementation
it('sets error state', () => {
  const { result } = renderHook(() => useForm());
  act(() => result.current.validate());
  expect(result.current.errors).toEqual({ name: 'Required' }); // Testing internals
});
```

**Alternatives Considered**:
- Enzyme's shallow rendering (rejected: encourages testing implementation)
- Full snapshot coverage (rejected: low signal, maintenance burden)

---

## 6. Testing Trophy Position

**Decision**: RTL component tests sit between unit tests and integration tests in the Testing Trophy.

**Rationale**: Kent C. Dodds's Testing Trophy emphasizes integration tests for maximum confidence with reasonable speed. RTL component tests bridge the gap between pure unit tests and full E2E tests.

### Test Type Classification

| Test Type | Tool | Location | Speed | Confidence | Use For |
|-----------|------|----------|-------|------------|---------|
| Static | TypeScript | - | Instant | Medium | Types, syntax |
| Unit | Vitest | `tests/unit/` | ~1ms | Low | Pure functions |
| **Component** | **Vitest + RTL** | **`tests/unit/components/`** | **~10ms** | **Medium-High** | **React components** |
| Integration | Vitest | `tests/integration/` | ~50ms | High | API, database |
| E2E | Playwright | `tests/e2e/` | ~5s | Highest | Browser-only |

### Component Test Decision Tree

```
Is it a React component with user interactions?
├── Yes → Use RTL component test
│   ├── Does it require real browser APIs (drag-drop, OAuth)?
│   │   ├── Yes → Use Playwright E2E
│   │   └── No → Use RTL in happy-dom
│   └── Does it only fetch data with no interactions?
│       └── Test via integration test
└── No → Use unit test
```

**Alternatives Considered**:
- All E2E tests (rejected: too slow, 100x slower than RTL)
- Only unit tests (rejected: miss component integration bugs)

---

## 7. Next.js Mocking Patterns

**Decision**: Mock Next.js navigation hooks at module level.

**Rationale**: Components using `useRouter`, `useSearchParams` need mocks since happy-dom doesn't provide Next.js context.

### Recommended Mock

```typescript
// tests/unit/components/helpers/next-mocks.ts
import { vi } from 'vitest';

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
};

export const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}));
```

---

## 8. Type-Safe Mock Data Factories

**Decision**: Use factory functions that return typed mock data.

**Rationale**: TypeScript strict mode requires explicit types. Factory functions ensure mocks match actual data shapes and reduce test maintenance.

### Recommended Pattern

```typescript
// tests/unit/components/helpers/factories.ts
import { Ticket, Project, Job } from '@prisma/client';

export function createMockTicket(overrides?: Partial<Ticket>): Ticket {
  return {
    id: 1,
    ticketKey: 'ABC-1',
    title: 'Test Ticket',
    description: null,
    stage: 'INBOX',
    branch: null,
    workflowType: 'FULL',
    previewUrl: null,
    projectId: 1,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockProject(overrides?: Partial<Project>): Project {
  return {
    id: 1,
    key: 'ABC',
    name: 'Test Project',
    githubOwner: 'test',
    githubRepo: 'repo',
    deploymentUrl: null,
    clarificationPolicy: 'AUTO',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

---

## Conclusion

RTL component testing integrates naturally into the existing Testing Trophy architecture. Key implementation decisions:

1. **Query Priority**: Follow RTL's accessibility-first query order
2. **Provider Wrappers**: Reusable TestWrapper with QueryClientProvider
3. **User Events**: Use `@testing-library/user-event` for realistic interactions
4. **Async Patterns**: `findBy*` for elements, `waitFor` for assertions
5. **Anti-Patterns**: Test behavior, not implementation
6. **Trophy Position**: Component tests between unit and integration
7. **Next.js Mocks**: Module-level mocks for navigation hooks
8. **Mock Factories**: Type-safe factory functions for test data
