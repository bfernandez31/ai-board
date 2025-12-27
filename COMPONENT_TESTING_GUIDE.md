# Component Testing with React Testing Library + Vitest + happy-dom

Comprehensive setup guide for testing React components in TypeScript strict mode, with focus on TanStack Query integration, Next.js features, and type-safe mock data factories.

## Table of Contents

1. [Configuration & Setup](#configuration--setup)
2. [happy-dom vs jsdom](#happy-dom-vs-jsdom)
3. [Test Utilities & Render Wrappers](#test-utilities--render-wrappers)
4. [TanStack Query Testing](#tanstack-query-testing)
5. [Mocking Next.js Features](#mocking-nextjs-features)
6. [Type-Safe Mock Data Factories](#type-safe-mock-data-factories)
7. [Practical Examples](#practical-examples)
8. [Troubleshooting](#troubleshooting)

---

## Configuration & Setup

### Current Project Setup

The ai-board project already has optimal configuration:

**vitest.config.mts:**
```typescript
export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom for unit tests (faster than jsdom)
    environment: isIntegration ? 'node' : 'happy-dom',
    include: isIntegration
      ? ['tests/integration/**/*.test.ts']
      : ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/**/*.spec.ts'],
    setupFiles: isIntegration ? ['./tests/fixtures/vitest/setup.ts'] : [],
    fileParallelism: isIntegration ? false : true,
    testTimeout: isIntegration ? 30000 : 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Setup File for Component Tests

Create a new setup file for unit/component tests:

**tests/fixtures/vitest/component-setup.ts:**
```typescript
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Automatic cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia if not available in happy-dom
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;
```

Update vitest config to include component setup:
```typescript
setupFiles: isIntegration
  ? ['./tests/fixtures/vitest/setup.ts']
  : ['./tests/fixtures/vitest/component-setup.ts'],
```

### Package.json Scripts

```json
{
  "test:unit": "vitest run",
  "test:unit:ui": "vitest --ui",
  "test:unit:watch": "vitest --watch"
}
```

---

## happy-dom vs jsdom

### Performance Characteristics

| Feature | happy-dom | jsdom |
|---------|-----------|-------|
| **Performance** | 2-10x faster | Slower, more overhead |
| **Memory Usage** | Minimal | Higher |
| **API Completeness** | ~80% coverage | ~95% coverage |
| **Maturity** | Newer, actively maintained | Very mature, widely used |
| **Use Case** | Fast unit tests | Comprehensive browser simulation |

### Key Differences

**happy-dom strengths:**
- Significantly faster for unit tests
- Sufficient for most React component testing
- Lower memory footprint
- Ideal for CI/CD pipelines

**jsdom strengths:**
- More complete browser API implementation
- Better for complex DOM interactions
- More battle-tested in production
- Required for edge case browser features

### When to Use Each

**Use happy-dom (default) for:**
- Component unit tests
- Hook testing
- Utility function tests
- Fast feedback loops in development

**Use jsdom when:**
- Testing advanced browser APIs not in happy-dom
- Testing contentEditable or complex text interactions
- Testing form APIs edge cases
- You encounter "API not available" errors

### Switching Environments Per Test

```typescript
import { describe, it, vi } from 'vitest';

describe('Component', { testEnvironment: 'jsdom' }, () => {
  // This test suite runs with jsdom instead of happy-dom
  it('should handle advanced DOM API', () => {
    // test code
  });
});
```

---

## Test Utilities & Render Wrappers

### Custom Render Function

Create a custom render wrapper that includes all necessary providers:

**tests/fixtures/vitest/render-utils.tsx:**
```typescript
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Create a fresh QueryClient for each test
 * Ensures complete test isolation
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: 0, // Disable garbage collection timer
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Test wrapper component that provides all necessary providers
 */
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render function with providers
 * Usage: render(<Component />) instead of RTL render
 */
function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestWrapper, ...options });
}

export { renderWithProviders, createTestQueryClient, TestWrapper };
export * from '@testing-library/react';
```

### Using Custom Render

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

---

## TanStack Query Testing

### Pattern 1: Testing Hooks with QueryClient

**tests/unit/hooks/useDocumentation.test.ts:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDocumentation } from '@/lib/hooks/use-documentation';
import React from 'react';

describe('useDocumentation Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  it('fetches documentation when enabled', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ content: 'Test documentation' }),
      } as Response)
    );

    const { result } = renderHook(
      () => useDocumentation(1, 123, 'spec', true),
      {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: queryClient }, children),
      }
    );

    // Initial state: pending
    expect(result.current.isPending).toBe(true);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.data?.content).toBe('Test documentation');
  });

  it('does not fetch when disabled', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    renderHook(
      () => useDocumentation(1, 123, 'spec', false), // disabled
      {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: queryClient }, children),
      }
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handles errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      } as Response)
    );

    const { result } = renderHook(
      () => useDocumentation(1, 123, 'spec', true),
      {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: queryClient }, children),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('Not found');
  });
});
```

### Pattern 2: Testing Components Using Queries

**tests/unit/components/ticket-card.test.tsx:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/tests/fixtures/vitest/render-utils';
import { TicketCard } from '@/components/board/ticket-card';
import type { TicketWithVersion } from '@/lib/types';

describe('TicketCard Component', () => {
  let mockTicket: TicketWithVersion;

  beforeEach(() => {
    mockTicket = {
      id: 1,
      ticketKey: 'ABC-123',
      title: 'Test Ticket',
      description: 'Test Description',
      stage: 'INBOX',
      branch: 'abc-123-test-ticket',
      projectId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      jobs: [],
    } as TicketWithVersion;

    vi.clearAllMocks();
  });

  it('renders ticket card with title', () => {
    renderWithProviders(
      <TicketCard ticket={mockTicket} />
    );

    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByText('Test Ticket')).toBeInTheDocument();
  });

  it('calls onTicketClick when clicked', () => {
    const onClickMock = vi.fn();

    renderWithProviders(
      <TicketCard ticket={mockTicket} onTicketClick={onClickMock} />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClickMock).toHaveBeenCalledWith(mockTicket);
  });
});
```

### Pattern 3: Cache Invalidation Testing

Existing pattern in the project (from useJobPolling.test.ts):

```typescript
describe('useJobPolling - Cache Invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  it('should invalidate tickets cache when job completes', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let callCount = 0;
    global.fetch = vi.fn(() => {
      callCount++;
      const jobs = callCount === 1
        ? [{ id: 1, status: 'RUNNING' }]
        : [{ id: 1, status: 'COMPLETED' }];

      return Promise.resolve({
        ok: true,
        json: async () => ({ jobs }),
      } as Response);
    });

    const { result } = renderHook(() => useJobPolling(1, 100), {
      wrapper: ({ children }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => {
      expect(result.current.jobs[0]?.status).toBe('COMPLETED');
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['projects', 1, 'tickets'],
      });
    });
  });
});
```

---

## Mocking Next.js Features

### Mocking useRouter and useSearchParams

**tests/fixtures/vitest/next-mocks.ts:**
```typescript
import { vi } from 'vitest';

/**
 * Mock next/navigation module
 * Call in test files or setup: vi.mock('next/navigation', () => createNextNavigationMocks())
 */
export function createNextNavigationMocks() {
  return {
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    })),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    usePathname: vi.fn(() => '/'),
  };
}

