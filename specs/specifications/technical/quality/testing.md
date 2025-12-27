# Testing Infrastructure

Comprehensive testing strategy following Testing Trophy architecture: Vitest for unit and integration tests, Playwright for browser-required E2E tests only.

## Test Organization

### Directory Structure

```
tests/
├── fixtures/                # Test infrastructure
│   ├── playwright/          # Playwright fixtures
│   │   ├── auth-fixture.ts
│   │   └── worker-isolation.ts
│   └── vitest/              # Vitest fixtures (integration tests)
│       ├── api-client.ts    # Fetch wrapper with auth
│       ├── global-setup.ts  # One-time database setup
│       └── setup.ts         # Per-test worker isolation
├── helpers/                 # Shared test utilities
│   ├── db-setup.ts          # Database helpers
│   ├── db-cleanup.ts        # Cleanup utilities
│   ├── worker-isolation.ts  # Worker → project ID mapping
│   └── test-utils.tsx       # React testing utilities
├── unit/                    # Unit tests (Vitest)
│   ├── components/          # Component tests (RTL)
│   │   ├── helpers/         # Component test utilities
│   │   │   ├── test-wrapper.tsx    # QueryClient provider wrapper
│   │   │   ├── render-helpers.tsx  # renderWithProviders helper
│   │   │   ├── factories.ts        # Type-safe mock data factories
│   │   │   └── next-mocks.ts       # Next.js component mocks
│   │   ├── board/           # Board component tests
│   │   │   ├── ticket-card.test.tsx
│   │   │   ├── stage-column.test.tsx
│   │   │   └── new-ticket-modal.test.tsx
│   │   ├── comments/        # Comment component tests
│   │   │   ├── comment-form.test.tsx
│   │   │   └── comment-list.test.tsx
│   │   └── projects/        # Project component tests
│   │       ├── project-card.test.tsx
│   │       └── empty-projects-state.test.tsx
│   ├── job-state-machine.test.ts
│   ├── useJobPolling.test.ts
│   └── query-keys.test.ts
├── integration/             # Integration tests (Vitest)
│   ├── projects/            # Domain: project management
│   │   ├── crud.test.ts
│   │   └── settings.test.ts
│   ├── tickets/             # Domain: ticket lifecycle
│   │   ├── crud.test.ts
│   │   ├── transitions.test.ts
│   │   ├── workflows.test.ts
│   │   └── constraints.test.ts
│   ├── comments/            # Domain: comment system
│   │   └── crud.test.ts
│   ├── jobs/                # Domain: job tracking
│   │   └── status.test.ts
│   └── cleanup/             # Domain: cleanup workflow
│       └── analysis.test.ts
└── e2e/                     # E2E tests (Playwright, browser-required only)
    ├── auth/                # OAuth flows
    ├── board/               # Drag-drop interactions
    ├── keyboard/            # Keyboard navigation
    └── visual/              # Viewport/responsive
```

## Testing Trophy Architecture

### Test Type Selection

The project follows Kent C. Dodds' Testing Trophy architecture, emphasizing fast integration tests over slow E2E tests.

| Test Type | Tool | Speed | Use For |
|-----------|------|-------|---------|
| Unit | Vitest | ~5ms | Pure functions, utilities, hooks |
| Component | Vitest + RTL | ~10ms | React component rendering, user interactions |
| Integration | Vitest | ~50ms | API endpoints, database operations, state machines |
| E2E | Playwright | ~500ms | Browser features (OAuth, drag-drop, viewport) |

### When to Use Component Tests (RTL)

Component tests validate React component behavior without a real browser:

- **Component rendering**: Verify components render with correct data
- **User interactions**: Clicks, form submissions, keyboard input
- **Conditional rendering**: Display logic based on props/state
- **Event handlers**: Callback functions fire with correct arguments
- **Form validation**: Client-side validation and error messages
- **Modal interactions**: Opening/closing dialogs and overlays
- **State updates**: Component state changes in response to user actions

**Test Utilities**:
- `renderWithProviders()`: Renders components with QueryClientProvider
- `createMock*()` factories: Type-safe mock data (Ticket, Project, Job, etc.)
- `userEvent`: Simulate user interactions (click, type, keyboard shortcuts)
- Query helpers: `getByRole`, `getByLabelText`, `getByText`

### When to Use Integration Tests (Vitest)

