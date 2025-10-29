# Quickstart: Project Card Redesign

**Feature**: Display last shipped ticket instead of project description
**Estimated Time**: 2-3 hours for TDD implementation
**Complexity**: Low-Medium (UI changes + query optimization)

---

## Prerequisites

✅ TypeScript 5.6 strict mode enabled
✅ Next.js 15 App Router configured
✅ Prisma 6.x connected to PostgreSQL
✅ shadcn/ui components installed
✅ Vitest + Playwright test suites functional

**Verify setup**:
```bash
bun run type-check     # TypeScript compiles without errors
bun run test:unit      # Vitest tests pass
bun run test:e2e       # Playwright tests pass
```

---

## Development Workflow

### Phase 1: Database Migration (15 min)

1. **Update Prisma schema**:
   ```bash
   # Edit prisma/schema.prisma
   # Add to Project model:
   deploymentUrl    String?     @db.VarChar(500)
   ```

2. **Create migration**:
   ```bash
   npx prisma migrate dev --name add_deployment_url
   npx prisma generate
   ```

3. **Verify migration**:
   ```bash
   # Check migration file created in prisma/migrations/
   # Verify deploymentUrl field exists in database
   npx prisma studio  # Visual verification
   ```

---

### Phase 2: Unit Tests (30 min)

**TDD Requirement**: Write tests BEFORE implementation.

#### Test 1: Relative Time Formatting (Existing Utility)

**File**: `tests/unit/format-timestamp.test.ts` (already exists)

No new tests needed - existing `formatTimestamp()` utility already has 21 tests covering:
- Recent timestamps (< 1 min, 1-59 min, 1-23 hours)
- Historical timestamps (≥ 24 hours)
- Edge cases (null, invalid inputs)

**Verify**:
```bash
bun run test:unit tests/unit/format-timestamp.test.ts
# Expected: 21 passing tests
```

#### Test 2: Clipboard Copy Hook (NEW)

**File**: `tests/unit/useCopyToClipboard.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '@/app/lib/hooks/useCopyToClipboard';

describe('useCopyToClipboard', () => {
  it('copies text to clipboard', async () => {
    const writeTextMock = vi.fn();
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('https://example.com');
    });

    expect(writeTextMock).toHaveBeenCalledWith('https://example.com');
    expect(result.current.isCopied).toBe(true);
  });

  it('resets isCopied after 2 seconds', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('test');
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCopied).toBe(false);
    vi.useRealTimers();
  });
});
```

**Run**:
```bash
bun run test:unit tests/unit/useCopyToClipboard.test.ts
# Expected: RED (tests fail - hook not implemented yet)
```

---

### Phase 3: Integration Tests (45 min)

**TDD Requirement**: Write Playwright tests BEFORE component changes.

#### Test 1: Project Card Display

**File**: `tests/e2e/project-card.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { createTestProject } from '../helpers/db-setup';

test.describe('Project Card - Shipped Ticket Display', () => {
  test('displays last shipped ticket with relative time', async ({ page }) => {
    // Setup: Create project with shipped ticket
    const project = await createTestProject({
      name: '[e2e] Test Project',
      tickets: [{
        title: '[e2e] Shipped Feature',
        stage: 'SHIP',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      }],
    });

    await page.goto('/projects');

    const card = page.getByTestId(`project-card-${project.id}`);

    // Verify shipped ticket displayed
    await expect(card.getByTestId('shipped-ticket-title')).toContainText('Shipped Feature');
    await expect(card.getByTestId('shipped-ticket-time')).toContainText('2 hours ago');
    await expect(card.getByTestId('ticket-count')).toContainText('1 total');
  });

  test('displays "No tickets shipped yet" when no SHIP stage tickets', async ({ page }) => {
    const project = await createTestProject({
      name: '[e2e] No Ships',
      tickets: [{ title: '[e2e] In Build', stage: 'BUILD' }],
    });

    await page.goto('/projects');

    const card = page.getByTestId(`project-card-${project.id}`);
    await expect(card).toContainText('No tickets shipped yet · 1 total');
  });

  test('displays deployment URL with copy button', async ({ page }) => {
    const project = await createTestProject({
      name: '[e2e] With Deployment',
      deploymentUrl: 'https://example.vercel.app',
    });

    await page.goto('/projects');

    const card = page.getByTestId(`project-card-${project.id}`);

    // Verify deployment URL displayed
    const deployUrl = card.getByTestId('deployment-url');
    await expect(deployUrl).toHaveText('example.vercel.app');

    // Click copy button
    const copyButton = card.getByTestId('copy-deployment-url');
    await copyButton.click();

    // Verify clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toBe('https://example.vercel.app');

    // Verify visual feedback (icon change)
    await expect(copyButton.getByTestId('check-icon')).toBeVisible();
  });

  test('hides deployment URL when not configured', async ({ page }) => {
    const project = await createTestProject({
      name: '[e2e] No Deployment',
      deploymentUrl: null,
    });

    await page.goto('/projects');

    const card = page.getByTestId(`project-card-${project.id}`);
    await expect(card.getByTestId('deployment-url')).not.toBeVisible();
  });

  test('displays GitHub link', async ({ page }) => {
    const project = await createTestProject({
      name: '[e2e] GitHub Test',
      githubOwner: 'test-owner',
      githubRepo: 'test-repo',
    });

    await page.goto('/projects');

    const card = page.getByTestId(`project-card-${project.id}`);
    const githubLink = card.getByTestId('github-link');

    await expect(githubLink).toHaveText('test-owner/test-repo');
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/test-owner/test-repo');
    await expect(githubLink).toHaveAttribute('target', '_blank');
  });
});
```

