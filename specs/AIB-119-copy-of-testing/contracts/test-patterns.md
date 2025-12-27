# RTL Component Test Patterns Contract

**Feature**: AIB-119-copy-of-testing
**Date**: 2025-12-27
**Version**: 1.0

## Overview

This document defines the patterns and interfaces for RTL component tests in the AI Board project. These patterns ensure consistency across component tests and alignment with Testing Trophy principles.

---

## 1. Component Test Structure

### Pattern: Arrange-Act-Assert with RTL

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockTicket } from '../helpers/factories';
import { ComponentUnderTest } from '@/components/path/to/component';

describe('ComponentUnderTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should [expected behavior] when [condition]', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockData = createMockTicket({ title: 'Test' });
    const onAction = vi.fn();

    // Act
    renderWithProviders(
      <ComponentUnderTest data={mockData} onAction={onAction} />
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Assert
    expect(onAction).toHaveBeenCalledWith(mockData);
  });
});
```

---

## 2. Query Patterns

### Pattern: Accessibility-First Queries

```typescript
// Priority 1: getByRole (most preferred)
screen.getByRole('button', { name: /submit/i });
screen.getByRole('textbox', { name: /email/i });
screen.getByRole('dialog', { name: /confirm/i });
screen.getByRole('article', { name: /ticket abc-1/i });

// Priority 2: getByLabelText (form elements)
screen.getByLabelText('Email address');
screen.getByLabelText(/password/i);

// Priority 3: getByPlaceholderText (inputs without labels)
screen.getByPlaceholderText('Search...');

// Priority 4: getByText (non-interactive content)
screen.getByText('Welcome back');
screen.getByText(/error occurred/i);

// Last resort: getByTestId
screen.getByTestId('ticket-card');
```

### Pattern: Async Queries

```typescript
// Element appears after async operation
const element = await screen.findByText('Loaded');

// Multiple elements appear
const items = await screen.findAllByRole('listitem');

// Wait for assertion
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});
```

---

## 3. User Interaction Patterns

### Pattern: User Events Setup

```typescript
import userEvent from '@testing-library/user-event';

describe('InteractiveComponent', () => {
  it('handles user interaction', async () => {
    // Always setup user at test start
    const user = userEvent.setup();

    renderWithProviders(<Component />);

    // Click
    await user.click(screen.getByRole('button'));

    // Type
    await user.type(screen.getByRole('textbox'), 'Hello');

    // Clear and type
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'New value');

    // Keyboard shortcuts
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    // Hover
    await user.hover(screen.getByRole('button'));

    // Tab navigation
    await user.tab();
  });
});
```

---

## 4. Mock Patterns

### Pattern: TanStack Query Hook Mocks

```typescript
import { vi } from 'vitest';

// Mock entire hook module
vi.mock('@/app/lib/hooks/mutations/useDeployPreview', () => ({
  useDeployPreview: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

// Or provide mock implementation per test
const mockMutate = vi.fn();
vi.mocked(useDeployPreview).mockReturnValue({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
});
```

### Pattern: Next.js Navigation Mocks

```typescript
// In test file or setup
import { vi } from 'vitest';
import { mockRouter } from '../helpers/next-mocks';

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/projects/1/board',
  useSearchParams: () => new URLSearchParams(),
}));

// In test
it('navigates on click', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ProjectCard project={mockProject} />);

  await user.click(screen.getByTestId('project-card'));

  expect(mockRouter.push).toHaveBeenCalledWith('/projects/1/board');
});
```

### Pattern: Clipboard Mock

```typescript
describe('CopyButton', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('copies text to clipboard', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CopyButton text="abc123" />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc123');
  });
});
```

---

## 5. Component-Specific Patterns

### Pattern: Modal Testing

```typescript
describe('ConfirmationModal', () => {
  it('opens when trigger clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModalWithTrigger />);

    // Initially modal is not visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open modal
    await user.click(screen.getByRole('button', { name: /open/i }));

    // Modal appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onConfirm and closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(<Modal open onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onConfirm).toHaveBeenCalled();
  });
});
```

### Pattern: Form Testing

```typescript
describe('CommentForm', () => {
  it('validates and submits', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithProviders(<CommentForm onSubmit={onSubmit} />);

    // Submit empty form shows error
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(screen.getByText(/required/i)).toBeInTheDocument();

    // Fill and submit
    await user.type(screen.getByRole('textbox'), 'Valid comment');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Valid comment' })
    );
  });

  it('shows character count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommentForm maxLength={100} />);

    await user.type(screen.getByRole('textbox'), 'Hello');

    expect(screen.getByText('5 / 100')).toBeInTheDocument();
  });
});
```

### Pattern: Card/List Item Testing

```typescript
describe('TicketCard', () => {
  it('displays ticket information', () => {
    const ticket = createMockTicket({
      ticketKey: 'ABC-42',
      title: 'Fix login bug',
      workflowType: 'QUICK',
    });

    renderWithProviders(<TicketCard ticket={ticket} />);

    expect(screen.getByText('ABC-42')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText(/quick/i)).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ticket = createMockTicket();

    renderWithProviders(
      <TicketCard ticket={ticket} onTicketClick={onClick} />
    );

    await user.click(screen.getByTestId('ticket-card'));

    expect(onClick).toHaveBeenCalledWith(ticket);
  });
});
```

---

## 6. Test Organization

### File Naming Convention

```
tests/unit/components/
├── helpers/
│   ├── test-wrapper.tsx       # TestWrapper component
│   ├── render-helpers.ts      # renderWithProviders
│   ├── factories.ts           # Mock data factories
│   └── next-mocks.ts          # Next.js mocks
├── board/
│   ├── ticket-card.test.tsx   # Tests for TicketCard
│   └── stage-column.test.tsx  # Tests for StageColumn
├── comments/
│   ├── comment-form.test.tsx  # Tests for CommentForm
│   └── comment-list.test.tsx  # Tests for CommentList
└── projects/
    └── project-card.test.tsx  # Tests for ProjectCard
```

### Describe Block Structure

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('renders default state correctly', () => {});
    it('renders with optional props', () => {});
    it('renders loading state', () => {});
    it('renders error state', () => {});
  });

  describe('user interactions', () => {
    it('handles click events', async () => {});
    it('handles keyboard shortcuts', async () => {});
    it('handles form submission', async () => {});
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {});
    it('is keyboard navigable', async () => {});
  });
});
```

---

## 7. What NOT to Test with RTL

### Defer to Other Test Types

| Scenario | Use Instead |
|----------|-------------|
| Pure utility functions | Unit test (Vitest) |
| API endpoint behavior | Integration test (Vitest) |
| Drag-and-drop (DnD Kit) | E2E test (Playwright) |
| OAuth flows | E2E test (Playwright) |
| Viewport-dependent layout | E2E test (Playwright) |
| Database operations | Integration test (Vitest) |
