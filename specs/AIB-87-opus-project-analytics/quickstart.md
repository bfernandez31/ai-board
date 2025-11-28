# Quickstart: Project Analytics Dashboard

**Feature**: AIB-87-opus-project-analytics
**Date**: 2025-11-28

## Prerequisites

- Node.js 22.20.0+
- PostgreSQL 14+ with existing ai-board database
- Project with completed jobs containing telemetry data

## 1. Install Recharts Dependency

```bash
bun add recharts
```

## 2. Create Analytics Types

Create `lib/analytics/types.ts`:

```typescript
export interface OverviewMetrics {
  totalCost: number;
  costTrend: number;
  successRate: number;
  avgDuration: number;
  ticketsShipped: number;
}

export interface CostDataPoint {
  date: string;
  cost: number;
}

export interface StageCost {
  stage: 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  cost: number;
  percentage: number;
}

export interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
}

export interface CacheMetrics {
  totalTokens: number;
  cacheTokens: number;
  savingsPercentage: number;
  estimatedSavingsUsd: number;
}

export interface ToolUsage {
  tool: string;
  count: number;
}

export interface WorkflowBreakdown {
  type: 'FULL' | 'QUICK' | 'CLEAN';
  count: number;
  percentage: number;
}

export interface WeeklyVelocity {
  week: string;
  ticketsShipped: number;
}

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export interface AnalyticsData {
  overview: OverviewMetrics;
  costOverTime: CostDataPoint[];
  costByStage: StageCost[];
  tokenUsage: TokenBreakdown;
  cacheEfficiency: CacheMetrics;
  topTools: ToolUsage[];
  workflowDistribution: WorkflowBreakdown[];
  velocity: WeeklyVelocity[];
  timeRange: TimeRange;
  generatedAt: string;
  jobCount: number;
  hasData: boolean;
}
```

## 3. Create API Route

Create `app/api/projects/[projectId]/analytics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyProjectAccess } from '@/lib/db/verify-access';
import { getAnalyticsData } from '@/lib/analytics/queries';

const querySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId: projectIdStr } = await params;
    const projectId = parseInt(projectIdStr, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await verifyProjectAccess(projectId);

    const { searchParams } = new URL(request.url);
    const { range } = querySchema.parse({
      range: searchParams.get('range') || '30d',
    });

    const data = await getAnalyticsData(projectId, range);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## 4. Create Analytics Page

Create `app/projects/[projectId]/analytics/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { getProject } from '@/lib/db/projects';
import { getAnalyticsData } from '@/lib/analytics/queries';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { projectId: projectIdString } = await params;
  const { range = '30d' } = await searchParams;

  const projectId = parseInt(projectIdString, 10);

  if (isNaN(projectId) || projectId <= 0) {
    notFound();
  }

  const project = await getProject(projectId).catch(() => null);
  if (!project) {
    notFound();
  }

  const initialData = await getAnalyticsData(projectId, range as '7d' | '30d' | '90d' | 'all');

  return (
    <main className="container mx-auto py-10 max-w-7xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2">
            AI workflow metrics for {project.name}
          </p>
        </div>

        <AnalyticsDashboard
          projectId={projectId}
          initialData={initialData}
        />
      </div>
    </main>
  );
}
```

## 5. Add Menu Item

Update `components/project/ProjectMenu.tsx` to add Analytics link:

```typescript
import { BarChart3 } from 'lucide-react';
// ...

<DropdownMenuItem asChild>
  <Link href={`/projects/${projectId}/analytics`}>
    <BarChart3 className="mr-2 h-4 w-4" />
    Analytics
  </Link>
</DropdownMenuItem>
```

## 6. Run Tests

```bash
# Unit tests for aggregation functions
bun run test:unit tests/unit/analytics.test.ts

# E2E tests for dashboard
bun run test:e2e tests/e2e/analytics.spec.ts
```

## 7. Verify

1. Navigate to a project with completed jobs
2. Click project menu → Analytics
3. Verify charts render with data
4. Test time range selector (7d, 30d, 90d, all time)
5. Verify empty state for new projects without jobs

## Key Files Created

| File | Purpose |
|------|---------|
| `lib/analytics/types.ts` | TypeScript interfaces |
| `lib/analytics/aggregations.ts` | Pure aggregation functions |
| `lib/analytics/queries.ts` | Prisma query helpers |
| `app/api/projects/[projectId]/analytics/route.ts` | API endpoint |
| `app/projects/[projectId]/analytics/page.tsx` | Dashboard page |
| `components/analytics/*.tsx` | Chart components |
| `tests/unit/analytics.test.ts` | Unit tests |
| `tests/e2e/analytics.spec.ts` | E2E tests |

## Common Issues

### Chart not rendering
- Ensure `'use client'` directive at top of chart component
- Verify parent container has explicit height (`h-80`, not just `h-full`)

### Empty state showing when data exists
- Check that jobs have `status = 'COMPLETED'`
- Verify `costUsd` is not null on completed jobs

### Time range not updating
- Confirm URL params are being passed to API
- Check TanStack Query key includes range parameter