**Run**:
```bash
bun run test:e2e tests/e2e/project-card.spec.ts
# Expected: RED (tests fail - UI not implemented yet)
```

#### Test 2: API Contract Tests

**File**: `tests/api/projects.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('GET /api/projects - Shipped Ticket Data', () => {
  test('returns last shipped ticket', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();

    const projects = await response.json();
    const projectWithShipped = projects.find(p => p.lastShippedTicket !== null);

    expect(projectWithShipped).toBeDefined();
    expect(projectWithShipped.lastShippedTicket).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO 8601
    });
  });

  test('includes deploymentUrl field', async ({ request }) => {
    const response = await request.get('/api/projects');
    const projects = await response.json();

    expect(projects[0]).toHaveProperty('deploymentUrl');
    expect(projects[0].deploymentUrl).toMatch(/^https?:\/\/|null/);
  });
});
```

**Run**:
```bash
bun run test:e2e tests/api/projects.spec.ts
# Expected: RED (API not updated yet)
```

---

### Phase 4: Implementation (60 min)

**TDD Workflow**: Make tests GREEN.

#### Step 1: Update TypeScript Types

**File**: `app/lib/types/project.ts`

```typescript
export interface ProjectWithCount {
  id: number;
  name: string;
  description: string;
  githubOwner: string;
  githubRepo: string;
  deploymentUrl: string | null;
  updatedAt: string;
  ticketCount: number;
  lastShippedTicket: {
    id: number;
    title: string;
    updatedAt: string;
  } | null;
}
```

#### Step 2: Update Database Query

**File**: `lib/db/projects.ts`

```typescript
export async function getUserProjects() {
  const userId = await requireAuth();

  return prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } }
      ]
    },
    include: {
      _count: { select: { tickets: true } },
      tickets: {
        where: { stage: 'SHIP' },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: { id: true, title: true, updatedAt: true }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
}
```

#### Step 3: Update API Route

**File**: `app/api/projects/route.ts`

```typescript
export async function GET() {
  try {
    const projects = await getUserProjects();

    const response: ProjectsListResponse = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      githubOwner: project.githubOwner,
      githubRepo: project.githubRepo,
      deploymentUrl: project.deploymentUrl,
      updatedAt: project.updatedAt.toISOString(),
      ticketCount: project._count.tickets,
      lastShippedTicket: project.tickets[0] ? {
        id: project.tickets[0].id,
        title: project.tickets[0].title,
        updatedAt: project.tickets[0].updatedAt.toISOString(),
      } : null,
    }));

    return NextResponse.json(response);
  } catch (error) {
    // ... existing error handling
  }
}
```

#### Step 4: Implement Clipboard Hook

**File**: `app/lib/hooks/useCopyToClipboard.ts`

```typescript
'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useCopyToClipboard() {
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      toast({
        title: 'Copied to clipboard',
        description: text,
      });

      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy',
        variant: 'destructive',
      });
    }
  };

  return { copy, isCopied };
}
```

