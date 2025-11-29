# Testing Infrastructure

Comprehensive testing strategy with Playwright (E2E/API) and Vitest (unit tests), including data isolation patterns.

## Test Organization

### Directory Structure

```
tests/
├── global-setup.ts          # Test environment setup
├── global-teardown.ts       # Test environment cleanup
├── helpers/                 # Shared test utilities
│   ├── db-setup.ts          # Database helpers
│   ├── db-cleanup.ts        # Cleanup utilities
│   └── test-utils.tsx       # React testing utilities
├── api/                     # API contract tests
│   ├── tickets.spec.ts
│   ├── comments.spec.ts
│   └── jobs.spec.ts
├── e2e/                     # End-to-end tests
│   ├── ticket-workflow.spec.ts
│   ├── drag-and-drop.spec.ts
│   ├── comments.spec.ts
│   └── tickets/
│       └── description-markdown-rendering.spec.ts  # Markdown in descriptions
├── unit/                    # Unit tests
│   ├── job-state-machine.test.ts
│   ├── useJobPolling.test.ts
│   └── query-keys.test.ts
└── integration/             # Integration tests
    └── workflow-dispatch.spec.ts
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

### API Contract Test

**File**: `tests/api/tickets.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tickets API', () => {
  test.beforeEach(async () => {
    await cleanupDatabase();
  });

  test('POST /api/projects/:projectId/tickets creates ticket', async ({ request }) => {
    const response = await request.post('/api/projects/1/tickets', {
      data: {
        title: '[e2e] Test Ticket',
        description: 'Test description',
      },
    });

    expect(response.status()).toBe(201);

    const ticket = await response.json();
    expect(ticket.title).toBe('[e2e] Test Ticket');
    expect(ticket.stage).toBe('INBOX');
    expect(ticket.projectId).toBe(1);
  });

  test('GET /api/projects/:projectId/tickets returns tickets', async ({ request }) => {
    // Create test ticket
    await request.post('/api/projects/1/tickets', {
      data: {
        title: '[e2e] Test Ticket',
        description: 'Test description',
      },
    });

    // Fetch tickets
    const response = await request.get('/api/projects/1/tickets');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].title).toBe('[e2e] Test Ticket');
  });

  test('PATCH /api/projects/:projectId/tickets/:id updates ticket', async ({ request }) => {
    // Create ticket
    const createResponse = await request.post('/api/projects/1/tickets', {
      data: { title: '[e2e] Original', description: 'Desc' },
    });
    const ticket = await createResponse.json();

    // Update ticket
    const updateResponse = await request.patch(`/api/projects/1/tickets/${ticket.id}`, {
      data: {
        title: '[e2e] Updated',
        version: ticket.version,
      },
    });

    expect(updateResponse.status()).toBe(200);

    const updated = await updateResponse.json();
    expect(updated.title).toBe('[e2e] Updated');
    expect(updated.version).toBe(ticket.version + 1);
  });
});
```

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

## Running Tests

### Commands

```bash
# All tests (unit + E2E)
bun run test

# Unit tests only (Vitest)
bun run test:unit
# or
bun test

# E2E tests only (Playwright)
bun run test:e2e
# or
npx playwright test

# E2E with UI mode
npx playwright test --ui

# Specific test file
npx playwright test tests/api/tickets.spec.ts

# Debug mode
npx playwright test --debug

# Generate HTML report
npx playwright show-report
```

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
        run: bun test

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
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

- name: Run E2E Tests
  run: npx playwright test --reporter=json --output=e2e-results.json
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

### Test Isolation
- ✅ Use `beforeEach` cleanup for each test
- ✅ Assume clean database state at test start
- ✅ Use `[e2e]` prefix for all test data
- ❌ Don't rely on test execution order

### Data Management
- ✅ Create minimal test data needed
- ✅ Use deterministic IDs (1, 2 for projects)
- ✅ Clean up after tests (via global teardown)
- ❌ Don't create data without `[e2e]` prefix

### Assertions
- ✅ Use specific assertions (toBe, toHaveLength)
- ✅ Test both success and error cases
- ✅ Verify database state for mutations
- ❌ Don't test implementation details

### Performance
- ✅ Run tests in parallel (Playwright default)
- ✅ Use database transactions for speed
- ✅ Mock external services (Cloudinary, GitHub)
- ❌ Don't make unnecessary API calls

### Debugging
- ✅ Use `--debug` flag for step-through
- ✅ Take screenshots on failure (automatic)
- ✅ Use `page.pause()` for breakpoints
- ❌ Don't commit debug code
