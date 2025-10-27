# Quickstart: GitHub-Style Ticket Conversations

**Feature**: 065-915-conversations-je
**Implementation Time**: 6-10 hours
**Complexity**: Medium

## Overview

This guide provides step-by-step implementation instructions for adding a GitHub-style conversation timeline to the ticket detail view. The feature merges user comments and job lifecycle events into a unified chronological timeline.

---

## Prerequisites

Before starting implementation, ensure you understand:

1. **Existing Codebase**:
   - TanStack Query patterns (`lib/hooks/queries/useTickets.ts`)
   - shadcn/ui component usage
   - Prisma query patterns (`lib/db/`)
   - Next.js App Router API routes

2. **Feature Requirements**:
   - Read `spec.md` (acceptance criteria)
   - Read `research.md` (design decisions)
   - Read `data-model.md` (TypeScript types)
   - Read `contracts/` (API and component contracts)

3. **Testing Setup**:
   - Vitest configured for unit tests
   - Playwright configured for integration tests
   - Search for existing test files BEFORE creating new ones

---

## Implementation Phases

### Phase 1: TypeScript Types & Utilities (2 hours)

**Goal**: Create data transformation logic and type definitions

#### Step 1.1: Create ConversationEvent Types

**File**: `lib/types/conversation-event.ts`

```typescript
import type { CommentWithUser } from '@/lib/types/comment';
import type { Job, JobStatus } from '@prisma/client';

interface BaseConversationEvent {
  type: 'comment' | 'job';
  timestamp: string;
}

export interface CommentEvent extends BaseConversationEvent {
  type: 'comment';
  timestamp: string;
  data: CommentWithUser;
}

export interface JobEvent extends BaseConversationEvent {
  type: 'job';
  timestamp: string;
  eventType: 'start' | 'complete';
  data: Job;
}

export type ConversationEvent = CommentEvent | JobEvent;

export type JobEventType = 'start' | 'complete' | 'fail' | 'cancel';
```

**Test**: `tests/unit/conversation-event-types.test.ts` (type guards, discriminator)

---

#### Step 1.2: Create Job Display Name Mapping

**File**: `lib/utils/job-display-names.ts`

```typescript
export const JOB_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  'specify': 'Specification generation',
  'plan': 'Planning',
  'implement': 'Implementation',
  'quick-impl': 'Quick implementation',
  'comment-specify': 'Specification assistance',
  'comment-plan': 'Planning assistance',
  'comment-build': 'Implementation assistance',
  'comment-verify': 'Verification assistance',
} as const;

export function getJobDisplayName(command: string): string {
  if (command in JOB_COMMAND_DISPLAY_NAMES) {
    return JOB_COMMAND_DISPLAY_NAMES[command as keyof typeof JOB_COMMAND_DISPLAY_NAMES];
  }

  if (command.startsWith('comment-')) {
    const stageSuffix = command.substring('comment-'.length);
    const stageCapitalized = stageSuffix.charAt(0).toUpperCase() + stageSuffix.slice(1);
    return `${stageCapitalized} assistance`;
  }

  return `Unknown command (${command})`;
}
```

**Test**: `tests/unit/job-display-names.test.ts` (all mappings, fallbacks)

---

#### Step 1.3: Create Event Merging Logic

**File**: `lib/utils/conversation-events.ts`

```typescript
import type { CommentWithUser } from '@/lib/types/comment';
import type { Job } from '@prisma/client';
import type { CommentEvent, JobEvent, ConversationEvent } from '@/lib/types/conversation-event';

export function createCommentEvent(comment: CommentWithUser): CommentEvent {
  return {
    type: 'comment',
    timestamp: comment.createdAt,
    data: comment,
  };
}

export function createJobEvents(job: Job): JobEvent[] {
  const events: JobEvent[] = [];

  events.push({
    type: 'job',
    timestamp: job.startedAt.toISOString(),
    data: job,
    eventType: 'start',
  });

  if (job.completedAt) {
    events.push({
      type: 'job',
      timestamp: job.completedAt.toISOString(),
      data: job,
      eventType: 'complete',
    });
  }

  return events;
}

export function mergeConversationEvents(
  comments: CommentWithUser[],
  jobs: Job[]
): ConversationEvent[] {
  const commentEvents = comments.map(createCommentEvent);
  const jobEvents = jobs.flatMap(createJobEvents);

  const allEvents = [...commentEvents, ...jobEvents];

  return allEvents.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
```

