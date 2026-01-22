# Research: Project Activity Feed

**Feature**: AIB-177-project-activity-feed
**Date**: 2026-01-22

## Research Topics

### 1. Event Type Derivation Strategy

**Question**: How to derive 8 event types from existing tables without schema changes?

**Decision**: Use a unified query approach combining jobs, comments, and tickets with computed event types.

**Rationale**:
- Jobs table provides: job started, job completed, job failed, PR created (verify command), preview deployed (deploy-preview command)
- Comments table provides: comment posted events
- Tickets table provides: ticket created events
- Stage changes can be derived from job completions (specify → PLAN, plan → BUILD, etc.)

**Event Derivation Map**:
| Event Type | Source Table | Derivation Logic |
|------------|--------------|------------------|
| ticket_created | tickets | `createdAt` timestamp |
| stage_changed | jobs | Job completion triggers stage change (command → next stage) |
| comment_posted | comments | `createdAt` timestamp |
| job_started | jobs | `startedAt` timestamp, status != PENDING |
| job_completed | jobs | `completedAt` timestamp, status = COMPLETED |
| job_failed | jobs | `completedAt` timestamp, status = FAILED |
| pr_created | jobs | command = 'verify', status = COMPLETED |
| preview_deployed | jobs | command = 'deploy-preview', status = COMPLETED |

**Alternatives Considered**:
1. **Create events table**: Rejected - adds schema complexity, requires migration, spec explicitly states "derive from existing data"
2. **Use job command to infer all events**: Rejected - loses ticket creation and comment events
3. **Store events in JSON field**: Rejected - not query-efficient, loses relational integrity

---

### 2. Stage Change Detection

**Question**: How to detect stage changes without audit logging?

**Decision**: Derive stage changes from job command completions using a command-to-stage mapping.

**Rationale**: Each job command completion implies a stage transition in the workflow:

```typescript
const COMMAND_STAGE_TRANSITIONS: Record<string, { from: string; to: string }> = {
  'specify': { from: 'INBOX', to: 'SPECIFY' },
  'plan': { from: 'SPECIFY', to: 'PLAN' },
  'implement': { from: 'PLAN', to: 'BUILD' },
  'quick-impl': { from: 'INBOX', to: 'BUILD' },
  'verify': { from: 'BUILD', to: 'VERIFY' },
  'deploy-preview': { from: 'VERIFY', to: 'VERIFY' }, // No stage change
  'clean': { from: 'TRIGGERED', to: 'BUILD' },
};
```

**Note**: Not all job completions trigger stage changes. Only show stage_changed events for jobs that actually advance the workflow stage (successful completion with stage-advancing commands).

**Alternatives Considered**:
1. **Add deletedAt/previousStage to tickets**: Rejected - requires schema migration
2. **Query ticket history via updatedAt**: Rejected - doesn't capture actual stage transitions, only last update
3. **Track all job completions as stage changes**: Rejected - creates noise (failed jobs, repeated jobs)

---

### 3. Pagination Strategy

**Question**: Offset vs cursor-based pagination for activity feed?

**Decision**: Use cursor-based pagination with composite cursor (timestamp + id).

**Rationale**:
- Activity feeds can have new events added frequently (15-second polling)
- Offset pagination breaks when new items are added (items shift, causing duplicates or gaps)
- Cursor-based pagination is stable - always returns items after the cursor regardless of new additions
- Composite cursor (timestamp + id) handles events with identical timestamps

**Implementation**:
```typescript
interface PaginationCursor {
  timestamp: string; // ISO 8601
  id: string;        // UUID of last event
}

// API: /api/projects/[projectId]/activity?cursor={base64EncodedCursor}&limit=50
// First request: no cursor (gets newest 50)
// Load more: pass cursor from last event
```

**Alternatives Considered**:
1. **Offset pagination**: Rejected - unstable with real-time additions, spec mentions "Load more" should append without replacing
2. **Page numbers**: Rejected - same issue as offset
3. **Timestamp-only cursor**: Rejected - multiple events can have same timestamp (job start + complete in same second)

---

### 4. Actor Identification

**Question**: How to identify actors for each event type?

**Decision**: Use a layered identification strategy based on event source.

**Rationale**: Different event types have different actor sources:

| Event Type | Actor Source | Fallback |
|------------|--------------|----------|
| ticket_created | Ticket has no direct userId - use first comment author or show project owner | "[System]" |
| comment_posted | comment.userId → user record | "[Deleted user]" |
| job_started/completed/failed | If job is AI-triggered (command like 'comment-*'), show "AI-BOARD"; otherwise derive from context | "AI-BOARD" |
| stage_changed | Same as job (derived from job that caused stage change) | "AI-BOARD" |
| pr_created | AI-BOARD (verify workflow) | "AI-BOARD" |
| preview_deployed | AI-BOARD (deploy-preview workflow) | "AI-BOARD" |

