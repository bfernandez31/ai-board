# Implementation Tasks: Display Generated Spec.md

**Feature**: 022-display-generated-spec
**Branch**: `022-display-generated-spec`
**Total Tasks**: 36
**Estimated Time**: 32-38 hours

## Task Execution Order

**TDD Approach**: Tests BEFORE implementation
1. Setup & Dependencies (T001-T002)
2. Test Fixtures & E2E Tests (T003-T017) - MUST FAIL INITIALLY
3. Backend Implementation (T018-T025)
4. Frontend Implementation (T026-T031)
5. Integration & Validation (T032-T036)

---

## Category 1: Setup & Dependencies

### T001: Install markdown rendering dependencies

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: None
**Estimated Time**: 15m
**Parallel**: [P]

**Description**:
Install react-markdown and react-syntax-highlighter packages required for rendering spec markdown content.

**Acceptance Criteria**:
- [ ] react-markdown ^9.0.1 added to package.json dependencies
- [ ] react-syntax-highlighter ^15.5.0 added to dependencies
- [ ] @types/react-syntax-highlighter ^15.5.11 added to devDependencies
- [ ] npm install completed successfully
- [ ] package-lock.json updated

**Implementation Notes**:
```bash
npm install react-markdown@^9.0.1 react-syntax-highlighter@^15.5.0
npm install --save-dev @types/react-syntax-highlighter@^15.5.11
```

**Testing**:
- Run `npm list react-markdown react-syntax-highlighter` to verify installation
- Check that TypeScript recognizes types with no errors

---

### T002: Create directory structure for new files

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: None
**Estimated Time**: 15m
**Parallel**: [P]

**Description**:
Create directory structure for API route, GitHub integration module, and test fixtures.

**Acceptance Criteria**:
- [ ] Directory `app/api/projects/[projectId]/tickets/[id]/spec/` exists
- [ ] Directory `lib/github/` exists
- [ ] Directory `tests/fixtures/` exists
- [ ] All directories have proper permissions

**Implementation Notes**:
```bash
mkdir -p app/api/projects/[projectId]/tickets/[id]/spec
mkdir -p lib/github
mkdir -p tests/fixtures
```

**Testing**:
- Verify directories exist with `ls` command
- Ensure git tracks directories (add .gitkeep if needed)

---

## Category 2: Test Fixtures & E2E Tests (TDD - Write Tests FIRST)

### T003: Create test fixture for mock spec content

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T002
**Estimated Time**: 30m
**Parallel**: [P]

**Description**:
Create mock spec.md file for E2E tests with proper markdown formatting including headings, lists, and code blocks.

**File**: `tests/fixtures/mock-spec.md`

**Acceptance Criteria**:
- [ ] File contains valid markdown with h1, h2, h3 headings
- [ ] Includes numbered and bulleted lists
- [ ] Contains TypeScript code block for syntax highlighting test
- [ ] File size < 10KB (reasonable for testing)
- [ ] Includes all markdown features to be tested

**Implementation Notes**:
Use the mock content from data-model.md:
```markdown
# Feature Specification: Test Feature

**Branch**: test-branch-100
**Status**: Draft

## Summary
This is a test specification.

## Requirements
- REQ-1: Test requirement
- REQ-2: Another test requirement

## Code Example
\`\`\`typescript
const test = 'example';
console.log(test);
\`\`\`
```

**Testing**:
- Verify file is valid markdown
- Check file can be read by Node.js

---

### T004: E2E Test - Button visibility with completed specify job [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies "View Specification" button appears when ticket has branch and completed specify job. Test must fail initially (TDD).

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test creates ticket with branch and completed specify job
- [ ] Test opens ticket detail modal
- [ ] Test asserts "View Specification" button is visible
- [ ] Test uses [e2e] prefix for data isolation
- [ ] Test FAILS initially (button not implemented yet)

**Implementation Notes**:
```typescript
test('shows View Specification button when ticket has branch and completed specify job', async ({ page }) => {
  // Setup: Create ticket with branch + completed job
  const ticket = await createTicket(request, {
    title: '[e2e] Test Spec Button Visibility',
    branch: 'test-branch-spec',
    projectId: 1,
  });

  await createJob(request, {
    ticketId: ticket.id,
    command: 'specify',
    status: 'COMPLETED',
  });

  // Navigate and open ticket
  await page.goto('/projects/1/board');
  await page.click(`[data-ticket-id="${ticket.id}"]`);

  // Assert button visible
  await expect(page.getByRole('button', { name: 'View Specification' })).toBeVisible();
});
```