**Test**: `tests/unit/conversation-events.test.ts` (merging, sorting, edge cases)

---

### Phase 2: API Endpoint (1 hour)

**Goal**: Create API route to fetch conversation timeline

#### Step 2.1: Create Timeline API Route

**File**: `app/api/projects/[projectId]/tickets/[ticketId]/timeline/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { mergeConversationEvents } from '@/lib/utils/conversation-events';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = parseInt(params.projectId);
    const ticketId = parseInt(params.ticketId);

    // Validate project ownership
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate ticket exists and belongs to project
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { projectId: true },
    });

    if (!ticket || ticket.projectId !== projectId) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Fetch comments
    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    // Fetch jobs (exclude VERIFY and SHIP stages - out of scope)
    const jobs = await prisma.job.findMany({
      where: {
        ticketId,
        command: { notIn: ['verify', 'ship'] }, // Exclude future stages
      },
      orderBy: { startedAt: 'asc' },
    });

    // Merge and sort events
    const timeline = mergeConversationEvents(comments, jobs);

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('[Timeline API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'DATABASE_ERROR' },
      { status: 500 }
    );
  }
}
```

**Test**: `tests/api/timeline.spec.ts` (Playwright contract tests - search for existing API tests first!)

---

### Phase 3: React Components (4 hours)

**Goal**: Create timeline UI components

#### Step 3.1: Create TanStack Query Hook

**File**: `lib/hooks/queries/useConversationTimeline.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import type { ConversationEvent } from '@/lib/types/conversation-event';

interface TimelineResponse {
  timeline: ConversationEvent[];
}

async function fetchConversationTimeline(
  projectId: number,
  ticketId: number
): Promise<TimelineResponse> {
  const response = await fetch(
    `/api/projects/${projectId}/tickets/${ticketId}/timeline`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch timeline');
  }

  return response.json();
}

export function useConversationTimeline(projectId: number, ticketId: number) {
  return useQuery({
    queryKey: ['timeline', projectId, ticketId],
    queryFn: () => fetchConversationTimeline(projectId, ticketId),
    staleTime: 10000, // 10 seconds
    refetchInterval: 10000, // Auto-refetch every 10 seconds
    refetchOnWindowFocus: true,
  });
}
```

**Integration**: Use existing query key patterns from `lib/query-keys.ts`

---

#### Step 3.2: Create Timeline Layout Components

**File**: `components/timeline/timeline.tsx`

```typescript
import { cn } from '@/lib/utils';

interface TimelineProps {
  children: React.ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <ol
      className={cn('relative pl-10 space-y-4', className)}
      aria-label="Timeline of ticket activity"
    >
      {/* Vertical connector line */}
      <div
        className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface0"
        aria-hidden="true"
      />
      {children}
    </ol>
  );
}
```

**File**: `components/timeline/timeline-badge.tsx`

```typescript
import { cn } from '@/lib/utils';

interface TimelineBadgeProps {
  variant?: 'avatar' | 'event';
  children: React.ReactNode;
}

export function TimelineBadge({ variant = 'avatar', children }: TimelineBadgeProps) {
  return (
    <div
      className={cn(
        '-ml-14 flex-shrink-0',
        variant === 'event' &&
          'w-8 h-8 rounded-full bg-surface0 border-2 border-base flex items-center justify-center'
      )}
    >
      {children}
    </div>
  );
}
```

**File**: `components/timeline/timeline-content.tsx`

```typescript
export function TimelineContent({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-w-0">{children}</div>;
}
```

