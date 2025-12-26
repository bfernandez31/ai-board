# Research: Testing Trophy Component Integration

**Date**: 2025-12-26
**Branch**: `AIB-117-testing-trophy-component`

## Summary

This document consolidates research findings for implementing component-level integration tests using Vitest with React Testing Library, following the Testing Trophy methodology established by Kent C. Dodds.

---

## Research Tasks Completed

### 1. Testing Components with TanStack Query v5

**Decision**: Use existing `createTestQueryClient` helper and create a `renderWithProviders` utility for component tests.

**Rationale**:
- Project already has a well-configured `createTestQueryClient()` at `tests/helpers/test-query-client.ts` with all recommended settings (retry: false, gcTime: 0, staleTime: 0)
- TanStack Query v5 documentation recommends fresh QueryClient per test for complete isolation
- MSW (Mock Service Worker) is the recommended approach for network-level mocking, but for component tests, direct mocking with vi.fn() is acceptable

**Alternatives Considered**:
- Hook-level mocking (vi.mock('@tanstack/react-query')) - Rejected: violates "test from user perspective" principle
- Shared QueryClient across tests - Rejected: causes state leakage between tests

**Implementation Pattern**:
```typescript
// tests/helpers/render-with-providers.tsx
import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { createTestQueryClient } from './test-query-client';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

interface CustomRenderResult extends RenderResult {
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): CustomRenderResult {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const user = userEvent.setup();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
    user,
  };
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { renderWithProviders as render };
```

---

### 2. Testing Form Components with Validation

**Decision**: Use Zod schema validation testing pattern with userEvent for form interactions.

**Rationale**:
- NewTicketModal uses Zod schemas for real-time validation
- Testing Library's `userEvent.type()` simulates real user input with proper event sequencing
- `waitFor` handles async validation updates

**Implementation Pattern**:
```typescript
it('should show validation error for short title', async () => {
  const { user } = renderWithProviders(<NewTicketModal open={true} {...props} />);

  const titleInput = screen.getByRole('textbox', { name: /title/i });
  await user.type(titleInput, 'ab');
  await user.tab(); // Trigger blur validation

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 3 characters/i);
  });
});
```

**Key Testing Points**:
- Title validation (min length, max length)
- Description validation (max length)
- Form submission with valid data
- Form submission with invalid data
- Loading state during submission
- Error handling on API failure

---

### 3. Testing Keyboard Interactions and Shortcuts

**Decision**: Use userEvent keyboard API with `{Modifier>}key{/Modifier}` syntax.

**Rationale**:
- userEvent provides proper event sequencing (keydown → keypress → keyup)
- Supports modifier keys (Ctrl, Cmd, Shift, Alt)
- Works with happy-dom environment

**Implementation Pattern**:
```typescript
// Test Cmd/Ctrl+Enter to submit
it('should submit on Cmd+Enter', async () => {
  const { user } = renderWithProviders(<CommentForm {...props} />);

  await user.type(screen.getByRole('textbox'), 'Test comment');
  await user.keyboard('{Meta>}{Enter}{/Meta}'); // Cmd+Enter

  expect(mockMutation).toHaveBeenCalled();
});

// Test Escape to close
it('should close on Escape', async () => {
  const { user } = renderWithProviders(<Modal open={true} onClose={onClose} />);

  await user.keyboard('{Escape}');

  expect(onClose).toHaveBeenCalled();
});

// Test arrow key navigation
it('should navigate with arrow keys', async () => {
  const { user } = renderWithProviders(<TicketSearch {...props} />);

  await user.type(screen.getByRole('searchbox'), 'test');
  await user.keyboard('{ArrowDown}');
  await user.keyboard('{ArrowDown}');
  await user.keyboard('{Enter}');

  expect(onSelect).toHaveBeenCalledWith(expectedTicket);
});
```

---

### 4. Testing Debounced Inputs

**Decision**: Use Vitest fake timers with `shouldAdvanceTime: true` configuration.

**Rationale**:
- TicketSearch component uses 300ms debounce
- Fake timers provide deterministic control over time
- `shouldAdvanceTime: true` is required for compatibility with userEvent async operations

**Implementation Pattern**:
```typescript
describe('TicketSearch debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should debounce search by 300ms', async () => {
    const mockFetch = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderWithProviders(<TicketSearch onSearch={mockFetch} />);

    await user.type(screen.getByRole('searchbox'), 'test');

    // Should not have called search yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockFetch).toHaveBeenCalledWith('test');
  });
});
```

---

### 5. Testing Autocomplete/Dropdown Components

