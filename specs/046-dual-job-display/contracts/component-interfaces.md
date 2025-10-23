# Component Interface Contracts: Dual Job Display

**Feature**: 046-dual-job-display
**Date**: 2025-10-23
**Status**: Complete

## Overview

This document defines TypeScript interface contracts for components affected by the dual job display feature. All interfaces use strict TypeScript types and follow the existing codebase patterns.

## Component Contracts

### 1. TicketCard Component

**File**: `components/board/ticket-card.tsx`

#### Props Interface

```typescript
interface DraggableTicketCardProps {
  /**
   * Ticket data with version control
   */
  ticket: TicketWithVersion;

  /**
   * Workflow job (non-comment jobs: specify, plan, implement, quick-impl)
   * Always displayed when present, regardless of ticket stage
   * @optional - No job when null
   */
  workflowJob?: Job | null;

  /**
   * AI-BOARD job (comment-* jobs: comment-specify, comment-plan, etc.)
   * Only displayed when command matches current ticket stage
   * @optional - No job or stage mismatch when null
   */
  aiBoardJob?: Job | null;

  /**
   * Whether the ticket card can be dragged
   * @default true
   */
  isDraggable?: boolean;

  /**
   * Click handler for ticket card
   * @optional - No click behavior when undefined
   */
  onTicketClick?: (ticket: TicketWithVersion) => void;
}
```

#### Display Rules

```typescript
/**
 * Ticket card displays job indicators based on these rules:
 *
 * 1. No Jobs:
 *    - workflowJob=null && aiBoardJob=null → No job indicators
 *
 * 2. Workflow Job Only:
 *    - workflowJob!=null && aiBoardJob=null → Single workflow indicator
 *
 * 3. AI-BOARD Job Only:
 *    - workflowJob=null && aiBoardJob!=null → Single AI-BOARD indicator
 *
 * 4. Both Jobs:
 *    - workflowJob!=null && aiBoardJob!=null → Two indicators (vertical stack)
 *
 * 5. Error States:
 *    - FAILED/CANCELLED status → Red color, prominent display (no masking)
 */
```

#### Example Usage

```tsx
// Scenario 1: Workflow job only
<TicketCard
  ticket={ticket}
  workflowJob={{ id: 1, command: 'specify', status: 'RUNNING', ... }}
  aiBoardJob={null}
/>

// Scenario 2: Both jobs
<TicketCard
  ticket={ticket}
  workflowJob={{ id: 2, command: 'plan', status: 'RUNNING', ... }}
  aiBoardJob={{ id: 3, command: 'comment-plan', status: 'RUNNING', ... }}
/>

// Scenario 3: Error states
<TicketCard
  ticket={ticket}
  workflowJob={{ id: 4, command: 'implement', status: 'FAILED', ... }}
  aiBoardJob={{ id: 5, command: 'comment-build', status: 'FAILED', ... }}
/>
```

---

### 2. JobStatusIndicator Component

**File**: `components/board/job-status-indicator.tsx`

#### Props Interface (Updated)

```typescript
export interface JobStatusIndicatorProps {
  /**
   * Current job status to display
   * May be transformed to contextual label for RUNNING status
   */
  status: JobStatus;

  /**
   * Job command for contextual label transformation
   * @example "specify", "plan", "implement", "comment-specify"
   */
  command: string;

  /**
   * Job type for visual distinction
   * @optional - No job type indicator when undefined
   */
  jobType?: JobType;

  /**
   * Optional CSS class name for styling
   */
  className?: string;

  /**
   * Whether to show animation (for RUNNING status)
   * @default true
   */
  animated?: boolean;

  /**
   * Accessibility label for screen readers
   * @optional - Auto-generated from status and command if not provided
   */
  ariaLabel?: string;
}
```

#### Contextual Label Transformation

```typescript
/**
 * Label transformation rules for RUNNING status:
 *
 * command === "specify" || command === "plan"
 *   → Display "WRITING"
 *
 * command === "implement" || command === "quick-impl"
 *   → Display "CODING"
 *
 * command.startsWith("comment-")
 *   → Display "ASSISTING"
 *
 * status !== "RUNNING"
 *   → Display status as-is (PENDING, COMPLETED, FAILED, CANCELLED)
 *
 * Unknown command with RUNNING status
 *   → Display "RUNNING" (fallback)
 */
```

#### Visual Configuration