/**
 * More flexible mock with state management
 */
export function createNextNavigationMocksWithState() {
  let searchParams = new URLSearchParams();
  let pathname = '/';

  return {
    useRouter: vi.fn(() => {
      const push = vi.fn((path: string) => {
        pathname = path;
      });
      const replace = vi.fn((path: string) => {
        pathname = path;
      });
      return {
        push,
        replace,
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        prefetch: vi.fn(),
      };
    }),
    useSearchParams: vi.fn(() => searchParams),
    usePathname: vi.fn(() => pathname),
  };
}
```

### Using the Mocks in Tests

**tests/unit/components/board.test.tsx:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { Board } from '@/components/board/board';

// Mock next/navigation before importing component
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/projects/1/board'),
}));

describe('Board Component', () => {
  it('renders board without errors', () => {
    renderWithProviders(
      <Board ticketsByStage={{}} projectId={1} />
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('updates URL when filter changes', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: vi.fn(),
    } as any);

    renderWithProviders(
      <Board ticketsByStage={{}} projectId={1} />
    );

    // Test interaction
    // expect(mockPush).toHaveBeenCalledWith(...)
  });
});
```

### Mock Configuration with Flexible State

```typescript
import { vi, beforeEach } from 'vitest';
import * as nextNavigation from 'next/navigation';

beforeEach(() => {
  vi.resetAllMocks();

  // Create mutable state for router mock
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    pathname: '/projects/1/board',
  };

  vi.mocked(nextNavigation.useRouter).mockReturnValue(mockRouter as any);
  vi.mocked(nextNavigation.usePathname).mockReturnValue('/projects/1/board');
  vi.mocked(nextNavigation.useSearchParams).mockReturnValue(
    new URLSearchParams('stage=INBOX')
  );
});
```

