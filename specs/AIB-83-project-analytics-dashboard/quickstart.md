# Quickstart: Project Analytics Dashboard

**Feature**: AIB-83-project-analytics-dashboard
**Date**: 2025-11-28
**Estimated Implementation Time**: 4-6 hours

This guide provides a step-by-step implementation path for the project analytics dashboard feature. Follow Test-Driven Development (TDD) principles: write tests first, then implement to make them pass.

---

## Prerequisites

Before starting implementation:

1. **Read all design artifacts**:
   - [spec.md](./spec.md) - Functional requirements and user scenarios
   - [research.md](./research.md) - Technical decisions and rationale
   - [data-model.md](./data-model.md) - Data entities and validation rules
   - [contracts/analytics-api.yaml](./contracts/analytics-api.yaml) - API contract

2. **Search for existing tests**:
   ```bash
   npx grep -r "analytics" tests/
   npx glob "tests/**/*analytics*.(test|spec).ts"
   ```
   Update existing test files if found; create new ones only if needed.

3. **Verify development environment**:
   ```bash
   bun run dev              # Start dev server
   bun run test:unit        # Verify Vitest works
   bun run test:e2e         # Verify Playwright works
   ```

---

## Phase 1: Backend Foundation (60-90 minutes)

### Step 1.1: Create TypeScript Types (10 min)

**File**: `lib/analytics/types.ts`

Create all TypeScript interfaces from data-model.md (see data model for complete types).

**Test**: TypeScript compiler validates types (`bun run type-check`)

---

### Step 1.2: Write Unit Tests for Aggregation Functions (20 min)

**File**: `tests/unit/analytics/aggregations.test.ts` (check if exists first!)

Write Vitest tests for:
- `aggregateCostByStage()` - Map commands to stages, sum costs
- `aggregateToolUsage()` - Flatten toolsUsed arrays, count frequencies
- `calculateCacheEfficiency()` - Formula: `(cacheRead / (input + cacheRead)) * 100`
- `calculateSuccessRate()` - Formula: `(COMPLETED / terminal) * 100`
- `formatDuration()` - Convert milliseconds to "2m 34s" format

**Example Test**:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCacheEfficiency } from '@/lib/analytics/calculations';

describe('calculateCacheEfficiency', () => {
  it('returns 0% when no cache usage', () => {
    expect(calculateCacheEfficiency(100000, 0)).toBe(0);
  });

  it('calculates efficiency correctly', () => {
    expect(calculateCacheEfficiency(125000, 80000)).toBeCloseTo(39.0, 1);
  });

  it('handles zero denominator', () => {
    expect(calculateCacheEfficiency(0, 0)).toBe(0);
  });
});
```

**Run**: `bun run test:unit` (tests should FAIL - Red)

---

### Step 1.3: Implement Aggregation Functions (20 min)

**Files**:
- `lib/analytics/aggregations.ts` - Stage, tool, time-series aggregations
- `lib/analytics/calculations.ts` - Cache efficiency, success rate, duration formulas

Implement functions to make tests pass (Green).

**Key Implementation**:
```typescript
// lib/analytics/calculations.ts
export function calculateCacheEfficiency(
  inputTokens: number,
  cacheReadTokens: number
): number {
  const total = inputTokens + cacheReadTokens;
  if (total === 0) return 0;
  return (cacheReadTokens / total) * 100;
}

export function calculateSuccessRate(
  completed: number,
  failed: number,
  cancelled: number
): number | null {
  const total = completed + failed + cancelled;
  if (total === 0) return null;
  return (completed / total) * 100;
}

export function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
```

**Run**: `bun run test:unit` (tests should PASS - Green)

---

### Step 1.4: Write Unit Tests for Database Queries (10 min)

**File**: `tests/unit/analytics/queries.test.ts` (check if exists first!)

Write Vitest tests for query builder functions (mock Prisma client):
- `buildJobFilter()` - Construct projectId + date range filter
- `buildStageGrouping()` - Group jobs by command, map to stages

**Run**: `bun run test:unit` (tests should FAIL)

---

### Step 1.5: Implement Database Query Functions (20 min)

**File**: `lib/db/analytics-queries.ts`

Implement Prisma queries for:
- `fetchJobsForAnalytics()` - Get jobs with telemetry data
- `fetchTicketsForVelocity()` - Get shipped tickets by week
- `aggregateCostSummary()` - Use Prisma aggregate/groupBy

**Example Query**:
```typescript
import { prisma } from '@/lib/db/client';