```typescript
/**
 * Job type visual distinction:
 *
 * JobType.WORKFLOW:
 *   - Icon: Cog (from lucide-react)
 *   - Color: Blue (text-blue-600, bg-blue-100)
 *   - Label: "Workflow"
 *
 * JobType.AI_BOARD:
 *   - Icon: MessageSquare (from lucide-react)
 *   - Color: Purple (text-purple-600, bg-purple-100)
 *   - Label: "AI-BOARD"
 */
```

#### Example Usage

```tsx
// Workflow job with WRITING label
<JobStatusIndicator
  status="RUNNING"
  command="specify"
  jobType={JobType.WORKFLOW}
  animated={true}
/>
// Displays: 🖊️ WRITING [Cog icon] Workflow

// AI-BOARD job with ASSISTING label
<JobStatusIndicator
  status="RUNNING"
  command="comment-plan"
  jobType={JobType.AI_BOARD}
  animated={true}
/>
// Displays: 🖊️ ASSISTING [MessageSquare icon] AI-BOARD

// Error state (no transformation)
<JobStatusIndicator
  status="FAILED"
  command="implement"
  jobType={JobType.WORKFLOW}
  animated={false}
/>
// Displays: ❌ FAILED [Cog icon] Workflow
```

---

### 3. Board Component

**File**: `components/board/board.tsx`

#### New Function: getTicketJobs

```typescript
/**
 * Get both workflow and AI-BOARD jobs for a specific ticket
 *
 * @param ticketId - Ticket ID to filter jobs
 * @returns DualJobState with workflow and aiBoard jobs (or null if not found)
 *
 * @example
 * const { workflow, aiBoard } = getTicketJobs(123);
 */
const getTicketJobs = useCallback(
  (ticketId: number): DualJobState => {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) {
      return { workflow: null, aiBoard: null };
    }

    const ticketJobs = polledJobs.filter(j => j.ticketId === ticketId);

    return {
      workflow: getWorkflowJob(ticketJobs),
      aiBoard: getAIBoardJob(ticketJobs, ticket.stage),
    };
  },
  [polledJobs, allTickets]
);
```

#### Return Type

```typescript
interface DualJobState {
  /**
   * Most recent workflow job (command NOT LIKE 'comment-%')
   * Always visible when present
   */
  workflow: Job | null;

  /**
   * Most recent AI-BOARD job (command LIKE 'comment-%')
   * Filtered by stage match (e.g., comment-specify → SPECIFY stage only)
   */
  aiBoard: Job | null;
}
```

---

### 4. StageColumn Component

**File**: `components/board/stage-column.tsx`

#### Props Interface (Updated)

```typescript
export interface StageColumnProps {
  stage: Stage;
  tickets: TicketWithVersion[];
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  projectId: number;

  /**
   * Function to get dual jobs for a ticket
   * Replaces old getTicketJob function
   */
  getTicketJobs?: (ticketId: number) => DualJobState;

  dropZoneStyle?: string;
  isBlockedByJob?: boolean;
}
```

#### Usage Update

```tsx
// OLD (deprecated):
<TicketCard
  currentJob={getTicketJob?.(ticket.id) || null}
/>

// NEW:
{(() => {
  const { workflow, aiBoard } = getTicketJobs?.(ticket.id) || { workflow: null, aiBoard: null };
  return (
    <TicketCard
      workflowJob={workflow}
      aiBoardJob={aiBoard}
    />
  );
})()}
```

---

## Utility Function Contracts

### 1. Job Filtering Functions

**File**: `lib/utils/job-filtering.ts`

```typescript
/**
 * Get most recent workflow job (command NOT LIKE 'comment-%')
 *
 * @param jobs - Array of jobs to filter
 * @returns Most recent workflow job or null if none found
 *
 * @example
 * const workflowJob = getWorkflowJob([job1, job2, job3]);
 */
export function getWorkflowJob(jobs: Job[]): Job | null;

/**
 * Get most recent AI-BOARD job matching current ticket stage
 *
 * @param jobs - Array of jobs to filter
 * @param currentStage - Current ticket stage for matching
 * @returns Most recent AI-BOARD job with matching stage or null
 *
 * @example
 * const aiBoardJob = getAIBoardJob([job1, job2], Stage.SPECIFY);
 */
export function getAIBoardJob(jobs: Job[], currentStage: Stage): Job | null;
```

### 2. Label Transformation Function

**File**: `lib/utils/job-label-transformer.ts`

