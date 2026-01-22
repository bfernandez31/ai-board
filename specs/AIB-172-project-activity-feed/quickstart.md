# Quickstart: Project Activity Feed

**Feature**: AIB-172 Project Activity Feed
**Date**: 2026-01-22

## Implementation Order

Follow this sequence for clean, testable implementation:

### Step 1: Types & Utilities
**Files**: `app/lib/types/activity-event.ts`, `app/lib/utils/activity-events.ts`

1. Define `ActivityEvent` discriminated union type
2. Implement type guards (`isTicketCreatedEvent`, `isCommentPostedEvent`, etc.)
3. Implement event transformation utilities:
   - `transformJobToEvents(job)` → JobStartedEvent | JobCompletedEvent | JobFailedEvent
   - `transformCommentToEvent(comment)` → CommentPostedEvent
   - `transformTicketToEvents(ticket)` → TicketCreatedEvent | TicketStageChangedEvent
4. Implement merge function: `mergeAndSortEvents(events[])`
5. Write unit tests for all transformations

### Step 2: API Endpoint
**Files**: `app/api/projects/[projectId]/activity/route.ts`

1. Implement GET handler with Zod validation for query params
2. Add authorization using `verifyProjectAccess(projectId)`
3. Implement parallel queries for jobs, comments, tickets
4. Transform and merge results
5. Return `ActivityFeedResponse` with pagination
6. Write integration tests for authorization and pagination

### Step 3: Query Hook
**Files**: `app/lib/hooks/queries/use-activity-feed.ts`, `app/lib/query-keys.ts`

1. Add `queryKeys.projects.activity(projectId)` to query-keys
2. Implement `useActivityFeed(projectId)` hook:
   - TanStack Query with 15-second polling
   - Pagination support (offset, limit)
   - Loading/error states
3. Write unit tests for hook behavior

### Step 4: UI Components
**Files**: `components/activity/*.tsx`

1. `ActivityEventItem` - Event renderer that dispatches by type:
   - Ticket events: PlusCircle (created), ArrowRight (stage change)
   - Comment events: MessageSquare
   - Job events: PlayCircle/CheckCircle/XCircle (start/complete/fail)
2. `ActivityEmptyState` - "No recent activity" message
3. `ActivityFeed` - Container with event list and "Load more" button
4. Write RTL component tests for rendering and interactions

### Step 5: Activity Page
**Files**: `app/projects/[projectId]/activity/page.tsx`

1. Server Component wrapper that fetches projectId
2. Renders `ActivityFeed` Client Component
3. Includes "Back to Board" navigation

### Step 6: Navigation Update
**Files**: `components/layout/header.tsx`

1. Add "Activity" link in header navigation
2. Position between existing Specs and Analytics links
3. Active state detection via pathname

### Step 7: E2E Tests
**Files**: `tests/e2e/activity-feed.spec.ts`

1. Test navigation flow: header → activity → ticket modal → back
2. Test polling updates (create activity, verify appearance)
3. Test responsive layout

## Key Patterns to Follow

### Event Transformation Pattern
```typescript
// Follow existing ConversationEvent pattern from app/lib/types/conversation-event.ts
// Each event type has discriminated union with type field
```

### Query Hook Pattern
```typescript
// Follow existing use-conversation-timeline.ts pattern
// Use queryKeys factory for key management
// Include refetchInterval for polling
```

### Component Pattern
```typescript
// Follow existing timeline components in components/timeline/
// Use TimelineBadge pattern for icons
// Use formatTimestamp for relative times
```

### Authorization Pattern
```typescript
// Follow existing verifyProjectAccess from app/lib/auth/project-access.ts
```

## Dependencies

- Existing: `date-fns`, `lucide-react`, `@tanstack/react-query`
- No new dependencies required

## Critical Files to Reference

| Pattern | Reference File |
|---------|---------------|
| Event types | `app/lib/types/conversation-event.ts` |
| Query hook | `app/lib/hooks/queries/use-conversation-timeline.ts` |
| Timeline UI | `components/timeline/*.tsx` |
| Authorization | `app/lib/auth/project-access.ts` |
| AI-BOARD user | `app/lib/db/ai-board-user.ts` |
| Timestamp format | `lib/utils/format-timestamp.ts` |
| Query keys | `app/lib/query-keys.ts` |
