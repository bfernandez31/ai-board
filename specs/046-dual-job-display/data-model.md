# Data Model: Dual Job Display

**Feature**: 046-dual-job-display
**Date**: 2025-10-23
**Status**: Complete

## Overview

This feature uses the existing Job entity with no schema changes. The data model focuses on client-side data structures for job classification, filtering, and display state management.

## Existing Entities

### Job (Database Schema - No Changes)

Existing Prisma schema from `prisma/schema.prisma`:

```prisma
model Job {
  id          Int       @id @default(autoincrement())
  ticketId    Int
  command     String    @db.VarChar(50)
  status      JobStatus @default(PENDING)
  branch      String?   @db.VarChar(200)
  commitSha   String?   @db.VarChar(40)
  logs        String?
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime
  projectId   Int
  ticket      Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([startedAt])
  @@index([status])
  @@index([ticketId])
  @@index([ticketId, status, startedAt])
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}
```

**Relevant Fields**:
- `command`: Distinguishes workflow jobs (e.g., "specify", "plan") from AI-BOARD jobs (e.g., "comment-specify")
- `status`: Current job state, transformed to contextual labels for RUNNING status
- `startedAt`: Used for sorting to get most recent job (DESC order)
- `ticketId`: Foreign key for job filtering per ticket

**Existing Indexes** (leveraged by feature):
- `@@index([ticketId, status, startedAt])` - Composite index for efficient job filtering

## New Client-Side Types

### 1. JobType Enum (Existing - Updated)

Location: `lib/types/job-types.ts`

```typescript
export enum JobType {
  WORKFLOW = 'WORKFLOW',
  AI_BOARD = 'AI_BOARD',
}
```

**Purpose**: Classify jobs into two display categories
**Update**: Already exists in codebase, no changes needed

### 2. ContextualLabel Type (New)

Location: `lib/utils/job-label-transformer.ts`

```typescript
export type ContextualLabel = 'WRITING' | 'CODING' | 'ASSISTING';

export type DisplayStatus = JobStatus | ContextualLabel;
```

**Purpose**: Type-safe representation of transformed status labels
**Rationale**: RUNNING status maps to contextual labels; other statuses remain as JobStatus enum values

### 3. DualJobState Type (New)

Location: `lib/types/job-types.ts`

```typescript
export interface DualJobState {
  workflow: Job | null;
  aiBoard: Job | null;
}
```

**Purpose**: Structured container for both job types per ticket
**Usage**: Return type from job filtering functions in Board component

### 4. TicketCardProps Update (Modified)

Location: `components/board/ticket-card.tsx`

```typescript
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null;    // NEW: Replaces currentJob
  aiBoardJob?: Job | null;     // NEW: AI-BOARD job
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}
```

**Changes**:
- Deprecate: `currentJob?: Job | null` (old single-job prop)
- Add: `workflowJob?: Job | null` (workflow job)
- Add: `aiBoardJob?: Job | null` (AI-BOARD job)

**Migration Strategy**: Both old and new props supported during transition, then remove `currentJob` after all consumers updated

## Data Transformations

### 1. Job Classification

**Input**: Array of Job objects for a ticket
**Output**: Classified as WORKFLOW or AI_BOARD based on command prefix

```typescript
function classifyJob(job: Job): JobType {
  return job.command.startsWith('comment-')
    ? JobType.AI_BOARD
    : JobType.WORKFLOW;
}
```

**Validation Rules**:
- Any command NOT starting with "comment-" → WORKFLOW
- Any command starting with "comment-" → AI_BOARD
- Empty commands → WORKFLOW (defensive default)

### 2. Workflow Job Filtering

**Input**: Job[], Ticket
**Output**: Most recent workflow job (Job | null)

```typescript
function getWorkflowJob(jobs: Job[]): Job | null {
  const workflowJobs = jobs.filter(job => !job.command.startsWith('comment-'));
  return workflowJobs.sort((a, b) =>
    b.startedAt.getTime() - a.startedAt.getTime()
  )[0] || null;
}
```

**Business Rules** (from FR-003):
- Filter: `command NOT LIKE 'comment-%'`
- Sort: `ORDER BY startedAt DESC`
- Limit: Take first result (most recent)

### 3. AI-BOARD Job Filtering

**Input**: Job[], Ticket (with current stage)
**Output**: Most recent AI-BOARD job matching stage (Job | null)

```typescript
function getAIBoardJob(jobs: Job[], currentStage: Stage): Job | null {
  const aiBoardJobs = jobs
    .filter(job => job.command.startsWith('comment-'))
    .filter(job => matchesStage(job.command, currentStage));

  return aiBoardJobs.sort((a, b) =>
    b.startedAt.getTime() - a.startedAt.getTime()
  )[0] || null;
}
```

**Business Rules** (from FR-004, FR-009):
- Filter: `command LIKE 'comment-%'`
- Stage match: Extract suffix from command, compare with ticket stage
- Sort: `ORDER BY startedAt DESC`
- Limit: Take first result (most recent)

### 4. Status Label Transformation

**Input**: Job (with command and status)
**Output**: DisplayStatus (JobStatus or ContextualLabel)

```typescript
function getContextualLabel(job: Job): DisplayStatus {
  if (job.status !== 'RUNNING') {
    return job.status; // No transformation for non-RUNNING
  }

  const labelMap: Record<string, ContextualLabel> = {
    'specify': 'WRITING',
    'plan': 'WRITING',
    'implement': 'CODING',
    'quick-impl': 'CODING',
  };

  if (job.command in labelMap) {
    return labelMap[job.command];
  }

  if (job.command.startsWith('comment-')) {
    return 'ASSISTING';
  }

  return job.status; // Unknown commands keep original status
}
```

