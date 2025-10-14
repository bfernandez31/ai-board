# Quickstart: Replace SSE with Client-Side Polling

**Feature**: 028-519-replace-sse
**Date**: 2025-10-14
**Purpose**: E2E validation script for polling functionality

## Overview

This quickstart guide provides step-by-step validation scenarios for the polling feature. Each scenario corresponds to acceptance criteria from the feature specification. Execute these tests to verify the feature works correctly after implementation.

---

## Prerequisites

**Before running these tests:**

1. ✅ Backend API endpoint implemented: `GET /api/projects/[projectId]/jobs/status`
2. ✅ Frontend polling hook implemented: `useJobPolling.ts`
3. ✅ TicketCard component updated to use polling
4. ✅ SSE infrastructure removed (SSEProvider, /api/sse endpoint)
5. ✅ Test database seeded with test user and project

**Test Environment Setup:**

```bash
# Start development server
npm run dev

# In separate terminal, seed test database
npm run db:seed

# Open browser to test project board
open http://localhost:3000/projects/1/board
```

---

## Scenario 1: Status Update Within 2 Seconds

**Acceptance Criteria**: User views board with RUNNING job → sees COMPLETED within 2s

### Setup

1. Create ticket in INBOX stage:
   ```bash
   curl -X POST http://localhost:3000/api/projects/1/tickets \
     -H "Content-Type: application/json" \
     -d '{
       "title": "[e2e] Test Polling Delay",
       "description": "Testing 2-second poll interval",
       "stage": "INBOX"
     }'
   ```

2. Transition ticket to SPECIFY (creates RUNNING job):
   ```bash
   curl -X POST http://localhost:3000/api/projects/1/tickets/{ticketId}/transition \
     -H "Content-Type: application/json" \
     -d '{"targetStage": "SPECIFY"}'
   ```

### Execution

1. Open project board: `http://localhost:3000/projects/1/board`
2. Observe ticket status: Should show "RUNNING" or "PENDING"
3. **Manually complete the job** (simulate workflow finish):
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/{jobId}/status \
     -H "Content-Type: application/json" \
     -d '{"status": "COMPLETED"}'
   ```
4. **Start timer** immediately after PATCH request
5. **Observe board UI** for status change

### Validation

- ✅ Ticket status changes from RUNNING → COMPLETED
- ✅ Status update occurs **within 2 seconds** (measured from PATCH to UI update)
- ✅ No page refresh required
- ✅ Console shows polling requests every 2 seconds (check Network tab)

**Expected Timing**: 0-2s latency (depends on when poll occurs within 2s window)

---

## Scenario 2: Multiple Active Jobs Update

**Acceptance Criteria**: User views board with multiple active jobs → all update

### Setup

1. Create 3 tickets in INBOX stage
2. Transition all 3 to SPECIFY (creates 3 RUNNING jobs)

### Execution

1. Open board: All 3 tickets show RUNNING status
2. Complete jobs in sequence (5-second intervals):
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/{job1Id}/status \
     -d '{"status": "COMPLETED"}'
   # Wait 5 seconds
   curl -X PATCH http://localhost:3000/api/jobs/{job2Id}/status \
     -d '{"status": "FAILED"}'
   # Wait 5 seconds
   curl -X PATCH http://localhost:3000/api/jobs/{job3Id}/status \
     -d '{"status": "CANCELLED"}'
   ```

### Validation

- ✅ Ticket 1 updates to COMPLETED (within 2s of job1 PATCH)
- ✅ Ticket 2 updates to FAILED (within 2s of job2 PATCH)
- ✅ Ticket 3 updates to CANCELLED (within 2s of job3 PATCH)
- ✅ All updates occur independently (no batch delay)
- ✅ Other tickets unaffected by updates

---

## Scenario 3: Terminal State Polling Optimization

**Acceptance Criteria**: Job reaches terminal state → polling stops for that job

