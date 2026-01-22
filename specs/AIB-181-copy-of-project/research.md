# Research: Project Activity Feed (AIB-181)

**Date**: 2026-01-22
**Status**: Complete

## Research Tasks

All unknowns from Technical Context have been resolved through codebase analysis.

---

## 1. Event Aggregation from Multiple Tables

**Decision**: Two-phase query with merge utility

**Rationale**: The existing timeline API (`/api/projects/[projectId]/tickets/[id]/timeline/route.ts`) already implements this pattern for per-ticket timelines. Project-level activity feed will extend this pattern across all project tickets.

**Implementation Pattern**:
```typescript
// Phase 1: Fetch comments across all project tickets (30-day window)
const comments = await prisma.comment.findMany({
  where: {
    ticket: { projectId },
    createdAt: { gte: thirtyDaysAgo },
  },
  include: {
    user: { select: { id, name, email, image } },
    ticket: { select: { ticketKey, title } }, // For ticket reference
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1, // Fetch one extra to check hasMore
});

// Phase 2: Fetch jobs across all project tickets (30-day window)
const jobs = await prisma.job.findMany({
  where: {
    projectId,
    startedAt: { gte: thirtyDaysAgo },
  },
  include: {
    ticket: { select: { ticketKey, title } },
  },
  orderBy: { startedAt: 'desc' },
  take: limit + 1,
});

// Phase 3: Fetch ticket events (creation/stage changes)
const tickets = await prisma.ticket.findMany({
  where: {
    projectId,
    createdAt: { gte: thirtyDaysAgo },
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1,
});
```

**Alternatives Considered**:
- Single complex query with UNION ALL: Rejected due to type complexity and lack of Prisma support for raw SQL unions with proper typing
- Denormalized activity table: Rejected per FR-005 (no new tables)

---

## 2. Cursor-Based vs Offset Pagination

**Decision**: Offset-based pagination with cursor fallback consideration

**Rationale**: The activity feed has a fixed 30-day window, which naturally limits the dataset. Existing patterns (notifications API, comparisons API) use offset-based pagination successfully. For the initial implementation, offset pagination provides simplicity and meets the 1-second pagination requirement (SC-003).

**Implementation Pattern**:
```typescript
// Query params
const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
const offset = parseInt(searchParams.get('offset') || '0');

// Response
return NextResponse.json({
  events: mergedEvents.slice(0, limit),
  hasMore: mergedEvents.length > limit,
  offset: offset + limit,
});
```

**Cursor Alternative (Future)**:
If performance degrades with high activity volumes, switch to cursor-based pagination:
```typescript
const cursor = searchParams.get('cursor'); // ISO timestamp
const events = await prisma.job.findMany({
  where: {
    startedAt: cursor ? { lt: new Date(cursor) } : undefined,
  },
  orderBy: { startedAt: 'desc' },
  take: limit + 1,
});
```

---

## 3. Relative Time Formatting

**Decision**: Reuse existing `formatTimestamp` utility with hover tooltip for absolute time

**Rationale**: Two utilities exist in the codebase:
1. `lib/utils/format-timestamp.ts` - Uses Intl API (locale-aware, no dependencies)
2. `app/lib/utils/date-utils.ts` - Uses date-fns (more features)

Use `formatTimestamp` for consistency with existing timeline components.

**Implementation Pattern**:
```typescript
import { formatTimestamp } from '@/lib/utils/format-timestamp';

// Display relative time
<span className="text-xs text-subtext0">
  {formatTimestamp(event.timestamp)}
</span>

// Tooltip with absolute time (using shadcn/ui Tooltip)
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>
      <span>{formatTimestamp(event.timestamp)}</span>
    </TooltipTrigger>
    <TooltipContent>
      {new Date(event.timestamp).toLocaleString()}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 4. Event Type Icons and Colors

**Decision**: Extend existing icon mapping pattern from job-event-timeline-item.tsx

**Rationale**: The codebase already has icon mappings for job events. Activity feed adds new event types for ticket events.

**Icon Mapping**:
| Event Type | Icon | Color |
|------------|------|-------|
| Job started | `PlayCircle` | Blue (`text-blue-500`) |
| Job completed | `CheckCircle` | Green (`text-green-500`) |
| Job failed | `XCircle` | Red (`text-red-500`) |
| Job cancelled | `Ban` | Gray (`text-gray-400`) |
| Comment posted | User avatar | N/A (avatar component) |
| Ticket created | `PlusCircle` | Purple (`text-purple-500`) |
| Ticket stage changed | `ArrowRight` | Blue (`text-blue-400`) |
| PR created | `GitPullRequest` | Green (`text-green-500`) |
| Preview deployed | `Globe` | Cyan (`text-cyan-500`) |

---

## 5. Navigation to Ticket Modal

**Decision**: Use URL parameters pattern matching board implementation

**Rationale**: The board component already handles ticket modal navigation via URL params. Activity feed should use the same pattern for consistency.

**Navigation Pattern**:
```typescript
// From activity feed, clicking a ticket reference
const handleTicketClick = (ticketKey: string) => {
  router.push(`/projects/${projectId}/board?ticket=${ticketKey}&modal=open`);
};