**Testing**:
- Run with `npx playwright test spec-viewer.spec.ts`
- Verify test FAILS (button not found)

---

### T005: E2E Test - Button hidden when no branch [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003
**Estimated Time**: 45m
**Parallel**: [P]

**Description**:
Write E2E test that verifies button is hidden when ticket has no branch. Test must fail initially.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test creates ticket with branch=null
- [ ] Test opens ticket detail modal
- [ ] Test asserts "View Specification" button is NOT visible
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('hides View Specification button when ticket has no branch', async ({ page }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] No Branch Ticket',
    branch: null,
    projectId: 1,
  });

  await page.goto('/projects/1/board');
  await page.click(`[data-ticket-id="${ticket.id}"]`);

  await expect(page.getByRole('button', { name: 'View Specification' })).not.toBeVisible();
});
```

**Testing**:
- Verify test FAILS initially
- Test should pass after T026-T027 implementation

---

### T006: E2E Test - Button hidden when no completed specify job [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003
**Estimated Time**: 45m
**Parallel**: [P]

**Description**:
Write E2E test that verifies button is hidden when ticket has branch but no completed specify job.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test creates ticket with branch
- [ ] Test creates job with status=PENDING (not COMPLETED)
- [ ] Test asserts button is NOT visible
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('hides button when job not completed', async ({ page }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Pending Job Ticket',
    branch: 'test-branch',
    projectId: 1,
  });

  await createJob(request, {
    ticketId: ticket.id,
    command: 'specify',
    status: 'PENDING', // Not COMPLETED
  });

  await page.goto('/projects/1/board');
  await page.click(`[data-ticket-id="${ticket.id}"]`);

  await expect(page.getByRole('button', { name: 'View Specification' })).not.toBeVisible();
});
```

**Testing**:
- Verify test FAILS initially

---

### T007: E2E Test - Button shown with multiple jobs including completed specify [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies button shows when ticket has multiple jobs including at least one completed specify job.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test creates ticket with branch
- [ ] Test creates multiple jobs (plan=PENDING, specify=COMPLETED, build=FAILED)
- [ ] Test asserts button IS visible
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('shows button when multiple jobs include completed specify', async ({ page }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Multiple Jobs Ticket',
    branch: 'test-branch-multi',
    projectId: 1,
  });

  await createJob(request, { ticketId: ticket.id, command: 'plan', status: 'PENDING' });
  await createJob(request, { ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });
  await createJob(request, { ticketId: ticket.id, command: 'build', status: 'FAILED' });

  await page.goto('/projects/1/board');
  await page.click(`[data-ticket-id="${ticket.id}"]`);

  await expect(page.getByRole('button', { name: 'View Specification' })).toBeVisible();
});
```

**Testing**:
- Verify test FAILS initially

---

### T008: E2E Test - Spec content displays when button clicked [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies clicking button opens modal and displays spec content.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test creates ticket with completed job
- [ ] Test clicks "View Specification" button
- [ ] Test waits for modal to appear
- [ ] Test asserts modal contains spec content
- [ ] Test FAILS initially (no API or modal yet)

**Implementation Notes**:
```typescript
test('displays spec content when button clicked', async ({ page }) => {
  const ticket = await createTicket(request, {
    title: '[e2e] Spec Content Test',
    branch: 'test-branch-content',
    projectId: 1,
  });

  await createJob(request, { ticketId: ticket.id, command: 'specify', status: 'COMPLETED' });

  await page.goto('/projects/1/board');
  await page.click(`[data-ticket-id="${ticket.id}"]`);
  await page.click('button:has-text("View Specification")');

  // Wait for spec viewer modal
  await expect(page.getByRole('dialog').filter({ hasText: 'Specification' })).toBeVisible();
  await expect(page.getByText('Test Mode Specification')).toBeVisible();
});
```

**Testing**:
- Verify test FAILS (no API endpoint yet)

---

### T009: E2E Test - Markdown headings render correctly [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003, T008
**Estimated Time**: 45m
**Parallel**: [P]

**Description**:
Write E2E test that verifies markdown headings (h1, h2, h3) render with proper styling.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test opens spec viewer modal
- [ ] Test asserts h1 heading exists
- [ ] Test asserts h2 headings exist
- [ ] Test verifies heading hierarchy
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('renders markdown headings correctly', async ({ page }) => {
  // Setup and open spec viewer (similar to T008)
  // ...

  // Assert headings
  await expect(page.locator('h1').filter({ hasText: 'Test Feature' })).toBeVisible();
  await expect(page.locator('h2').filter({ hasText: 'Summary' })).toBeVisible();
  await expect(page.locator('h2').filter({ hasText: 'Requirements' })).toBeVisible();
});
```

