# Component Contracts: Conversation Timeline

**Feature**: 065-915-conversations-je

## Component Hierarchy

```
ConversationTimeline (Container)
├── Timeline (Layout wrapper)
│   ├── TimelineItem (Comment)
│   │   ├── TimelineBadge (Avatar)
│   │   └── TimelineContent
│   │       └── CommentBox
│   │           ├── CommentHeader
│   │           └── CommentBody
│   └── TimelineItem (Job Event)
│       ├── TimelineBadge (Icon)
│       └── TimelineContent
│           └── JobEventText
```

---

## Component Contracts

### 1. ConversationTimeline (Container Component)

**Purpose**: Fetch conversation events and render unified timeline

**Location**: `components/ticket/conversation-timeline.tsx`

**Props**:
```typescript
interface ConversationTimelineProps {
  ticketId: number;
  projectId: number;
}
```

**Behavior**:
- Fetch conversation events via TanStack Query hook (`useConversationTimeline`)
- Handle loading state (skeleton loader)
- Handle error state (error message)
- Handle empty state ("No activity yet")
- Pass sorted events to `Timeline` component

**TanStack Query Hook**:
```typescript
function useConversationTimeline(ticketId: number, projectId: number) {
  return useQuery({
    queryKey: ['timeline', projectId, ticketId],
    queryFn: () => fetchConversationTimeline(projectId, ticketId),
    staleTime: 10000, // 10 seconds (existing polling interval)
    refetchInterval: 10000, // Auto-refetch every 10 seconds
  });
}
```

**Rendering Logic**:
```typescript
export function ConversationTimeline({ ticketId, projectId }: ConversationTimelineProps) {
  const { data, isLoading, error } = useConversationTimeline(ticketId, projectId);

  if (isLoading) return <TimelineSkeleton />;
  if (error) return <TimelineError error={error} />;
  if (!data || data.timeline.length === 0) return <TimelineEmpty />;

  return <Timeline events={data.timeline} />;
}
```

**State Management**:
- Server state via TanStack Query (auto-refetch, caching)
- No local state needed (stateless presentation)

---

### 2. Timeline (Layout Component)

**Purpose**: Render vertical timeline structure with connector line

**Location**: `components/timeline/timeline.tsx`

**Props**:
```typescript
interface TimelineProps {
  events: ConversationEvent[];
}
```

**Styling**:
```typescript
<ol className="relative pl-10 space-y-4" aria-label="Timeline of ticket activity">
  {/* Vertical connector line */}
  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface0" aria-hidden="true" />
  {children}
</ol>
```

**Rendering Logic**:
```typescript
export function Timeline({ events }: TimelineProps) {
  return (
    <ol className="relative pl-10 space-y-4" aria-label="Timeline of ticket activity">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface0" aria-hidden="true" />
      {events.map((event) => (
        <TimelineItem key={getEventKey(event)} event={event} />
      ))}
    </ol>
  );
}

function getEventKey(event: ConversationEvent): string {
  if (event.type === 'comment') {
    return `comment-${event.data.id}`;
  } else {
    return `job-${event.data.id}-${event.eventType}`;
  }
}
```

**Accessibility**:
- `<ol>` semantic list element
- `aria-label` describes timeline purpose
- Vertical line uses `aria-hidden="true"` (decorative only)

---

### 3. TimelineItem (Wrapper Component)

**Purpose**: Dispatch rendering to CommentItem or JobEventItem based on event type

**Location**: `components/timeline/timeline-item.tsx`

**Props**:
```typescript
interface TimelineItemProps {
  event: ConversationEvent;
}
```

**Rendering Logic** (discriminated union with exhaustive checking):
```typescript
export function TimelineItem({ event }: TimelineItemProps) {
  switch (event.type) {
    case 'comment':
      return <CommentTimelineItem comment={event.data} timestamp={event.timestamp} />;
    case 'job':
      return <JobEventTimelineItem job={event.data} eventType={event.eventType} timestamp={event.timestamp} />;
    default:
      return assertNever(event); // Compile-time exhaustiveness check
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
```

**Performance**:
- Use `React.memo` for memoization
- Only re-render when event data changes

---

### 4. CommentTimelineItem (Comment Display)

**Purpose**: Render user comment in timeline format

**Location**: `components/timeline/comment-timeline-item.tsx`

**Props**:
```typescript
interface CommentTimelineItemProps {
  comment: CommentWithUser;
  timestamp: string;
}
```

**Layout Structure**:
```typescript
<li className="relative flex gap-4">
  <TimelineBadge>
    <Avatar user={comment.user} size="md" />
  </TimelineBadge>
  <TimelineContent>
    <CommentBox comment={comment} />
  </TimelineContent>
</li>
```