export async function fetchJobsForAnalytics(
  projectId: number,
  startDate: Date
) {
  return await prisma.job.findMany({
    where: {
      projectId,
      completedAt: { gte: startDate },
      status: 'COMPLETED',
    },
    select: {
      command: true,
      costUsd: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheCreationTokens: true,
      durationMs: true,
      toolsUsed: true,
      completedAt: true,
    },
  });
}
```

**Run**: `bun run test:unit` (tests should PASS)

---

### Step 1.6: Write Playwright API Tests (15 min)

**File**: `tests/integration/analytics/api.spec.ts` (check if exists first!)

Write Playwright tests for:
- GET `/api/projects/[projectId]/analytics` returns 200 with valid data
- GET with invalid projectId returns 400
- GET without authorization returns 403
- GET with no jobs returns empty arrays but valid structure

**Example Test**:
```typescript
import { test, expect } from '@playwright/test';

test('GET /api/projects/1/analytics returns analytics data', async ({ request }) => {
  const response = await request.get('/api/projects/1/analytics');
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data).toHaveProperty('summary');
  expect(data).toHaveProperty('costOverTime');
  expect(data.summary).toHaveProperty('totalCostUsd');
});
```

**Run**: `bun run test:e2e` (tests should FAIL)

---

### Step 1.7: Implement Analytics API Route (20 min)

**File**: `app/api/projects/[projectId]/analytics/route.ts`

Implement GET handler:
1. Validate projectId parameter (Zod schema)
2. Verify project access (`verifyProjectAccess`)
3. Fetch jobs and tickets from database
4. Aggregate data using utility functions
5. Return AnalyticsData response

**Example Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/auth-helpers';
import { fetchJobsForAnalytics } from '@/lib/db/analytics-queries';
import { aggregateCostByStage } from '@/lib/analytics/aggregations';
import type { AnalyticsData } from '@/lib/analytics/types';

const RouteParamsSchema = z.object({
  projectId: z.string().regex(/^\d+$/),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const paramsResult = RouteParamsSchema.safeParse(params);

    if (!paramsResult.success) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const projectId = parseInt(params.projectId, 10);
    await verifyProjectAccess(projectId);

    // Fetch data (last 30 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const jobs = await fetchJobsForAnalytics(projectId, startDate);

    // Aggregate data
    const analyticsData: AnalyticsData = {
      summary: {
        totalCostUsd: jobs.reduce((sum, j) => sum + (j.costUsd || 0), 0),
        costTrendPercent: null, // TODO: implement trend calculation
        successRatePercent: null, // TODO: implement success rate
        avgDurationMs: null, // TODO: implement avg duration
        ticketsShippedThisMonth: 0, // TODO: fetch tickets
      },
      costOverTime: [], // TODO: implement time-series
      costByStage: aggregateCostByStage(jobs),
      tokenUsage: {
        inputTokens: jobs.reduce((sum, j) => sum + (j.inputTokens || 0), 0),
        outputTokens: jobs.reduce((sum, j) => sum + (j.outputTokens || 0), 0),
        cacheReadTokens: jobs.reduce((sum, j) => sum + (j.cacheReadTokens || 0), 0),
        cacheCreationTokens: jobs.reduce((sum, j) => sum + (j.cacheCreationTokens || 0), 0),
        totalTokens: 0, // Calculate from above
      },
      topTools: [], // TODO: implement tool aggregation
      cacheEfficiency: {
        efficiencyPercent: 0,
        cacheReadTokens: 0,
        freshInputTokens: 0,
        totalInputTokens: 0,
      }, // TODO: implement
      workflowDistribution: [], // TODO: implement
      velocity: [], // TODO: implement
    };

    return NextResponse.json(analyticsData, { status: 200 });
  } catch (error) {
    console.error('Error fetching analytics:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Run**: `bun run test:e2e` (tests should PASS)

---

## Phase 2: Frontend UI (90-120 minutes)

### Step 2.1: Install Chart Library (5 min)

Check if shadcn/ui chart components are installed:
```bash
npx shadcn@latest add chart
```

This installs Recharts integration with shadcn/ui design system.

---

### Step 2.2: Write Playwright UI Tests (20 min)

**File**: `tests/integration/analytics/dashboard.spec.ts` (check if exists first!)

Write Playwright tests for:
- Analytics page renders with 4 overview cards
- Cost over time chart displays data points
- Top tools chart displays horizontal bars
- Authorization: redirects to login if not authenticated
- Navigation: "Analytics" menu item visible in project dropdown

**Example Test**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    // ... perform login
  });

  test('displays overview cards', async ({ page }) => {
    await page.goto('/project/AIB/analytics');

    await expect(page.getByText('Total Cost')).toBeVisible();
    await expect(page.getByText('Success Rate')).toBeVisible();
    await expect(page.getByText('Avg Duration')).toBeVisible();
    await expect(page.getByText('Tickets Shipped')).toBeVisible();
  });

  test('displays cost over time chart', async ({ page }) => {
    await page.goto('/project/AIB/analytics');

    const chart = page.locator('[data-testid="cost-over-time-chart"]');
    await expect(chart).toBeVisible();
  });
});
```

