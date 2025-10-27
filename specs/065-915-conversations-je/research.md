# Research: GitHub-Style Ticket Conversations

**Feature**: 065-915-conversations-je
**Date**: 2025-10-27

## Research Areas

This document consolidates research findings to resolve "NEEDS CLARIFICATION" items from the Technical Context and inform the design phase.

---

## 1. GitHub Conversation UI Patterns

### Decision
Adopt GitHub's vertical timeline component pattern with the following characteristics:
- Vertical layout with left-aligned badges/avatars connected by continuous vertical line
- Two-tier visual hierarchy: prominent bordered boxes for user comments, minimal badges for system events
- Icon-based event identification using lucide-react icons in circular badges
- Consistent 16px spacing between items, condensed 8px mode for consecutive system events

### Rationale
- **Cognitive Load Reduction**: Vertical scanning follows natural chronological flow; clear visual separation between comment types
- **Responsive Design**: Single-column layout works equally well on mobile and desktop
- **Information Density**: Condensed system events reduce visual clutter while prominent comment boxes emphasize user content
- **Accessibility**: Timeline semantics support screen readers; icon labels provide context

### Implementation Notes

**Component Structure**:
```tsx
<Timeline>
  <TimelineItem type="comment">
    <TimelineBadge><Avatar /></TimelineBadge>
    <TimelineContent><CommentBox /></TimelineContent>
  </TimelineItem>

  <TimelineItem type="event">
    <TimelineBadge variant="event"><Icon /></TimelineBadge>
    <TimelineContent><EventText /></TimelineContent>
  </TimelineItem>
</Timeline>
```

**Styling with TailwindCSS**:
- Timeline container: `relative pl-10 space-y-4`
- Vertical line connector: `absolute left-4 top-0 bottom-0 w-0.5 bg-surface0`
- Comment box: `border border-surface0 rounded-lg bg-mantle p-4 shadow-sm`
- Event badge: `w-8 h-8 rounded-full bg-surface0 border-2 border-base flex items-center justify-center`
- Icon colors: `text-green` (success), `text-blue` (info), `text-red` (error), `text-yellow` (warning)

**shadcn/ui Components to Leverage**:
- Avatar (already exists, 32px matches timeline badge size)
- Badge (for event type indicators)
- Card (for comment content wrapping)
- Separator (for date dividers)

**Icon Mapping (lucide-react)**:
- Comment created: `MessageCircle` (text-blue)
- Workflow started: `PlayCircle` (text-blue)
- Workflow completed: `CheckCircle` (text-green)
- Workflow failed: `XCircle` (text-red)
- AI-BOARD mention: `Zap` (text-peach)
- Branch created: `GitBranch` (text-blue)

**Phased Implementation**:
1. **Phase 1**: Timeline for existing comments (wrap CommentList in timeline structure) - 2-4 hours
2. **Phase 2**: Add job lifecycle events with icons - 4-8 hours
3. **Phase 3**: Enhancements (condensed mode, animations) - 2-4 hours

### Alternatives Considered
- **Horizontal Timeline**: Rejected - poor mobile experience, limited content width
- **Flat List**: Rejected - lacks visual hierarchy and chronological context
- **Slack-Style Threading**: Rejected - too complex for linear ticket comments

---

## 2. Data Merging and Sorting Patterns

### Decision
Use discriminated union types with client-side merge and sort:
1. **Database Queries**: Fetch Comments and Jobs separately (2 queries) instead of JOIN
2. **TypeScript Types**: Discriminated union with `type` field as discriminator
3. **Merging**: Client-side array concatenation using spread operator for <100 items
4. **Sorting**: Single JavaScript sort by timestamp (chronological order)
5. **Rendering**: Type narrowing with switch statement for conditional rendering

### Rationale

**Separate Queries vs JOIN**:
- Comments and Jobs have no direct relationship (both relate to Ticket independently)
- JOINs would cause data duplication and complex query structure
- For 50 items total: separate queries are faster (~20-30ms vs 50-100ms for JOIN)
- Existing codebase already uses this pattern (job-queries.ts, comment API)
- Each query already has appropriate indexes (ticketId, createdAt/startedAt)

**Discriminated Union**:
- TypeScript best practice for heterogeneous data (2024)
- Enables type-safe conditional rendering with exhaustive checking
- Provides compile-time safety and IDE autocomplete
- Codebase already uses this pattern (job-types.ts)

**Spread Operator for Merging**:
- 50% faster than concat() for arrays <100 items
- Better ergonomics and readability
- Performance difference negligible for <100 items (~0.01ms)

**React Rendering**:
- Switch statement with exhaustive checking prevents runtime errors
- Type narrowing enables different components per event type
- React.memo pattern already used in codebase (stage-column.tsx)

### Code Pattern

```typescript
// ConversationEvent union type
interface BaseConversationEvent {
  type: 'comment' | 'job';
  timestamp: string; // ISO 8601
}

export interface CommentEvent extends BaseConversationEvent {
  type: 'comment';
  timestamp: string; // comment.createdAt
  data: CommentWithUser;
}

export interface JobEvent extends BaseConversationEvent {
  type: 'job';
  timestamp: string; // job.startedAt
  data: Job;
}

export type ConversationEvent = CommentEvent | JobEvent;

// Merge and sort function
export function mergeConversationEvents(
  comments: CommentWithUser[],
  jobs: Job[]
): ConversationEvent[] {
  const commentEvents = comments.map(c => ({
    type: 'comment' as const,
    timestamp: c.createdAt,
    data: c,
  }));

  const jobEvents = jobs.map(j => ({
    type: 'job' as const,
    timestamp: j.startedAt.toISOString(),
    data: j,
  }));

  return [...commentEvents, ...jobEvents].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// React rendering with type narrowing
export function ConversationTimeline({ events }: { events: ConversationEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event) => {
        switch (event.type) {
          case 'comment':
            return <CommentItem key={`comment-${event.data.id}`} comment={event.data} />;
          case 'job':
            return <JobEventItem key={`job-${event.data.id}`} job={event.data} />;
          default:
            return assertNever(event); // Compile-time exhaustiveness check
        }
      })}
    </div>
  );
}
```