**Styling**:
- Outer `<li>`: `relative flex gap-4`
- Badge: Avatar component (32px, existing component)
- Content: Full comment box with border, padding, shadow

**Delegation**:
- Reuses existing `CommentBox` component (or similar)
- Wraps with timeline-specific layout

---

### 5. JobEventTimelineItem (Job Event Display)

**Purpose**: Render job lifecycle event in timeline format

**Location**: `components/timeline/job-event-timeline-item.tsx`

**Props**:
```typescript
interface JobEventTimelineItemProps {
  job: Job;
  eventType: 'start' | 'complete';
  timestamp: string;
}
```

**Layout Structure**:
```typescript
<li className="relative flex gap-4 items-center">
  <TimelineBadge variant="event">
    <JobEventIcon eventType={eventType} status={job.status} />
  </TimelineBadge>
  <TimelineContent>
    <JobEventText job={job} eventType={eventType} />
  </TimelineContent>
</li>
```

**Icon Mapping** (lucide-react):
```typescript
function JobEventIcon({ eventType, status }: { eventType: JobEventType, status: JobStatus }) {
  if (eventType === 'start') {
    return <PlayCircle className="w-4 h-4 text-blue" />;
  }

  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="w-4 h-4 text-green" />;
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red" />;
    case 'CANCELLED':
      return <Ban className="w-4 h-4 text-subtext0" />;
    default:
      return <Circle className="w-4 h-4 text-blue" />;
  }
}
```

**Message Generation**:
```typescript
function JobEventText({ job, eventType }: { job: Job, eventType: JobEventType }) {
  const displayName = getJobDisplayName(job.command);
  const quickIndicator = job.workflowType === 'QUICK' && job.command === 'quick-impl' ? ' ⚡' : '';

  let message = '';
  if (eventType === 'start') {
    message = `${displayName}${quickIndicator} started`;
  } else {
    switch (job.status) {
      case 'COMPLETED':
        message = `${displayName}${quickIndicator} completed`;
        break;
      case 'FAILED':
        message = `${displayName}${quickIndicator} failed`;
        break;
      case 'CANCELLED':
        message = `${displayName}${quickIndicator} cancelled`;
        break;
    }
  }

  return (
    <span className="text-sm text-subtext0">
      {message}
      <time className="ml-2 text-xs text-subtext1" dateTime={timestamp}>
        {formatRelativeTime(timestamp)}
      </time>
    </span>
  );
}
```

**Styling**:
- Condensed layout (items-center alignment)
- Small text (`text-sm text-subtext0`)
- No border/background (minimal visual weight)

---

### 6. TimelineBadge (Badge Component)

**Purpose**: Display avatar or icon in timeline badge position

**Location**: `components/timeline/timeline-badge.tsx`

**Props**:
```typescript
interface TimelineBadgeProps {
  variant?: 'avatar' | 'event';
  children: React.ReactNode;
}
```

**Styling**:
```typescript
export function TimelineBadge({ variant = 'avatar', children }: TimelineBadgeProps) {
  const badgeClasses = cn(
    '-ml-14 flex-shrink-0',
    variant === 'event' && 'w-8 h-8 rounded-full bg-surface0 border-2 border-base flex items-center justify-center'
  );

  return <div className={badgeClasses}>{children}</div>;
}
```

**Variants**:
- `avatar`: Wraps Avatar component (no additional styling)
- `event`: Circular badge with background and border for icons

---

### 7. TimelineContent (Content Wrapper)

**Purpose**: Wrapper for timeline item content (right side of badge)

**Location**: `components/timeline/timeline-content.tsx`

**Props**:
```typescript
interface TimelineContentProps {
  children: React.ReactNode;
}
```

**Styling**:
```typescript
export function TimelineContent({ children }: TimelineContentProps) {
  return <div className="flex-1 min-w-0">{children}</div>;
}
```

**Layout**:
- `flex-1`: Expand to fill available space
- `min-w-0`: Prevent text overflow issues

---

## State Management

### Server State (TanStack Query)

**Query Key**: `['timeline', projectId, ticketId]`

**Query Function**:
```typescript
async function fetchConversationTimeline(projectId: number, ticketId: number): Promise<{ timeline: ConversationEvent[] }> {
  const response = await fetch(`/api/projects/${projectId}/tickets/${ticketId}/timeline`);
  if (!response.ok) throw new Error('Failed to fetch timeline');
  return response.json();
}
```

