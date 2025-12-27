# Component Testing Research & Setup Guide

Complete research documentation and practical setup for testing React components in TypeScript strict mode with Vitest + happy-dom + React Testing Library.

## Overview

This package includes:
1. **Comprehensive research guide** - Best practices and deep dive into configuration
2. **Ready-to-use utilities** - Drop-in render wrappers and mock factories
3. **Example tests** - Working examples demonstrating all patterns
4. **Quick start guide** - Get started in minutes

## Quick Navigation

| Document | Purpose |
|----------|---------|
| **COMPONENT_TESTING_GUIDE.md** | Complete reference (11 sections, 400+ lines) |
| **COMPONENT_TESTING_SETUP_SUMMARY.md** | Quick start & cheat sheet |
| This document | Overview & research findings |

## What's Included

### Documentation Files
- **COMPONENT_TESTING_GUIDE.md** - 11-section comprehensive guide
- **COMPONENT_TESTING_SETUP_SUMMARY.md** - Quick reference and API docs

### Reusable Test Utilities

#### `/tests/fixtures/vitest/render-utils.tsx`
Custom render function with automatic provider setup
```typescript
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';

renderWithProviders(<MyComponent />);
expect(screen.getByText('text')).toBeInTheDocument();
```

#### `/tests/fixtures/vitest/next-mocks.ts`
Next.js navigation mocks for useRouter, useSearchParams, usePathname
```typescript
vi.mock('next/navigation', () => createNextNavigationMocks());
```

#### `/tests/fixtures/factories/mock-data.ts`
Type-safe mock data factories for test data
```typescript
import { mockTicket, MockDataFactory } from '@/tests/fixtures/factories/mock-data';

const ticket = mockTicket({ title: 'Custom Title' });
const ticketsByStage = MockDataFactory.ticketsByStage({ INBOX: 3, BUILD: 2 });
```

### Example Test Files

#### `tests/unit/examples/component-with-query.test.tsx`
Demonstrates testing components that use TanStack Query (useQuery)
- Mocking fetch/API calls
- Testing loading states
- Testing error handling
- Cache invalidation

#### `tests/unit/examples/component-with-next-router.test.tsx`
Demonstrates testing components with Next.js navigation
- Mocking useRouter, useSearchParams, usePathname
- Testing navigation behavior
- URL parameter handling
- Router state tracking

#### `tests/unit/examples/using-factories.test.tsx`
Demonstrates type-safe mock data factories
- Simple factory usage
- Complex nested objects
- Composing test scenarios
- Best practices

## Key Research Findings

### 1. happy-dom vs jsdom

**Performance:**
- happy-dom: 2-10x faster than jsdom
- Best for unit tests and CI/CD pipelines
- Lower memory footprint

**API Coverage:**
- happy-dom: ~80% complete (sufficient for 95% of React tests)
- jsdom: ~95% complete (more mature)

**Recommendation:** Default to happy-dom, switch to jsdom only when needed

### 2. QueryClient Setup for Testing

**Key pattern:** Fresh QueryClient per test
```typescript
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}
```

**Benefits:**
- Complete test isolation
- No cache pollution between tests
- Predictable behavior
- Faster test execution

### 3. React Testing Library Best Practices

**User-centric queries (recommended):**
- `getByRole()` - What users see
- `getByLabelText()` - Form labels
- `getByText()` - Visible text

**Implementation-detail queries (avoid):**
- `getByTestId()` - Only when necessary
- Direct DOM queries - Brittle tests

### 4. Next.js Mocking Strategy

**Key insight:** Mock only the hooks, not App Router Context
```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
}));
```

**Advantages:**
- Simpler than Context mocking
- Sufficient for component testing
- Less boilerplate
- Easier to understand

### 5. Type-Safe Mock Data Factories

**Pattern: Use Partial<T> for type safety**
```typescript
export function mockTicket(
  overrides?: Partial<TicketWithVersion>
): TicketWithVersion {
  return { /* complete object with defaults */ };
}
```

**Benefits:**
- TypeScript prevents property typos
- Self-documenting code
- Easy to maintain
- Supports composition

---

## Current Project Status

The ai-board project is **already well-configured** for component testing:

### Existing Configuration
- ✅ Vitest with happy-dom for unit tests
- ✅ Proper test file organization (tests/unit/, tests/integration/, tests/e2e/)
- ✅ TypeScript strict mode enabled
- ✅ TanStack Query v5.90.5 ready
- ✅ React Testing Library installed