**AI-BOARD Detection**:
- Jobs triggered by workflows (not manual UI actions) are attributed to AI-BOARD
- Comment jobs (comment-specify, comment-plan, etc.) are always AI-BOARD
- Standard workflow jobs (specify, plan, implement, verify) are AI-BOARD

**Alternatives Considered**:
1. **Add actorId to jobs table**: Rejected - requires schema change
2. **Always show AI-BOARD for all jobs**: Too simplistic - loses human attribution for manual actions
3. **Show "Unknown" for ambiguous events**: Rejected - poor UX

---

### 5. Event Merging and Sorting

**Question**: How to efficiently merge events from multiple tables into a sorted timeline?

**Decision**: Query tables in parallel, transform to common ActivityEvent type, merge and sort in JavaScript.

**Rationale**: Following existing pattern from `mergeConversationEvents` utility:

```typescript
// Parallel queries (Promise.all)
const [jobs, comments, tickets] = await Promise.all([
  prisma.job.findMany({ where: { ticket: { projectId }, startedAt: { gte: thirtyDaysAgo } } }),
  prisma.comment.findMany({ where: { ticket: { projectId }, createdAt: { gte: thirtyDaysAgo } } }),
  prisma.ticket.findMany({ where: { projectId, createdAt: { gte: thirtyDaysAgo } } }),
]);

// Transform each to ActivityEvent[]
// Merge all arrays
// Sort by timestamp DESC
// Apply cursor-based pagination
```

**Performance Considerations**:
- Parallel queries reduce latency
- 30-day filter limits result set
- Database indexes exist on: jobs[projectId, startedAt], comments[ticketId, createdAt], tickets[projectId, createdAt]
- Sorting in JS is fast for expected data size (<1000 events per 30 days)

**Alternatives Considered**:
1. **Single complex SQL query with UNION**: Possible but harder to maintain, types lose clarity
2. **Materialized view**: Rejected - adds schema complexity, requires refresh logic
3. **Stream processing**: Overkill for expected volume

---

### 6. Relative Timestamp Display

**Question**: How to display relative timestamps with absolute on hover?

**Decision**: Use `formatDistanceToNow` from date-fns with native HTML `title` attribute for hover.

**Rationale**: Matches existing patterns in codebase:
```typescript
import { formatDistanceToNow } from 'date-fns';

const relativeTime = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });
// "2 hours ago", "3 days ago", etc.

// HTML: <time title={absoluteTime}>{relativeTime}</time>
```

**Alternatives Considered**:
1. **Custom relative time function**: Exists in codebase but inconsistent; date-fns is standard
2. **Tooltip component**: Adds complexity for simple hover text; native title is sufficient

---

### 7. Ticket Reference Handling

**Question**: How to handle ticket references for deleted tickets?

**Decision**: Query tickets at render time; missing tickets show disabled links.

**Rationale**:
- Events store ticketId as foreign key
- If ticket is deleted (hard delete in current schema), query returns null
- UI shows ticket key as plain text instead of clickable link
- No need to track deletion events (out of scope per spec)

**Implementation**:
```typescript
interface TicketReference {
  id: number;
  ticketKey: string;
  title: string;
  exists: boolean; // false if ticket was deleted
}
```

**Alternatives Considered**:
1. **Soft deletes**: Rejected - requires schema migration, spec says out of scope
2. **Store ticket data in event**: Rejected - data denormalization, stale data issues
3. **Hide events for deleted tickets**: Rejected - loses historical context

---

### 8. Empty State and Error Handling

**Question**: How to handle empty projects and error states?

**Decision**: Follow existing patterns from analytics dashboard.

**Empty State**:
- Message: "No activity yet. Events will appear here as work progresses."
- Icon: Activity icon (lucide-react)
- No action button (activity generates automatically)

**Error States**:
- Network error during polling: Silent retry on next interval (15 seconds)
- Initial load failure: Show error message with retry button
- Authorization failure: Redirect to projects list with toast

**Rationale**: Matches spec edge cases and existing UX patterns.

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| Event derivation | Combine jobs + comments + tickets queries, compute event types |
| Stage changes | Derive from job command completions with stage mapping |
| Pagination | Cursor-based with composite (timestamp + id) |
| Actor identification | Layered: userId for comments, AI-BOARD for workflow jobs |
| Event merging | Parallel queries, JS transform and sort |
| Timestamps | formatDistanceToNow + native title for hover |
| Deleted tickets | Show disabled link, query at render time |
| Empty/error states | Follow analytics dashboard patterns |

## Open Items

None - all clarifications resolved through codebase research.
