# Component Tests

React components with mocked hooks and dependencies. Tests UI rendering and user interactions in isolation.

## When to Use

- Component renders correctly with props
- User interactions (clicks, typing, keyboard)
- Conditional rendering
- Form validation UI
- Loading/error states (mocked)

## Location

```
tests/unit/components/[component-name].test.ts
```

## Environment

- **Vitest** + **React Testing Library** with `happy-dom`
- Fast (~10ms per test)
- Hooks are mocked

## Critical Rule: Mock BEFORE Import

```typescript
// 1. FIRST: Mock the hooks
vi.mock('@/app/lib/hooks/mutations/use-create-ticket', () => ({
  useCreateTicket: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// 2. THEN: Import the component (uses the mocked hooks)
import { TicketForm } from '@/components/tickets/ticket-form';
import { useCreateTicket } from '@/app/lib/hooks/mutations/use-create-ticket';
```

## Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// 1. Mock hooks BEFORE importing component
vi.mock('@/app/lib/hooks/mutations/use-create-ticket', () => ({
  useCreateTicket: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

// 2. Import component AFTER mocks
import { TicketForm } from '@/components/tickets/ticket-form';
import { useCreateTicket } from '@/app/lib/hooks/mutations/use-create-ticket';

describe('TicketForm', () => {
  let queryClient: QueryClient;
  const mockMutate = vi.fn();

  beforeEach(() => {
    // Fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    // Reset mock implementation
    vi.mocked(useCreateTicket).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      isIdle: true,
      data: undefined,
      error: null,
      variables: undefined,
      context: undefined,
      reset: vi.fn(),
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
    });

    mockMutate.mockClear();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TicketForm projectId={1} />
      </QueryClientProvider>
    );
  };

  it('renders form fields', () => {
    renderComponent();
    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('submits form with user input', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'New Ticket');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Ticket' })
    );
  });

  it('shows loading state when submitting', () => {
    vi.mocked(useCreateTicket).mockReturnValue({
      ...vi.mocked(useCreateTicket)(),
      isPending: true,
    });

    renderComponent();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });
});
```

## Query Priority (RTL Best Practices)

Use queries in this order:

1. `getByRole` - Accessible to everyone (buttons, textboxes, etc.)
2. `getByLabelText` - Form fields with labels
3. `getByPlaceholderText` - Input placeholders
4. `getByText` - Visible text content
5. `getByTestId` - **Last resort only**

```typescript
// GOOD
screen.getByRole('button', { name: /submit/i });
screen.getByRole('textbox', { name: /email/i });
screen.getByLabelText(/password/i);

// AVOID
screen.getByTestId('submit-button');
```

## User Interactions

Always use `userEvent` (not `fireEvent`):

```typescript
const user = userEvent.setup();

// Clicking
await user.click(screen.getByRole('button'));

// Typing
await user.type(screen.getByRole('textbox'), 'Hello');

// Clearing and typing
await user.clear(screen.getByRole('textbox'));
await user.type(screen.getByRole('textbox'), 'New value');

// Keyboard
await user.keyboard('{Enter}');
await user.keyboard('{Escape}');

// Hover
await user.hover(screen.getByRole('button'));
```

## Async Elements

Use `findBy*` for elements that appear asynchronously:

```typescript
// Wait for element to appear
const element = await screen.findByText('Loaded!');

// Wait for element with timeout
const element = await screen.findByRole('alert', {}, { timeout: 3000 });

// Wait for condition
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

## Common Mocks

### DnD Kit

```typescript
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));
```

### Next.js Router

```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/current/path',
  useSearchParams: () => new URLSearchParams(),
}));
```

### Toast

```typescript
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));
```
