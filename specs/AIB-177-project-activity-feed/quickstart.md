# Quickstart: Project Activity Feed

**Feature**: AIB-177-project-activity-feed
**Date**: 2026-01-22

## Implementation Order

Execute tasks in this order to maintain testability at each step:

### Phase 1: Type Definitions
1. Create `app/lib/types/activity-event.ts` with all type definitions
2. Write unit tests for type guards

### Phase 2: Backend Logic
3. Create `app/lib/utils/activity-events.ts` with event derivation and merging logic
4. Write unit tests for event derivation functions
5. Create `app/api/projects/[projectId]/activity/route.ts` API endpoint
6. Write integration tests for API endpoint

### Phase 3: Frontend Components
7. Create `components/activity/activity-empty-state.tsx`
8. Create `components/activity/activity-item.tsx` with event type rendering
9. Create `app/lib/hooks/queries/use-project-activity.ts` TanStack Query hook
10. Create `components/activity/activity-feed.tsx` with polling
11. Create `app/projects/[projectId]/activity/page.tsx` Server Component
12. Write component tests for activity-item

### Phase 4: Navigation Integration
13. Modify `components/layout/header.tsx` to add Activity link
14. Add query key to `app/lib/query-keys.ts`

### Phase 5: Testing
15. Write E2E test for navigation flow only

## Key Patterns to Follow

### API Route Pattern
Reference: `app/api/projects/[projectId]/analytics/route.ts`
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const projectId = parseInt((await params).projectId, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    await verifyProjectAccess(projectId);
    // ... query and return data
  } catch (error) {
    // ... error handling
  }
}
```

### TanStack Query Hook Pattern
Reference: `app/lib/hooks/queries/use-conversation-timeline.ts`
```typescript
export function useProjectActivity({ projectId, limit = 50, cursor, enabled = true }) {
  return useQuery({
    queryKey: queryKeys.projects.activity(projectId, cursor),
    queryFn: async () => {
      const url = new URL(`/api/projects/${projectId}/activity`, window.location.origin);
      url.searchParams.set('limit', String(limit));
      if (cursor) url.searchParams.set('cursor', cursor);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    enabled,
    staleTime: 10000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}
```

### Event Type Discriminated Union
Reference: `app/lib/types/conversation-event.ts`
```typescript
function renderActivityItem(event: ActivityEvent) {
  switch (event.type) {
    case 'ticket_created':
      return <TicketCreatedItem event={event} />;
    case 'stage_changed':
      return <StageChangedItem event={event} />;
    // ... etc
  }
}
```

### Event Merging Pattern
Reference: `app/lib/utils/conversation-events.ts`
```typescript
export function mergeActivityEvents(
  jobs: JobWithTicket[],
  comments: CommentWithUser[],
  tickets: Ticket[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // Derive events from each source
  jobs.forEach(job => events.push(...deriveJobEvents(job)));
  comments.forEach(comment => events.push(deriveCommentEvent(comment)));
  tickets.forEach(ticket => events.push(deriveTicketCreatedEvent(ticket)));

  // Sort by timestamp DESC
  return events.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
```

## Files to Reference

| File | What to Learn |
|------|---------------|
| `app/api/projects/[projectId]/analytics/route.ts` | API route structure, validation, error handling |
| `app/api/projects/[projectId]/tickets/[id]/timeline/route.ts` | Multi-table query merging |
| `components/analytics/analytics-dashboard.tsx` | useQuery with polling, initial data hydration |
| `components/timeline/timeline-item.tsx` | Discriminated union rendering pattern |
| `components/timeline/job-event-timeline-item.tsx` | Job event display with icons |
| `app/lib/utils/conversation-events.ts` | Event merging and sorting |
| `app/lib/hooks/queries/use-conversation-timeline.ts` | Query hook with polling |
| `components/comments/avatar.tsx` | Avatar rendering with fallback |

## Testing Strategy

| Test Type | Location | What to Test |
|-----------|----------|--------------|
| Unit | `tests/unit/activity-events.test.ts` | Event derivation, merging, cursor encoding |
| Integration | `tests/integration/activity/api.test.ts` | API endpoint with real DB |
| Component | `tests/unit/components/activity-item.test.tsx` | Event rendering by type |
| E2E | `tests/e2e/activity.spec.ts` | Navigation to activity page only |

## Icon Mapping

| Event Type | Icon (lucide-react) |
|------------|---------------------|
| ticket_created | PlusCircle |
| stage_changed | ArrowRight |
| comment_posted | MessageSquare |
| job_started | Play |
| job_completed | CheckCircle |
| job_failed | XCircle |
| pr_created | GitPullRequest |
| preview_deployed | Globe |

## Dependencies

No new dependencies required. All features use existing packages:
- `date-fns` for timestamp formatting
- `lucide-react` for icons
- `@tanstack/react-query` for data fetching
- `zod` for validation
- shadcn/ui components