### What Was Added
- ✅ Custom render wrapper (render-utils.tsx)
- ✅ Next.js mock utilities (next-mocks.ts)
- ✅ Type-safe mock data factory (mock-data.ts)
- ✅ Three working example tests
- ✅ Comprehensive documentation

---

## Getting Started

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

### 2. Test with TanStack Query
See `tests/unit/examples/component-with-query.test.tsx`

### 3. Test with Next.js Navigation
See `tests/unit/examples/component-with-next-router.test.tsx`

### 4. Use Mock Factories
See `tests/unit/examples/using-factories.test.tsx`

## Running Tests

```bash
# Run all unit tests
bun run test:unit

# Watch mode (development)
bun run test:unit:watch

# UI mode with coverage
bun run test:unit:ui

# Run specific test file
bun run test:unit -- component-with-query.test.tsx

# Run tests matching pattern
bun run test:unit -- --grep "renders correctly"
```

## File Structure

```
/
├── COMPONENT_TESTING_GUIDE.md               # Full reference (this is the main guide)
├── COMPONENT_TESTING_SETUP_SUMMARY.md       # Quick reference
├── COMPONENT_TESTING_README.md              # This file
│
├── tests/
│   ├── fixtures/
│   │   ├── vitest/
│   │   │   ├── render-utils.tsx             # Custom render function
│   │   │   ├── next-mocks.ts                # Next.js mocks
│   │   │   ├── setup.ts                     # Integration test setup (existing)
│   │   │   ├── api-client.ts                # Test API client (existing)
│   │   │   └── global-setup.ts              # Global setup (existing)
│   │   └── factories/
│   │       └── mock-data.ts                 # Type-safe factories
│   │
│   └── unit/
│       ├── examples/
│       │   ├── component-with-query.test.tsx        # Query pattern example
│       │   ├── component-with-next-router.test.tsx  # Router pattern example
│       │   └── using-factories.test.tsx             # Factory pattern example
│       ├── use-reduced-motion.test.ts               # Existing hook test
│       ├── useJobPolling.test.ts                    # Existing query test
│       └── [other existing tests...]
│
└── vitest.config.mts                        # Already configured (no changes needed)
```

---

## Key APIs at a Glance

### renderWithProviders
```typescript
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';

// Returns RTL render result + auto-wrapped in QueryClientProvider
const { rerender, unmount, ...queries } = renderWithProviders(<Component />);
```

### Mock Data Factories
```typescript
import {
  MockDataFactory,           // Full class with all methods
  mockTicket,               // Convenience function
  mockTickets,              // Multiple objects
  mockTicketsByStage,       // Organized by stage
  mockProject,              // Project factory
  mockUser,                 // User factory
} from '@/tests/fixtures/factories/mock-data';

// Usage
const ticket = mockTicket({ title: 'Custom' });
const tickets = mockTickets(5);
const byStage = mockTicketsByStage({ INBOX: 3, BUILD: 2 });
const complex = MockDataFactory.ticketWithJobs(2);
```

### Next.js Mocks
```typescript
import { vi } from 'vitest';
import {
  createNextNavigationMocks,           // Simple mocks
  createNextNavigationMocksWithState,  // Stateful mocks
  setupNextNavigationMocks,            // Helper function
} from '@/tests/fixtures/vitest/next-mocks';

// Usage
vi.mock('next/navigation', () => createNextNavigationMocks());
// OR
vi.mock('next/navigation', () => createNextNavigationMocksWithState());
```

---

## Important Patterns

### Pattern 1: Test with Query Client
```typescript
let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
});

it('fetches data', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' }),
  } as Response));

  renderWithProviders(<Component />);

  await waitFor(() => {
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
```

### Pattern 2: Mock Next.js Navigation
```typescript
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

import { useRouter } from 'next/navigation';

it('navigates', () => {
  const mockPush = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any);

  renderWithProviders(<Component />);
  // Verify mockPush called
});
```

### Pattern 3: Use Type-Safe Factories
```typescript
it('renders multiple tickets', () => {
  const tickets = mockTickets(5, { stage: 'BUILD' });

  renderWithProviders(
    <Board ticketsByStage={{ BUILD: tickets }} projectId={1} />
  );

  expect(screen.getAllByRole('button')).toHaveLength(5);
});
```

---

## Troubleshooting Quick Reference

| Error | Solution |
|-------|----------|
| "No QueryClient set" | Use `renderWithProviders` instead of `render` |
| "act() is not defined" | Import `{ act }` from `@testing-library/react` |
| "window.matchMedia is not a function" | Already fixed in component-setup.ts |
| "Cannot find module 'next/navigation'" | Mock must come before component import |
| Tests timeout with happy-dom | Try jsdom for that specific test with `{ testEnvironment: 'jsdom' }` |

