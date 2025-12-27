# Quickstart: RTL Component Testing

**Feature**: AIB-119-copy-of-testing
**Date**: 2025-12-27

## Overview

This guide shows how to write RTL component tests for AI Board React components. Component tests run in Vitest with happy-dom, providing fast feedback without browser overhead.

---

## Prerequisites

All dependencies are already installed:
- `@testing-library/react` - Component rendering and queries
- `@testing-library/dom` - DOM queries
- `vitest` - Test runner with happy-dom
- `happy-dom` - Fast DOM implementation

---

## Quick Start: Write Your First Test

### 1. Create a test file

```bash
# Component tests go in tests/unit/components/
touch tests/unit/components/board/ticket-card.test.tsx
```

### 2. Write the test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockTicket } from '../helpers/factories';
import { TicketCard } from '@/components/board/ticket-card';

describe('TicketCard', () => {
  it('displays ticket key and title', () => {
    const ticket = createMockTicket({
      ticketKey: 'ABC-42',
      title: 'Fix authentication bug',
    });

    renderWithProviders(<TicketCard ticket={ticket} />);

    expect(screen.getByText('ABC-42')).toBeInTheDocument();
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup();
    const ticket = createMockTicket();
    const onClick = vi.fn();

    renderWithProviders(
      <TicketCard ticket={ticket} onTicketClick={onClick} />
    );

    await user.click(screen.getByTestId('ticket-card'));

    expect(onClick).toHaveBeenCalledWith(ticket);
  });
});
```

### 3. Run the test

```bash
# Run all unit tests (includes component tests)
bun run test:unit

# Watch mode for development
bun run test:unit:watch

# Run specific test file
bunx vitest tests/unit/components/board/ticket-card.test.tsx
```

---

## Test Helpers Reference

### renderWithProviders

Renders a component with all required providers (QueryClient, etc.).

```typescript
import { renderWithProviders } from '../helpers/render-helpers';

// Basic usage
renderWithProviders(<MyComponent />);

// With custom QueryClient
const queryClient = createTestQueryClient();
renderWithProviders(<MyComponent />, { queryClient });

// Access QueryClient for assertions
const { queryClient } = renderWithProviders(<MyComponent />);
```

### Mock Data Factories

Create type-safe mock data for your tests:

```typescript
import {
  createMockTicket,
  createMockProject,
  createMockJob,
  createMockComment,
  createMockUser,
} from '../helpers/factories';

// Default values
const ticket = createMockTicket();

// Override specific fields
const ticket = createMockTicket({
  stage: 'VERIFY',
  workflowType: 'QUICK',
  previewUrl: 'https://preview.example.com',
});

// With nested data
const ticket = createMockTicket({
  jobs: [createMockJob({ status: 'RUNNING' })],
});
```

### User Events

Simulate user interactions:

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();

// Click
await user.click(element);

// Type text
await user.type(input, 'Hello world');

// Clear and type
await user.clear(input);
await user.type(input, 'New value');

// Keyboard shortcuts
await user.keyboard('{Meta>}{Enter}{/Meta}');

// Tab navigation
await user.tab();
```

---

## Common Patterns

### Testing Form Submission

```typescript
it('submits form with valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  renderWithProviders(<CommentForm onSubmit={onSubmit} />);

  await user.type(
    screen.getByRole('textbox'),
    'This is my comment'
  );
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ content: 'This is my comment' })
  );
});
```

### Testing Async State

```typescript
it('shows loading then content', async () => {
  renderWithProviders(<DataComponent />);

  // Loading state
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Wait for content
  await screen.findByText('Loaded content');

  // Loading should be gone
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### Testing Modal Opening

```typescript
it('opens modal on button click', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ComponentWithModal />);

  // Modal initially closed
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Open modal
  await user.click(screen.getByRole('button', { name: /open/i }));

  // Modal is now visible
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
```

### Mocking Hooks

```typescript
// Mock at top of test file
vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Or per-test mocking
import { useDeployPreview } from '@/app/lib/hooks/mutations/useDeployPreview';
vi.mocked(useDeployPreview).mockReturnValue({
  mutate: mockMutate,
  isPending: true,
});
```

---

## Query Priority Cheat Sheet

Use queries in this order (most accessible first):

| Query | When to Use | Example |
|-------|-------------|---------|
| `getByRole` | Buttons, inputs, headings | `getByRole('button', { name: /submit/i })` |
| `getByLabelText` | Form inputs with labels | `getByLabelText('Email')` |
| `getByText` | Static text content | `getByText('Welcome')` |
| `getByTestId` | Last resort | `getByTestId('ticket-card')` |

---

## What NOT to Test with RTL

| Scenario | Use Instead |
|----------|-------------|
| Drag-and-drop | Playwright E2E |
| OAuth flows | Playwright E2E |
| API endpoints | Vitest integration tests |
| Pure functions | Vitest unit tests |

---

## Troubleshooting

### "Cannot find module" errors

Ensure test uses `@/` alias and file exists:
```typescript
import { Component } from '@/components/path/to/component';
```

### "Unable to find role" errors

Check the element has correct ARIA role:
```typescript
// Debug the DOM
screen.debug();

// Use more flexible query
screen.getByRole('button', { name: /submit/i }); // Case-insensitive
```

### Async test timeout

Use `findBy*` for elements that appear after render:
```typescript
// BAD: Fails if element isn't immediate
screen.getByText('Loaded');

// GOOD: Waits up to 1000ms
await screen.findByText('Loaded');
```

---

## File Structure

```
tests/unit/components/
├── helpers/
│   ├── test-wrapper.tsx      # Provider wrapper
│   ├── render-helpers.ts     # renderWithProviders
│   ├── factories.ts          # Mock data factories
│   └── next-mocks.ts         # Next.js mocks
├── board/
│   └── ticket-card.test.tsx
├── comments/
│   └── comment-form.test.tsx
└── projects/
    └── project-card.test.tsx
```