```typescript
/**
 * Contextual label type for RUNNING status transformation
 */
export type ContextualLabel = 'WRITING' | 'CODING' | 'ASSISTING';

/**
 * Display status type (original status or contextual label)
 */
export type DisplayStatus = JobStatus | ContextualLabel;

/**
 * Transform job status to contextual label for RUNNING status
 *
 * @param command - Job command string
 * @param status - Current job status
 * @returns Original status or contextual label
 *
 * @example
 * getContextualLabel('specify', 'RUNNING') // Returns: 'WRITING'
 * getContextualLabel('implement', 'COMPLETED') // Returns: 'COMPLETED'
 */
export function getContextualLabel(
  command: string,
  status: JobStatus
): DisplayStatus;
```

### 3. Stage Matching Function

**File**: `lib/utils/stage-matcher.ts`

```typescript
/**
 * Check if AI-BOARD job command matches current ticket stage
 *
 * @param command - Job command string (e.g., "comment-specify")
 * @param currentStage - Current ticket stage enum
 * @returns true if command suffix matches stage, false otherwise
 *
 * @example
 * matchesStage('comment-specify', Stage.SPECIFY) // Returns: true
 * matchesStage('comment-specify', Stage.PLAN) // Returns: false
 * matchesStage('specify', Stage.SPECIFY) // Returns: false (not AI-BOARD)
 */
export function matchesStage(command: string, currentStage: Stage): boolean;
```

---

## Type Definitions

### Existing Types (No Changes)

```typescript
// From @prisma/client
enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

enum Stage {
  INBOX = 'INBOX',
  SPECIFY = 'SPECIFY',
  PLAN = 'PLAN',
  BUILD = 'BUILD',
  VERIFY = 'VERIFY',
  SHIP = 'SHIP',
}

// From lib/types/job-types.ts (existing)
enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
}
```

### New Types

```typescript
// lib/types/job-types.ts (new additions)
export interface DualJobState {
  workflow: Job | null;
  aiBoard: Job | null;
}

// lib/utils/job-label-transformer.ts (new)
export type ContextualLabel = 'WRITING' | 'CODING' | 'ASSISTING';
export type DisplayStatus = JobStatus | ContextualLabel;
```

---

## Validation Rules

### Prop Validation

All props are validated by TypeScript strict mode at compile time. No runtime validation is required for type safety.

### Display Validation

```typescript
/**
 * Job display validation rules:
 *
 * 1. Workflow Job Visibility: Always display when workflowJob !== null
 * 2. AI-BOARD Job Visibility: Display only when aiBoardJob !== null AND stage matches
 * 3. Dual Display: Both jobs can be visible simultaneously
 * 4. Error Prominence: FAILED/CANCELLED always visible (never masked)
 * 5. Real-time Updates: Jobs update within 2 seconds via polling
 */
```

---

## Accessibility

### ARIA Labels

```typescript
// JobStatusIndicator auto-generates aria-label
const statusLabel = ariaLabel || `Job ${command} is ${status.toLowerCase()}`;
const jobTypeLabel = jobTypeConfig ? `. ${jobTypeConfig.ariaLabel}` : '';
const finalAriaLabel = `${statusLabel}${jobTypeLabel}`;

/**
 * Examples:
 * - "Job specify is running. Automated workflow job"
 * - "Job comment-plan is running. AI-BOARD assistance job"
 * - "Job implement is failed. Automated workflow job"
 */
```

### Keyboard Navigation

No changes to keyboard navigation. Existing drag-and-drop keyboard support remains unchanged.

---

## Performance Characteristics

### Rendering Performance

```typescript
/**
 * Component memoization:
 * - TicketCard: React.memo (existing)
 * - JobStatusIndicator: Functional component (no memo needed - minimal props)
 *
 * Callback memoization:
 * - getTicketJobs: useCallback with [polledJobs, allTickets] dependencies
 * - Job filtering functions: Pure functions (no state, inherently memoized by JS engine)
 */
```

### Time Complexity

```typescript
/**
 * getWorkflowJob(jobs): O(n) where n = jobs.length (typically 1-3)
 * getAIBoardJob(jobs, stage): O(n) where n = jobs.length (typically 1-3)
 * getTicketJobs(ticketId): O(m + n) where m = tickets.length, n = jobs.length
 *
 * Overall board rendering: O(t * j) where t = tickets.length, j = avg jobs per ticket
 * With 100 tickets and 2 jobs each: 200 filter operations (~1-2ms total)
 */
```

---

## Testing Contracts (Hybrid: Vitest + Playwright)