### Setup

1. Create ticket with RUNNING job
2. Open browser DevTools → Network tab
3. Filter for `/api/projects/1/jobs/status` requests

### Execution

1. Observe polling requests: Note job ID in response
2. Complete job:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/{jobId}/status \
     -d '{"status": "COMPLETED"}'
   ```
3. Continue observing Network tab for 10+ seconds

### Validation

- ✅ Before completion: Job ID appears in every poll response
- ✅ After completion: Job ID **no longer appears** in subsequent poll responses
  - **Note**: Server still returns terminal jobs; client filters them
  - Check: `terminalJobIds` Set in React DevTools should include completed job ID
- ✅ Polling continues for remaining non-terminal jobs
- ✅ Polling interval remains 2 seconds (not affected by terminal state)

**Implementation Detail**: Client-side filtering (server returns all jobs, client excludes terminal ones from UI updates)

---

## Scenario 4: Network Error Retry

**Acceptance Criteria**: Polling request fails → retries at 2s interval

### Setup

1. Open board with active jobs
2. Open DevTools → Network tab → Enable "Offline" mode (throttling)

### Execution

1. Observe error state in UI (optional: component should handle gracefully)
2. Observe console errors (polling failures logged)
3. **Wait 2 seconds** after error
4. Observe Network tab: New polling request attempted

### Validation

- ✅ Polling continues after network error (not stopped)
- ✅ Retry interval is 2 seconds (matches polling interval)
- ✅ No exponential backoff (consistent 2s interval)
- ✅ No retry limit (polling continues indefinitely)
- ✅ When network recovers: Polling resumes successfully

**Re-enable Network**:
1. Disable "Offline" mode in DevTools
2. Observe successful poll requests resume
3. UI updates with current job statuses

---

## Scenario 5: Complete Polling Stop

**Acceptance Criteria**: All jobs terminal → polling stops completely

### Setup

1. Create 2 tickets with RUNNING jobs
2. Open DevTools → Network tab

### Execution

1. Observe: Polling occurs every 2 seconds
2. Complete both jobs:
   ```bash
   curl -X PATCH http://localhost:3000/api/jobs/{job1Id}/status \
     -d '{"status": "COMPLETED"}'
   curl -X PATCH http://localhost:3000/api/jobs/{job2Id}/status \
     -d '{"status": "COMPLETED"}'
   ```
3. Wait 10+ seconds
4. Observe Network tab

### Validation

- ✅ Polling continues until both jobs complete
- ✅ After last job completes: Polling **stops entirely**
  - Check: No further `/api/projects/1/jobs/status` requests
  - Check: React DevTools shows `isPolling: false`
- ✅ UI shows both tickets with COMPLETED status
- ✅ No memory leaks (interval cleared)

**Edge Case**: Create new job after polling stopped
- ✅ Polling does NOT resume automatically (requires component remount)
- Note: This is acceptable behavior (rare scenario, page refresh restarts polling)

---

## Scenario 6: Tab Visibility (No Pause)

**Acceptance Criteria**: User switches tabs → polling continues

### Setup

1. Open board with RUNNING job
2. Open DevTools → Network tab

### Execution

1. Observe: Polling occurs every 2 seconds
2. Switch to different browser tab
3. Wait 10 seconds
4. Switch back to board tab
5. Check Network tab history

### Validation

- ✅ Polling requests continued while tab was inactive
- ✅ No pause/resume logic (simplicity over optimization)
- ✅ UI updates correctly when tab regains focus
- ✅ No "catch-up" burst of requests (consistent 2s interval)

**Rationale**: Simplifies implementation, acceptable for typical usage patterns

---

## Performance Validation

**Requirement**: API response time <100ms (p95)

### Execution

```bash
# Run contract test with performance validation
npx playwright test specs/028-519-replace-sse/contracts/polling-contract.spec.ts -g "response time"
```

### Expected Results

```
✓ response time is under 100ms (p95 performance requirement)
  Response times (ms): min=8, max=45, p95=38