**Testing**:
- Verify test FAILS (markdown not rendered yet)

---

### T010: E2E Test - Code blocks with syntax highlighting [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T003, T008
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies code blocks render with syntax highlighting.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test opens spec viewer
- [ ] Test asserts code block exists
- [ ] Test verifies syntax highlighting applied (check for .hljs or similar classes)
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('renders code blocks with syntax highlighting', async ({ page }) => {
  // Setup and open spec viewer
  // ...

  // Assert code block
  const codeBlock = page.locator('pre code');
  await expect(codeBlock).toBeVisible();
  await expect(codeBlock).toContainText("const test = 'example';");

  // Verify syntax highlighting (react-syntax-highlighter adds classes)
  await expect(codeBlock).toHaveClass(/language-typescript/);
});
```

**Testing**:
- Verify test FAILS (no syntax highlighting yet)

---

### T011: E2E Test - Loading state shows while fetching [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T008
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies loading indicator appears while spec is being fetched.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test clicks "View Specification" button
- [ ] Test immediately checks for loading indicator
- [ ] Test waits for loading to complete
- [ ] Test verifies content appears after loading
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('shows loading state while fetching spec', async ({ page }) => {
  // Setup ticket
  // ...

  await page.click('button:has-text("View Specification")');

  // Check loading state (button disabled + spinner)
  await expect(page.locator('button:has-text("View Specification")')).toBeDisabled();

  // Wait for loading to complete and content to appear
  await expect(page.getByRole('dialog').filter({ hasText: 'Specification' })).toBeVisible();
});
```

**Testing**:
- Verify test FAILS (no loading state implemented)

---

### T012: E2E Test - Error handling for 404 [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T008
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies error message displays when spec file not found (404).

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test intercepts API call to return 404
- [ ] Test clicks button
- [ ] Test asserts error toast appears
- [ ] Test verifies error message text
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('displays error on 404', async ({ page }) => {
  // Intercept API call
  await page.route('**/api/projects/*/tickets/*/spec', (route) => {
    route.fulfill({
      status: 404,
      body: JSON.stringify({ error: 'Specification not available' }),
    });
  });

  // Setup and click button
  // ...

  // Assert error toast
  await expect(page.getByText('Specification not available')).toBeVisible();
});
```

**Testing**:
- Verify test FAILS (error handling not implemented)

---

### T013: E2E Test - Error handling for 403 Forbidden [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T008
**Estimated Time**: 45m
**Parallel**: [P]

**Description**:
Write E2E test that verifies error handling when ticket belongs to different project (403).

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test intercepts API to return 403
- [ ] Test verifies error toast appears
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('displays error on 403 Forbidden', async ({ page }) => {
  await page.route('**/api/projects/*/tickets/*/spec', (route) => {
    route.fulfill({
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    });
  });

  // Setup and trigger error
  // ...

  await expect(page.getByText('Forbidden')).toBeVisible();
});
```

**Testing**:
- Verify test FAILS initially

---

### T014: E2E Test - Modal closes with close button [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T008
**Estimated Time**: 30m
**Parallel**: [P]