Integration tests validate API behavior and database operations without a browser:

- **API endpoint validation**: HTTP methods, status codes, response schemas
- **Database constraints**: Foreign keys, unique constraints, cascade deletes
- **State machine transitions**: Valid/invalid state changes
- **Authorization**: Access control, ownership verification
- **Business logic**: Multi-step workflows, data transformations

### When to Use E2E Tests (Playwright)

E2E tests are reserved for scenarios that genuinely require a real browser:

- **OAuth flows**: Browser redirects, session cookies
- **Drag-and-drop**: DnD Kit interactions with real DOM
- **Keyboard navigation**: Focus management, keyboard shortcuts
- **Viewport testing**: Responsive layouts, media queries
- **Visual state**: Cleanup banners, loading states

### Worker Isolation Pattern

Both Vitest integration tests and Playwright E2E tests use worker isolation to enable parallel execution without data conflicts.

**Project ID Mapping**:
```typescript
const PROJECT_MAPPING = [1, 2, 4, 5, 6, 7]; // Skip project 3 (development)

// Each worker gets a unique project ID based on pool ID
function getProjectId(workerId: number): number {
  return PROJECT_MAPPING[workerId % PROJECT_MAPPING.length];
}
```

**Vitest Configuration**:
```typescript
// vitest.config.mts
{
  pool: 'forks',
  poolOptions: {
    forks: {
      maxForks: 6, // Match project mapping length
      minForks: 1,
    },
  },
}
```

**Playwright Configuration**:
```typescript
// playwright.config.ts
{
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined, // Parallel in local, sequential in CI
}
```

## Test Data Isolation

### Prefix Pattern

**Convention**: All test-generated data uses `[e2e]` prefix

```typescript
// Ticket creation
const ticket = await createTicket(request, {
  title: '[e2e] Fix login bug',  // ← [e2e] prefix mandatory
  description: 'Test description',
});

// Project creation
const project = await prisma.project.upsert({
  where: { id: 1 },
  create: {
    name: '[e2e] Test Project',  // ← [e2e] prefix mandatory
    ...
  }
});
```

### Reserved Project IDs

- **Project 1**: Primary E2E test project (`githubOwner: "test", githubRepo: "test"`)
- **Project 2**: Secondary E2E test project (`githubOwner: "test", githubRepo: "test2"`)
- **Project 3**: Development project (AI Board Development)
- **Project 4+**: Additional projects (test or manual)

### Selective Cleanup

**File**: `tests/helpers/db-cleanup.ts`

```typescript
import { prisma } from '@/app/lib/db';

export async function cleanupDatabase() {
  // Delete all tickets from test projects (1, 2)
  await prisma.ticket.deleteMany({
    where: {
      projectId: { in: [1, 2] }
    }
  });

  // Delete [e2e] prefixed tickets from other projects
  await prisma.ticket.deleteMany({
    where: {
      title: { startsWith: '[e2e]' },
      projectId: { notIn: [1, 2, 3] }
    }
  });

  // Delete [e2e] prefixed projects (except 1, 2, 3)
  await prisma.project.deleteMany({
    where: {
      name: { startsWith: '[e2e]' },
      id: { notIn: [1, 2, 3] }
    }
  });

  // Delete all comments from test projects
  await prisma.comment.deleteMany({
    where: {
      ticket: {
        projectId: { in: [1, 2] }
      }
    }
  });

  // Delete all jobs from test projects
  await prisma.job.deleteMany({
    where: {
      projectId: { in: [1, 2] }
    }
  });
}
```

### Test User Management

**Global Setup**:

```typescript
// tests/global-setup.ts
import { prisma } from '@/app/lib/db';
import { cleanupDatabase } from './helpers/db-cleanup';

export default async function globalSetup() {
  // Clean database before all tests
  await cleanupDatabase();

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });

  // Create test projects with userId
  await prisma.project.upsert({
    where: { id: 1 },
    update: { userId: testUser.id },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      description: 'Primary E2E test project',
      githubOwner: 'test',
      githubRepo: 'test',
      userId: testUser.id,
    },
  });

  await prisma.project.upsert({
    where: { id: 2 },
    update: { userId: testUser.id },
    create: {
      id: 2,
      name: '[e2e] Test Project 2',
      description: 'Secondary E2E test project',
      githubOwner: 'test',
      githubRepo: 'test2',
      userId: testUser.id,
    },
  });

  // Store for tests
  process.env.TEST_USER_ID = testUser.id;
}
```