**Caching Strategy**:
- `staleTime: 10000` (10 seconds) - Data considered fresh for 10 seconds
- `refetchInterval: 10000` - Auto-refetch every 10 seconds (polling)
- `refetchOnWindowFocus: true` - Refetch when user returns to tab

**Invalidation Triggers**:
- After comment creation: `queryClient.invalidateQueries(['timeline', projectId, ticketId])`
- After job status update: `queryClient.invalidateQueries(['timeline', projectId, ticketId])`

### Local State

**No local state required** - all data comes from server via TanStack Query

---

## Performance Optimizations

### 1. React.memo for Event Components

```typescript
export const CommentTimelineItem = React.memo(({ comment, timestamp }: CommentTimelineItemProps) => {
  // ... component implementation
});

export const JobEventTimelineItem = React.memo(({ job, eventType, timestamp }: JobEventTimelineItemProps) => {
  // ... component implementation
});
```

**Rationale**: Prevent unnecessary re-renders when parent timeline updates

### 2. useMemo for Event Processing

```typescript
function Timeline({ events }: TimelineProps) {
  const sortedEvents = useMemo(
    () => events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [events]
  );

  return (
    <ol className="relative pl-10 space-y-4">
      {sortedEvents.map((event) => <TimelineItem key={getEventKey(event)} event={event} />)}
    </ol>
  );
}
```

**Rationale**: Cache sorting operation to avoid redundant calculations

### 3. Key Prop Strategy

```typescript
function getEventKey(event: ConversationEvent): string {
  if (event.type === 'comment') {
    return `comment-${event.data.id}`;
  } else {
    // Include eventType to distinguish start vs complete events for same job
    return `job-${event.data.id}-${event.eventType}`;
  }
}
```

**Rationale**: Stable keys prevent unnecessary DOM reconciliation

---

## Testing Contracts

### Unit Tests (Vitest)

**File**: `tests/unit/conversation-events.test.ts`

**Test Cases**:
- `mergeConversationEvents()` correctly merges and sorts comments + jobs
- `createJobEvents()` generates start event for all jobs
- `createJobEvents()` generates completion event only when completedAt is not null
- `getJobDisplayName()` maps all known commands correctly
- `getJobDisplayName()` handles unmapped commands with fallback
- `getJobEventMessage()` generates correct messages for all event types

### Integration Tests (Playwright)

**File**: `tests/integration/timeline/conversation-timeline.spec.ts`

**Test Cases**:
- Timeline displays comments in chronological order
- Timeline displays job events (start and completion) in chronological order
- Timeline interleaves comments and job events correctly
- Timeline shows loading state while fetching data
- Timeline shows error state when API fails
- Timeline shows empty state when no events exist
- Comment items render with avatar and content
- Job event items render with icon and message
- Quick workflow indicator (⚡) appears on quick-impl jobs
- Timeline auto-updates when new comment is added
- Timeline auto-updates when job status changes

---

## Accessibility Requirements

### Semantic HTML
- Use `<ol>` for timeline (ordered list)
- Use `<li>` for timeline items
- Use `<time>` elements for timestamps with `dateTime` attribute

### ARIA Labels
- Timeline: `aria-label="Timeline of ticket activity"`
- Decorative elements: `aria-hidden="true"` (vertical line)
- Icons: Wrap in element with `aria-label` describing action

### Keyboard Navigation
- All interactive elements (comment actions, etc.) must be keyboard accessible
- Tab order follows visual timeline order (top to bottom)

### Screen Reader Support
```typescript
<time className="text-xs text-subtext0" dateTime={timestamp}>
  <span className="sr-only">Posted </span>
  {formatRelativeTime(timestamp)}
</time>
```

**Example Output**: "Posted 2 hours ago" (screen reader), "2 hours ago" (visual)

---

## Summary

**New Components**:
1. `ConversationTimeline` - Container with TanStack Query hook
2. `Timeline` - Layout wrapper with vertical connector line
3. `TimelineItem` - Discriminated union dispatcher
4. `CommentTimelineItem` - Comment display in timeline format
5. `JobEventTimelineItem` - Job event display with icon and message
6. `TimelineBadge` - Badge wrapper (avatar or event icon)
7. `TimelineContent` - Content wrapper

**Reused Components**:
- `Avatar` (existing component for user avatars)
- `CommentBox` or similar (existing comment display logic)

**State Management**:
- TanStack Query for server state (10-second polling)
- No local state required

**Performance**:
- React.memo for event components
- useMemo for event sorting
- Stable key prop strategy

**Accessibility**:
- Semantic HTML (`<ol>`, `<li>`, `<time>`)
- ARIA labels for context
- Keyboard navigation support
