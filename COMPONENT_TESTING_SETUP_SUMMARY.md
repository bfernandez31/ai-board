# Component Testing Setup - Summary & Quick Start

This document provides a quick reference for setting up and using component tests with React Testing Library, Vitest, and happy-dom in the ai-board project.

## Files Created

### Documentation
- **COMPONENT_TESTING_GUIDE.md** - Comprehensive reference guide covering:
  - Configuration explanation
  - happy-dom vs jsdom comparison
  - TanStack Query testing patterns
  - Next.js feature mocking
  - Type-safe mock data factories
  - Troubleshooting guide

### Test Utilities
- **tests/fixtures/vitest/render-utils.tsx** - Custom render function with QueryClientProvider
- **tests/fixtures/vitest/next-mocks.ts** - Next.js navigation mocks (useRouter, useSearchParams, usePathname)
- **tests/fixtures/factories/mock-data.ts** - Type-safe mock data factories

### Example Tests
- **tests/unit/examples/component-with-query.test.tsx** - Testing components that use useQuery
- **tests/unit/examples/component-with-next-router.test.tsx** - Testing components that use Next.js navigation
- **tests/unit/examples/using-factories.test.tsx** - Using mock data factories effectively

## Quick Start

### 1. Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

### 2. Testing with useQuery

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/fixtures/vitest/render-utils';

describe('Component with Query', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ data: 'test data' }),
      } as Response)
    );
  });

  it('fetches and displays data', async () => {
    renderWithProviders(<MyQueryComponent />);

    await waitFor(() => {
      expect(screen.getByText('test data')).toBeInTheDocument();
    });
  });
});
```

### 3. Testing with Next.js Navigation

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/fixtures/vitest/render-utils';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

import { useRouter } from 'next/navigation';

describe('Component with Router', () => {
  it('navigates on button click', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

    renderWithProviders(<MyRouterComponent />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockPush).toHaveBeenCalled();
  });
});
```

### 4. Using Mock Data Factories

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { mockTicket, mockTicketsByStage } from '@/tests/fixtures/factories/mock-data';

describe('Board Component', () => {
  it('renders all tickets', () => {
    const ticketsByStage = mockTicketsByStage({
      INBOX: 3,
      BUILD: 2,
    });

    renderWithProviders(<Board ticketsByStage={ticketsByStage} projectId={1} />);

    // 5 total tickets rendered
    const tickets = screen.getAllByRole('button', { name: /ABC-/ });
    expect(tickets).toHaveLength(5);
  });

  it('renders custom ticket properties', () => {
    const ticket = mockTicket({
      title: 'Custom Ticket',
      stage: 'BUILD',
    });

    renderWithProviders(<TicketCard ticket={ticket} />);
    expect(screen.getByText('Custom Ticket')).toBeInTheDocument();
  });
});
```

## API Reference

### renderWithProviders
Custom render function that wraps components with QueryClientProvider.

```typescript
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';

const { getByText, rerender, unmount } = renderWithProviders(
  <MyComponent prop="value" />
);
```

**Re-exports from React Testing Library:**
- `screen` - DOM queries
- `fireEvent` - User events
- `waitFor` - Async operations
- `userEvent` - Better user simulation
- All other RTL utilities

### MockDataFactory
Type-safe factory methods for creating test data.

```typescript
import { MockDataFactory } from '@/tests/fixtures/factories/mock-data';

// Single objects
MockDataFactory.ticket()
MockDataFactory.ticket({ title: 'Custom', stage: 'BUILD' })
MockDataFactory.project()
MockDataFactory.user()
MockDataFactory.job()

// Multiple objects
MockDataFactory.tickets(5)
MockDataFactory.tickets(3, { stage: 'BUILD' })

// Complex scenarios
MockDataFactory.ticketsByStage({ INBOX: 3, BUILD: 2 })
MockDataFactory.ticketWithJobs(2)
MockDataFactory.ticketWithJobs(1, { stage: 'VERIFY' })

// Convenience aliases
import { mockTicket, mockTickets, mockProject, mockUser } from '@/tests/fixtures/factories/mock-data';
```

### Next.js Mocks
Utilities for mocking Next.js navigation.

```typescript
import { vi } from 'vitest';
import { createNextNavigationMocks } from '@/tests/fixtures/vitest/next-mocks';

vi.mock('next/navigation', () => createNextNavigationMocks());