**Description**:
Write E2E test that verifies modal closes when close button (X) is clicked.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test opens spec viewer modal
- [ ] Test clicks close button
- [ ] Test asserts modal is not visible
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('closes modal with close button', async ({ page }) => {
  // Open modal
  // ...

  await expect(page.getByRole('dialog')).toBeVisible();

  // Click close button
  await page.click('[aria-label="Close"]');

  // Assert modal closed
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

**Testing**:
- Verify test FAILS (modal not implemented)

---

### T015: E2E Test - Modal closes with ESC key [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T008
**Estimated Time**: 30m
**Parallel**: [P]

**Description**:
Write E2E test that verifies modal closes when ESC key is pressed.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test opens spec viewer modal
- [ ] Test presses ESC key
- [ ] Test asserts modal is not visible
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('closes modal with ESC key', async ({ page }) => {
  // Open modal
  // ...

  await expect(page.getByRole('dialog')).toBeVisible();

  // Press ESC
  await page.keyboard.press('Escape');

  // Assert modal closed
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

**Testing**:
- Verify test FAILS initially

---

### T016: E2E Test - Scrollable content for large specs [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T008
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies content is scrollable when it exceeds viewport height.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test uses large mock spec content
- [ ] Test opens spec viewer
- [ ] Test verifies scroll container exists
- [ ] Test performs scroll action
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('provides scrollable content for large specs', async ({ page }) => {
  // Intercept API to return large content
  await page.route('**/api/projects/*/tickets/*/spec', (route) => {
    const largeContent = '# Large Spec\n\n' + '## Section\n\n'.repeat(100);
    route.fulfill({
      status: 200,
      body: JSON.stringify({ content: largeContent, metadata: {} }),
    });
  });

  // Open modal and verify scroll
  // ...

  const scrollArea = page.locator('[data-radix-scroll-area-viewport]');
  await expect(scrollArea).toBeVisible();
});
```

**Testing**:
- Verify test FAILS (ScrollArea not implemented)

---

### T017: E2E Test - Responsive layout on mobile [MUST FAIL]

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T008
**Estimated Time**: 1h
**Parallel**: [P]

**Description**:
Write E2E test that verifies modal layout is responsive on mobile viewport.

**File**: `tests/e2e/spec-viewer.spec.ts`

**Acceptance Criteria**:
- [ ] Test sets mobile viewport (375x667)
- [ ] Test opens spec viewer
- [ ] Test verifies modal fits viewport
- [ ] Test verifies content is readable
- [ ] Test FAILS initially

**Implementation Notes**:
```typescript
test('displays correctly on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  // Open spec viewer
  // ...

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  // Verify modal fits viewport
  const modalBox = await modal.boundingBox();
  expect(modalBox.width).toBeLessThanOrEqual(375);
});
```

**Testing**:
- Verify test FAILS initially

---

## Category 3: Backend Implementation

### T018: Create GitHub API integration module with test mode detection

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T002, T004-T017 (tests written)
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Create module to fetch spec.md from GitHub using Octokit with test mode detection pattern from transition.ts.

**File**: `lib/github/spec-fetcher.ts`

**Acceptance Criteria**:
- [ ] Function `fetchSpecContent(params)` implemented
- [ ] Test mode detection checks GITHUB_TOKEN
- [ ] Test mode returns mock content
- [ ] Production mode uses Octokit to fetch from GitHub
- [ ] Base64 decoding implemented
- [ ] TypeScript types from contracts/types.ts used
- [ ] Error handling for GitHub API failures

**Implementation Notes**:
```typescript
import { Octokit } from '@octokit/rest';

interface FetchSpecParams {
  owner: string;
  repo: string;
  branch: string;
}

export async function fetchSpecContent(params: FetchSpecParams): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;
  const isTestMode = !githubToken ||
                     githubToken.includes('test') ||
                     githubToken.includes('placeholder');

  if (isTestMode) {
    return `# Test Mode Specification

This is mock content returned in test mode.

## Test Requirements
- Test requirement 1
- Test requirement 2

\`\`\`typescript
const test = 'example';
\`\`\``;
  }

  const octokit = new Octokit({ auth: githubToken });
  const response = await octokit.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: `specs/${params.branch}/spec.md`,
    ref: params.branch,
  });

  if ('content' in response.data) {
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  }

  throw new Error('Spec file not found');
}
```

**Testing**:
- Unit test with mocked Octokit
- Test mode returns mock content
- Production mode calls GitHub API

---

### T019: Create API route handler skeleton

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T018
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Create Next.js API route handler with basic structure and type definitions.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] GET handler function created
- [ ] NextRequest and NextResponse imported
- [ ] Context params typed correctly
- [ ] Basic try-catch error handling
- [ ] Returns 500 on unexpected errors
- [ ] Proper TypeScript strict mode compliance

**Implementation Notes**:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // TODO: Add validation and business logic

    return NextResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error fetching spec:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Testing**:
- curl request returns 501
- Type check passes

---

### T020: Implement project and ticket validation logic

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T019
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Add validation for projectId and ticketId with project-scoped access control following existing patterns.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] ProjectId validated with existing ProjectIdSchema
- [ ] TicketId validated (numeric check)
- [ ] Project existence verified
- [ ] Ticket existence verified with projectId filter
- [ ] Returns 400 for invalid IDs
- [ ] Returns 404 for not found
- [ ] Returns 403 for wrong project
- [ ] Uses getProjectById helper
- [ ] Uses prisma.ticket.findFirst with projectId filter

**Implementation Notes**:
```typescript
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';

// In GET handler:
const projectIdResult = ProjectIdSchema.safeParse(projectIdString);
if (!projectIdResult.success) {
  return NextResponse.json(
    { error: 'Invalid project ID', code: 'VALIDATION_ERROR' },
    { status: 400 }
  );
}

