# Quickstart: Add Stats Tab to Ticket Detail Modal

**Feature Branch**: `AIB-99-add-stats-tab`
**Date**: 2025-12-06

## Prerequisites

- Node.js 22.20.0 or later
- Bun package manager
- PostgreSQL database running with existing schema
- Project with tickets that have completed jobs (for testing)

## Quick Setup

```bash
# 1. Ensure dependencies are installed
bun install

# 2. Ensure database has telemetry data
# (Jobs must have completed with Claude telemetry for stats to display)

# 3. Start development server
bun run dev
```

## Files to Implement

### 1. Types Extension
**File**: `lib/types/job-types.ts`

Add `TicketJobWithTelemetry` interface extending existing types with telemetry fields.

### 2. Stats Hook
**File**: `lib/hooks/use-ticket-stats.ts`

Create hook that:
- Accepts jobs array
- Computes aggregated statistics (cost, duration, tokens, cache efficiency)
- Returns computed `TicketStats` object

### 3. Stats Components
**Files**:
- `components/ticket/ticket-stats.tsx` - Main Stats tab container
- `components/ticket/jobs-timeline.tsx` - Chronological jobs list with expand

### 4. Modal Integration
**File**: `components/board/ticket-detail-modal.tsx`

Modifications:
- Update `activeTab` type: `'details' | 'comments' | 'files' | 'stats'`
- Update TabsList grid: `grid-cols-3` → `grid-cols-4`
- Add Stats TabsTrigger with conditional rendering
- Add Stats TabsContent
- Add keyboard shortcut `Cmd+4` / `Ctrl+4`

### 5. Tests
**Files**:
- `tests/unit/ticket-stats.test.ts` - Unit tests for aggregation functions
- `tests/e2e/tickets/stats-tab.spec.ts` - E2E tests for Stats tab

## Key Implementation Notes

### Tab Visibility Logic
```typescript
// Stats tab only visible when jobs exist
{jobs.length > 0 && (
  <TabsTrigger value="stats">Stats</TabsTrigger>
)}
```

### Existing Utilities to Import
```typescript
import {
  formatCost,
  formatDuration,
  formatPercentage,
  formatAbbreviatedNumber,
} from '@/lib/analytics/aggregations';
```

### Cache Efficiency Formula
```typescript
const cacheEfficiency =
  (inputTokens + cacheReadTokens) > 0
    ? (cacheReadTokens / (inputTokens + cacheReadTokens)) * 100
    : 0;
```

### Null Handling
```typescript
// Treat null as 0 for summation
const totalCost = jobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
```

## Testing Commands

```bash
# Run unit tests for stats aggregation
bun run test:unit tests/unit/ticket-stats.test.ts

# Run E2E tests for Stats tab
bun run test:e2e tests/e2e/tickets/stats-tab.spec.ts

# Run all tests
bun run test
```

## Verification Checklist

- [ ] Stats tab appears only when ticket has jobs
- [ ] Summary cards show total cost, duration, tokens, cache efficiency
- [ ] Jobs timeline shows all jobs in chronological order
- [ ] Job rows are expandable to show token breakdown
- [ ] Tools usage section shows frequency-sorted tools
- [ ] Real-time updates work via existing 2-second polling
- [ ] Keyboard shortcut Cmd+4 / Ctrl+4 switches to Stats tab
- [ ] Empty/null telemetry displays appropriate fallback values
- [ ] Unit tests pass for aggregation functions
- [ ] E2E test passes for Stats tab functionality