## Playwright Configuration

### Config File

**File**: `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
```

## Test Patterns

### Component Test (RTL)

**File**: `tests/unit/components/board/ticket-card.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/render-helpers';
import { createMockTicketWithVersion } from '../helpers/factories';
import { TicketCard } from '@/components/board/ticket-card';

// Mock dependencies
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn() }),
}));

describe('TicketCard', () => {
  it('displays ticket key and title', () => {
    const ticket = createMockTicketWithVersion({
      ticketKey: 'ABC-42',
      title: 'Fix authentication bug',
    });

    renderWithProviders(<TicketCard ticket={ticket} />);

    expect(screen.getByText('ABC-42')).toBeInTheDocument();
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument();
  });

  it('calls onTicketClick when card is clicked', async () => {
    const user = userEvent.setup();
    const ticket = createMockTicketWithVersion();
    const onClick = vi.fn();

    renderWithProviders(
      <TicketCard ticket={ticket} onTicketClick={onClick} />
    );

    await user.click(screen.getByTestId('ticket-card'));

    expect(onClick).toHaveBeenCalledWith(ticket);
  });

  it('shows preview URL badge when available', () => {
    const ticket = createMockTicketWithVersion({
      previewUrl: 'https://preview.example.com',
    });

    renderWithProviders(<TicketCard ticket={ticket} />);

    expect(screen.getByTestId('preview-badge')).toBeInTheDocument();
  });
});
```

**Key Features**:
- `renderWithProviders()` provides QueryClient context automatically
- `createMockTicketWithVersion()` generates type-safe mock data
- `userEvent` simulates real user interactions
- `vi.mock()` mocks dependencies like `@dnd-kit/core`
- Query by role/label first, fallback to test IDs when needed
- Average execution: ~10ms per test

### Integration Test (Vitest)

**File**: `tests/integration/tickets/crud.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';

describe('Tickets API', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('POST /api/projects/:projectId/tickets creates ticket', async () => {
    const response = await ctx.api.post(`/api/projects/${ctx.projectId}/tickets`, {
      title: '[e2e] Test Ticket',
      description: 'Test description',
    });

    expect(response.status).toBe(201);

    const ticket = await response.json();
    expect(ticket.title).toBe('[e2e] Test Ticket');
    expect(ticket.stage).toBe('INBOX');
    expect(ticket.projectId).toBe(ctx.projectId);
  });

  it('GET /api/projects/:projectId/tickets returns tickets', async () => {
    // Create test ticket
    await ctx.createTicket({
      title: '[e2e] Test Ticket',
      description: 'Test description',
    });

    // Fetch tickets
    const response = await ctx.api.get(`/api/projects/${ctx.projectId}/tickets`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].title).toBe('[e2e] Test Ticket');
  });

  it('PATCH /api/projects/:projectId/tickets/:id updates ticket', async () => {
    // Create ticket
    const { id } = await ctx.createTicket({
      title: '[e2e] Original',
      description: 'Desc',
    });

    // Fetch ticket to get version
    const getResponse = await ctx.api.get(`/api/projects/${ctx.projectId}/tickets/${id}`);
    const ticket = await getResponse.json();

    // Update ticket
    const updateResponse = await ctx.api.patch(`/api/projects/${ctx.projectId}/tickets/${id}`, {
      title: '[e2e] Updated',
      version: ticket.version,
    });

    expect(updateResponse.status).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.title).toBe('[e2e] Updated');
    expect(updated.version).toBe(ticket.version + 1);
  });
});
```

**Key Features**:
- `getTestContext()` provides isolated project ID and API client
- `ctx.cleanup()` clears test data for each test
- `ctx.createTicket()` helper for test fixtures
- Worker isolation prevents parallel test conflicts
- Average execution: ~50ms per test

### E2E Test

