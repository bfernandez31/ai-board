# Quickstart Guide: Dual Job Display

**Feature**: 046-dual-job-display
**Date**: 2025-10-23
**For**: Developers implementing this feature

## What This Feature Does

Displays two types of jobs on ticket cards:
1. **Workflow Jobs**: Always visible (specify, plan, implement, quick-impl)
2. **AI-BOARD Jobs**: Visible only when stage matches (comment-specify, comment-plan, etc.)

Jobs show contextual labels:
- `WRITING` - For specification and planning operations
- `CODING` - For implementation operations
- `ASSISTING` - For AI-BOARD assistance
- Original status (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`) for non-RUNNING states

## Prerequisites

- Node.js 22.20.0 LTS
- TypeScript 5.6 strict mode enabled
- Existing ai-board project with Job polling system
- Playwright for testing

## 5-Minute Implementation Overview

### Step 1: Create Utility Functions (15 min)

Create three utility files in `lib/utils/`:

```bash
# 1. Job filtering
lib/utils/job-filtering.ts

# 2. Label transformation
lib/utils/job-label-transformer.ts

# 3. Stage matching
lib/utils/stage-matcher.ts
```

**Key Functions**:
- `getWorkflowJob(jobs: Job[]): Job | null` - Filter workflow jobs
- `getAIBoardJob(jobs: Job[], stage: Stage): Job | null` - Filter AI-BOARD jobs with stage match
- `getContextualLabel(command: string, status: JobStatus): DisplayStatus` - Transform RUNNING to contextual labels
- `matchesStage(command: string, stage: Stage): boolean` - Check AI-BOARD stage match

### Step 2: Update Type Definitions (5 min)

Add to `lib/types/job-types.ts`:

```typescript
export interface DualJobState {
  workflow: Job | null;
  aiBoard: Job | null;
}
```

Add to `lib/utils/job-label-transformer.ts`:

```typescript
export type ContextualLabel = 'WRITING' | 'CODING' | 'ASSISTING';
export type DisplayStatus = JobStatus | ContextualLabel;
```

### Step 3: Update Board Component (10 min)

Modify `components/board/board.tsx`:

```typescript
// Replace getTicketJob with getTicketJobs
const getTicketJobs = useCallback(
  (ticketId: number): DualJobState => {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return { workflow: null, aiBoard: null };

    const ticketJobs = polledJobs.filter(j => j.ticketId === ticketId);
    return {
      workflow: getWorkflowJob(ticketJobs),
      aiBoard: getAIBoardJob(ticketJobs, ticket.stage),
    };
  },
  [polledJobs, allTickets]
);
```

### Step 4: Update TicketCard Component (10 min)

Modify `components/board/ticket-card.tsx`:

```typescript
// Update props interface
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null;  // NEW
  aiBoardJob?: Job | null;   // NEW
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}

// Render both job indicators
{workflowJob && (
  <JobStatusIndicator
    status={workflowJob.status}
    command={workflowJob.command}
    jobType={JobType.WORKFLOW}
    animated={true}
  />
)}

{aiBoardJob && (
  <JobStatusIndicator
    status={aiBoardJob.status}
    command={aiBoardJob.command}
    jobType={JobType.AI_BOARD}
    animated={true}
  />
)}
```

### Step 5: Update JobStatusIndicator (5 min)

Modify `components/board/job-status-indicator.tsx` to use `getContextualLabel()` for displaying transformed labels.

### Step 6: Write Tests (25 min)

**A. Unit Tests (Vitest) - 10 min**

Create fast unit tests for pure functions:

```bash
# tests/unit/job-filtering.test.ts
describe('getWorkflowJob', () => {
  it('returns null for empty array')
  it('filters out comment jobs')
  it('returns most recent by startedAt')
});