For detailed solutions, see **COMPONENT_TESTING_GUIDE.md** troubleshooting section.

---

## Research Sources

### Configuration & Setup
- [JetBrains Guide: DOM Testing with Happy DOM](https://www.jetbrains.com/guide/javascript/tutorials/eleventy-tsx/happy-dom/)
- [happy-dom Wiki: Setup as Test Environment](https://github.com/capricorn86/happy-dom/wiki/Setup-as-Test-Environment)
- [Vitest Configuration Guide](https://vitest.dev/config/)

### TanStack Query Testing
- [TanStack Query Testing Guide](https://tanstack.com/query/v3/docs/framework/react/guides/testing)
- [Testing Library Setup](https://testing-library.com/docs/svelte-testing-library/setup/)
- [TkDodo's Testing React Query Blog](https://tkdodo.eu/blog/testing-react-query)

### Next.js Mocking
- [DEV Community: Mocking useSearchParams and useRouter](https://dev.to/peterlidee/-mocking-usesearchparams-and-userouter-with-jest-in-next-13-nextnavigation-15bd)
- [DEV Community: Next.js 15 Mocking Guide](https://dev.to/peterlidee/5-mocking-usepathname-usesearchparams-and-userouter-with-jest-in-next-15-3coh)

### Mock Data Factories
- [DEV Community: Mock Factory Pattern in TypeScript](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9)
- [Theodo Blog: Making Unit Tests Easy with Mock Data](https://blog.theodo.com/2023/01/mock-data-with-factory-pattern/)
- [Nearform Blog: Mock Factories Make Better Tests](https://formidable.com/blog/2023/mock-factories-make-better-tests/)

### happy-dom vs jsdom
- [Vitest Discussion: jsdom vs happy-dom](https://github.com/vitest-dev/vitest/discussions/1607)
- [Sean Coughlin: jsdom vs happy-dom Comparison](https://blog.seancoughlin.me/jsdom-vs-happy-dom-navigating-the-nuances-of-javascript-testing)
- [Steve Kinney: Testing the DOM Setup](https://stevekinney.com/courses/testing/testing-the-dom)

---

## Next Steps

1. **Review the examples** - Read through the three example test files
2. **Read the full guide** - COMPONENT_TESTING_GUIDE.md has all details
3. **Write your first test** - Use the quick start template
4. **Run tests** - `bun run test:unit:watch`
5. **Check coverage** - `bun run test:unit:ui`

## Quick Checklist for New Component Test

- [ ] Create `.test.tsx` file in `tests/unit/components/`
- [ ] Import from `render-utils.tsx` (not directly from `@testing-library/react`)
- [ ] Use `renderWithProviders()` instead of `render()`
- [ ] Use `mockTicket()` or factories for test data
- [ ] Mock Next.js hooks if component uses them
- [ ] Use `waitFor()` for async operations
- [ ] Use user-centric queries (`getByRole`, `getByLabelText`)
- [ ] Test behavior, not implementation
- [ ] Run `bun run test:unit:watch` to verify

---

## TypeScript Strict Mode

All code is compatible with TypeScript strict mode:
- ✅ Type-safe factories with `Partial<T>`
- ✅ All mocks properly typed
- ✅ Component props fully typed
- ✅ No `any` types except where necessary

---

## Performance Tips

1. **Use happy-dom by default** - 2-10x faster than jsdom
2. **Disable retries in tests** - Faster failure detection
3. **Clear mocks in beforeEach** - Prevents test pollution
4. **Use factories instead of hard-coded data** - Cleaner code
5. **Test behavior, not implementation** - More maintainable
6. **Parallelize unit tests** - They're fast and independent

---

## Integration with Existing Project

The ai-board project already has:
- ✅ Vitest 4.0.2 configured
- ✅ happy-dom 20.0.8 installed
- ✅ React Testing Library 16.3.0 installed
- ✅ TypeScript 5.6.3 (strict mode enabled)
- ✅ TanStack Query 5.90.5 installed

**No additional dependencies needed!** All utilities use existing packages.

---

## Support & Questions

For comprehensive coverage of all topics, see:
- **COMPONENT_TESTING_GUIDE.md** - Complete reference manual
- **COMPONENT_TESTING_SETUP_SUMMARY.md** - Quick reference & API docs
- **Example tests** - Working code demonstrating patterns

---

Created: December 27, 2025
Last Updated: December 27, 2025

Status: Ready for use in TypeScript strict mode with Vitest + React Testing Library + happy-dom