// Preserves scroll position on board page by letting board handle modal opening
```

**Key Consideration**: The board component already handles closed tickets via `useTicketByKey` hook. Activity feed can rely on this existing infrastructure.

---

## 6. Event Actor Display

**Decision**: Display user avatar for human actors, AI-BOARD system avatar for automated actions

**Rationale**: FR-007 specifies AI-BOARD as actor for system-initiated actions. Need consistent visual distinction.

**Implementation Pattern**:
```typescript
// Determine actor
const isSystemAction = event.type === 'job' || (event.type === 'comment' && isAiBoardComment);

// Display
{isSystemAction ? (
  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
    <Bot className="w-4 h-4 text-white" />
  </div>
) : (
  <Avatar>
    <AvatarImage src={actor.image} alt={actor.name} />
    <AvatarFallback>{getInitials(actor.name)}</AvatarFallback>
  </Avatar>
)}
```

---

## 7. Polling Implementation

**Decision**: 15-second fixed polling interval using TanStack Query

**Rationale**: FR-012 specifies 15-second polling, matching the notification pattern. The existing `useConversationTimeline` hook uses 10-second polling, but activity feed is project-wide (more data) so 15 seconds is appropriate.

**Implementation Pattern**:
```typescript
export function useActivityFeed(projectId: number, options?: UseActivityFeedOptions) {
  return useQuery({
    queryKey: queryKeys.projects.activity(projectId),
    queryFn: () => fetchActivityFeed(projectId, options?.offset ?? 0),
    refetchInterval: 15000, // 15 seconds per FR-012
    staleTime: 10000,
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}
```

---

## 8. Empty State and Loading State

**Decision**: Follow existing timeline component patterns

**Rationale**: Consistency with existing UI patterns.

**Empty State** (FR edge case):
```typescript
<div className="flex flex-col items-center justify-center py-16 text-center">
  <Activity className="w-12 h-12 text-subtext0 mb-4" />
  <h3 className="text-lg font-medium text-text">No activity yet</h3>
  <p className="text-sm text-subtext0 mt-2">
    No activity in the last 30 days
  </p>
</div>
```

**Loading State**:
```typescript
<div className="space-y-4">
  {[1, 2, 3, 4, 5].map((i) => (
    <div key={i} className="flex gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-surface0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-surface0 rounded w-3/4" />
        <div className="h-3 bg-surface0 rounded w-1/2" />
      </div>
    </div>
  ))}
</div>
```

---

## 9. Mobile Responsiveness

**Decision**: Stack layout on mobile, full-width list items

**Rationale**: FR-015 specifies responsive design. Use Tailwind responsive classes.

**Implementation Pattern**:
```typescript
// Desktop: Wider padding, larger icons
// Mobile: Reduced padding, compact layout
<div className="px-4 md:px-6 lg:px-8">
  <div className="flex items-start gap-3 md:gap-4">
    {/* Avatar/Icon - slightly smaller on mobile */}
    <div className="w-8 h-8 md:w-10 md:h-10 shrink-0">
      {/* icon content */}
    </div>
    {/* Content - full width */}
    <div className="flex-1 min-w-0">
      {/* text content with truncation */}
    </div>
  </div>
</div>
```

---

## Summary: Implementation Approach

1. **API Route**: `/api/projects/[projectId]/activity/route.ts`
   - Accept `limit` (default 50, max 100) and `offset` query params
   - Query jobs, comments, tickets with 30-day filter
   - Merge and sort by timestamp descending
   - Return `{ events, hasMore, offset }`

2. **TanStack Query Hook**: `use-activity-feed.ts`
   - 15-second polling
   - Handle pagination via offset
   - Query key: `['projects', projectId, 'activity']`

3. **Page Component**: `/app/projects/[projectId]/activity/page.tsx`
   - Server component for auth check
   - Client component for feed rendering

4. **Feed Component**: `components/activity/activity-feed.tsx`
   - Render list of events
   - Load more button at bottom
   - Delegate to event-specific components

5. **Navigation Components**: `header.tsx`, `mobile-menu.tsx`
   - Add Activity icon link next to Analytics