**Decision**: Use semantic ARIA roles (combobox, listbox, option) for autocomplete testing.

**Rationale**:
- MentionInput renders an autocomplete dropdown with user options
- Testing by ARIA roles ensures accessibility compliance
- `within()` helper scopes queries to specific containers

**Implementation Pattern**:
```typescript
it('should show autocomplete on @ symbol', async () => {
  const { user } = renderWithProviders(
    <MentionInput
      value=""
      onChange={vi.fn()}
      projectMembers={mockMembers}
    />
  );

  await user.type(screen.getByRole('textbox'), '@jo');

  // Verify autocomplete appears
  const listbox = screen.getByRole('listbox');
  expect(listbox).toBeVisible();

  // Verify filtered results
  expect(within(listbox).getByRole('option', { name: /john/i })).toBeVisible();
  expect(within(listbox).queryByRole('option', { name: /alice/i })).not.toBeInTheDocument();
});

it('should insert mention on selection', async () => {
  const onChange = vi.fn();
  const { user } = renderWithProviders(
    <MentionInput
      value=""
      onChange={onChange}
      projectMembers={mockMembers}
    />
  );

  await user.type(screen.getByRole('textbox'), '@jo');
  await user.click(screen.getByRole('option', { name: /john/i }));

  expect(onChange).toHaveBeenCalledWith(expect.stringContaining('@['));
});
```

---

### 6. Component Test File Organization

**Decision**: Create `tests/integration/components/` directory for component integration tests.

**Rationale**:
- Aligns with existing directory structure (`tests/integration/[domain]/`)
- Distinguishes from API integration tests
- Follows Testing Trophy layer organization

**Directory Structure**:
```
tests/
├── integration/
│   ├── components/              # NEW: Component integration tests
│   │   ├── new-ticket-modal.test.tsx
│   │   ├── comment-form.test.tsx
│   │   ├── ticket-search.test.tsx
│   │   └── mention-input.test.tsx
│   ├── tickets/                 # Existing API tests
│   ├── projects/
│   └── ...
├── helpers/
│   ├── test-query-client.ts     # Existing
│   └── render-with-providers.tsx # NEW
└── unit/
```

---

### 7. Mock Strategies for Component Dependencies

**Decision**: Mock at the fetch/network level, not at the hook level.

**Rationale**:
- Follows Kent C. Dodds' principle of testing implementation details
- Allows testing of hook integration with component logic
- More maintainable as hook implementations can change

**Implementation Pattern**:
```typescript
// Mock fetch for API calls
beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (url.includes('/api/projects/1/tickets')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ tickets: mockTickets }),
      });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
});

// Alternative: Mock useQuery hooks when necessary (for complex scenarios)
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    }),
  };
});
```

---

### 8. Vitest Configuration for Component Tests

**Decision**: Extend existing integration test configuration with happy-dom environment.

**Rationale**:
- Component tests need DOM environment like happy-dom
- Should be grouped with integration tests (similar execution patterns)
- Can use existing setup file with extensions

**Configuration**:
```typescript
// vitest.config.mts - extend integration workspace
workspaces: [
  {
    extends: true,
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.{ts,tsx}'],
      environment: 'happy-dom', // Already set for integration
      setupFiles: ['./tests/fixtures/vitest/setup.ts'],
    },
  },
]
```

---

## Summary of Key Decisions

| Area | Decision | Key Tool/Pattern |
|------|----------|------------------|
| Provider wrapping | `renderWithProviders` utility | QueryClientProvider + userEvent |
| Query mocking | Fresh QueryClient per test | `createTestQueryClient()` |
| Form testing | Zod validation + userEvent | `waitFor` for async validation |
| Keyboard testing | userEvent keyboard API | `{Modifier>}key{/Modifier}` syntax |
| Debounce testing | Fake timers | `vi.useFakeTimers({ shouldAdvanceTime: true })` |
| Autocomplete testing | ARIA roles | `combobox`, `listbox`, `option` |
| File organization | `tests/integration/components/` | Domain-based structure |
| Network mocking | Fetch-level mocking | `global.fetch = vi.fn()` |

---

## References

- [TanStack Query v5 Testing Documentation](https://tanstack.com/query/v5/docs/react/guides/testing)
- [Testing React Query - TkDodo's Blog](https://tkdodo.eu/blog/testing-react-query)
- [React Testing Library Setup](https://testing-library.com/docs/react-testing-library/setup/)
- [userEvent Keyboard API](https://testing-library.com/docs/user-event/keyboard/)
- [Kent C. Dodds - Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)
- [Testing Implementation Details - Kent C. Dodds](https://kentcdodds.com/blog/testing-implementation-details)