---

#### Step 3.3: Create Event Components

**File**: `components/timeline/comment-timeline-item.tsx`

```typescript
import { Avatar } from '@/components/ui/avatar';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import type { CommentWithUser } from '@/lib/types/comment';

interface CommentTimelineItemProps {
  comment: CommentWithUser;
  timestamp: string;
}

export const CommentTimelineItem = React.memo(
  ({ comment, timestamp }: CommentTimelineItemProps) => {
    return (
      <li className="relative flex gap-4">
        <TimelineBadge variant="avatar">
          <Avatar user={comment.user} size="md" />
        </TimelineBadge>
        <TimelineContent>
          {/* Reuse existing CommentBox component or create similar */}
          <div className="border border-surface0 rounded-lg bg-mantle p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-text">
                {comment.user.name || comment.user.email}
              </span>
              <time className="text-xs text-subtext0" dateTime={timestamp}>
                {formatRelativeTime(timestamp)}
              </time>
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              {comment.content}
            </div>
          </div>
        </TimelineContent>
      </li>
    );
  }
);
```

**File**: `components/timeline/job-event-timeline-item.tsx`

```typescript
import { PlayCircle, CheckCircle, XCircle, Ban } from 'lucide-react';
import { TimelineBadge } from './timeline-badge';
import { TimelineContent } from './timeline-content';
import { getJobDisplayName } from '@/lib/utils/job-display-names';
import type { Job, JobStatus } from '@prisma/client';

interface JobEventTimelineItemProps {
  job: Job;
  eventType: 'start' | 'complete';
  timestamp: string;
}

function JobEventIcon({ eventType, status }: { eventType: string; status: JobStatus }) {
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
      return <PlayCircle className="w-4 h-4 text-blue" />;
  }
}

export const JobEventTimelineItem = React.memo(
  ({ job, eventType, timestamp }: JobEventTimelineItemProps) => {
    const displayName = getJobDisplayName(job.command);
    const quickIndicator =
      job.workflowType === 'QUICK' && job.command === 'quick-impl' ? ' ⚡' : '';

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
      <li className="relative flex gap-4 items-center">
        <TimelineBadge variant="event">
          <JobEventIcon eventType={eventType} status={job.status} />
        </TimelineBadge>
        <TimelineContent>
          <span className="text-sm text-subtext0">
            {message}
            <time className="ml-2 text-xs text-subtext1" dateTime={timestamp}>
              {formatRelativeTime(timestamp)}
            </time>
          </span>
        </TimelineContent>
      </li>
    );
  }
);
```

---

#### Step 3.4: Create Timeline Item Dispatcher

**File**: `components/timeline/timeline-item.tsx`

```typescript
import type { ConversationEvent } from '@/lib/types/conversation-event';
import { CommentTimelineItem } from './comment-timeline-item';
import { JobEventTimelineItem } from './job-event-timeline-item';

interface TimelineItemProps {
  event: ConversationEvent;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}

export function TimelineItem({ event }: TimelineItemProps) {
  switch (event.type) {
    case 'comment':
      return <CommentTimelineItem comment={event.data} timestamp={event.timestamp} />;
    case 'job':
      return (
        <JobEventTimelineItem
          job={event.data}
          eventType={event.eventType}
          timestamp={event.timestamp}
        />
      );
    default:
      return assertNever(event);
  }
}
```

---

#### Step 3.5: Create Container Component

**File**: `components/ticket/conversation-timeline.tsx`