// Or with state tracking:
import { createNextNavigationMocksWithState } from '@/tests/fixtures/vitest/next-mocks';
vi.mock('next/navigation', () => createNextNavigationMocksWithState());
```

## Configuration

### Current Setup (Already Configured)

**vitest.config.mts:**
- Unit tests: `tests/unit/**/*.test.ts` with happy-dom environment
- Integration tests: `tests/integration/**/*.test.ts` with node environment
- E2E tests: excluded from vitest (run separately with Playwright)

### Adding Component Tests to an Existing Setup

1. **Create render wrapper** - Copy from `tests/fixtures/vitest/render-utils.tsx`
2. **Create mock factories** - Copy from `tests/fixtures/factories/mock-data.ts`
3. **Add setup file** - Update vitest config to include component setup
4. **Write tests** - Follow examples in `tests/unit/examples/`

### Switching to jsdom for Specific Tests

For tests that need full browser API coverage:

```typescript
describe('Complex DOM Test', { testEnvironment: 'jsdom' }, () => {
  it('uses advanced APIs', () => {
    // This test suite runs with jsdom instead of happy-dom
  });
});
```

## Performance Characteristics

### happy-dom (Default for unit tests)
- 2-10x faster than jsdom
- Sufficient for 95% of React component tests
- Lower memory footprint
- Good for CI/CD pipelines

### jsdom (Use when needed)
- More complete browser API implementation
- Better for edge case browser features
- More mature, battle-tested
- ~1.5x slower and more memory

**Recommendation:** Start with happy-dom, switch to jsdom only if tests fail with "API not available" errors.

## Common Patterns

### Testing API Calls

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

it('fetches data correctly', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ id: 1, name: 'Test' }),
    } as Response)
  );

  renderWithProviders(<ComponentUsingQuery />);

  await waitFor(() => {
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  expect(global.fetch).toHaveBeenCalledWith('/api/endpoint', expect.any(Object));
});
```

### Testing User Interactions

```typescript
import { userEvent } from '@testing-library/user-event';

it('submits form on button click', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Form />);

  await user.type(screen.getByLabelText('Name'), 'John');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### Testing Error States

```typescript
it('displays error message on failure', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    } as Response)
  );

  renderWithProviders(<ComponentUsingQuery />);

  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

### Testing Loading States

```typescript
it('shows loading spinner initially', () => {
  vi.useFakeTimers();

  global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

  renderWithProviders(<ComponentUsingQuery />);

  expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();

  vi.useRealTimers();
});
```

## Testing Best Practices

1. **Prefer user-centric queries**
   ```typescript
   // Good - user sees this
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText('Email')
   screen.getByText('Success')

   // Avoid - implementation details
   screen.getByTestId('submit-btn')
   ```

2. **Use factories for data**
   ```typescript
   // Good
   const ticket = mockTicket({ title: 'Custom' });

   // Avoid
   const ticket = { id: 1, title: 'Custom', ... }; // Hard to maintain
   ```

3. **Test behavior, not implementation**
   ```typescript
   // Good
   expect(screen.getByText('Saved!')).toBeInTheDocument();

   // Avoid
   expect(componentInstance.setState).toHaveBeenCalled();
   ```

4. **Keep tests focused**
   ```typescript
   // One assertion per test is ideal
   it('displays user name', () => {
     renderWithProviders(<Profile user={mockUser()} />);
     expect(screen.getByText('John Doe')).toBeInTheDocument();
   });
   ```

5. **Clean up automatically**
   ```typescript
   // renderWithProviders includes cleanup
   // afterEach(() => cleanup()) runs automatically
   ```

## Debugging Tests

### Enable Debug Output
```typescript
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';

it('debug component', () => {
  const { debug } = renderWithProviders(<MyComponent />);
  debug(); // Prints DOM to console
});
```

### Use screen.logTestingPlaygroundURL()
```typescript
it('test with playground', () => {
  renderWithProviders(<MyComponent />);
  screen.logTestingPlaygroundURL(); // Get Testing Playground URL
});
```

### Run Single Test
```bash
# Run specific test file
bun run test:unit -- component-with-query.test.tsx

# Run tests matching pattern
bun run test:unit -- --grep "renders correctly"

# Watch mode
bun run test:unit:watch
```

## Troubleshooting

See **COMPONENT_TESTING_GUIDE.md** for comprehensive troubleshooting guide covering:
- "No QueryClient set" error
- "act() is not defined" error
- "window.matchMedia is not a function"
- "Cannot find module" for mocked imports
- Tests timing out with happy-dom
- Type errors with mock factories

## Next Steps

1. **Read COMPONENT_TESTING_GUIDE.md** - Full reference documentation
2. **Review example tests** - `tests/unit/examples/*.test.tsx`
3. **Create your first test** - Use examples as template
4. **Run tests** - `bun run test:unit` or `bun run test:unit:watch`
5. **Check coverage** - `bun run test:unit:ui`

## Resources

- [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [TanStack Query Testing Guide](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Project Structure

```
tests/
├── fixtures/
│   ├── vitest/
│   │   ├── render-utils.tsx        # Custom render with providers
│   │   ├── next-mocks.ts           # Next.js navigation mocks
│   │   ├── setup.ts                # Integration test setup
│   │   └── api-client.ts           # Test API client
│   └── factories/
│       └── mock-data.ts            # Type-safe mock factories
├── unit/
│   ├── examples/
│   │   ├── component-with-query.test.tsx
│   │   ├── component-with-next-router.test.tsx
│   │   └── using-factories.test.tsx
│   ├── hooks/
│   │   └── use-reduced-motion.test.ts
│   ├── animation-helpers.test.ts
│   └── ...
├── integration/
│   └── ...
└── e2e/
    └── ...
```

---

Last updated: December 27, 2025
For questions or issues, refer to COMPONENT_TESTING_GUIDE.md