**File**: `tests/e2e/ticket-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Ticket Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupDatabase();
    await page.goto('/projects/1/board');
  });

  test('creates ticket and moves through workflow', async ({ page }) => {
    // Create ticket
    await page.click('button:has-text("+ New Ticket")');
    await page.fill('input[name="title"]', '[e2e] Test Feature');
    await page.fill('textarea[name="description"]', 'Test description');
    await page.click('button:has-text("Create")');

    // Verify ticket appears in INBOX
    const ticket = page.locator('.ticket-card', {
      hasText: '[e2e] Test Feature',
    });
    await expect(ticket).toBeVisible();

    // Drag to SPECIFY (would trigger workflow in real scenario)
    const specifyColumn = page.locator('[data-stage="SPECIFY"]');
    await ticket.dragTo(specifyColumn);

    // Verify ticket moved
    await expect(specifyColumn.locator('.ticket-card', {
      hasText: '[e2e] Test Feature',
    })).toBeVisible();
  });
});
```

### Unit Test

**File**: `tests/unit/job-state-machine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { canTransition, InvalidTransitionError } from '@/app/lib/job-state-machine';

describe('Job State Machine', () => {
  it('allows PENDING → RUNNING', () => {
    expect(canTransition('PENDING', 'RUNNING')).toBe(true);
  });

  it('allows RUNNING → COMPLETED', () => {
    expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
  });

  it('rejects COMPLETED → RUNNING', () => {
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
  });

  it('allows idempotent transitions', () => {
    expect(canTransition('COMPLETED', 'COMPLETED')).toBe(true);
    expect(canTransition('FAILED', 'FAILED')).toBe(true);
  });

  it('throws on invalid transitions', () => {
    expect(() => {
      if (!canTransition('PENDING', 'COMPLETED')) {
        throw new InvalidTransitionError('PENDING', 'COMPLETED');
      }
    }).toThrow(InvalidTransitionError);
  });
});
```

## Test Utilities

### Database Setup Helper

**File**: `tests/helpers/db-setup.ts`

```typescript
import { prisma } from '@/app/lib/db';

export async function ensureTestUser() {
  return await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
      emailVerified: new Date(),
    },
  });
}

export async function createTestTicket(data: {
  title: string;
  description: string;
  projectId?: number;
  stage?: string;
}) {
  const testUser = await ensureTestUser();

  return await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      stage: data.stage || 'INBOX',
      projectId: data.projectId || 1,
    },
  });
}

export async function createTestJob(data: {
  ticketId: number;
  command: string;
  status?: string;
}) {
  return await prisma.job.create({
    data: {
      ticketId: data.ticketId,
      projectId: 1,
      command: data.command,
      status: data.status || 'PENDING',
    },
  });
}
```

### React Testing Utilities

**File**: `tests/helpers/test-utils.tsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface TestProvidersProps {
  children: React.ReactNode;
}

function TestProviders({ children }: TestProvidersProps) {
  const testQueryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: TestProviders, ...options });
}
```

### Component Test Helpers

**File**: `tests/unit/components/helpers/render-helpers.tsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Creates a QueryClient configured for component tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Renders component with QueryClientProvider and returns queryClient for assertions
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { queryClient?: QueryClient }
) {
  const queryClient = options?.queryClient ?? createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    ...render(ui, { ...options, wrapper: Wrapper }),
    queryClient,
  };
}
```

**File**: `tests/unit/components/helpers/factories.ts`

```typescript
import type { Ticket, Project, Job, Comment, User } from '@prisma/client';

type TicketWithVersion = Ticket & { version: number };

/**
 * Creates type-safe mock ticket with all required fields
 */
export function createMockTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    ticketKey: 'ABC-1',
    title: 'Test Ticket',
    description: 'Test description',
    stage: 'INBOX',
    projectId: 1,
    workflowType: null,
    branch: null,
    previewUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates ticket with version field for optimistic locking
 */
export function createMockTicketWithVersion(
  overrides: Partial<TicketWithVersion> = {}
): TicketWithVersion {
  return {
    ...createMockTicket(overrides),
    version: overrides.version ?? 0,
  };
}

/**
 * Creates type-safe mock project
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    key: 'ABC',
    name: 'Test Project',
    description: 'Test project description',
    githubOwner: 'test-owner',
    githubRepo: 'test-repo',
    userId: 'user-1',
    clarificationPolicy: 'CONSERVATIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Additional factories: createMockJob, createMockComment, createMockUser
```

**Key Features**:
- **Type-safe mocks**: All factories return Prisma-typed entities
- **Minimal defaults**: Only required fields, override as needed
- **Version support**: `createMockTicketWithVersion()` includes optimistic locking field
- **Consistent structure**: All factories follow same pattern