**Business Rules** (from FR-005, FR-006):
- RUNNING + (specify | plan) → WRITING
- RUNNING + (implement | quick-impl) → CODING
- RUNNING + comment-* → ASSISTING
- Non-RUNNING statuses → Pass through unchanged
- Unknown commands → Pass through status

### 5. Stage Matching

**Input**: Command string, Current Stage enum
**Output**: Boolean (matches or not)

```typescript
function matchesStage(command: string, currentStage: Stage): boolean {
  if (!command.startsWith('comment-')) {
    return false;
  }

  const stageSuffix = command.replace('comment-', '').toUpperCase();
  return stageSuffix === currentStage;
}
```

**Business Rules** (from FR-009):
- Extract stage from command suffix (e.g., "comment-specify" → "SPECIFY")
- Case-insensitive comparison with current ticket stage
- Only AI-BOARD commands (starting with "comment-") can match

## State Management

### Client-Side State (TanStack Query)

The feature integrates with existing job polling managed by TanStack Query:

**Existing Query** (no changes):
- Hook: `useJobPolling(projectId)`
- Polling interval: 2 seconds
- Query key: `['jobs', projectId]`
- Returns: `{ jobs: Job[], isPolling: boolean, error: Error | null }`

**Derived State** (new):
```typescript
const getTicketJobs = useCallback(
  (ticketId: number): DualJobState => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return { workflow: null, aiBoard: null };

    const ticketJobs = jobs.filter(j => j.ticketId === ticketId);

    return {
      workflow: getWorkflowJob(ticketJobs),
      aiBoard: getAIBoardJob(ticketJobs, ticket.stage),
    };
  },
  [jobs, tickets]
);
```

**Performance Characteristics**:
- O(n) filtering per ticket where n = total jobs on board
- Memoized with useCallback to prevent unnecessary recalculations
- Polling-based real-time updates (no WebSocket overhead)

## Validation Rules

### Job Existence Validation

```typescript
// FR-001: Display workflow job when it exists
if (workflowJob !== null) {
  // Render workflow job indicator
}

// FR-002: Display AI-BOARD job only when exists AND matches stage
if (aiBoardJob !== null && matchesStage(aiBoardJob.command, ticket.stage)) {
  // Render AI-BOARD job indicator
}
```

### Error State Validation

```typescript
// FR-011: Always display error states prominently
function isErrorState(status: JobStatus): boolean {
  return status === 'FAILED' || status === 'CANCELLED';
}

// Both error states must be visible simultaneously (FR-008)
const hasWorkflowError = workflowJob && isErrorState(workflowJob.status);
const hasAIBoardError = aiBoardJob && isErrorState(aiBoardJob.status);
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────┐
│ useJobPolling Hook (TanStack Query)             │
│ - Polls every 2s: GET /api/projects/:id/jobs    │
│ - Returns: Job[]                                 │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ Board Component                                  │
│ - Filters jobs by ticketId                      │
│ - Calls getWorkflowJob(jobs)                    │
│ - Calls getAIBoardJob(jobs, ticket.stage)       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│ TicketCard Component                             │
│ Props: { workflowJob, aiBoardJob }              │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ JobStatusIndicator    │ JobStatusIndicator│
│ Job: workflowJob │    │ Job: aiBoardJob  │
│ Label: WRITING/  │    │ Label: ASSISTING │
│        CODING    │    │                  │
└──────────────────┘    └──────────────────┘
```

## Migration Strategy

### Phase 1: Add Dual Job Support (Backwards Compatible)

```typescript
// TicketCard accepts both old and new props
interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  currentJob?: Job | null;      // OLD (deprecated)
  workflowJob?: Job | null;     // NEW
  aiBoardJob?: Job | null;      // NEW
  // ... other props
}

// Internal logic prioritizes new props
const effectiveWorkflowJob = workflowJob ?? currentJob;
```

### Phase 2: Update Board Component Callers

```typescript
// Before:
<TicketCard
  currentJob={getTicketJob(ticket.id)}
/>

// After:
<TicketCard
  workflowJob={getTicketJobs(ticket.id).workflow}
  aiBoardJob={getTicketJobs(ticket.id).aiBoard}
/>
```

### Phase 3: Remove Deprecated Props

After all consumers updated, remove `currentJob` prop and fallback logic.

## Testing Data

### Test Scenarios

1. **Workflow Job Only**:
   - Input: Job(id=1, command="specify", status=RUNNING)
   - Expected: workflowJob=Job#1, aiBoardJob=null, Label="WRITING"

2. **AI-BOARD Job Only (Stage Match)**:
   - Input: Job(id=2, command="comment-specify", status=RUNNING), Ticket(stage=SPECIFY)
   - Expected: workflowJob=null, aiBoardJob=Job#2, Label="ASSISTING"

3. **AI-BOARD Job (Stage Mismatch)**:
   - Input: Job(id=3, command="comment-specify", status=RUNNING), Ticket(stage=PLAN)
   - Expected: workflowJob=null, aiBoardJob=null (hidden due to stage mismatch)

4. **Both Jobs (Dual Display)**:
   - Input: Job(id=4, command="plan", status=RUNNING), Job(id=5, command="comment-plan", status=RUNNING), Ticket(stage=PLAN)
   - Expected: workflowJob=Job#4, aiBoardJob=Job#5, Both visible with distinct labels

5. **Error States**:
   - Input: Job(id=6, command="implement", status=FAILED), Job(id=7, command="comment-build", status=FAILED)
   - Expected: Both error indicators visible with "FAILED" status (no transformation)

## References

- Spec: `specs/046-dual-job-display/spec.md`
- Research: `specs/046-dual-job-display/research.md`
- Existing Schema: `prisma/schema.prisma`
- Job Types: `lib/types/job-types.ts`