---

## Type-Safe Mock Data Factories

### Pattern 1: Simple Factory Functions

**tests/fixtures/factories/ticket-factory.ts:**
```typescript
import { faker } from '@faker-js/faker';
import type { TicketWithVersion } from '@/lib/types';

/**
 * Type-safe factory for creating test tickets
 * Uses Partial<T> to allow selective overrides while maintaining type safety
 */
export function createMockTicket(
  overrides?: Partial<TicketWithVersion>
): TicketWithVersion {
  return {
    id: faker.number.int({ min: 1, max: 10000 }),
    ticketKey: `${faker.string.alphaNumeric(3).toUpperCase()}-${faker.number.int({ min: 1, max: 999 })}`,
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    stage: 'INBOX' as const,
    branch: faker.git.branch().replace(/[\s/]/g, '-'),
    projectId: 1,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    jobs: [],
    version: 1,
    workflowType: 'FULL',
    previewUrl: null,
    ...overrides,
  };
}

/**
 * Factory for creating multiple tickets in different stages
 */
export function createMockTickets(
  count: number,
  stage?: string
): TicketWithVersion[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTicket({
      id: i + 1,
      stage: (stage || 'INBOX') as any,
    })
  );
}
```

### Pattern 2: Complex Nested Factories with Builders

**tests/fixtures/factories/index.ts:**
```typescript
import { faker } from '@faker-js/faker';
import type { TicketWithVersion, Project } from '@/lib/types';
import { Prisma } from '@prisma/client';

/**
 * Comprehensive mock data factory with type safety
 * Supports nested objects and flexible overrides
 */
export class MockDataFactory {
  /**
   * Create a project
   */
  static project(overrides?: Partial<Project>): Project {
    return {
      id: faker.number.int({ min: 1, max: 10000 }),
      name: faker.company.name(),
      key: faker.string.alphaNumeric(3).toUpperCase(),
      description: faker.lorem.paragraph(),
      githubOwner: faker.internet.userName(),
      githubRepo: faker.lorem.slug(),
      clarificationPolicy: 'INTERACTIVE',
      userId: `user-${faker.string.uuid()}`,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create a ticket with optional job and nested relationships
   */
  static ticket(overrides?: Partial<TicketWithVersion>): TicketWithVersion {
    return {
      id: faker.number.int({ min: 1, max: 10000 }),
      projectId: 1,
      ticketKey: `ABC-${faker.number.int({ min: 1, max: 999 })}`,
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      stage: 'INBOX',
      branch: faker.git.branch().replace(/[\s/]/g, '-'),
      workflowType: 'FULL',
      previewUrl: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      version: 1,
      jobs: [],
      ...overrides,
    };
  }

  /**
   * Create a job with proper status typing
   */
  static job(
    overrides?: Partial<Prisma.JobCreateInput>
  ): Prisma.JobCreateInput {
    const status = faker.helpers.arrayElement(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']);
    return {
      ticketId: faker.number.int({ min: 1, max: 10000 }),
      command: faker.helpers.arrayElement([
        'specify',
        'plan',
        'implement',
        'verify',
      ]),
      status,
      jobUrl: faker.internet.url(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };
  }

  /**
   * Create a complete ticket with jobs
   */
  static ticketWithJobs(
    jobCount: number = 1,
    overrides?: Partial<TicketWithVersion>
  ): TicketWithVersion {
    const ticket = this.ticket(overrides);
    return {
      ...ticket,
      jobs: Array.from({ length: jobCount }, (_, i) =>
        this.job({
          ticketId: ticket.id,
        })
      ),
    };
  }

  /**
   * Create multiple tickets efficiently
   */
  static tickets(
    count: number,
    overrides?: Partial<TicketWithVersion>
  ): TicketWithVersion[] {
    return Array.from({ length: count }, (_, i) =>
      this.ticket({
        id: i + 1,
        ...overrides,
      })
    );
  }

  /**
   * Create stage-grouped tickets (simulating database query result)
   */
  static ticketsByStage(
    counts: Record<string, number> = { INBOX: 3, SPECIFY: 2, BUILD: 1 }
  ): Record<string, TicketWithVersion[]> {
    const result: Record<string, TicketWithVersion[]> = {};
    let id = 1;

    for (const [stage, count] of Object.entries(counts)) {
      result[stage] = Array.from({ length: count }, () =>
        this.ticket({ id: id++, stage })
      );
    }

    return result;
  }
}

// Export convenience functions
export const mockTicket = (overrides?: Partial<TicketWithVersion>) =>
  MockDataFactory.ticket(overrides);

export const mockTickets = (count: number, overrides?: Partial<TicketWithVersion>) =>
  MockDataFactory.tickets(count, overrides);

export const mockProject = (overrides?: Partial<Project>) =>
  MockDataFactory.project(overrides);
```