### Performance Notes (50 items)
- Initial merge + sort: <2ms
- Re-render on new event: <5ms (only new item renders with React.memo)
- Memory: ~25KB (negligible)
- User perception: Instant (<16ms = 60fps)

**Optimization**:
```typescript
const events = useMemo(
  () => mergeConversationEvents(comments, jobs),
  [comments, jobs]
);
```

### Alternatives Considered
- **Database JOIN**: Rejected - adds complexity without performance benefit for <100 items
- **Array.concat()**: Rejected - slower for <100 items (use spread operator)
- **Single Event Table**: Rejected - requires migration, violates normalized design
- **Virtual Scrolling**: Rejected - premature optimization for 50 items

---

## 3. Job Command to User-Friendly Display Names

### Decision
Use explicit mapping table with pattern-based fallbacks:

```typescript
export const JOB_COMMAND_DISPLAY_NAMES: Record<string, string> = {
  // Normal workflow commands (FULL workflowType)
  'specify': 'Specification generation',
  'plan': 'Planning',
  'implement': 'Implementation',

  // Quick-impl workflow command (QUICK workflowType)
  'quick-impl': 'Quick implementation',

  // AI-BOARD assistance commands (comment-* pattern)
  'comment-specify': 'Specification assistance',
  'comment-plan': 'Planning assistance',
  'comment-build': 'Implementation assistance',
  'comment-verify': 'Verification assistance',
} as const;

export function getJobDisplayName(command: string): string {
  // Direct mapping lookup
  if (command in JOB_COMMAND_DISPLAY_NAMES) {
    return JOB_COMMAND_DISPLAY_NAMES[command as keyof typeof JOB_COMMAND_DISPLAY_NAMES];
  }

  // Pattern-based fallback for unmapped comment-* commands
  if (command.startsWith('comment-')) {
    const stageSuffix = command.substring('comment-'.length);
    const stageCapitalized = stageSuffix.charAt(0).toUpperCase() + stageSuffix.slice(1).toLowerCase();
    return `${stageCapitalized} assistance`;
  }

  // Unknown commands: Return descriptive fallback
  return `Unknown command (${command})`;
}
```

### Rationale

**User-Friendly Language**:
- Display names describe what the job is doing (output/purpose) rather than internal command names
- "specify" → "Specification generation" (describes output)
- "plan" → "Planning" (clear action)
- "implement" → "Implementation" (what's being produced)

**Consistency with Existing Code**:
- CLAUDE.md already refers to these terms in workflow descriptions
- Job status indicators use contextual labels (WRITING, CODING)
- UI already differentiates workflow jobs from AI-BOARD jobs

**AI-BOARD Commands**:
- Pattern: `{Stage} assistance` (e.g., "Specification assistance")
- Clearly indicates AI helping (word "assistance")
- Maps to the stage where help is provided
- Differentiates from main workflow job for that stage

### Edge Cases

**Unmapped Commands**: Return descriptive fallback
```typescript
getJobDisplayName('new-command') // → "Unknown command (new-command)"
```

**Legacy Commands**: Add to mapping table
```typescript
clarify: 'Clarification (legacy)',
tasks: 'Task generation (legacy)',
```

**Future Commands**: Pattern-based fallback handles comment-* automatically
```typescript
getJobDisplayName('comment-ship') // → "Ship assistance"
```

**Empty/Invalid Commands**: Defensive handling
```typescript
if (!command || command.trim() === '') {
  return 'Unknown job type';
}
```

### Workflow Type Integration

Add visual indicator for quick-impl jobs:
```typescript
export function getJobDisplayNameWithIndicator(
  command: string,
  workflowType: 'FULL' | 'QUICK'
): string {
  const baseName = getJobDisplayName(command);

  // Add lightning bolt indicator for quick-impl
  if (command === 'quick-impl' && workflowType === 'QUICK') {
    return `${baseName} ⚡`;
  }

  return baseName;
}
```

### Implementation Location
- File: `lib/utils/job-display-names.ts`
- Unit tests: `tests/unit/job-display-names.test.ts`

### Alternatives Considered
- **Hardcoded strings in components**: Rejected - not maintainable
- **Database enum mapping**: Rejected - over-engineered for display logic
- **i18n translation keys**: Rejected - not needed for English-only app currently

---

## Summary

All "NEEDS CLARIFICATION" items from Technical Context have been resolved:

1. ✅ **UI Patterns**: Adopt GitHub's vertical timeline with two-tier visual hierarchy
2. ✅ **Data Merging**: Use discriminated unions with client-side merge/sort (2 separate queries)
3. ✅ **Display Names**: Explicit mapping table with pattern-based fallbacks for job commands
4. ✅ **Performance**: Optimizations identified for 50+ item lists (React.memo, useMemo)

**Next Steps**: Proceed to Phase 1 (Design & Contracts) to generate data-model.md and API contracts.
