# Developer Quickstart: Real-Time UI Stage Synchronization

**Feature**: Real-Time UI Stage Synchronization
**Date**: 2025-10-30
**Branch**: `076-934-ui-stages`

## Overview

This quickstart guide helps developers test and debug the real-time UI stage synchronization feature. The feature fixes a bug where workflow-initiated ticket stage transitions (quick-impl → VERIFY, auto-ship → SHIP) do not automatically update the UI without page refresh.

## Prerequisites

- Node.js 22.20.0 LTS installed
- Bun package manager installed
- PostgreSQL 14+ running locally
- Project database seeded with test data
- GitHub repository access (for workflow testing)

## Setup

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/bfernandez31/ai-board.git
cd ai-board

# Checkout feature branch
git checkout 076-934-ui-stages

# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate
```

### 2. Configure Environment

Create `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_board_dev"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# GitHub (for workflow testing)
GITHUB_TOKEN="ghp_your_personal_access_token"

# Cloudinary (for image uploads, optional for this feature)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### 3. Database Setup

```bash
# Run migrations
bunx prisma migrate dev

# Seed database with test data
bun run db:seed

# Verify database connection
bunx prisma studio
```

## Development Workflow

### Start Development Server

```bash
# Terminal 1: Start Next.js dev server
bun run dev

# Open browser: http://localhost:3000
```

### Run Tests (TDD Approach)

```bash
# Terminal 2: Run unit tests (Vitest, fast feedback)
bun run test:unit:watch

# Terminal 3: Run E2E tests (Playwright, integration validation)
bun run test:e2e:headed

# Full test suite (before committing)
bun test
```

## Testing the Feature

### Test Scenario 1: Quick-Impl Workflow

**Objective**: Verify ticket automatically moves from BUILD to VERIFY after quick-impl workflow completes.

**Steps**:

1. **Create Test Ticket**:
   ```bash
   # Via UI: Navigate to http://localhost:3000/projects/3/board
   # Click "New Ticket" button
   # Title: "[test] Quick-impl stage sync"
   # Description: "Test workflow-initiated stage transition"
   # Submit form
   ```

2. **Trigger Quick-Impl Workflow**:
   ```bash
   # Drag ticket from INBOX column to BUILD column
   # Observe: "Quick Implementation?" modal appears
   # Click "Proceed" button
   # Observe: Job status indicator shows "PENDING" badge on ticket
   ```

3. **Monitor Polling**:
   ```bash
   # Open browser DevTools (F12)
   # Switch to Console tab
   # Filter logs: "useJobPolling"
   # Expected output every 2 seconds:
   #   [useJobPolling] Fetching jobs for project 3
   #   [useJobPolling] Jobs: [{ id: X, status: "RUNNING", ticketId: Y, ... }]
   ```

4. **Verify Stage Transition**:
   ```bash
   # Wait for workflow to complete (30-60 seconds)
   # Expected console output:
   #   [useJobPolling] Detected terminal jobs: [{ id: X, status: "COMPLETED", ... }]
   #   [TanStack Query] Invalidating tickets cache
   #   [TanStack Query] Refetching tickets
   # Expected UI behavior:
   #   - Ticket card moves from BUILD column to VERIFY column
   #   - Job status badge updates to "COMPLETED"
   #   - No page refresh required
   ```

5. **Acceptance Criteria**:
   - ✅ Ticket moves to VERIFY column within 2-3 seconds of workflow completion
   - ✅ No manual page refresh required
   - ✅ Job status indicator updates correctly
   - ✅ No visual flicker or duplicate cards

### Test Scenario 2: Auto-Ship Deployment

**Objective**: Verify ticket automatically moves from VERIFY to SHIP after auto-ship workflow completes.

**Steps**:

1. **Create Ticket in VERIFY Stage**:
   ```bash
   # Create ticket via UI (see Scenario 1 steps 1-2)
   # Wait for ticket to reach VERIFY stage
   # Merge feature branch to main (simulates deployment)
   ```

2. **Trigger Auto-Ship Workflow**:
   ```bash
   # Via GitHub UI or CLI:
   gh workflow run auto-ship.yml --ref main

   # Or simulate via API call:
   curl -X PATCH http://localhost:3000/api/projects/3/tickets/10 \
     -H "Content-Type: application/json" \
     -d '{ "stage": "SHIP", "version": 3 }'
   ```

3. **Verify Stage Transition**:
   ```bash
   # Expected console output (see Scenario 1 step 3)
   # Expected UI behavior:
   #   - Ticket card moves from VERIFY column to SHIP column
   #   - Job status badge updates to "COMPLETED"
   #   - No page refresh required
   ```