**Run**: `bun run test:e2e` (tests should FAIL)

---

### Step 2.3: Implement Overview Cards Component (20 min)

**File**: `components/analytics/overview-cards.tsx`

Create component displaying 4 metric cards using shadcn/ui Card component:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalyticsSummary } from '@/lib/analytics/types';
import { formatDuration } from '@/lib/analytics/calculations';

export function OverviewCards({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Cost</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${summary.totalCostUsd.toFixed(2)}
          </div>
          {summary.costTrendPercent !== null && (
            <p className="text-xs text-muted-foreground">
              {summary.costTrendPercent > 0 ? '+' : ''}
              {summary.costTrendPercent.toFixed(1)}% vs. previous period
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.successRatePercent !== null
              ? `${summary.successRatePercent.toFixed(1)}%`
              : 'N/A'}
          </div>
          {summary.successRatePercent === null && (
            <p className="text-xs text-muted-foreground">
              No completed jobs
            </p>
          )}
        </CardContent>
      </Card>

      {/* Repeat for avgDuration and ticketsShipped */}
    </div>
  );
}
```

---

### Step 2.4: Implement Chart Components (40 min)

Create chart components using Recharts (via shadcn/ui):

**Files**:
- `components/analytics/cost-over-time-chart.tsx` - AreaChart
- `components/analytics/cost-by-stage-chart.tsx` - BarChart (horizontal)
- `components/analytics/token-usage-chart.tsx` - BarChart (stacked)
- `components/analytics/top-tools-chart.tsx` - BarChart (horizontal)
- `components/analytics/cache-efficiency-chart.tsx` - PieChart (donut)
- `components/analytics/workflow-distribution-chart.tsx` - PieChart (donut)
- `components/analytics/velocity-chart.tsx` - BarChart

**Example Chart**:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CostByStageDataPoint } from '@/lib/analytics/types';

export function CostByStageChart({ data }: { data: CostByStageDataPoint[] }) {
  if (data.length === 0) {
    return <div className="text-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" />
        <YAxis dataKey="stage" type="category" />
        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
        <Bar dataKey="costUsd" fill="hsl(var(--primary))" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

### Step 2.5: Implement Analytics Page (20 min)

**File**: `app/(authenticated)/project/[projectKey]/analytics/page.tsx`

Create Server Component that:
1. Fetches analytics data via API
2. Renders overview cards
3. Renders charts in Bento Grid layout

```tsx
import { OverviewCards } from '@/components/analytics/overview-cards';
import { CostOverTimeChart } from '@/components/analytics/cost-over-time-chart';
// ... import other charts

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ projectKey: string }>;
}) {
  const { projectKey } = await params;

  // Fetch project by key to get projectId
  const project = await prisma.project.findUnique({
    where: { key: projectKey },
    select: { id: true, name: true },
  });

  if (!project) {
    notFound();
  }

  // Fetch analytics data
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/projects/${project.id}/analytics`,
    { cache: 'no-store' }
  );

  const analyticsData = await response.json();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{project.name} Analytics</h1>

      <OverviewCards summary={analyticsData.summary} />

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Cost Over Time</h2>
          <CostOverTimeChart data={analyticsData.costOverTime} />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Cost by Stage</h2>
          <CostByStageChart data={analyticsData.costByStage} />
        </div>

        {/* Add remaining charts */}
      </div>
    </div>
  );
}
```

**Run**: `bun run test:e2e` (UI tests should PASS)

---

### Step 2.6: Add Navigation Menu Item (15 min)

**File**: Find existing project dropdown component (likely `components/project/project-menu.tsx` or similar)

Add "Analytics" menu item:

```tsx
import { BarChart3 } from 'lucide-react';

// Inside DropdownMenu
<DropdownMenuItem asChild>
  <Link href={`/project/${project.key}/analytics`}>
    <BarChart3 className="mr-2 h-4 w-4" />
    <span>Analytics</span>
  </Link>
</DropdownMenuItem>
```

---

## Phase 3: Polish & Validation (30-60 minutes)

### Step 3.1: Add TanStack Query Integration (20 min)

Replace fetch with TanStack Query for client-side data fetching (if needed for interactivity):

**File**: `lib/analytics/queries.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import type { AnalyticsData } from '@/lib/analytics/types';

export function useProjectAnalytics(projectId: number) {
  return useQuery<AnalyticsData>({
    queryKey: ['analytics', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/analytics`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });
}
```

---

### Step 3.2: Handle Edge Cases (15 min)

Add UI states for:
- Loading: Show skeleton cards and chart placeholders
- Error: Display error message with retry button
- Empty data: "No data available" messages in charts

**Example**:
```tsx
if (isLoading) return <AnalyticsSkeleton />;
if (error) return <ErrorState error={error} />;
if (!data) return <EmptyState />;
```

---

### Step 3.3: Responsive Layout (10 min)

Verify Bento Grid layout works on mobile:
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Charts adapt to viewport */}
</div>
```