### Unit Tests (Vitest - Fast, Isolated)

Location: `tests/unit/`

**Performance**: ~45ms total for 45 test cases (~1ms per test)

```typescript
// tests/unit/job-filtering.test.ts
describe('getWorkflowJob', () => {
  it('returns null for empty array')
  it('returns null when only comment jobs exist')
  it('filters out comment jobs correctly')
  it('returns most recent workflow job by startedAt')
  it('handles single workflow job')
  it('handles multiple workflow jobs')
});

describe('getAIBoardJob', () => {
  it('returns null for empty array')
  it('returns null when no comment jobs exist')
  it('filters workflow jobs out')
  it('returns most recent AI-BOARD job by startedAt')
  it('filters by stage match - SPECIFY')
  it('filters by stage match - PLAN')
  it('returns null for stage mismatch')
  it('handles case-insensitive stage matching')
});

// tests/unit/job-label-transformer.test.ts
describe('getContextualLabel', () => {
  it('returns WRITING for specify command with RUNNING status')
  it('returns WRITING for plan command with RUNNING status')
  it('returns CODING for implement command with RUNNING status')
  it('returns CODING for quick-impl command with RUNNING status')
  it('returns ASSISTING for comment-* commands with RUNNING status')
  it('returns original status for non-RUNNING statuses')
  it('handles unknown commands by returning original status')
});

// tests/unit/stage-matcher.test.ts
describe('matchesStage', () => {
  it('returns true for comment-specify matching SPECIFY')
  it('returns true for comment-plan matching PLAN')
  it('returns false for comment-specify not matching PLAN')
  it('returns false for non-comment commands')
  it('handles case-insensitive matching')
});
```

### E2E Tests (Playwright - Critical User Flows)

Location: `tests/e2e/dual-job-display.spec.ts`

**Performance**: ~6s total for 3 critical scenarios (~2s per test)

```typescript
/**
 * Full user flow tests with real browser interaction:
 *
 * 1. User creates ticket and drags to SPECIFY → Workflow job displays "WRITING"
 * 2. User mentions @ai-board in SPECIFY ticket → AI-BOARD job displays "ASSISTING"
 * 3. Ticket with both jobs → Two indicators visible with distinct icons/colors
 */
```

### Integration Tests (Playwright - Component Behavior)

Location: `tests/integration/tickets/ticket-card-job-status.spec.ts`

**Performance**: ~3s total for 6 scenarios (~500ms per test)

```typescript
/**
 * Component rendering tests with DOM verification:
 *
 * 1. Workflow job only → Single indicator visible in DOM
 * 2. AI-BOARD job (stage match) → Single indicator visible in DOM
 * 3. AI-BOARD job (stage mismatch) → AI-BOARD indicator not in DOM
 * 4. Both jobs → Two indicators with data-testid attributes
 * 5. Error states → Red color classes and error icons present
 * 6. Contextual labels → "WRITING", "CODING", "ASSISTING" text in DOM
 */
```

### Test Data Setup

```typescript
/**
 * Vitest test data (in-memory):
 *
 * const mockJob = (id: number, command: string, status: JobStatus): Job => ({
 *   id, command, status,
 *   startedAt: new Date(),
 *   ticketId: 1,
 *   projectId: 1,
 *   // ... other required fields
 * });
 */

/**
 * Playwright fixtures (database):
 *
 * 1. createTicketWithWorkflowJob(stage, command, status)
 * 2. createTicketWithAIBoardJob(stage, command, status)
 * 3. createTicketWithDualJobs(stage, workflowCommand, aiBoardCommand)
 * 4. waitForJobPolling() → Wait for 2-second polling cycle
 */
```

### Test Performance Summary

| Test Type | Tool | Count | Total Time | Per Test |
|-----------|------|-------|------------|----------|
| Unit | Vitest | 45 | ~45ms | ~1ms |
| Integration | Playwright | 6 | ~3s | ~500ms |
| E2E | Playwright | 3 | ~6s | ~2s |
| **Total** | | **54** | **~9s** | |

**vs. Playwright Only**: 54 tests × ~500ms = ~27s (66% faster with hybrid approach)

---

## References

- Spec: `specs/046-dual-job-display/spec.md`
- Data Model: `specs/046-dual-job-display/data-model.md`
- Research: `specs/046-dual-job-display/research.md`
- Existing Job Types: `lib/types/job-types.ts`
- Existing TicketCard: `components/board/ticket-card.tsx`
