---
description: "Generate RTL component tests following Testing Trophy patterns - use for component test, RTL, React testing, testing library"
allowed-tools: ["Read", "Glob", "Grep", "Write"]
---

# Component Testing Skill

Generate React Testing Library (RTL) component tests following the Testing Trophy strategy.

## When to Use

Use this skill when:
- Creating new component tests
- Testing user interactions (forms, buttons, keyboard shortcuts)
- Testing components with TanStack Query hooks
- Validating component behavior (not implementation details)

## Test File Location

Component tests go in `tests/unit/components/[component-name].test.ts`

## Standard Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock hooks before importing component
vi.mock('@/app/lib/hooks/...', () => ({
  useHookName: vi.fn(() => ({ /* default return */ })),
}));

import { ComponentName } from '@/components/path/component-name';
import { useHookName } from '@/app/lib/hooks/...';

describe('ComponentName', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Reset mock implementations each test
    vi.mocked(useHookName).mockReturnValue({
      // ... full mock return type
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ComponentName, { ...defaultProps, ...props })
      )
    );
  };

  it('should render correctly', () => {
    renderComponent();
    expect(screen.getByText(/expected text/i)).toBeDefined();
  });
});
```

## Provider Wrapping Pattern

Components using TanStack Query need a QueryClientProvider wrapper:

```typescript
const renderComponent = () => {
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(ComponentName, { prop1: value1 })
    )
  );
};
```

## Fetch Mocking Pattern

Mock global fetch for API calls:

```typescript
beforeEach(() => {
  global.fetch = vi.fn();
});

it('should handle API response', async () => {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { /* response */ } }),
  } as Response);

  // trigger fetch...

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/endpoint',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

## Hook Mocking Pattern

Mock TanStack Query hooks completely:

```typescript
vi.mock('@/app/lib/hooks/queries/useMyQuery', () => ({
  useMyQuery: vi.fn(() => ({
    data: { items: [] },
    isLoading: false,
    error: null,
    // Include ALL TanStack Query return properties
    status: 'success',
    isSuccess: true,
    isFetching: false,
    isPending: false,
    isError: false,
    // ... etc
  })),
}));
```

## Testing Guidelines

1. **Test behavior, not implementation** - Focus on what the user sees and does
2. **Use semantic queries** - Prefer `getByRole`, `getByLabelText`, `getByPlaceholderText`
3. **Avoid testing internal state** - Test through rendered output
4. **Keep tests fast** - Each test should execute under 100ms
5. **Use `waitFor` for async operations** - Don't use arbitrary delays

## Common Assertions

```typescript
// Element exists
expect(screen.getByText(/text/i)).toBeDefined();

// Element doesn't exist
expect(screen.queryByText(/text/i)).toBeNull();

// Button disabled
expect((button as HTMLButtonElement).disabled).toBe(true);

// Input value
expect((input as HTMLInputElement).value).toBe('expected');

// Class contains
expect(element.className).toContain('expected-class');

// Attribute value
expect(element.getAttribute('aria-expanded')).toBe('false');
```

## Testing Keyboard Shortcuts

```typescript
// Cmd+Enter shortcut
fireEvent.keyDown(window, { key: 'Enter', metaKey: true });

// Ctrl+Enter shortcut
fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

// Arrow navigation
fireEvent.keyDown(element, { key: 'ArrowDown' });

// Escape key
fireEvent.keyDown(element, { key: 'Escape' });
```

## Testing Debounced Input

```typescript
vi.useFakeTimers();

fireEvent.change(input, { target: { value: 'search' } });

await act(async () => {
  vi.advanceTimersByTime(300); // debounce delay
});

expect(mockFn).toHaveBeenCalledWith('search');

vi.useRealTimers();
```

## Reference Examples

See existing component tests in:
- `tests/unit/components/comment-form.test.ts`
- `tests/unit/components/new-ticket-modal.test.ts`
- `tests/unit/components/ticket-search.test.ts`

And the hook test pattern in:
- `tests/unit/useJobPolling.test.ts`