Test on mobile viewport in Playwright:
```typescript
test('responsive on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/project/AIB/analytics');
  // ... assert layout
});
```

---

### Step 3.4: Final Test Run (10 min)

Run full test suite:
```bash
bun run type-check          # TypeScript validation
bun run test:unit           # Vitest unit tests
bun run test:e2e            # Playwright integration tests
bun run build               # Verify production build
```

All tests should pass. If failures, debug and fix before proceeding.

---

## Phase 4: Documentation & Review (15 min)

### Step 4.1: Add Code Comments

Add JSDoc comments to exported functions:
```typescript
/**
 * Calculates cache efficiency as percentage of input tokens served from cache.
 * Formula: (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100
 *
 * @param inputTokens - Non-cached input tokens
 * @param cacheReadTokens - Cached input tokens
 * @returns Efficiency percentage (0-100), or 0 if no tokens
 */
export function calculateCacheEfficiency(
  inputTokens: number,
  cacheReadTokens: number
): number {
  // ...
}
```

---

### Step 4.2: Update Project README (5 min)

If project README exists, add analytics feature documentation:
```markdown
## Analytics Dashboard

View project analytics at `/project/[projectKey]/analytics`:
- Cost metrics and trends
- Token usage and cache efficiency
- Workflow success rates
- Tool usage patterns
- Ticket velocity
```

---

## Verification Checklist

Before marking feature complete, verify:

- [ ] All unit tests pass (`bun run test:unit`)
- [ ] All integration tests pass (`bun run test:e2e`)
- [ ] TypeScript compilation succeeds (`bun run type-check`)
- [ ] Production build succeeds (`bun run build`)
- [ ] Analytics page accessible via project dropdown menu
- [ ] Authorization enforced (403 for non-members)
- [ ] All 4 overview cards display correctly
- [ ] All 7 charts render with real data
- [ ] Empty states display when no data available
- [ ] Page loads in <2 seconds for 500 jobs
- [ ] Responsive layout works on mobile (320px+)
- [ ] No console errors or warnings
- [ ] Recharts tooltips show formatted values (currency, percentages)

---

## Common Pitfalls

1. **Forgetting to search for existing tests**: Always use `npx grep` before creating new test files
2. **Skipping TDD**: Write tests BEFORE implementation, not after
3. **Missing authorization check**: Always call `verifyProjectAccess()` in API routes
4. **Null handling**: Job telemetry fields are nullable; use `|| 0` in aggregations
5. **Date timezone issues**: Use UTC dates consistently (`new Date().toISOString()`)
6. **Chart responsiveness**: Always wrap Recharts in `<ResponsiveContainer>`
7. **Prisma query performance**: Leverage existing indexes, avoid N+1 queries
8. **Type safety**: Never use `any`; define explicit TypeScript interfaces

---

## Success Metrics

Feature is complete when:
- All acceptance scenarios from spec.md pass
- All constitution checks remain green
- Test coverage >80% for analytics utilities
- Page load time <2 seconds (verify in Network tab)
- Zero TypeScript errors
- Zero runtime errors in console

---

**Estimated Total Time**: 4-6 hours

**Next Steps**: After implementation, run `/speckit.tasks` to generate tasks.md for implementation tracking.