4. **Acceptance Criteria**:
   - ✅ Ticket moves to SHIP column within 2-3 seconds of deployment
   - ✅ No manual page refresh required
   - ✅ Other tickets in VERIFY remain unaffected

### Test Scenario 3: Manual Drag-and-Drop (Backward Compatibility)

**Objective**: Verify manual stage transitions still work correctly with polling active.

**Steps**:

1. **Drag Ticket Manually**:
   ```bash
   # Via UI: Drag ticket from BUILD column to INBOX column (rollback)
   # Expected: Ticket moves immediately (optimistic update)
   # Expected: No visual delay or flicker
   ```

2. **Verify Polling Continues**:
   ```bash
   # Expected console output:
   #   [useJobPolling] Fetching jobs for project 3
   #   [useJobPolling] Jobs: [...]
   # Expected: Polling does not interfere with manual transitions
   ```

3. **Acceptance Criteria**:
   - ✅ Manual drag-and-drop works immediately (no latency)
   - ✅ Polling continues to work for other tickets
   - ✅ No UI state corruption or race conditions

## Debugging Tips

### Enable TanStack Query DevTools

Add to browser console:

```javascript
// Open TanStack Query DevTools
window.__REACT_QUERY_DEVTOOLS__ = true;
```

Or add to `app/layout.tsx`:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </body>
    </html>
  );
}
```

### Check Polling Hook State

Add console logs to `useJobPolling.ts`:

```typescript
console.log('[useJobPolling] Current state:', {
  jobs,
  isPolling,
  allTerminal,
  lastPollTime: new Date(lastPollTime || 0).toISOString(),
});
```

### Inspect Cache Invalidation

Add console logs to terminal detection effect:

```typescript
useEffect(() => {
  console.log('[useJobPolling] Previous jobs:', previousJobsRef.current);
  console.log('[useJobPolling] Current jobs:', jobs);
  console.log('[useJobPolling] Newly terminal:', newlyTerminal);

  if (newlyTerminal.length > 0) {
    console.log('[useJobPolling] Invalidating tickets cache');
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.tickets(projectId),
    });
  }
}, [jobs, projectId, queryClient]);
```

### Monitor API Requests

Use browser DevTools Network tab:

```bash
# Filter by:
# - jobs/status (every 2 seconds)
# - tickets (on cache invalidation)

# Expected request pattern:
# T+0s:  GET /api/projects/3/jobs/status (polling)
# T+2s:  GET /api/projects/3/jobs/status (polling)
# T+4s:  GET /api/projects/3/jobs/status (polling)
# T+4s:  GET /api/projects/3/tickets (cache invalidated, refetch triggered)
# T+6s:  GET /api/projects/3/jobs/status (polling continues)
```

### Simulate Workflow Completion

Manually update job status via Prisma Studio:

```sql
-- Find running job
SELECT * FROM "Job" WHERE "status" = 'RUNNING';

-- Update to COMPLETED
UPDATE "Job" SET "status" = 'COMPLETED', "completedAt" = NOW()
WHERE "id" = 42;

-- Observe polling hook detects change within 2 seconds
```

## Common Issues

### Issue 1: Polling Not Detecting Terminal Jobs

**Symptom**: Console shows jobs with COMPLETED status, but tickets cache not invalidated.

**Debug**:
```typescript
// Check terminal detection logic
const newlyTerminal = jobs.filter(job => {
  const isTerminal = TERMINAL_STATUSES.has(job.status);
  const wasTerminal = previousJobsRef.current.some(
    prev => prev.id === job.id && TERMINAL_STATUSES.has(prev.status)
  );
  console.log(`Job ${job.id}: isTerminal=${isTerminal}, wasTerminal=${wasTerminal}`);
  return isTerminal && !wasTerminal;
});
```

**Solution**: Verify `previousJobsRef` is correctly initialized and updated.

### Issue 2: Tickets Not Refetching After Invalidation

**Symptom**: Cache invalidated but tickets data not updated.

**Debug**:
```typescript
// Check if query is active (subscribed by component)
const queryClient = useQueryClient();
const queryState = queryClient.getQueryState(queryKeys.projects.tickets(projectId));
console.log('Tickets query state:', queryState);
```

**Solution**: Ensure `useTicketsByStage` or `useProjectTickets` hook is mounted and active.

### Issue 3: UI Not Re-rendering After Cache Update

**Symptom**: Tickets cache updated but UI still shows old stage.

**Debug**:
```typescript
// Check if component is re-rendering
const { data: ticketsByStage } = useTicketsByStage(projectId);
console.log('Board re-render, ticketsByStage:', ticketsByStage);
```

**Solution**: Verify board component is not memoized incorrectly, and TanStack Query is triggering re-renders.

## Performance Validation

### Measure UI Update Latency

Add instrumentation to polling hook:

```typescript
useEffect(() => {
  if (newlyTerminal.length > 0) {
    const startTime = performance.now();
    console.log(`[Performance] Terminal detected at ${startTime}ms`);

    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.tickets(projectId),
    });

    // Measure time to refetch completion
    setTimeout(() => {
      const endTime = performance.now();
      console.log(`[Performance] Refetch completed in ${endTime - startTime}ms`);
    }, 100);
  }
}, [newlyTerminal, projectId, queryClient]);
```

**Target**: < 3000ms from terminal detection to UI update

### Monitor API Response Times

Use browser DevTools Performance tab:

```bash
# Record performance profile during workflow completion
# Expected timeline:
# 1. Polling request: ~50-100ms
# 2. Cache invalidation: < 1ms (synchronous)
# 3. Tickets refetch: ~50-100ms
# 4. React re-render: ~10-50ms