## Running Tests

### Commands

```bash
# All tests (unit + integration + E2E)
bun run test

# Unit tests only (Vitest)
bun run test:unit
# or
bun test

# Integration tests only (Vitest)
bun run test:integration
# Sets VITEST_INTEGRATION=1 to enable integration test mode

# E2E tests only (Playwright)
bun run test:e2e
# or
npx playwright test

# E2E with UI mode
npx playwright test --ui

# Specific test file
npx playwright test tests/e2e/board/drag-drop.spec.ts
VITEST_INTEGRATION=1 bun test tests/integration/tickets/crud.test.ts

# Debug mode
npx playwright test --debug
bun test --reporter=verbose

# Coverage
bun test --coverage

# Generate HTML report
npx playwright show-report
```

### Test Execution Modes

**Unit Tests** (`bun run test:unit`):
- Environment: `happy-dom` (lightweight browser simulation)
- Includes: `tests/unit/**/*.test.ts` and `tests/unit/components/**/*.test.tsx`
- Timeout: 5 seconds per test
- Workers: Unlimited (CPU-bound)
- Component tests run alongside unit tests in same environment

**Integration Tests** (`bun run test:integration`):
- Environment: `node` (no browser simulation)
- Includes: `tests/integration/**/*.test.ts`
- Timeout: 30 seconds per test
- Workers: 6 forks (matches project mapping)
- Setup: `tests/fixtures/vitest/setup.ts` (worker isolation)
- Global Setup: `tests/fixtures/vitest/global-setup.ts` (one-time DB prep)

**E2E Tests** (`bun run test:e2e`):
- Environment: Real browser (Chromium/Firefox/WebKit)
- Includes: `tests/e2e/**/*.spec.ts`
- Timeout: Default Playwright timeout
- Workers: Parallel (local), sequential (CI)
- Setup: Playwright fixtures

### CI/CD Integration

**GitHub Actions** (`.github/workflows/test.yml`):

```yaml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22.20.0'

      - name: Install dependencies
        run: npm install

      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run unit tests
        run: bun run test:unit

      - name: Run integration tests
        run: bun run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: bun run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Automated Test Verification

### Verify Workflow

The verify workflow (`.github/workflows/verify.yml`) runs automatically when tickets transition BUILD → VERIFY:

**Phase 1: Test Execution**
```yaml
- name: Run Unit Tests
  run: bun run test:unit --reporter=json --outputFile=unit-results.json

- name: Run Integration Tests
  run: bun run test:integration --reporter=json --outputFile=integration-results.json

- name: Run E2E Tests
  run: bun run test:e2e --reporter=json --output=e2e-results.json
```

**Phase 2: Failure Report Generation**
```bash
# If tests fail, generate structured report
node .specify/scripts/generate-test-report.js \
  --unit unit-results.json \
  --e2e e2e-results.json \
  --output test-failures.json
