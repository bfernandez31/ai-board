# Quickstart: Component Integration Testing

**Date**: 2025-12-26
**Branch**: `AIB-117-testing-trophy-component`

This guide provides a quick reference for writing component integration tests following the Testing Trophy methodology.

---

## TL;DR

```typescript
// 1. Import from test utilities
import { renderWithProviders, screen, waitFor } from '@/tests/helpers/render-with-providers';
import { vi } from 'vitest';

// 2. Render component with providers
const { user, queryClient } = renderWithProviders(<MyComponent prop="value" />);

// 3. Interact and assert
await user.click(screen.getByRole('button'));
expect(screen.getByText('Success')).toBeVisible();
```

---

## Setup

### 1. Install Dependencies (Already Installed)

All required dependencies are already installed:
- `@testing-library/react` - Component testing
- `@testing-library/react-hooks` - Hook testing
- `@testing-library/dom` - DOM utilities
- `vitest` - Test runner
- `happy-dom` - DOM environment

### 2. Directory Structure

```
tests/
├── integration/
│   └── components/           # Component integration tests
│       ├── new-ticket-modal.test.tsx
│       ├── comment-form.test.tsx
│       ├── ticket-search.test.tsx
│       └── mention-input.test.tsx
└── helpers/
    ├── test-query-client.ts  # Existing
    └── render-with-providers.tsx  # NEW
```

### 3. Run Tests

```bash
# Run all integration tests (includes component tests)
bun run test:integration

# Run specific component test
bun run test:integration tests/integration/components/new-ticket-modal.test.tsx

# Run with UI
bun run test:integration:ui
```

---

## Writing Your First Test

### Step 1: Create Test File

```typescript
// tests/integration/components/my-component.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/helpers/render-with-providers';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByRole('button')).toBeVisible();
  });
});
```

### Step 2: Use Role-Based Queries

```typescript
// Preferred query order (most to least preferred):
screen.getByRole('button', { name: /submit/i });     // Best
screen.getByLabelText(/email/i);                      // Good for form fields
screen.getByText(/welcome/i);                         // Good for text content
screen.getByTestId('custom-element');                 // Last resort
```

### Step 3: Simulate User Interactions

```typescript
it('handles user input', async () => {
  const { user } = renderWithProviders(<MyForm />);

  // Type in input
  await user.type(screen.getByRole('textbox', { name: /title/i }), 'Hello');

  // Click button
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Verify result
  expect(screen.getByText('Success')).toBeVisible();
});
```

---

## Common Patterns

### Testing Form Validation

```typescript
it('shows validation error for short title', async () => {
  const { user } = renderWithProviders(<NewTicketModal open={true} {...props} />);

  // Type invalid input
  await user.type(screen.getByRole('textbox', { name: /title/i }), 'ab');
  await user.tab(); // Trigger blur validation

  // Wait for async validation
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 3 characters/i);
  });
});
```

### Testing Keyboard Shortcuts

```typescript
it('submits on Cmd+Enter', async () => {
  const onSubmit = vi.fn();
  const { user } = renderWithProviders(<CommentForm onSubmit={onSubmit} />);

  await user.type(screen.getByRole('textbox'), 'Test comment');
  await user.keyboard('{Meta>}{Enter}{/Meta}'); // Cmd+Enter

  expect(onSubmit).toHaveBeenCalled();
});

it('navigates with arrow keys', async () => {
  const { user } = renderWithProviders(<TicketSearch {...props} />);

  await user.keyboard('{ArrowDown}');
  await user.keyboard('{ArrowDown}');
  await user.keyboard('{Enter}');

  // Assert selection
});
```

### Testing Debounced Input

```typescript
describe('debounced search', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('debounces by 300ms', async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<TicketSearch onSearch={onSearch} />);

    await user.type(screen.getByRole('searchbox'), 'test');
    expect(onSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith('test');
  });
});
```

### Testing Autocomplete

```typescript
it('shows autocomplete on @ symbol', async () => {
  const { user } = renderWithProviders(
    <MentionInput projectMembers={mockMembers} {...props} />
  );

  await user.type(screen.getByRole('textbox'), '@jo');

  const listbox = screen.getByRole('listbox');
  expect(listbox).toBeVisible();
  expect(within(listbox).getByText(/john/i)).toBeVisible();
});
```

### Mocking API Calls

```typescript
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/projects/1/tickets')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          tickets: [
            { id: 1, ticketKey: 'TEST-1', title: 'First Ticket' },
          ],
        }),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

---

## Test Selection Guide

| Scenario | Test Type | Reason |
|----------|-----------|--------|
| Form validation | Component Integration | User input simulation |
| Keyboard shortcuts | Component Integration | Event handling |
| Debounced search | Component Integration | Timer control |
| Autocomplete | Component Integration | DOM interaction |
| API mutation | Component Integration | Mock fetch |
| Drag & drop | E2E (Playwright) | Browser DnD API required |
| OAuth flow | E2E (Playwright) | Browser redirects required |
| Visual layout | E2E (Playwright) | Viewport required |

---

## Troubleshooting

### "Unable to find role"

```typescript
// Use screen.debug() to see rendered HTML
screen.debug();

// Check if element exists but hidden
expect(screen.queryByRole('button')).not.toBeInTheDocument(); // null check
```

### "Element not found" with async operations

```typescript
// Use waitFor for async updates
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeVisible();
});

// Or use findBy* queries (auto-waits)
expect(await screen.findByText('Loaded')).toBeVisible();
```

### Fake timers not working

```typescript
// Must use shouldAdvanceTime option
vi.useFakeTimers({ shouldAdvanceTime: true });

// Configure userEvent with timer advancement
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
```

### Query client state not updating

```typescript
// Access queryClient from render result
const { queryClient } = renderWithProviders(<MyComponent />);

// Inspect state
console.log(queryClient.getQueryState(['myQuery']));

// Force refetch in test
await queryClient.refetchQueries({ queryKey: ['myQuery'] });
```

---

## References

- [Research Document](./research.md) - Detailed research findings
- [Data Model](./data-model.md) - Entity definitions
- [Contracts](./contracts/) - API contracts
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications) - Kent C. Dodds