### Usage in Tests

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/tests/fixtures/vitest/render-utils';
import { Board } from '@/components/board/board';
import { MockDataFactory, mockTicket } from '@/tests/fixtures/factories';

describe('Board with Factories', () => {
  it('renders empty board', () => {
    renderWithProviders(
      <Board ticketsByStage={{}} projectId={1} />
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders board with tickets', () => {
    const ticketsByStage = MockDataFactory.ticketsByStage({
      INBOX: 3,
      SPECIFY: 1,
      BUILD: 2,
    });

    renderWithProviders(
      <Board ticketsByStage={ticketsByStage} projectId={1} />
    );

    // All 6 tickets should render
    const tickets = screen.getAllByRole('button', { name: /ABC-/ });
    expect(tickets).toHaveLength(6);
  });

  it('renders ticket with specific properties', () => {
    const customTicket = mockTicket({
      title: 'Custom Test Ticket',
      stage: 'BUILD',
    });

    renderWithProviders(
      <TicketCard ticket={customTicket} />
    );

    expect(screen.getByText('Custom Test Ticket')).toBeInTheDocument();
  });
});
```

---

## Practical Examples

### Complete Component Test

**tests/unit/components/new-ticket-modal.test.tsx:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/tests/fixtures/vitest/render-utils';
import { NewTicketModal } from '@/components/board/new-ticket-modal';
import { mockProject } from '@/tests/fixtures/factories';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
}));

describe('NewTicketModal', () => {
  const mockProject = {
    id: 1,
    name: 'Test Project',
    key: 'TEST',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    renderWithProviders(
      <NewTicketModal isOpen={true} projectId={1} onClose={vi.fn()} />
    );

    expect(screen.getByText('Create New Ticket')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = renderWithProviders(
      <NewTicketModal isOpen={false} projectId={1} onClose={vi.fn()} />
    );

    // Dialog should be in DOM but hidden
    expect(container.querySelector('[role="dialog"]')).not.toBeVisible();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onCloseMock = vi.fn();

    renderWithProviders(
      <NewTicketModal isOpen={true} projectId={1} onClose={onCloseMock} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('creates ticket on submit', async () => {
    const mockCreateMutation = vi.fn().mockResolvedValue({
      id: 123,
      ticketKey: 'TEST-123',
    });

    // Mock the mutation hook
    vi.mock('@/app/lib/hooks/mutations/useCreateTicket', () => ({
      useCreateTicket: vi.fn(() => ({
        mutate: mockCreateMutation,
        isPending: false,
      })),
    }));

    renderWithProviders(
      <NewTicketModal isOpen={true} projectId={1} onClose={vi.fn()} />
    );

    // Fill form
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Feature' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockCreateMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Feature',
        })
      );
    });
  });

  it('shows loading state during submission', async () => {
    vi.mock('@/app/lib/hooks/mutations/useCreateTicket', () => ({
      useCreateTicket: vi.fn(() => ({
        mutate: vi.fn(),
        isPending: true,
      })),
    }));

    renderWithProviders(
      <NewTicketModal isOpen={true} projectId={1} onClose={vi.fn()} />
    );

    // Button should be disabled
    const submitButton = screen.getByRole('button', { name: /create/i });
    expect(submitButton).toBeDisabled();
  });
});
```

### Hook Test with Multiple Scenarios

**tests/unit/hooks/useReducedMotion.test.ts:** (Already in project - shown as reference)

```typescript
describe('useReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    matchMediaMock = vi.fn();
    window.matchMedia = matchMediaMock;
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | null = null;

    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: (event: string, listener: any) => {
        changeListener = listener;
      },
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      if (changeListener) {
        changeListener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });
});
```

---

## Troubleshooting

### Issue: "No QueryClient set"

**Problem:** Tests fail with "No QueryClient set, use QueryClientProvider to set one"

**Solution:** Always wrap components in test utilities:
```typescript
// ✅ Good
const { result } = renderHook(() => useQuery(...), { wrapper: QueryClientProvider });

// ❌ Bad
const { result } = renderHook(() => useQuery(...));
```

### Issue: "act() is not defined"

**Problem:** State updates not wrapped in `act()`

**Solution:**
```typescript
import { act } from '@testing-library/react';

act(() => {
  fireEvent.click(button);
  // or
  result.current.mutate();
});
```

### Issue: "window.matchMedia is not a function"

**Problem:** happy-dom doesn't implement matchMedia by default

**Solution:** Already handled in component-setup.ts, but for individual tests:
```typescript
const matchMediaMock = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
window.matchMedia = matchMediaMock;
```

### Issue: "Cannot find module" for mocked Next.js

**Problem:** Module mock not working

**Solution:** Mocks must be called before imports in test files:
```typescript
// ✅ Correct order
vi.mock('next/navigation', () => ({ /* mock */ }));
import { useRouter } from 'next/navigation'; // Now safe to import
import { MyComponent } from '@/components/my-component';

describe('Test', () => {
  // tests
});
```

### Issue: Tests timing out with happy-dom

**Problem:** Some tests run much slower with happy-dom (especially with byRole queries)

**Debugging steps:**
1. Try switching to jsdom for specific test file
2. Avoid expensive queries like `getByRole()` - use `getByTestId()` instead
3. Check for infinite loops in component or mock

**Solution:**
```typescript
describe('Expensive Test', { testEnvironment: 'jsdom' }, () => {
  // Use jsdom for this suite only
});
```

### Issue: Type errors with mock factories

**Problem:** TypeScript complains about Partial<T> assignments

**Solution:** Ensure proper typing in factory functions:
```typescript
// ✅ Good - explicit return type
export function mockTicket(overrides?: Partial<TicketWithVersion>): TicketWithVersion {
  return { /* complete object */ };
}

// ❌ Bad - loses type safety
export const mockTicket = (overrides?: any) => ({ /* incomplete object */ });
```

---

## Best Practices Summary

1. **Always create fresh QueryClient per test** - Prevents test pollution
2. **Use custom render wrapper** - Ensures all providers are applied consistently
3. **Mock at test level, not globally** - Better control and clarity
4. **Use type-safe factories** - Leverage TypeScript's type system
5. **Prefer happy-dom** - It's fast and sufficient for most tests
6. **Test behavior, not implementation** - Use RTL's recommended queries (getByRole, getByLabelText)
7. **Keep mocks simple** - Only mock what's necessary for the test
8. **Use waitFor for async operations** - Don't use timeouts

---

## References & Resources

- [TanStack Query Testing Guide](https://tanstack.com/query/v3/docs/framework/react/guides/testing)
- [Testing Library Setup](https://testing-library.com/docs/svelte-testing-library/setup/)
- [Vitest Configuration](https://vitest.dev/config/)
- [happy-dom npm](https://www.npmjs.com/package/happy-dom)
- [jsdom vs happy-dom Discussion](https://github.com/vitest-dev/vitest/discussions/1607)
