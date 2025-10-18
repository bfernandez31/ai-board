# Quickstart Guide: View Plan and Tasks Documentation

**Feature**: 035-view-plan-and
**Date**: 2025-10-18
**Purpose**: Developer guide for implementing the documentation viewing feature

## Overview

This guide provides a step-by-step implementation path for adding "View Plan" and "View Tasks" buttons to the ticket detail modal. Follow phases in order for test-driven development approach.

## Prerequisites

- Node.js 22.20.0 LTS installed
- PostgreSQL 14+ running locally
- GitHub Personal Access Token (GITHUB_TOKEN) configured
- Existing project with tickets in database
- Familiarity with Next.js 15 App Router and Prisma

## Implementation Phases

### Phase 1: Backend Infrastructure (API + GitHub Integration)

**Goal**: Create generic documentation fetcher and new API endpoints

**Duration**: ~2 hours

#### Step 1.1: Create Generic Document Fetcher

**File**: `lib/github/doc-fetcher.ts`

```typescript
import { Octokit } from '@octokit/rest';
import { DocumentType, DocumentTypeFiles } from '@/specs/035-view-plan-and/contracts/types';

export interface DocumentFetchParams {
  owner: string;
  repo: string;
  branch: string;
  docType: DocumentType;
}

export async function fetchDocumentContent(params: DocumentFetchParams): Promise<string> {
  const githubToken = process.env.GITHUB_TOKEN;
  const isTestEnvironment = process.env.TEST_MODE === 'true';

  if (isTestEnvironment) {
    return `# Test Mode ${params.docType}\n\nThis is mock content for ${params.docType}.md`;
  }

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const octokit = new Octokit({ auth: githubToken });
  const fileName = DocumentTypeFiles[params.docType];

  const response = await octokit.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: `specs/${params.branch}/${fileName}`,
    ref: params.branch,
  });

  if ('content' in response.data && response.data.content) {
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  }

  throw new Error(`${fileName} not found - response does not contain content`);
}
```

**Test**: Create `tests/unit/doc-fetcher.test.ts` to verify test mode and error handling

---

#### Step 1.2: Create Plan API Endpoint

**File**: `app/api/projects/[projectId]/tickets/[id]/plan/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ProjectIdSchema } from '@/lib/validations/ticket';
import { getProjectById } from '@/lib/db/projects';
import { prisma } from '@/lib/db/client';
import { fetchDocumentContent } from '@/lib/github/doc-fetcher';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; id: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { projectId: projectIdString, id: ticketIdString } = params;

    // Validate projectId
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
        { error: 'Invalid ticket ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Query ticket with jobs
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, projectId: projectId },
      include: {
        jobs: {
          where: { command: 'plan', status: 'COMPLETED' },
          take: 1,
        },
        project: true,
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found', code: 'TICKET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!ticket.branch) {
      return NextResponse.json(
        { error: 'Plan not available', code: 'BRANCH_NOT_ASSIGNED' },
        { status: 404 }
      );
    }

    // Determine branch (SHIP → main, else → feature branch)
    const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

    // Fetch plan content from GitHub
    const content = await fetchDocumentContent({
      owner: ticket.project.githubOwner,
      repo: ticket.project.githubRepo,
      branch: branch,
      docType: 'plan',
    });

    return NextResponse.json({
      content,
      metadata: {
        ticketId: ticket.id,
        branch: branch,
        projectId: ticket.projectId,
        docType: 'plan',
        fileName: 'plan.md',
        filePath: `specs/${ticket.branch}/plan.md`,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
```

**Test**: Create `tests/api/plan-endpoint.spec.ts` with contract tests

---

#### Step 1.3: Create Tasks API Endpoint

**File**: `app/api/projects/[projectId]/tickets/[id]/tasks/route.ts`

Copy `plan/route.ts` and change:
- `docType: 'plan'` → `docType: 'tasks'`
- `'plan.md'` → `'tasks.md'`
- Job filter: `command: 'plan'` → keep as 'plan' (tasks.md created by plan job)

**Test**: Create `tests/api/tasks-endpoint.spec.ts`

---

#### Step 1.4: Update Spec Endpoint for Branch Logic

**File**: `app/api/projects/[projectId]/tickets/[id]/spec/route.ts`

**Change** (around line 150):
```typescript
// OLD:
const content = await fetchSpecContent({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  branch: ticket.branch,
});

// NEW:
const branch = ticket.stage === 'SHIP' ? 'main' : ticket.branch;

const content = await fetchDocumentContent({
  owner: ticket.project.githubOwner,
  repo: ticket.project.githubRepo,
  branch: branch,
  docType: 'spec',
});
```

**Test**: Update `tests/e2e/spec-viewer.spec.ts` to test shipped ticket behavior

---

### Phase 2: Frontend Components (UI + State Management)

**Goal**: Create DocumentationViewer component and add buttons to TicketDetailModal

**Duration**: ~2 hours

#### Step 2.1: Create TanStack Query Hook

**File**: `lib/hooks/use-documentation.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { documentationKeys, DocumentType, DocumentContent } from '@/specs/035-view-plan-and/contracts/types';

export function useDocumentation(
  projectId: number,
  ticketId: number,
  docType: DocumentType,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: documentationKeys.document(projectId, ticketId, docType),
    queryFn: async (): Promise<DocumentContent> => {
      const res = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/${docType}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch documentation');
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled, // Only fetch when modal is open
  });
}
```

---

#### Step 2.2: Create DocumentationViewer Component

**File**: `components/board/documentation-viewer.tsx`

Copy `components/board/spec-viewer.tsx` and modify:

1. Update props interface:
```typescript
interface DocumentationViewerProps {
  ticketId: number;
  projectId: number;
  ticketTitle: string;
  docType: DocumentType; // NEW: specify which doc to show
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

2. Update modal title:
```typescript
<DialogTitle className="text-zinc-50">
  {DocumentTypeLabels[docType]} - Ticket #{ticketId}: {ticketTitle}
</DialogTitle>
```

3. Use `useDocumentation` hook instead of direct fetch:
```typescript
const { data, isLoading, error } = useDocumentation(
  projectId,
  ticketId,
  docType,
  open // enabled when modal opens
);
```

**Test**: Create `tests/e2e/documentation-viewer.spec.ts`

---

#### Step 2.3: Update TicketDetailModal

**File**: `components/board/ticket-detail-modal.tsx`

**Add state** (after existing state declarations around line 160):
```typescript
const [docViewerOpen, setDocViewerOpen] = useState(false);
const [docViewerType, setDocViewerType] = useState<DocumentType>('plan');
```

**Add visibility logic** (after `hasCompletedSpecifyJob` around line 217):
```typescript
// Check if "View Plan" button should be visible
const hasCompletedPlanJob = useMemo(() => {
  if (!localTicket?.branch || jobs.length === 0) return false;
  return jobs.some(
    (job) => job.command === 'plan' && job.status === 'COMPLETED'
  );
}, [localTicket?.branch, jobs]);

const showPlanButton = localTicket?.workflowType === 'FULL' && hasCompletedPlanJob;
const showTasksButton = showPlanButton && ['BUILD', 'VERIFY', 'SHIP'].includes(localTicket?.stage || '');
```

**Add buttons** (after View Spec button around line 450):
```typescript
{showPlanButton && (
  <Button
    variant="outline"
    onClick={() => {
      setDocViewerType('plan');
      setDocViewerOpen(true);
    }}
  >
    <Settings2 className="mr-2 h-4 w-4" />
    View Plan
  </Button>
)}

{showTasksButton && (
  <Button
    variant="outline"
    onClick={() => {
      setDocViewerType('tasks');
      setDocViewerOpen(true);
    }}
  >
    <CheckSquare className="mr-2 h-4 w-4" />
    View Tasks
  </Button>
)}
```

**Add modal** (after SpecViewer around line 550):
```typescript
<DocumentationViewer
  ticketId={localTicket.id}
  projectId={projectId}
  ticketTitle={localTicket.title}
  docType={docViewerType}
  open={docViewerOpen}
  onOpenChange={setDocViewerOpen}
/>
```

**Add imports**:
```typescript
import { Settings2, CheckSquare } from 'lucide-react';
import DocumentationViewer from './documentation-viewer';
import type { DocumentType } from '@/specs/035-view-plan-and/contracts/types';
```

**Test**: Update `tests/e2e/ticket-detail-modal.spec.ts` to verify button visibility

---

### Phase 3: Testing & Validation

**Goal**: Comprehensive E2E and contract tests

**Duration**: ~1 hour

#### Step 3.1: Write E2E Tests

**File**: `tests/e2e/documentation-viewer.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '../helpers/db-cleanup';
import { createTicket } from '../helpers/api-helpers';

test.beforeEach(async () => {
  await cleanupDatabase();
});

test.describe('Documentation Viewer', () => {
  test('shows plan button when plan job completed', async ({ page, request }) => {
    // Create full-workflow ticket
    const ticket = await createTicket(request, {
      title: '[e2e] Test Ticket',
      description: 'Test',
      stage: 'PLAN',
      workflowType: 'FULL',
      branch: '035-test-feature',
    });

    // Create completed plan job
    await request.post(`/api/jobs`, {
      data: {
        ticketId: ticket.id,
        command: 'plan',
        status: 'COMPLETED',
        projectId: 1,
      },
    });

    // Open ticket detail
    await page.goto('http://localhost:3000/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    // Verify plan button visible
    await expect(page.getByText('View Plan')).toBeVisible();
  });

  test('hides plan button for quick-impl tickets', async ({ page, request }) => {
    const ticket = await createTicket(request, {
      title: '[e2e] Quick Ticket',
      workflowType: 'QUICK',
      stage: 'BUILD',
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);

    await expect(page.getByText('View Plan')).not.toBeVisible();
  });

  test('fetches from main branch for shipped tickets', async ({ page, request }) => {
    // Create shipped ticket
    const ticket = await createTicket(request, {
      title: '[e2e] Shipped Ticket',
      stage: 'SHIP',
      workflowType: 'FULL',
      branch: '035-shipped-feature',
    });

    // Create completed plan job
    await request.post(`/api/jobs`, {
      data: {
        ticketId: ticket.id,
        command: 'plan',
        status: 'COMPLETED',
        projectId: 1,
      },
    });

    // Intercept API request to verify branch
    await page.route('**/api/projects/1/tickets/*/plan', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      expect(data.metadata.branch).toBe('main'); // Shipped → main branch
      await route.fulfill({ response });
    });

    await page.goto('http://localhost:3000/projects/1/board');
    await page.click(`[data-ticket-id="${ticket.id}"]`);
    await page.click('text=View Plan');
  });
});
```

#### Step 3.2: Run All Tests

```bash
# Unit tests
npm test tests/unit/doc-fetcher.test.ts

# Contract tests
npm test tests/api/plan-endpoint.spec.ts
npm test tests/api/tasks-endpoint.spec.ts

# E2E tests
npx playwright test tests/e2e/documentation-viewer.spec.ts
npx playwright test tests/e2e/ticket-detail-modal.spec.ts

# Full test suite
npm test
```

---

## Verification Checklist

**Backend**:
- [ ] Generic doc-fetcher.ts created with DocumentType support
- [ ] Plan API endpoint returns 200 with valid content
- [ ] Tasks API endpoint returns 200 with valid content
- [ ] Spec endpoint updated with branch selection logic
- [ ] Branch logic works (SHIP → main, others → feature branch)
- [ ] Error handling for file not found, rate limits, etc.

**Frontend**:
- [ ] DocumentationViewer component renders markdown correctly
- [ ] Plan button visible for full-workflow tickets with completed plan job
- [ ] Tasks button visible for BUILD/VERIFY/SHIP stages only
- [ ] Both buttons hidden for quick-impl tickets
- [ ] Buttons disabled when branch is null
- [ ] TanStack Query caching works (no duplicate API calls)

**Testing**:
- [ ] All unit tests pass
- [ ] All contract tests pass
- [ ] All E2E tests pass
- [ ] Test coverage ≥80% for new code

**User Experience**:
- [ ] Loading states show spinner
- [ ] Error states show user-friendly messages
- [ ] Buttons have proper spacing on mobile
- [ ] Modal scrolls correctly for large documents
- [ ] Syntax highlighting works in code blocks

---

## Troubleshooting

### "GITHUB_TOKEN not configured" Error
- Ensure `.env.local` has `GITHUB_TOKEN=ghp_...`
- Restart Next.js dev server after adding token

### "File not found" Errors in Tests
- Set `TEST_MODE=true` in `.env.test`
- Mock GitHub API returns test content

### Buttons Not Showing
- Check `ticket.workflowType` is 'FULL' (not 'QUICK')
- Check `jobs` array includes plan job with status 'COMPLETED'
- Check `ticket.branch` is not null

### Rate Limit Errors
- Reduce test frequency
- Use TanStack Query caching (5-minute stale time)
- Consider GitHub PAT with higher rate limits

---

## Performance Optimization

**Caching Strategy**:
- TanStack Query: 5-minute stale time prevents redundant fetches
- Client-side only: No server-side caching needed
- Lazy loading: Fetch only when modal opens

**Bundle Size**:
- Reuse existing react-markdown and syntax highlighter (no new deps)
- Generic DocumentationViewer reduces code duplication

**GitHub API Rate Limits**:
- 5000 requests/hour (authenticated)
- Caching reduces actual API calls by ~80%
- Monitor usage in GitHub settings

---

## Next Steps

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Implement in order: Backend → Frontend → Tests
3. Test locally before pushing
4. Create pull request with test evidence
5. Review with team and merge

## Reference Files

- Spec: `specs/035-view-plan-and/spec.md`
- Plan: `specs/035-view-plan-and/plan.md`
- Research: `specs/035-view-plan-and/research.md`
- Data Model: `specs/035-view-plan-and/data-model.md`
- Contracts: `specs/035-view-plan-and/contracts/`
