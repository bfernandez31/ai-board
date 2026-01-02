# Research: RTL Component Testing Best Practices

**Feature**: Testing Trophy Component Testing with React Testing Library
**Date**: 2025-12-28
**Status**: Complete

## Research Questions Resolved

### 1. RTL Query Priority Hierarchy (Kent C. Dodds)

**Decision**: Follow the official query priority from Testing Library documentation.

**Priority Order**:
1. `getByRole` - Top priority for all interactive elements (buttons, inputs, headings)
2. `getByLabelText` - Best for form fields (users find inputs by their labels)
3. `getByPlaceholderText` - Use sparingly, only when label unavailable
4. `getByText` - For non-interactive elements (paragraphs, spans)
5. `getByDisplayValue` - For filled form values
6. `getByAltText` - For images
7. `getByTitle` - Use rarely (not consistently read by screen readers)
8. `getByTestId` - Last resort escape hatch only

**Rationale**: This hierarchy reflects how users (visual and assistive technology) actually find and interact with elements. If `getByRole` doesn't find an element, the UI may have accessibility issues.

**Alternatives Considered**: Using `getByTestId` for everything - rejected because it doesn't verify accessibility and couples tests to implementation.

### 2. Testing Modals and Dialogs

**Decision**: Test portaled modals using standard RTL queries on document, pass `onClose` handler from parent.

**Pattern**:
```typescript
it('should close modal on ESC key', async () => {
  const user = userEvent.setup();
  const handleClose = vi.fn();

  render(<Modal open={true} onClose={handleClose} />);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(handleClose).toHaveBeenCalledTimes(1);
});
```

**Rationale**: Portaled content is still in the document, so RTL's `screen` queries find it automatically. Testing via handlers (not internal state) ensures tests verify behavior.

**Alternatives Considered**: Using `within(container)` to scope queries - rejected because unnecessary complexity for most modal tests.

### 3. userEvent vs fireEvent

**Decision**: Use `userEvent` for 95% of tests; use `fireEvent` only for isolated event handler tests.

**Rationale**:
- `userEvent.setup()` simulates complete user interactions (focus, blur, keydown sequence)
- Catches more bugs (missing focus handlers, incomplete event chains)
- More accurately reflects real user behavior

**Pattern**:
```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText(/username/i), 'john');
await user.click(screen.getByRole('button', { name: /submit/i }));
await user.keyboard('{Enter}');
```

**Alternatives Considered**: Using `fireEvent` everywhere for simplicity - rejected because it misses real-world interaction bugs.

### 4. Testing Components with TanStack Query v5

**Decision**: Create fresh QueryClient per test with `retry: false` and `gcTime: 0`.

**Pattern**:
```typescript
let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  vi.clearAllMocks();
});

const wrapper = ({ children }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);
```

**Rationale**:
- Fresh client prevents test isolation issues (cached data leaking between tests)
- `retry: false` prevents timeout issues in error tests
- `gcTime: 0` ensures predictable garbage collection

**Alternatives Considered**: Shared QueryClient with manual cache clearing - rejected because of potential race conditions.

### 5. Test Provider Setup Patterns

**Decision**: Create a custom `renderWithProviders` function in test utilities.

**Pattern**:
```typescript
// tests/utils/component-test-utils.tsx
export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions } = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}
```

**Rationale**: Reduces boilerplate, ensures consistent provider setup, allows custom QueryClient injection.

**Alternatives Considered**: Inline wrapper per test - rejected because of duplication and inconsistency.

### 6. Testing Keyboard Shortcuts

**Decision**: Use `userEvent.keyboard()` for key combinations, `fireEvent.keyDown()` only when userEvent doesn't work.

**Patterns**:
```typescript
// Escape key
await user.keyboard('{Escape}');

// Enter to submit
await user.keyboard('{Enter}');

// Cmd/Ctrl + K (search shortcut)
await user.keyboard('{Meta>}k{/Meta}');
await user.keyboard('{Control>}k{/Control}');

// Tab navigation
await user.tab();
```

**Rationale**: `userEvent.keyboard()` handles key sequences properly, including focus management.

**Alternatives Considered**: Using `fireEvent` for all keyboard events - rejected because it doesn't simulate full event chain.

## Happy-DOM Compatibility

**Decision**: Keep happy-dom for unit/component tests (current Vitest configuration).

**Findings**:
- Significantly faster than jsdom
- Compatible with RTL out of the box
- Works with Vitest configuration already in place
- Known issue: `act()` warnings with React 18.3.1+ (safe to ignore, tests work)

**Performance Note**: `getByRole` can be slow on large DOM trees. Use `{ hidden: true }` option if needed, or simpler queries for non-interactive elements.

## High-Priority Components for Initial Testing

Based on codebase analysis, these components have the most interactive behavior:

1. **NewTicketModal** (`components/board/new-ticket-modal.tsx`)
   - Form validation, submission, cancel
   - Keyboard shortcuts (Escape to close)
   - Loading states, error handling

2. **QuickImplModal** (`components/board/quick-impl-modal.tsx`)
   - Confirm/cancel behavior
   - Keyboard accessibility

3. **DeleteConfirmationModal** (`components/board/delete-confirmation-modal.tsx`)
   - Confirmation flow, danger action

4. **TicketSearch** (`components/search/ticket-search.tsx`)
   - Search input, keyboard navigation
   - Results display

5. **CommentForm** (`components/comments/comment-form.tsx`)
   - Text input, submission
   - Keyboard shortcuts (Cmd/Ctrl+Enter)

## Testing Infrastructure Needs

1. **Test Utilities File**: `tests/utils/component-test-utils.tsx`
   - `renderWithProviders()` function
   - `createTestQueryClient()` helper
   - Re-export RTL utilities

2. **Documentation Updates**:
   - Constitution: Add RTL component testing layer to Testing Trophy table
   - CLAUDE.md: Add component test decision tree and patterns

3. **No New Dependencies Required**: `@testing-library/react` already installed

## Sources

- Kent C. Dodds - Testing Library Documentation
- TanStack Query v5 Testing Guide
- Testing Library userEvent Documentation
- Happy-DOM GitHub Wiki