describe('getAIBoardJob', () => {
  it('filters comment jobs only')
  it('matches stage correctly')
  it('handles stage mismatch')
});
```

**B. Integration Tests (Playwright) - 10 min**

Extend `tests/integration/tickets/ticket-card-job-status.spec.ts`:
- Dual job display scenarios
- Component rendering verification
- Stage-based visibility

**C. E2E Tests (Playwright) - 5 min**

Create `tests/e2e/dual-job-display.spec.ts`:
- Critical user flows
- Real-time updates
- Error state handling

### Step 7: Update StageColumn (5 min)

Modify `components/board/stage-column.tsx` to pass `getTicketJobs` and use dual job props.

## File Checklist

### New Files (7)
- [ ] `lib/utils/job-filtering.ts`
- [ ] `lib/utils/job-label-transformer.ts`
- [ ] `lib/utils/stage-matcher.ts`
- [ ] `tests/unit/job-filtering.test.ts` ⚡ **Vitest**
- [ ] `tests/unit/job-label-transformer.test.ts` ⚡ **Vitest**
- [ ] `tests/unit/stage-matcher.test.ts` ⚡ **Vitest**
- [ ] `tests/e2e/dual-job-display.spec.ts` 🎭 **Playwright**

### Modified Files (6)
- [ ] `lib/types/job-types.ts` (add DualJobState interface)
- [ ] `components/board/board.tsx` (add getTicketJobs function)
- [ ] `components/board/ticket-card.tsx` (dual job props and rendering)
- [ ] `components/board/job-status-indicator.tsx` (contextual labels)
- [ ] `components/board/stage-column.tsx` (pass dual jobs)
- [ ] `tests/integration/tickets/ticket-card-job-status.spec.ts` (extend - Playwright)

### Configuration Files (1)
- [ ] `vitest.config.ts` (new Vitest configuration)
- [ ] `package.json` (add Vitest scripts and dependencies)

## Testing Commands

```bash
# Setup: Install Vitest
npm install -D vitest @vitest/ui

# Run type checking
npm run type-check

# Run unit tests (fast - Vitest)
npm run test:unit
# or watch mode (runs on every save)
npm run test:unit -- --watch

# Run unit tests with UI
npm run test:unit:ui

# Run Playwright tests (integration + E2E)
npm run test:e2e

# Run specific Playwright test
npx playwright test tests/e2e/dual-job-display.spec.ts

# Run Playwright in UI mode
npm run test:e2e:ui

# Run all tests (unit + integration + E2E)
npm test
```

**Recommended Development Workflow**:
```bash
# Terminal 1: Watch unit tests (instant feedback)
npm run test:unit -- --watch

# Terminal 2: Run dev server
npm run dev