# Total: < 200ms for cache update, < 3000ms including polling interval
```

## Manual Testing Checklist

- [ ] Ticket moves from INBOX to BUILD via quick-impl (UI updates automatically)
- [ ] Ticket moves from BUILD to VERIFY via quick-impl (UI updates automatically)
- [ ] Ticket moves from VERIFY to SHIP via auto-ship (UI updates automatically)
- [ ] Manual drag-and-drop still works (optimistic updates)
- [ ] Polling continues when all jobs terminal (stops when expected)
- [ ] Multiple concurrent workflows handled correctly (no race conditions)
- [ ] UI performance acceptable (no visual lag or flicker)
- [ ] Console logs show expected cache invalidation pattern

## Automated Testing

### Run Unit Tests (Vitest)

```bash
# Run all unit tests
bun run test:unit

# Run specific test file
bun run test:unit tests/unit/useJobPolling.test.ts

# Watch mode (auto-rerun on file changes)
bun run test:unit:watch

# UI mode (interactive test runner)
bun run test:unit:ui
```

**Expected Output**:
```
✓ useJobPolling detects newly terminal jobs
✓ useJobPolling invalidates tickets cache on terminal transition
✓ useJobPolling does not invalidate on initial mount
✓ useJobPolling handles multiple terminal jobs simultaneously
```

### Run E2E Tests (Playwright)

```bash
# Run all E2E tests
bun run test:e2e

# Run specific test file
bunx playwright test tests/e2e/real-time/ui-stage-sync.spec.ts

# Headed mode (see browser)
bun run test:e2e:headed

# UI mode (interactive test runner)
bun run test:e2e:ui

# Debug mode (step through tests)
bunx playwright test --debug
```

**Expected Output**:
```
✓ Quick-impl workflow: ticket moves from BUILD to VERIFY automatically
✓ Auto-ship workflow: ticket moves from VERIFY to SHIP automatically
✓ Manual drag-and-drop: remains responsive with polling active
✓ Rapid successive transitions: handled without UI flicker
```

## Git Workflow

### Feature Development

```bash
# Create feature branch (already created)
git checkout -b 076-934-ui-stages

# Make changes
git add app/lib/hooks/useJobPolling.ts
git commit -m "feat: invalidate tickets cache on terminal job status"

# Run tests before pushing
bun test

# Push to remote
git push origin 076-934-ui-stages
```

### Pull Request Checklist

- [ ] All tests pass (`bun test`)
- [ ] Type checking passes (`bun run type-check`)
- [ ] Linting passes (`bun run lint`)
- [ ] Manual testing completed (see checklist above)
- [ ] Performance validated (< 3s UI update latency)
- [ ] Console logs removed (except debug-level logging)
- [ ] CLAUDE.md updated (if needed)

## References

- **Feature Spec**: `specs/076-934-ui-stages/spec.md`
- **Implementation Plan**: `specs/076-934-ui-stages/plan.md`
- **Research Notes**: `specs/076-934-ui-stages/research.md`
- **Data Model**: `specs/076-934-ui-stages/data-model.md`
- **API Contracts**: `specs/076-934-ui-stages/contracts/api-endpoints.md`
- **Polling Hook**: `app/lib/hooks/useJobPolling.ts`
- **Tickets Query**: `app/lib/hooks/queries/useTickets.ts`
- **Board Component**: `components/board/board.tsx`
