# Quickstart: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-98-add-stats-tab`
**Date**: 2025-12-06

## Overview

This feature adds a fourth "Stats" tab to the ticket detail modal, displaying aggregated telemetry metrics from workflow jobs. Implementation touches the API layer, type definitions, utility functions, and UI components.

## Prerequisites

- Node.js 22.20.0+
- PostgreSQL 14+ with existing job telemetry data
- Development server running (`bun run dev`)

## Implementation Order

### 1. Extend Job Types (15 min)

**File**: `lib/types/job-types.ts`

Add `TicketJobWithStats` interface extending existing job type:

```typescript
export interface TicketJobWithStats {
  id: number;
  command: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  completedAt: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  model: string | null;
  toolsUsed: string[];
}
```

### 2. Extend Jobs API (20 min)

**File**: `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

Add `includeStats` query parameter support:

```typescript
const url = new URL(request.url);
const includeStats = url.searchParams.get('includeStats') === 'true';

const jobs = await prisma.job.findMany({
  where: { ticketId },
  select: includeStats ? {
    id: true,
    command: true,
    status: true,
    startedAt: true,
    completedAt: true,
    inputTokens: true,
    outputTokens: true,
    cacheReadTokens: true,
    cacheCreationTokens: true,
    costUsd: true,
    durationMs: true,
    model: true,
    toolsUsed: true,
  } : {
    id: true,
    command: true,
    status: true,
    completedAt: true,
  },
  orderBy: { startedAt: 'asc' },
});
```

### 3. Create Stats Utilities (30 min)

**File**: `lib/stats/ticket-stats.ts`

```typescript
import { TicketJobWithStats, TicketStats, ToolUsageCount } from '@/lib/types/job-types';

export function calculateTicketStats(jobs: TicketJobWithStats[]): TicketStats {
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED');

  const totalInputTokens = completedJobs.reduce((sum, j) => sum + (j.inputTokens ?? 0), 0);
  const totalOutputTokens = completedJobs.reduce((sum, j) => sum + (j.outputTokens ?? 0), 0);
  const cacheReadTokens = completedJobs.reduce((sum, j) => sum + (j.cacheReadTokens ?? 0), 0);

  return {
    totalCost: completedJobs.reduce((sum, j) => sum + (j.costUsd ?? 0), 0),
    totalDuration: completedJobs.reduce((sum, j) => sum + (j.durationMs ?? 0), 0),
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    cacheReadTokens,
    cacheEfficiency: totalInputTokens > 0
      ? (cacheReadTokens / totalInputTokens) * 100
      : null,
    toolUsage: aggregateToolUsage(completedJobs),
  };
}

function aggregateToolUsage(jobs: TicketJobWithStats[]): ToolUsageCount[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    for (const tool of job.toolsUsed) {
      counts.set(tool, (counts.get(tool) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);
}
```

### 4. Create Stats Tab Component (45 min)

**File**: `components/ticket/stats-tab.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import { TicketJobWithStats } from '@/lib/types/job-types';
import { calculateTicketStats } from '@/lib/stats/ticket-stats';
import { StatsSummaryCards } from './stats-summary-cards';
import { JobTimeline } from './job-timeline';
import { ToolsUsageSection } from './tools-usage-section';

interface StatsTabProps {
  jobs: TicketJobWithStats[];
}

export function StatsTab({ jobs }: StatsTabProps) {
  const stats = useMemo(() => calculateTicketStats(jobs), [jobs]);

  return (
    <div className="space-y-6">
      <StatsSummaryCards stats={stats} />
      <JobTimeline jobs={jobs} />
      <ToolsUsageSection toolUsage={stats.toolUsage} />
    </div>
  );
}
```

### 5. Create Summary Cards (30 min)

**File**: `components/ticket/stats-summary-cards.tsx`

Four cards displaying: Total Cost, Total Duration, Total Tokens, Cache Efficiency.

### 6. Create Job Timeline (45 min)

**File**: `components/ticket/job-timeline.tsx`
**File**: `components/ticket/job-timeline-row.tsx`

Chronological list with expandable rows for token breakdown.

### 7. Create Tools Usage Section (20 min)

**File**: `components/ticket/tools-usage-section.tsx`

Badge display of tool counts sorted by frequency.

### 8. Integrate into Modal (30 min)

**File**: `components/board/ticket-detail-modal.tsx`

- Add Stats tab (4th position)
- Update grid from `grid-cols-3` to conditional `grid-cols-4`
- Add Cmd/Ctrl+4 keyboard shortcut
- Conditionally render when `jobs.length > 0`

### 9. Write Tests (60 min)

**Unit Tests** (`tests/unit/stats-aggregation.test.ts`):
- `calculateTicketStats()` with various job configurations
- Null handling
- Cache efficiency edge cases

**E2E Tests** (`tests/e2e/stats-tab.spec.ts`):
- Tab visibility with/without jobs
- Summary card values
- Timeline expansion
- Keyboard navigation

## Key Files

| File | Purpose |
|------|---------|
| `lib/types/job-types.ts` | Type definitions |
| `lib/stats/ticket-stats.ts` | Aggregation utilities |
| `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Extended API |
| `components/ticket/stats-tab.tsx` | Main tab component |
| `components/ticket/stats-summary-cards.tsx` | Metric cards |
| `components/ticket/job-timeline.tsx` | Job list |
| `components/ticket/job-timeline-row.tsx` | Expandable row |
| `components/ticket/tools-usage-section.tsx` | Tool badges |
| `components/board/ticket-detail-modal.tsx` | Tab integration |

## Testing

```bash
# Unit tests for aggregation
bun run test:unit -- stats-aggregation

# E2E tests for tab functionality
bun run test:e2e -- stats-tab

# Type checking
bun run type-check
```

## Verification Checklist

- [ ] Stats tab appears only when ticket has jobs
- [ ] Summary cards show accurate aggregated values
- [ ] Job timeline ordered chronologically (oldest first)
- [ ] Expandable rows show token breakdown
- [ ] Tool usage sorted by frequency
- [ ] Cmd/Ctrl+4 navigates to Stats tab
- [ ] Real-time updates via polling
- [ ] Null values display as "—"
- [ ] Large numbers use abbreviations (K, M)