# Before commit: Run all tests
npm test
```

## Common Pitfalls to Avoid

### 1. Forgetting Stage Matching for AI-BOARD Jobs
❌ **Wrong**: Display AI-BOARD job without checking stage
```typescript
const aiBoardJob = jobs.find(j => j.command.startsWith('comment-'));
```

✅ **Correct**: Filter by stage match
```typescript
const aiBoardJob = getAIBoardJob(jobs, ticket.stage);
```

### 2. Transforming Non-RUNNING Statuses
❌ **Wrong**: Transform all statuses
```typescript
if (command === 'specify') return 'WRITING'; // Missing status check
```

✅ **Correct**: Only transform RUNNING status
```typescript
if (status !== 'RUNNING') return status;
if (command === 'specify') return 'WRITING';
```

### 3. Missing Workflow Job Display
❌ **Wrong**: Hide workflow job when AI-BOARD job exists
```typescript
{aiBoardJob || workflowJob && <JobStatusIndicator />}
```

✅ **Correct**: Display both independently
```typescript
{workflowJob && <JobStatusIndicator />}
{aiBoardJob && <JobStatusIndicator />}
```

### 4. Breaking Existing Polling
❌ **Wrong**: Create new polling endpoint
```typescript
const { data } = useQuery('/api/dual-jobs'); // Unnecessary new endpoint
```

✅ **Correct**: Reuse existing polling
```typescript
const { jobs } = useJobPolling(projectId); // Existing hook
```

### 5. Null Handling in Filters
❌ **Wrong**: Return undefined or throw errors
```typescript
function getWorkflowJob(jobs: Job[]) {
  const filtered = jobs.filter(...);
  return filtered[0]; // Returns undefined if empty
}
```

✅ **Correct**: Explicit null return
```typescript
function getWorkflowJob(jobs: Job[]): Job | null {
  const filtered = jobs.filter(...);
  return filtered[0] || null; // Explicit null
}
```

## Debugging Tips

### Issue: AI-BOARD Job Not Visible

**Check**:
1. Job command starts with "comment-"? (`console.log(job.command)`)
2. Stage matches ticket stage? (`console.log(matchesStage(job.command, ticket.stage))`)
3. Most recent AI-BOARD job? (`console.log(jobs.filter(j => j.command.startsWith('comment-')))`)

### Issue: Wrong Label Displayed

**Check**:
1. Status is RUNNING? (`console.log(job.status)`)
2. Command matches mapping? (`console.log(getContextualLabel(job.command, job.status))`)
3. Unknown command fallback working? (Should show original status)

### Issue: Performance Degradation

**Check**:
1. Memoization working? (Use React DevTools Profiler)
2. Unnecessary re-renders? (Check dependency arrays in useCallback)
3. Filter operations efficient? (Should be O(n) with n = 1-3 jobs per ticket)

## Visual Verification Checklist

After implementation, verify these scenarios manually:

- [ ] Ticket in SPECIFY with running "specify" job shows "WRITING" label
- [ ] Ticket in BUILD with running "implement" job shows "CODING" label
- [ ] Ticket in PLAN with "comment-plan" job shows "ASSISTING" label
- [ ] Ticket in PLAN with "comment-specify" job hides AI-BOARD indicator (stage mismatch)
- [ ] Ticket with both jobs shows two distinct indicators (Cog for workflow, MessageSquare for AI-BOARD)
- [ ] Failed jobs show "FAILED" prominently in red (both workflow and AI-BOARD)
- [ ] Completed jobs show "COMPLETED" without transformation
- [ ] Job status updates within 2 seconds when polling detects changes

## Performance Benchmarks

**Expected Performance**:
- Job filtering per ticket: <1ms (O(n) with n=1-3)
- Board rendering with 100 tickets: <50ms total
- Polling update cycle: 2 seconds (existing)
- UI update after job status change: <2 seconds

**Measure With**:
```typescript
console.time('getTicketJobs');
const jobs = getTicketJobs(ticketId);
console.timeEnd('getTicketJobs');
// Expected: 0.1-0.5ms per ticket
```

## Next Steps After Implementation

1. **Code Review**: Ensure all components follow TypeScript strict mode
2. **E2E Testing**: Run full test suite (`npm run test:e2e`)
3. **Manual Testing**: Verify all visual scenarios in checklist above
4. **Performance Testing**: Measure rendering time with 100+ tickets
5. **Accessibility Testing**: Verify aria-labels with screen reader

## References

- **Spec**: `specs/046-dual-job-display/spec.md`
- **Data Model**: `specs/046-dual-job-display/data-model.md`
- **Component Contracts**: `specs/046-dual-job-display/contracts/component-interfaces.md`
- **Research**: `specs/046-dual-job-display/research.md`
- **Existing Code**:
  - Board: `components/board/board.tsx:155-185`
  - TicketCard: `components/board/ticket-card.tsx`
  - JobStatusIndicator: `components/board/job-status-indicator.tsx`
  - Job Types: `lib/types/job-types.ts`

## Questions?

Refer to the detailed planning documents or check existing patterns in the codebase:
- Job filtering pattern: `board.tsx:155-185`
- Job type classification: `lib/utils/job-type-classifier.ts`
- Polling mechanism: `lib/hooks/useJobPolling.ts`