```

**Phase 3: AI-Powered Fixes**
```bash
# Claude analyzes failures and applies fixes
claude --dangerously-skip-permissions "/verify"
```

**Phase 4: Pull Request Creation**
```bash
# Only if all tests pass
.specify/scripts/bash/create-pr-only.sh
```

### Test Failure Report Format

**File**: `test-failures.json`

```json
{
  "summary": {
    "totalFailures": 5,
    "unitFailures": 2,
    "e2eFailures": 3
  },
  "categories": {
    "assertions": [...],
    "timeouts": [...],
    "errors": [...],
    "setup": [...]
  },
  "rootCauses": [
    {
      "pattern": "Expected N but got N",
      "originalMessage": "Expected 5 but got 3",
      "affectedTests": [
        {
          "testPath": "tests/api/tickets.spec.ts > GET /tickets",
          "testName": "GET /tickets returns correct count",
          "filePath": "tests/api/tickets.spec.ts"
        }
      ],
      "category": "assertions",
      "count": 2
    }
  ],
  "impactPriority": [
    {
      "description": "Expected 5 but got 3",
      "affectedTestCount": 2,
      "category": "assertions",
      "tests": ["tests/api/tickets.spec.ts > GET /tickets"]
    }
  ]
}
```

### AI Fix Strategy

**Critical Context**:
- ℹ️ **All tests were passing on main branch (100% baseline)**
- ℹ️ **Test failures are expected when implementing new features**
- 💡 **Your job**: Determine if failure is bug OR intentional behavior change

**Root Cause Analysis**:
1. Group failures by similar error patterns
2. Identify common root causes
3. Prioritize by impact (number of affected tests)
4. **Read specification FIRST**: `specs/*/spec.md` - Source of truth for intended behavior
5. **Compare with main branch**: `git diff main...HEAD` to see what changed
6. **Check test history**: `git show main:<test-file>` to verify test existed
7. Analyze each root cause systematically

**Fix Application**:
1. **CRITICAL**: Read specification to understand intended behavior
2. Read test file and implementation
3. Check recent changes: `git diff main...HEAD`
4. Check if test passed on main: `git show main:<test-file>`
5. **Decision Framework** (specification is source of truth):
   - **Case A - Implementation Bug**: Spec says X, implementation does Y, test expects X
     → Fix implementation to match specification
   - **Case B - Intentional Change**: Spec requires NEW behavior X, test expects OLD behavior Y
     → Update test to expect new behavior from specification
   - **Case C - Unclear**: When uncertain, prefer fixing implementation (safer)
6. Apply minimal fix (implementation OR test, based on spec)
7. Re-run only affected tests
8. Validate with lint and typecheck

**Quality Gates**:
- Lint must pass after each fix
- Type check must pass after each fix
- No new test failures introduced
- Maximum 3 fix attempts per root cause

### Verification Success Criteria

Tests must pass with these requirements:

**Unit Tests**:
- ≥80% line coverage maintained
- All test suites pass
- No skipped tests (unless marked intentionally)

**E2E Tests**:
- All critical user paths tested
- All API endpoints validated
- No flaky tests (consistent results)

**Integration**:
- Database migrations successful
- Test data cleanup working
- No orphaned data in test database

## Test Coverage

### Target Coverage

- **Unit Tests**: 80% line coverage
- **API Tests**: 100% endpoint coverage
- **E2E Tests**: Critical user paths

### Measuring Coverage

```bash
# Vitest coverage
bun test --coverage

# Playwright coverage (requires instrumentation)
npx playwright test --coverage
```

## Best Practices

### Test Type Selection
- ✅ Default to integration tests for API/database behavior
- ✅ Use component tests (RTL) for React component interactions
- ✅ Use unit tests for pure functions and utilities
- ✅ Reserve E2E tests for browser-required scenarios only
- ❌ Don't use Playwright for component testing (use RTL instead)
- ❌ Don't use Playwright for API testing (use Vitest integration tests)

### Test Isolation
- ✅ Use `beforeEach` cleanup for each test
- ✅ Assume clean database state at test start
- ✅ Use `[e2e]` prefix for all test data
- ✅ Use worker isolation for parallel execution
- ❌ Don't rely on test execution order

### Data Management
- ✅ Create minimal test data needed
- ✅ Use worker-specific project IDs (1, 2, 4, 5, 6, 7)
- ✅ Clean up after tests (via `ctx.cleanup()` or global teardown)
- ✅ Use test helpers: `ctx.createTicket()`, `ctx.createProject()`
- ❌ Don't create data without `[e2e]` prefix
- ❌ Don't hardcode project ID 3 (reserved for development)

### Assertions
- ✅ Use specific assertions (toBe, toHaveLength)
- ✅ Test both success and error cases
- ✅ Verify database state for mutations
- ✅ Check status codes before parsing response bodies
- ✅ Query by role/label first in component tests (`getByRole`, `getByLabelText`)
- ✅ Use `findBy*` for async elements that appear after render
- ❌ Don't test implementation details (CSS classes, internal state)
- ❌ Don't query by implementation details in component tests

### Performance
- ✅ Run integration tests in parallel (6 workers)
- ✅ Use native fetch instead of Playwright for API tests
- ✅ Mock external services (Cloudinary, GitHub)
- ✅ Target <50ms per integration test, <500ms per E2E test
- ❌ Don't make unnecessary API calls

### Debugging
- ✅ Use `bun test --reporter=verbose` for detailed output
- ✅ Use `npx playwright test --debug` for E2E debugging
- ✅ Use `console.error()` in tests (goes to stderr, not captured)
- ✅ Take screenshots on failure (automatic in Playwright)
- ❌ Don't commit debug code or console.log statements