const projectId = parseInt(projectIdString, 10);
const ticketId = parseInt(ticketIdString, 10);

if (isNaN(ticketId)) {
  return NextResponse.json(
    { error: 'Invalid ticket ID' },
    { status: 400 }
  );
}

const project = await getProjectById(projectId);
if (!project) {
  return NextResponse.json(
    { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
    { status: 404 }
  );
}

const ticket = await prisma.ticket.findFirst({
  where: { id: ticketId, projectId: projectId },
  include: {
    jobs: {
      where: { command: 'specify', status: 'COMPLETED' },
      take: 1,
    },
    project: true,
  },
});

if (!ticket) {
  const ticketExists = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (ticketExists) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
}
```

**Testing**:
- E2E tests T012-T013 should start passing
- Invalid IDs return 400
- Wrong project returns 403

---

### T021: Implement job status checking logic

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T020
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Add business logic to check if ticket has branch and completed specify job.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] Branch existence checked
- [ ] Completed specify job checked
- [ ] Returns 404 if branch is null
- [ ] Returns 404 if no completed specify job
- [ ] Uses jobs included in ticket query from T020

**Implementation Notes**:
```typescript
// After ticket query from T020:

if (!ticket.branch) {
  return NextResponse.json(
    { error: 'Specification not available', code: 'SPEC_NOT_AVAILABLE' },
    { status: 404 }
  );
}

const hasCompletedSpecifyJob = ticket.jobs.length > 0;

if (!hasCompletedSpecifyJob) {
  return NextResponse.json(
    { error: 'Specification not available', code: 'SPEC_NOT_AVAILABLE' },
    { status: 404 }
  );
}
```

**Testing**:
- E2E tests T005-T006 should start passing
- Tickets without branch/job return 404

---

### T022: Integrate GitHub API call with test mode

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T018, T021
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Call fetchSpecContent from GitHub module and handle the response.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] Imports fetchSpecContent from lib/github/spec-fetcher
- [ ] Calls fetchSpecContent with correct params
- [ ] Handles successful response
- [ ] Catches and handles errors
- [ ] Returns 404 if file not found
- [ ] Returns 500 on GitHub API errors
- [ ] Test mode works (uses mock data)

**Implementation Notes**:
```typescript
import { fetchSpecContent } from '@/lib/github/spec-fetcher';

// After job validation:

try {
  const content = await fetchSpecContent({
    owner: ticket.project.githubOwner,
    repo: ticket.project.githubRepo,
    branch: ticket.branch,
  });

  return NextResponse.json({
    content,
    metadata: {
      ticketId: ticket.id,
      branch: ticket.branch,
      projectId: ticket.projectId,
      fileName: 'spec.md',
      filePath: `specs/${ticket.branch}/spec.md`,
    },
  });
} catch (error) {
  console.error('GitHub API error:', error);
  return NextResponse.json(
    { error: 'Specification file not found', code: 'FILE_NOT_FOUND' },
    { status: 404 }
  );
}
```

**Testing**:
- E2E test T008 should start passing
- Test mode returns mock content

---

### T023: Add comprehensive error handling and logging

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T022
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Add detailed error logging and proper error messages for all failure scenarios.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] All error paths have console.error logging
- [ ] Logs include context (projectId, ticketId, error details)
- [ ] Error messages are user-friendly
- [ ] Error codes match API contract
- [ ] No sensitive data in logs

**Implementation Notes**:
```typescript
try {
  // existing code
} catch (error) {
  console.error('Error fetching specification:', {
    projectId,
    ticketId,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof Error && error.message.includes('rate limit')) {
    return NextResponse.json(
      { error: 'GitHub API rate limit exceeded', code: 'RATE_LIMIT' },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { error: 'Failed to fetch specification', code: 'GITHUB_API_ERROR' },
    { status: 500 }
  );
}
```

**Testing**:
- Check logs for all error scenarios
- Verify no sensitive data logged

---

### T024: Add JSDoc comments and TypeScript documentation

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T023
**Estimated Time**: 30m
**Parallel**: [P]

**Description**:
Add comprehensive JSDoc comments to API route for maintainability.

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Acceptance Criteria**:
- [ ] Function has JSDoc with description
- [ ] Parameters documented
- [ ] Return types documented
- [ ] Error scenarios documented
- [ ] Example responses included

**Implementation Notes**:
```typescript
/**
 * GET /api/projects/[projectId]/tickets/[id]/spec
 *
 * Retrieves the spec.md file for a ticket from GitHub.
 *
 * @param request - Next.js request object
 * @param context - Route context with projectId and ticket id params
 *
 * @returns JSON response with spec content and metadata
 *
 * @throws 400 - Invalid project or ticket ID
 * @throws 403 - Ticket belongs to different project
 * @throws 404 - Project, ticket, or spec file not found
 * @throws 500 - GitHub API error or internal server error
 *
 * @example
 * GET /api/projects/1/tickets/123/spec
 * Response: { content: "# Spec...", metadata: {...} }
 */
export async function GET(...) {
  // implementation
}
```

**Testing**:
- TypeScript recognizes JSDoc
- IDE shows documentation on hover

---

### T025: Write unit tests for GitHub fetcher module

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T018
**Estimated Time**: 2h
**Parallel**: [P]

**Description**:
Write unit tests for the GitHub API integration module.

**File**: `tests/unit/github-spec-fetcher.test.ts`

**Acceptance Criteria**:
- [ ] Test suite created with describe block
- [ ] Test for test mode returning mock content
- [ ] Test for successful GitHub API call
- [ ] Test for error handling (404, rate limit, etc.)
- [ ] Mock Octokit responses
- [ ] All edge cases covered

**Implementation Notes**:
```typescript
import { fetchSpecContent } from '@/lib/github/spec-fetcher';

describe('fetchSpecContent', () => {
  it('returns mock content in test mode', async () => {
    process.env.GITHUB_TOKEN = 'test';
    const content = await fetchSpecContent({
      owner: 'test',
      repo: 'test',
      branch: 'test-branch',
    });
    expect(content).toContain('Test Mode Specification');
  });

  it('fetches from GitHub in production mode', async () => {
    // Mock Octokit
    // ...
  });

  it('handles file not found error', async () => {
    // Test 404 handling
  });
});
```

**Testing**:
- Run with `npm test`
- All tests pass

---

## Category 4: Frontend Implementation

### T026: Create SpecViewer component shell with shadcn/ui Dialog

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T001, T004-T017 (tests written)
**Estimated Time**: 1.5h
**Parallel**: [Sequential]

**Description**:
Create SpecViewer component using shadcn/ui Dialog primitive with proper structure.

**File**: `components/board/spec-viewer.tsx`

**Acceptance Criteria**:
- [ ] "use client" directive at top
- [ ] Component exports default function
- [ ] Uses Dialog, DialogContent, DialogHeader from shadcn/ui
- [ ] Accepts ticketId, projectId, ticketTitle props
- [ ] Has open/close state management
- [ ] Exports interface for props

**Implementation Notes**:
```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SpecViewerProps {
  ticketId: number;
  projectId: number;
  ticketTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SpecViewer({
  ticketId,
  projectId,
  ticketTitle,
  open,
  onOpenChange,
}: SpecViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Specification - Ticket #{ticketId}: {ticketTitle}
          </DialogTitle>
        </DialogHeader>
        <div>
          {/* Content will be added in next tasks */}
          TODO: Spec content here
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Testing**:
- Component renders without errors
- Dialog opens/closes correctly

---

### T027: Add button to TicketDetailModal with visibility logic

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T026
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Modify TicketDetailModal to add "View Specification" button with visibility logic based on ticket state.

**File**: `components/board/ticket-detail-modal.tsx`

**Acceptance Criteria**:
- [ ] Query jobs for ticket with command='specify' and status='COMPLETED'
- [ ] Button only shows when ticket.branch exists AND has completed job
- [ ] Button styled consistently (blue background)
- [ ] Button placed after description, before dates
- [ ] useMemo for performance optimization
- [ ] State for SpecViewer modal (open/closed)

**Implementation Notes**:
```typescript
// Add at top of component
const [specViewerOpen, setSpecViewerOpen] = useState(false);

// Query jobs
const { data: jobs } = useQuery({
  queryKey: ['ticket-jobs', ticket.id],
  queryFn: () => fetch(`/api/tickets/${ticket.id}/jobs`).then(r => r.json()),
});

// Visibility logic
const hasCompletedSpecifyJob = useMemo(() => {
  if (!ticket.branch || !jobs) return false;
  return jobs.some(
    (job: Job) => job.command === 'specify' && job.status === 'COMPLETED'
  );
}, [ticket.branch, jobs]);

// In JSX, after description:
{hasCompletedSpecifyJob && (
  <div className="border-t-2 border-zinc-700/50 pt-6">
    <Button
      onClick={() => setSpecViewerOpen(true)}
      className="w-full bg-blue-600 hover:bg-blue-700"
    >
      View Specification
    </Button>
  </div>
)}

{/* Add SpecViewer modal */}
<SpecViewer
  ticketId={ticket.id}
  projectId={ticket.projectId}
  ticketTitle={ticket.title}
  open={specViewerOpen}
  onOpenChange={setSpecViewerOpen}
/>
```

**Testing**:
- E2E tests T004-T007 should pass
- Button shows/hides correctly

---

### T028: Implement API fetch logic with loading and error states

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T026
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Add logic to fetch spec content from API when SpecViewer opens, with loading and error state management.

**File**: `components/board/spec-viewer.tsx`

**Acceptance Criteria**:
- [ ] useState for isLoading, error, content
- [ ] useEffect to fetch when modal opens
- [ ] Fetch calls GET /api/projects/:projectId/tickets/:id/spec
- [ ] Loading indicator displays while fetching
- [ ] Error toast on failure
- [ ] Content updates on success
- [ ] Cleanup on unmount

**Implementation Notes**:
```typescript
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// In component:
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [content, setContent] = useState<string | null>(null);
const { toast } = useToast();

useEffect(() => {
  if (!open) return;

  const fetchSpec = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/spec`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch specification');
      }

      const data = await res.json();
      setContent(data.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  fetchSpec();
}, [open, projectId, ticketId]);

// In JSX:
{isLoading && <div>Loading...</div>}
{error && <div>Error: {error}</div>}
{content && <div>{/* Markdown render here */}</div>}
```

**Testing**:
- E2E test T011 should pass
- Loading state shows
- Errors display toast

---

### T029: Add markdown rendering with react-markdown

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T028
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Integrate react-markdown to render spec content with proper styling for dark theme.

**File**: `components/board/spec-viewer.tsx`

**Acceptance Criteria**:
- [ ] Import ReactMarkdown
- [ ] Render content with ReactMarkdown component
- [ ] Apply dark theme classes
- [ ] Style headings, lists, links properly
- [ ] Use Tailwind classes for spacing
- [ ] Ensure text is readable

**Implementation Notes**:
```typescript
import ReactMarkdown from 'react-markdown';

// In JSX, replace content div:
{content && (
  <div className="prose prose-invert max-w-none">
    <ReactMarkdown
      className="text-zinc-100"
      components={{
        h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-4" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-2xl font-semibold mb-3 mt-6" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mb-2 mt-4" {...props} />,
        p: ({ node, ...props }) => <p className="mb-4" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc ml-6 mb-4" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal ml-6 mb-4" {...props} />,
        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
)}
```

**Testing**:
- E2E test T009 should pass
- Headings render correctly
- Dark theme applied

---

### T030: Add syntax highlighting with react-syntax-highlighter

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T029
**Estimated Time**: 1.5h
**Parallel**: [Sequential]

**Description**:
Add syntax highlighting to code blocks using react-syntax-highlighter.

**File**: `components/board/spec-viewer.tsx`

**Acceptance Criteria**:
- [ ] Import Prism from react-syntax-highlighter
- [ ] Import dark theme (vscDarkPlus or similar)
- [ ] Configure ReactMarkdown code component
- [ ] Apply syntax highlighting
- [ ] Style code blocks for dark theme
- [ ] Handle inline code differently from blocks

**Implementation Notes**:
```typescript
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Add to ReactMarkdown components:
components={{
  // ... existing components
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        className="rounded-md my-4"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className="bg-zinc-800 px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    );
  },
}}
```

**Testing**:
- E2E test T010 should pass
- Code blocks have syntax highlighting
- Inline code styled differently

---

### T031: Add ScrollArea and polish responsive design

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T030
**Estimated Time**: 1.5h
**Parallel**: [Sequential]

**Description**:
Wrap content in ScrollArea component and ensure responsive design for mobile.

**File**: `components/board/spec-viewer.tsx`

**Acceptance Criteria**:
- [ ] Import ScrollArea from shadcn/ui
- [ ] Wrap markdown content in ScrollArea
- [ ] Set max height (e.g., max-h-[60vh])
- [ ] Test on mobile viewport (375px)
- [ ] Ensure modal is responsive
- [ ] Add proper padding and spacing

**Implementation Notes**:
```typescript
import { ScrollArea } from '@/components/ui/scroll-area';

// Wrap markdown content:
<ScrollArea className="h-[60vh] w-full rounded-md pr-4">
  <div className="prose prose-invert max-w-none">
    <ReactMarkdown ...>
      {content}
    </ReactMarkdown>
  </div>
</ScrollArea>
```

**Testing**:
- E2E tests T016-T017 should pass
- Content scrollable
- Mobile viewport works

---

## Category 5: Integration & Validation

### T032: Run all E2E tests and verify they pass

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T018-T031
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Run complete E2E test suite and verify all tests pass.

**Acceptance Criteria**:
- [ ] All 15 E2E tests pass (T004-T017 plus T014-T015)
- [ ] No test failures
- [ ] No console errors during tests
- [ ] Test mode works correctly
- [ ] All assertions pass

**Implementation Notes**:
```bash
npm run test:e2e -- spec-viewer.spec.ts
```

**Testing**:
- Green test suite
- Review test output for any warnings

---

### T033: Performance testing and optimization

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T032
**Estimated Time**: 2h
**Parallel**: [Sequential]

**Description**:
Measure performance metrics and optimize if needed.

**Acceptance Criteria**:
- [ ] API response time <200ms (test mode <50ms)
- [ ] Markdown render time <100ms
- [ ] Modal open Time to Interactive <200ms
- [ ] Bundle size analyzed
- [ ] Lazy loading implemented if needed
- [ ] Performance metrics documented

**Implementation Notes**:
- Use Next.js dynamic import for SpecViewer if bundle is large
- Measure with Chrome DevTools Performance tab
- Test with large specs (>100KB)

**Testing**:
- Performance metrics meet targets
- No performance regressions

---

### T034: Accessibility testing with keyboard navigation

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T032
**Estimated Time**: 1.5h
**Parallel**: [P]

**Description**:
Test and verify keyboard navigation and screen reader accessibility.

**Acceptance Criteria**:
- [ ] Tab key navigates correctly
- [ ] ESC key closes modal
- [ ] Button has proper aria-label
- [ ] Modal has proper role and aria attributes
- [ ] Focus management works correctly
- [ ] Screen reader announces content properly

**Implementation Notes**:
- Use axe DevTools for automated testing
- Manual test with keyboard only
- Test with screen reader (NVDA/VoiceOver)

**Testing**:
- No accessibility violations
- Keyboard navigation smooth

---

### T035: Cross-browser and mobile testing

**Status**: ⏳ Not Started
**Complexity**: Medium
**Dependencies**: T032
**Estimated Time**: 2h
**Parallel**: [P]

**Description**:
Test feature across different browsers and mobile devices.

**Acceptance Criteria**:
- [ ] Works in Chrome (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome
- [ ] Responsive on mobile (375px, 768px, 1024px)

**Implementation Notes**:
- Use Playwright for Chrome/Firefox/Safari
- Test on real devices if available
- Use BrowserStack for comprehensive testing

**Testing**:
- Feature works consistently across browsers
- Mobile experience is good

---

### T036: Code review and documentation updates

**Status**: ⏳ Not Started
**Complexity**: Simple
**Dependencies**: T032-T035
**Estimated Time**: 1h
**Parallel**: [Sequential]

**Description**:
Final code review, update documentation, and prepare for merge.

**Acceptance Criteria**:
- [ ] Code follows TypeScript strict mode
- [ ] All console.logs removed
- [ ] No commented-out code
- [ ] README updated (if needed)
- [ ] API documentation complete
- [ ] Constitution compliance verified
- [ ] All tests passing

**Implementation Notes**:
- Review against constitution checklist
- Update CLAUDE.md if needed
- Review PR checklist

**Testing**:
- Final npm run build succeeds
- npm run lint passes
- npm test passes

---

## Summary

**Total Tasks**: 36
- Setup: 2 tasks
- Test Fixtures & E2E Tests: 15 tasks (TDD - written first)
- Backend: 8 tasks
- Frontend: 6 tasks
- Integration & Validation: 5 tasks

**Estimated Time**: 32-38 hours

**Key Milestones**:
1. ✅ T002 - Directory structure ready
2. ✅ T017 - All E2E tests written (failing)
3. ✅ T025 - Backend API complete
4. ✅ T031 - Frontend components complete
5. ✅ T036 - Feature ready for merge

**Parallel Execution Opportunities**:
- T001-T002 can run in parallel (setup)
- T003-T017 can be written in parallel (tests)
- T024-T025 can run in parallel (documentation + unit tests)
- T034-T035 can run in parallel (accessibility + cross-browser)

**Next Steps**:
Execute tasks in order, marking each as complete before moving to next. Run `npx playwright test` after T031 to verify all tests pass.
