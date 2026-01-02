# Implementation Plan: Ticket Modal Real-Time Data Refresh

**Branch**: `AIB-128-update-ticket-on` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-128-update-ticket-on/spec.md`

## Summary

Fix ticket modal data synchronization so that artifact buttons (Spec/Plan/Summary), branch field, and Stats tab update in real-time when jobs complete, without requiring page refresh. The solution leverages existing TanStack Query cache invalidation patterns already implemented in `useJobPolling()`.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, TanStack Query v5.90.5, Prisma 6.x
**Storage**: PostgreSQL 14+ via Prisma ORM
**Testing**: Vitest (unit + integration), Playwright (E2E - browser-required only)
**Target Platform**: Web application (Next.js App Router)
**Project Type**: web (Next.js monorepo)
**Performance Goals**: UI updates within 5 seconds of job completion (2-second polling interval)
**Constraints**: No additional network overhead, use existing polling mechanisms
**Scale/Scope**: Single project, ~8 affected files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| TypeScript-First | ✅ PASS | All code will be TypeScript strict mode |
| Component-Driven | ✅ PASS | Using existing shadcn/ui patterns, extending existing hooks |
| Test-Driven | ✅ PASS | Will add RTL component tests + Vitest integration tests |
| Security-First | ✅ PASS | No new user inputs, uses existing authenticated endpoints |
| Database Integrity | ✅ PASS | Read-only operation, no schema changes |
| AI-First Development | ✅ PASS | Following spec-kit workflow, no tutorial docs |

## Project Structure

### Documentation (this feature)

```
specs/AIB-128-update-ticket-on/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (N/A - no API changes)
```

### Source Code (repository root)

```
# Affected files (Next.js App Router structure)
app/
└── lib/
    └── hooks/
        └── useJobPolling.ts          # Existing - enhance invalidation

components/
├── board/
│   ├── board.tsx                     # Existing - verify data flow
│   └── ticket-detail-modal.tsx       # Existing - verify prop updates
└── ticket/
    └── ticket-stats.tsx              # Existing - verify job merging

tests/
├── unit/
│   └── components/
│       └── ticket-detail-modal.test.tsx  # New - RTL component tests
└── integration/
    └── job-polling/
        └── cache-invalidation.test.ts    # New - invalidation tests
```

**Structure Decision**: Existing Next.js App Router structure. No new directories needed - extending existing hooks and components with behavior fixes.

## Complexity Tracking

*No violations - solution uses existing patterns*

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| No new hooks | Extend `useJobPolling` | Reuse proven polling mechanism |
| No new API endpoints | Use existing cache invalidation | No additional network calls |
| Component tests over E2E | RTL + Vitest | Faster, more reliable for state synchronization testing |

## Root Cause Analysis

### The Problem

1. **Job polling works**: `useJobPolling()` correctly detects job completion and invalidates the tickets cache
2. **Board updates**: Board component receives fresh ticket data after invalidation
3. **Modal doesn't update**: Modal uses `localTicket` state that doesn't sync with fresh ticket data

### Why Modal Data Becomes Stale

Looking at `ticket-detail-modal.tsx` lines 218-235:

```typescript
// Update local ticket when a different ticket is selected, version changes, or branch changes
useEffect(() => {
  if (ticket) {
    setLocalTicket((current) => {
      if (!current || current.id !== ticket.id || current.version !== ticket.version || current.branch !== ticket.branch) {
        return ticket;
      }
      return current;  // <-- BUG: Other fields don't trigger update
    });
  }
}, [ticket]);
```

**Problem**: The `useEffect` only updates `localTicket` when:
- Different ticket ID
- Different version (version isn't bumped by job completion)
- Different branch (only changes once during specify)

**Missing**: Job data is passed via `jobs` prop directly from Board (updated every 2s), but the button visibility conditions depend on `localTicket?.branch` which may be stale.

### Artifact Button Issue

From lines 284-290:
```typescript
const hasCompletedSpecifyJob = useMemo(() => {
  if (!localTicket?.branch || jobs.length === 0) return false;  // <-- Uses localTicket
  return jobs.some((job) => job.command === 'specify' && job.status === 'COMPLETED');
}, [localTicket?.branch, jobs]);
```

**Root Cause**: When specify job completes:
1. Job status updates via polling ✅
2. Ticket cache invalidates ✅
3. Board receives new ticket with branch ✅
4. Modal's `localTicket` doesn't update because version unchanged ❌
5. `hasCompletedSpecifyJob` returns false because `localTicket?.branch` is null ❌

## Solution Design

### Fix 1: Always Sync localTicket with Incoming Ticket Prop

Replace the conditional update with unconditional sync when ticket data changes meaningfully:

```typescript
useEffect(() => {
  if (ticket) {
    setLocalTicket(ticket);  // Always sync with parent
  }
}, [ticket]);
```

**Concern**: This was conditional to preserve edit state during inline editing.

**Resolution**: The editing hooks (`useTicketEdit`) manage their own state and call `onUpdate` callback on save. The `localTicket` state is only for display, not edit tracking.

### Fix 2: Ensure Parent Ticket Updates Trigger Re-render

The Board component already derives `selectedTicket` from `allTickets`:

```typescript
const selectedTicket = useMemo(() => {
  if (!selectedTicketId) return null;
  return allTickets.find(t => t.id === selectedTicketId) || null;
}, [selectedTicketId, allTickets]);
```

This is correct - when tickets cache invalidates, `allTickets` updates, which updates `selectedTicket`, which updates the modal's `ticket` prop.

**Verify**: The cache invalidation in `useJobPolling` correctly triggers refetch of tickets.

### Fix 3: Ensure Stats Tab Gets Fresh Data

Stats tab receives `fullJobs` (server data) and `polledJobs` (real-time):

```typescript
<TicketStats jobs={fullJobs} polledJobs={jobs} />
```

**Issue**: `fullJobs` comes from `initialJobs` Map which is only populated on page load. Jobs created during the session have minimal data.

**Solution**: When jobs transition to terminal status, also refresh the full job data (telemetry fields) by adding a timeline/jobs refetch.

## Implementation Tasks

### Task 1: Fix Modal localTicket Sync

**File**: `components/board/ticket-detail-modal.tsx`
**Change**: Update useEffect to always sync localTicket with incoming ticket prop

### Task 2: Verify Cache Invalidation Chain

**Files**:
- `app/lib/hooks/useJobPolling.ts` - verify invalidation triggers
- `app/lib/hooks/queries/useTickets.ts` - verify refetch behavior

### Task 3: Add Timeline Refresh on Job Completion

**File**: `app/lib/hooks/useJobPolling.ts`
**Change**: Also invalidate timeline queries when jobs complete (for stats tab)

### Task 4: Add Component Tests (RTL)

**File**: `tests/unit/components/ticket-detail-modal.test.tsx`
**Tests**:
- Button visibility based on job status
- localTicket updates when ticket prop changes
- Stats tab receives updated job data

### Task 5: Add Integration Tests

**File**: `tests/integration/job-polling/cache-invalidation.test.ts`
**Tests**:
- Cache invalidation triggers on terminal job
- Tickets query refetches after invalidation
