# Research: Project Activity Feed

**Feature**: AIB-172 Project Activity Feed
**Date**: 2026-01-22

## Research Findings

### 1. AI-BOARD Actor Representation

**Decision**: Use existing AI-BOARD system user (`ai-board@system.local`)

**Rationale**: The codebase already has a dedicated system user for AI-generated activities:
- Located in `/app/lib/db/ai-board-user.ts`
- Email: `ai-board@system.local`
- Cached globally via `getAIBoardUserId()` function
- Already used as actor for comment-triggered jobs and automated workflow activities

**Alternatives Considered**:
- Create new system user → Rejected: Unnecessary duplication, existing user serves purpose
- Use null actor with fallback display → Rejected: Loses audit trail, inconsistent with notifications

**Implementation Notes**:
- Jobs created by workflow dispatch have no explicit `userId` - must check `Job.command` pattern
- Comments with `userId` matching AI-BOARD user ID are AI-generated
- Display: "AI-BOARD" name with distinctive avatar (robot icon or system badge)

---

### 2. Event Type Derivation Strategy

**Decision**: Derive events from existing tables using composite queries with UNION ALL

**Rationale**:
- Spec explicitly states "no new database table" (FR-003 note)
- Existing tables (Job, Comment, Ticket) contain all necessary timestamps
- Avoids schema migration and event sourcing complexity

**Event Type Mappings**:

| Event Type | Source | Timestamp Field | Detection Logic |
|------------|--------|-----------------|-----------------|
| Ticket created | Ticket | `createdAt` | All tickets have creation |
| Stage changed | Ticket | `updatedAt` | Compare with `createdAt` (updatedAt > createdAt implies change) |
| Comment posted | Comment | `createdAt` | All comments |
| Job started | Job | `startedAt` | `status` IN (RUNNING, COMPLETED, FAILED, CANCELLED) |
| Job completed | Job | `completedAt` | `status` = COMPLETED |
| Job failed | Job | `completedAt` | `status` = FAILED |

**Alternatives Considered**:
- Create ActivityEvent table with triggers → Rejected: Schema change, complexity
- Event sourcing with audit log → Rejected: Overkill for display-only feature
- Materialize events periodically → Rejected: Stale data, background job overhead

**Implementation Notes**:
- Use Prisma raw query for UNION ALL (Prisma doesn't support native UNION)
- Alternative: Fetch from each table separately and merge in application code
- Application-level merge is acceptable for 50-event pages with 30-day window

---

### 3. Query Optimization Strategy

**Decision**: Use application-level merge with parallel queries + existing indexes

**Rationale**:
- Existing indexes support efficient queries:
  - Job: `[ticketId, status, startedAt]`, `[projectId]`, `[startedAt]`
  - Comment: `[ticketId, createdAt]`
  - Ticket: `[projectId]`
- Parallel queries (Promise.all) minimize latency
- Application merge handles discriminated union typing naturally

**Query Strategy**:
```typescript
// Parallel fetch from each source
const [jobs, comments, tickets] = await Promise.all([
  prisma.job.findMany({
    where: { projectId, startedAt: { gte: thirtyDaysAgo } },
    include: { ticket: { select: { ticketKey: true } } },
    orderBy: { startedAt: 'desc' },
    take: limit * 2  // Over-fetch to handle filtering
  }),
  prisma.comment.findMany({
    where: { ticket: { projectId }, createdAt: { gte: thirtyDaysAgo } },
    include: { user: true, ticket: { select: { ticketKey: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit
  }),
  prisma.ticket.findMany({
    where: { projectId, createdAt: { gte: thirtyDaysAgo } },
    select: { ticketKey: true, createdAt: true, updatedAt: true, stage: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
])

// Merge and sort by timestamp (newest first)
// Apply pagination offset/limit after merge
```

**Alternatives Considered**:
- Single raw SQL UNION ALL → Rejected: Complex type handling, less maintainable
- Database view → Rejected: Schema change, Prisma limitations with views
- Cached aggregation → Rejected: Stale data, sync complexity

---

### 4. Polling Interval Selection

**Decision**: 15-second polling interval

**Rationale**:
- Matches existing notification polling interval (spec auto-resolved)
- Balances real-time feel with server load
- Consistent with established patterns:
  - Jobs: 2s (aggressive, auto-stops)
  - Comments/Timeline: 10s
  - Notifications: 15s (unread), 30s (read)
  - Analytics: 15s

**Implementation**:
```typescript
useQuery({
  queryKey: queryKeys.projects.activity(projectId),
  queryFn: fetchActivity,
  refetchInterval: 15000,  // 15 seconds
  staleTime: 10000,
  refetchOnWindowFocus: true
})
```

**Alternatives Considered**:
- 10s (match comments) → Rejected: Activity changes less frequently than conversation
- 30s (conservative) → Rejected: Too slow for monitoring active work
- WebSocket real-time → Rejected: Future enhancement, polling sufficient for MVP

---

### 5. Actor Resolution for Jobs

**Decision**: Actor determined by job creation context

**Rationale**: Jobs don't have direct `userId` field. Actor derivation:
- Workflow-triggered jobs (implement, plan, etc.): AI-BOARD is actor
- Comment-triggered jobs (`comment-*`): The comment author triggered it
- Manual dispatch: AI-BOARD (workflows are automated)

**Implementation**:
```typescript
function getJobActor(job: Job, aiboardUserId: string): Actor {
  // All workflow jobs are AI-BOARD actions
  return {
    id: aiboardUserId,
    name: 'AI-BOARD',
    image: null,  // Use system avatar
    isSystem: true
  }
}
```

**Alternatives Considered**:
- Add userId field to Job → Rejected: Schema change, historical data gap
- Derive from comment relation for `comment-*` → Considered viable but adds complexity

---

### 6. Deleted Ticket/User Handling

**Decision**: Graceful degradation with placeholder text

**Rationale**: Edge cases from spec:
- Deleted ticket: Show "ABC-42 (deleted)" with non-clickable reference
- Deleted user: Show "Deleted user" with default avatar

**Implementation**:
- Check ticket existence before rendering link
- Check user existence/null for actor display
- Use consistent placeholder styling (muted text, no interactivity)

---

### 7. Navigation Architecture

**Decision**: Add "Activity" link in project header between existing nav items

**Rationale**:
- Spec requires link in project header (FR-013)
- Header already has: Logo, Project name, Specs link, Analytics link, Search, Notifications, User
- Activity fits naturally between Specs and Analytics

**Implementation**:
- Add Link to `/projects/{projectId}/activity` in header
- Active state detection via pathname matching
- Mobile responsive: include in navigation menu

---

## Technology Decisions Summary

| Topic | Decision | Confidence |
|-------|----------|------------|
| AI-BOARD actor | Existing system user | High |
| Event derivation | Application-level merge | High |
| Query strategy | Parallel Prisma queries | High |
| Polling interval | 15 seconds | Medium |
| Job actor | AI-BOARD for all workflows | High |
| Deleted entities | Placeholder text fallback | High |
| Navigation | Header link after Specs | High |

## Open Questions (None)

All NEEDS CLARIFICATION items have been resolved through codebase research and spec review.