```typescript
import { useConversationTimeline } from '@/lib/hooks/queries/useConversationTimeline';
import { Timeline } from '@/components/timeline/timeline';
import { TimelineItem } from '@/components/timeline/timeline-item';

interface ConversationTimelineProps {
  ticketId: number;
  projectId: number;
}

function getEventKey(event: ConversationEvent): string {
  if (event.type === 'comment') {
    return `comment-${event.data.id}`;
  } else {
    return `job-${event.data.id}-${event.eventType}`;
  }
}

export function ConversationTimeline({ ticketId, projectId }: ConversationTimelineProps) {
  const { data, isLoading, error } = useConversationTimeline(projectId, ticketId);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <div className="text-sm text-red">
        Failed to load conversation timeline
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="text-sm text-subtext0 text-center py-8">
        No activity yet
      </div>
    );
  }

  return (
    <Timeline>
      {data.timeline.map((event) => (
        <TimelineItem key={getEventKey(event)} event={event} />
      ))}
    </Timeline>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-surface0" />
          <div className="flex-1 h-16 bg-surface0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
```

---

### Phase 4: Integration (1 hour)

**Goal**: Integrate timeline into ticket detail modal

#### Step 4.1: Update Ticket Detail Modal

**File**: `components/board/ticket-detail-modal.tsx` (or similar)

**Changes**:
1. Replace existing comment list with `ConversationTimeline` component
2. Update tab structure if needed (keep "Comments" tab, now shows timeline)
3. Ensure TanStack Query invalidation triggers work (comment creation, job status updates)

```typescript
// In ticket detail modal
<Tabs defaultValue="details">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="conversation">Conversation</TabsTrigger>
    <TabsTrigger value="files">Files</TabsTrigger>
  </TabsList>

  <TabsContent value="conversation">
    <ConversationTimeline ticketId={ticket.id} projectId={ticket.projectId} />
  </TabsContent>
</Tabs>
```

**TanStack Query Invalidation** (after comment creation):
```typescript
// In comment mutation onSuccess handler
queryClient.invalidateQueries(['timeline', projectId, ticketId]);
```

---

### Phase 5: Testing (2 hours)

**Goal**: Write comprehensive tests for all layers

#### Step 5.1: Search for Existing Tests

**IMPORTANT**: Before creating any test files, search for existing tests:

```bash
# Search for timeline tests
npx grep -r "timeline" tests/

# Search for comment tests
npx grep -r "conversation" tests/

# Search for API tests
npx glob "tests/api/**/*.spec.ts"
```

**Update existing test files** if found, **only create new files** if genuinely needed.

---

#### Step 5.2: Unit Tests (Vitest)

**File**: `tests/unit/conversation-events.test.ts` (or extend existing file)

```typescript
import { describe, it, expect } from 'vitest';
import { mergeConversationEvents, createJobEvents } from '@/lib/utils/conversation-events';

describe('mergeConversationEvents', () => {
  it('merges and sorts comments + jobs chronologically', () => {
    // ... test implementation
  });

  it('handles empty comments array', () => {
    // ... test implementation
  });

  it('handles empty jobs array', () => {
    // ... test implementation
  });

  it('generates start event for all jobs', () => {
    // ... test implementation
  });

  it('generates completion event only when completedAt is not null', () => {
    // ... test implementation
  });
});
```

**File**: `tests/unit/job-display-names.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getJobDisplayName } from '@/lib/utils/job-display-names';

describe('getJobDisplayName', () => {
  it('maps workflow commands correctly', () => {
    expect(getJobDisplayName('specify')).toBe('Specification generation');
    // ... more assertions
  });

  it('handles unmapped commands with fallback', () => {
    expect(getJobDisplayName('unknown-cmd')).toBe('Unknown command (unknown-cmd)');
  });
});
```

**Run Tests**: `bun run test:unit`

---

#### Step 5.3: Integration Tests (Playwright)

**File**: `tests/integration/timeline/conversation-timeline.spec.ts` (or extend existing)

```typescript
import { test, expect } from '@playwright/test';
import { cleanupDatabase } from '@/tests/helpers/db-cleanup';
import { prisma } from '@/lib/db';

test.beforeEach(async () => {
  await cleanupDatabase();

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@e2e.local' },
    update: {},
    create: {
      email: 'test@e2e.local',
      name: 'E2E Test User',
    },
  });

  // Create test project
  await prisma.project.upsert({
    where: { id: 1 },
    update: { userId: testUser.id },
    create: {
      id: 1,
      name: '[e2e] Test Project',
      userId: testUser.id,
      // ... other fields
    },
  });

  // Create test ticket with comments and jobs
  // ... test data setup
});

test('displays comments in chronological order', async ({ page }) => {
  // ... test implementation
});

test('displays job events with correct icons and messages', async ({ page }) => {
  // ... test implementation
});

test('shows quick workflow indicator for quick-impl jobs', async ({ page }) => {
  // ... test implementation
});
```

