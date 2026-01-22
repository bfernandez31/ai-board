# Quickstart: Project Activity Feed (AIB-181)

**Date**: 2026-01-22

## Implementation Order

Follow these steps in sequence to implement the activity feed feature:

### Step 1: Define Types

Create `/app/lib/types/activity-event.ts`:
- Define `ActivityEventType` enum
- Define `Actor` interface
- Define `BaseActivityEvent` interface
- Define event-specific interfaces (JobActivityEvent, CommentActivityEvent, etc.)
- Define `ActivityEvent` discriminated union
- Add type guards (`isJobEvent`, `isCommentEvent`, etc.)

Reference patterns from: `/app/lib/types/conversation-event.ts`

### Step 2: Add Query Keys

Update `/app/lib/query-keys.ts`:
```typescript
projects: {
  // ... existing keys
  activity: (projectId: number) => ['projects', projectId, 'activity'] as const,
}
```

### Step 3: Create Activity Aggregation Utility

Create `/app/lib/utils/activity-events.ts`:
- `createJobActivityEvent(job, ticket): JobActivityEvent`
- `createCommentActivityEvent(comment, ticket): CommentActivityEvent`
- `createTicketCreatedEvent(ticket): TicketCreatedActivityEvent`
- `mergeActivityEvents(...events): ActivityEvent[]` - merge and sort

Reference patterns from: `/app/lib/utils/conversation-events.ts`

### Step 4: Implement API Route

Create `/app/api/projects/[projectId]/activity/route.ts`:

```typescript
// GET handler
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<NextResponse> {
  // 1. Validate params with Zod
  // 2. Verify project access
  // 3. Query jobs, comments, tickets (30-day window)
  // 4. Transform to ActivityEvent format
  // 5. Merge, sort, paginate
  // 6. Return { events, hasMore, offset }
}
```

Reference patterns from: `/app/api/projects/[projectId]/tickets/[id]/timeline/route.ts`

### Step 5: Create TanStack Query Hook

Create `/app/lib/hooks/queries/use-activity-feed.ts`:

```typescript
export function useActivityFeed(projectId: number, options?: {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.projects.activity(projectId),
    queryFn: () => fetchActivityFeed(projectId, options),
    refetchInterval: 15000, // 15-second polling
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}
```

Reference patterns from: `/app/lib/hooks/queries/use-conversation-timeline.ts`

### Step 6: Create Activity Event Item Component

Create `/components/activity/activity-event-item.tsx`:
- Accept `event: ActivityEvent` prop
- Render based on event.type using switch/discriminated union
- Display icon, actor avatar, action text, ticket reference, timestamp
- Handle deleted tickets (show "(deleted)" suffix)
- Handle click on ticket reference → navigation

Reference patterns from: `/components/timeline/timeline-item.tsx`

### Step 7: Create Activity Feed Component

Create `/components/activity/activity-feed.tsx`:
- Client component with "use client" directive
- Use `useActivityFeed` hook
- Render loading skeleton, error state, empty state
- Map events to `<ActivityEventItem>` components
- Implement "Load more" button for pagination
- Handle scroll position preservation

Reference patterns from: `/components/timeline/conversation-timeline.tsx`

### Step 8: Create Empty State Component

Create `/components/activity/activity-empty-state.tsx`:
- Centered message with Activity icon
- Text: "No activity in the last 30 days"

Reference patterns from: existing empty states in timeline components

### Step 9: Create Activity Page

Create `/app/projects/[projectId]/activity/page.tsx`:
- Server component for authorization
- Fetch project info
- Render header with "Back to Board" button
- Render `<ActivityFeed>` client component

Reference patterns from: `/app/projects/[projectId]/analytics/page.tsx`

### Step 10: Add Navigation Links

Update `/components/layout/header.tsx`:
- Add Activity icon (e.g., `Activity` from lucide-react) next to Analytics icon
- Link to `/projects/${projectId}/activity`

Update `/components/layout/mobile-menu.tsx`:
- Add Activity link in project navigation section

Reference patterns from: existing Analytics link implementation

### Step 11: Write Tests

#### Integration Tests (`tests/integration/activity/activity-api.test.ts`):
- Test GET returns events in correct format
- Test 401 for unauthenticated users
- Test 403 for non-members
- Test pagination (limit, offset, hasMore)
- Test 30-day window filtering
- Test event type coverage (job, comment, ticket)

Reference patterns from: `/tests/integration/timeline/` tests

#### E2E Test (`tests/e2e/activity-navigation.spec.ts`):
- Test clicking ticket reference opens modal on board
- Test "Back to Board" navigation
- Test Activity link in header

Reference patterns from: existing E2E tests with modal navigation

---

## File Checklist

| File | Status |
|------|--------|
| `app/lib/types/activity-event.ts` | Create |
| `app/lib/query-keys.ts` | Update |
| `app/lib/utils/activity-events.ts` | Create |
| `app/api/projects/[projectId]/activity/route.ts` | Create |
| `app/lib/hooks/queries/use-activity-feed.ts` | Create |
| `components/activity/activity-event-item.tsx` | Create |
| `components/activity/activity-feed.tsx` | Create |
| `components/activity/activity-empty-state.tsx` | Create |
| `app/projects/[projectId]/activity/page.tsx` | Create |
| `components/layout/header.tsx` | Update |
| `components/layout/mobile-menu.tsx` | Update |
| `tests/integration/activity/activity-api.test.ts` | Create |
| `tests/e2e/activity-navigation.spec.ts` | Create |

---

## Key Dependencies

These existing utilities should be reused:

- `verifyProjectAccess` from `/lib/db/auth-helpers.ts`
- `formatTimestamp` from `/lib/utils/format-timestamp.ts`
- `getJobDisplayName` from `/app/lib/utils/job-display-names.ts`
- Timeline components for UI patterns
- shadcn/ui components: Avatar, Button, Card, Tooltip

---

## Testing Commands

```bash
# Run integration tests
bun run test:integration

# Run specific activity tests
bun run test:integration -- --grep "activity"

# Run E2E tests
bun run test:e2e

# Run type check
bun run type-check
```