#### Step 5: Update Project Card Component

**File**: `components/projects/project-card.tsx`

```typescript
'use client';

import { formatTimestamp } from '@/lib/utils/format-timestamp';
import { useCopyToClipboard } from '@/app/lib/hooks/useCopyToClipboard';
import { Check, Copy, CheckCircle, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { copy, isCopied } = useCopyToClipboard();

  const handleClick = () => {
    router.push(`/projects/${project.id}/board`);
  };

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    copy(project.deploymentUrl!);
  };

  const handleGitHubClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
  };

  return (
    <Card onClick={handleClick} data-testid="project-card">
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>

        {/* Deployment URL */}
        {project.deploymentUrl && (
          <div className="flex items-center gap-2">
            <a href={project.deploymentUrl} target="_blank" rel="noopener">
              {new URL(project.deploymentUrl).hostname}
            </a>
            <Button size="icon" variant="ghost" onClick={handleCopyUrl}>
              {isCopied ? <Check /> : <Copy />}
            </Button>
          </div>
        )}

        {/* GitHub Link */}
        <a
          href={`https://github.com/${project.githubOwner}/${project.githubRepo}`}
          target="_blank"
          rel="noopener"
          onClick={handleGitHubClick}
          className="flex items-center gap-2"
        >
          <Github className="h-4 w-4" />
          {project.githubOwner}/{project.githubRepo}
        </a>
      </CardHeader>

      <CardContent>
        {/* Shipped Ticket Status */}
        {project.lastShippedTicket ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="truncate">{project.lastShippedTicket.title}</span>
            <span className="text-sm text-muted-foreground">
              · Shipped {formatTimestamp(project.lastShippedTicket.updatedAt)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {project.ticketCount === 0
              ? 'No tickets yet'
              : `No tickets shipped yet · ${project.ticketCount} total`}
          </span>
        )}

        {/* Total Count */}
        {project.lastShippedTicket && (
          <span className="text-sm text-muted-foreground">
            · {project.ticketCount} total
          </span>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Phase 5: Verification (30 min)

#### Run All Tests

```bash
# Unit tests
bun run test:unit
# Expected: All tests GREEN (including new clipboard tests)

# E2E tests
bun run test:e2e tests/e2e/project-card.spec.ts
# Expected: All tests GREEN

# API tests
bun run test:e2e tests/api/projects.spec.ts
# Expected: All tests GREEN

# Full test suite
bun test
# Expected: All tests GREEN
```

#### Manual Testing

1. **Start dev server**:
   ```bash
   bun run dev
   ```

2. **Test scenarios**:
   - ✅ View projects page at http://localhost:3000/projects
   - ✅ Verify shipped ticket displayed with relative time
   - ✅ Click copy button for deployment URL
   - ✅ Verify toast notification appears
   - ✅ Click GitHub link (opens in new tab)
   - ✅ Verify card click still navigates to board
   - ✅ Test with project with no shipped tickets
   - ✅ Test with project with no deployment URL

#### Performance Check

```bash
# Monitor API response time
curl -w "@curl-format.txt" http://localhost:3000/api/projects

# Expected: < 100ms response time
```

---

## Rollback Plan

If issues arise during implementation:

1. **Revert database migration**:
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

2. **Revert code changes**:
   ```bash
   git checkout main -- components/projects/project-card.tsx
   git checkout main -- app/api/projects/route.ts
   git checkout main -- lib/db/projects.ts
   ```

3. **Clean up test files**:
   ```bash
   git checkout main -- tests/
   ```

---

## Success Criteria

✅ All unit tests pass (Vitest)
✅ All integration tests pass (Playwright)
✅ API returns last shipped ticket data
✅ Project cards display shipped ticket status
✅ Deployment URL copy functionality works
✅ GitHub links open in new tab
✅ Card click navigation preserved
✅ No layout breaking with long text
✅ Performance <100ms for GET /api/projects

**Estimated Total Time**: 2-3 hours with TDD workflow

---

## Next Steps

After successful implementation:

1. Deploy to staging environment
2. Run smoke tests on staging
3. Monitor performance metrics
4. Create pull request with test evidence
5. Request code review
6. Merge to main branch
7. Deploy to production

**Documentation**: Update CLAUDE.md if new patterns introduced (clipboard hook, etc.)