**Run Tests**: `bun run test:e2e`

---

## Verification Checklist

After implementation, verify:

### Functional Requirements
- [ ] Timeline displays comments and job events chronologically
- [ ] Job start events appear for all jobs (PENDING/RUNNING)
- [ ] Job completion events appear for finished jobs (COMPLETED/FAILED/CANCELLED)
- [ ] Job command names mapped to user-friendly display names
- [ ] Quick workflow indicator (⚡) appears on quick-impl jobs
- [ ] VERIFY and SHIP stage jobs excluded from timeline
- [ ] Timeline auto-updates when new comment added
- [ ] Timeline auto-updates when job status changes

### Visual/UX
- [ ] Vertical timeline with connector line visible
- [ ] Comments use bordered boxes with avatars
- [ ] Job events use small icons with minimal styling
- [ ] Icons match event type (PlayCircle, CheckCircle, XCircle, etc.)
- [ ] Timestamps display in relative format ("2 hours ago")
- [ ] Empty state shows "No activity yet" message
- [ ] Loading state shows skeleton loader

### Performance
- [ ] Timeline loads in <2 seconds for 50+ items
- [ ] API response time <100ms
- [ ] No unnecessary re-renders (React.memo working)
- [ ] TanStack Query caching effective (10-second stale time)

### Accessibility
- [ ] Timeline uses semantic `<ol>` element
- [ ] Timeline has `aria-label="Timeline of ticket activity"`
- [ ] Icons have appropriate `aria-label` attributes
- [ ] Timestamps use `<time>` element with `dateTime` attribute
- [ ] Keyboard navigation works (tab through items)

### Testing
- [ ] All unit tests pass (`bun run test:unit`)
- [ ] All integration tests pass (`bun run test:e2e`)
- [ ] Edge cases covered (empty timeline, rapid updates, legacy commands)

---

## Troubleshooting

### Issue: Timeline not updating when comment added
**Solution**: Check TanStack Query invalidation in comment mutation `onSuccess` handler

### Issue: Job events not appearing
**Solution**: Verify `createJobEvents()` generates events correctly; check API excludes VERIFY/SHIP

### Issue: Visual styling doesn't match GitHub
**Solution**: Review research.md styling patterns; adjust TailwindCSS classes

### Issue: Performance slow for 50+ items
**Solution**: Verify React.memo on event components; check useMemo for sorting

---

## Next Steps

After completing this feature:

1. **Merge Pull Request**: Create PR from feature branch to main
2. **Deploy to Production**: Vercel auto-deploys on merge
3. **Monitor Performance**: Check API response times in production
4. **Gather Feedback**: User testing for visual/UX improvements
5. **Plan Phase 3 Enhancements**: Condensed mode, date separators, animations

---

## Resources

- **Design Decisions**: `specs/065-915-conversations-je/research.md`
- **Data Model**: `specs/065-915-conversations-je/data-model.md`
- **API Contract**: `specs/065-915-conversations-je/contracts/conversation-api.yaml`
- **Component Contract**: `specs/065-915-conversations-je/contracts/component-contracts.md`
- **GitHub Primer Timeline**: https://primer.style/components/timeline-item/
- **lucide-react Icons**: https://lucide.dev/icons/

---

**Total Estimated Time**: 10 hours
- Phase 1 (Types & Utils): 2 hours
- Phase 2 (API): 1 hour
- Phase 3 (Components): 4 hours
- Phase 4 (Integration): 1 hour
- Phase 5 (Testing): 2 hours