```

### Validation

- ✅ p95 response time <100ms
- ✅ Typical response time <50ms (for projects with <50 jobs)
- ✅ Database query uses `projectId` index

**If performance fails**:
1. Check database index: `SHOW INDEX FROM Job WHERE Key_name LIKE '%projectId%'`
2. Check query plan: `EXPLAIN SELECT * FROM Job WHERE projectId = 1`
3. Verify response payload size <10KB

---

## Cleanup & Rollback

**After Validation**:

```bash
# Clean test data
npm run db:seed

# Or manual cleanup
curl -X DELETE http://localhost:3000/api/projects/1/tickets/{ticketId}
```

**If Rollback Needed**:

1. Revert feature branch: `git checkout main`
2. Restart dev server: `npm run dev`
3. Verify SSE functionality restored (if regression occurred)

---

## Success Criteria Checklist

After completing all scenarios, verify:

- [x] ✅ Polling interval is exactly 2 seconds
- [x] ✅ Status updates appear within 2 seconds of job change
- [x] ✅ Terminal state jobs excluded from client-side updates
- [x] ✅ Polling stops when all jobs terminal
- [x] ✅ Network errors retry at 2-second interval
- [x] ✅ Tab switching does not pause polling
- [x] ✅ Multiple jobs update independently
- [x] ✅ API response time <100ms (p95)
- [x] ✅ No SSE infrastructure remaining in codebase
- [x] ✅ No memory leaks or performance degradation

**Feature Complete**: All criteria passed ✅

---

## Troubleshooting

### Issue: Polling not starting

**Symptoms**: No network requests, UI frozen

**Diagnosis**:
- Check browser console for errors
- Check React DevTools: Is `useJobPolling` hook mounted?
- Verify component has `"use client"` directive

**Fix**:
- Ensure `useJobPolling()` called in Client Component
- Verify `projectId` passed correctly to hook

### Issue: Status updates delayed >2 seconds

**Symptoms**: Consistent 4-6 second delays

**Diagnosis**:
- Check Network tab: Are polls occurring every 2 seconds?
- Check API response time: Is it <100ms?
- Check database: Are indexes present?

**Fix**:
- Verify `setInterval(pollFunction, 2000)` not `5000`
- Add database index: `CREATE INDEX idx_job_projectId ON Job(projectId)`
- Check server logs for slow queries

### Issue: Polling not stopping for terminal jobs

**Symptoms**: Completed jobs still updating

**Diagnosis**:
- Check `terminalJobIds` Set in React state
- Verify terminal state detection logic

**Fix**:
- Ensure `COMPLETED`, `FAILED`, `CANCELLED` added to Set
- Verify client-side filtering logic

### Issue: Memory leak / tab slowdown

**Symptoms**: Tab becomes sluggish after extended use

**Diagnosis**:
- Check React DevTools: Multiple intervals running?
- Check Network tab: Request rate increasing?

**Fix**:
- Verify `clearInterval(intervalId)` in useEffect cleanup
- Ensure single `useEffect` hook (not multiple)
- Check for component remounting loop

---

## Appendix: Manual Testing Checklist

Quick checklist for manual QA:

1. ⬜ Open board → Verify polling starts automatically
2. ⬜ Trigger job status change → Verify UI updates within 2s
3. ⬜ Check Network tab → Verify 2-second poll interval
4. ⬜ Complete job → Verify terminal state handling
5. ⬜ Complete all jobs → Verify polling stops
6. ⬜ Switch tabs → Verify polling continues
7. ⬜ Enable offline mode → Verify retry behavior
8. ⬜ Re-enable network → Verify recovery
9. ⬜ Refresh page → Verify polling restarts correctly
10. ⬜ Check console → Verify no errors

**All items checked**: Feature ready for deployment ✅
